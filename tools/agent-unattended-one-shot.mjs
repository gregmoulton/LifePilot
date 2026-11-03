import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

export const REPO = 'gregmoulton/LifePilot';
export const TASK_NO = 80;
export const BASE_BRANCH = 'experiment/agent-unattended-proof-20261103';
export const TARGET_FILE = 'experiments/agent-proof/fixture/label.mjs';
export const TEST_FILE = 'experiments/agent-proof/fixture/label.test.mjs';
export const FREE_MODEL = 'cohere/north-mini-code:free';
export const EXPECTED_BEFORE = 'export const todayLabel = () => "Todo";\n';
export const REQUIRED_MARKER = '[agent-approved:synthetic-only:v1]';

export function validateTask(issue) {
  if (!issue || issue.number !== TASK_NO || issue.state !== 'open' ||
      issue.pull_request || !String(issue.body || '').includes(REQUIRED_MARKER) ||
      !String(issue.title || '').startsWith('[Agent proof]')) {
    throw Error('Task not allowlisted or not explicitly approved');
  }
  return {number:TASK_NO, target:TARGET_FILE};
}

export function validateLimit(payload) {
  const d=payload?.data;
  if (typeof d?.limit !== 'number' || d.limit < 0 || d.limit > 1 || d.limit_reset !== null)
    throw Error('Non-resetting $1 provider cap not verified');
  return true;
}

export function extractPatch(payload) {
  let text=payload?.choices?.[0]?.message?.content;
  if (Array.isArray(text)) text=text.filter(c=>c?.type==='text' && typeof c.text==='string').map(c=>c.text).join('\n');
  if (typeof text !== 'string' || text.length > 3000) throw Error('Model returned no usable source');
  let code=text.trim();
  const fence=String.fromCharCode(96).repeat(3);
  if (code.startsWith(fence)) {
    const lines=code.split('\n');
    if (!lines[0].startsWith(fence) || lines.at(-1).trim()!==fence) throw Error('Malformed fenced code');
    code=lines.slice(1,-1).join('\n').trim();
  }
  if (!/^export const todayLabel\s*=\s*\(\s*\)\s*=>\s*["']Today["'];?$/.test(code))
    throw Error('Model patch violates exact fictional output schema');
  return code.endsWith(';') ? code+'\n' : code+';\n';
}

export async function generatePatch(key, fetcher=globalThis.fetch) {
  const response=await fetcher('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',redirect:'error',
    headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:FREE_MODEL,stream:false,temperature:0,max_tokens:768,
      messages:[
        {role:'system',content:'You are editing a fictional JavaScript source file. Return one exact final line of JavaScript. No explanation, no extra code, no reasoning.'},
        {role:'user',content:'Change the string Todo to Today and return the full JavaScript line, preserving the export and function: '+EXPECTED_BEFORE.trim()}
      ]
    }),
    signal:AbortSignal.timeout(90000)
  });
  if(!response?.ok) throw Error('OpenRouter returned HTTP '+(response?.status||'unknown'));
  const data=await response.json();
  return {code:extractPatch(data),model:typeof data.model==='string'?data.model.slice(0,100):'unknown',tokens:Number.isSafeInteger(data.usage?.total_tokens)?data.usage.total_tokens:null};
}

async function githubApi(token,path,method='GET',data) {
  const res=await fetch('https://api.github.com/repos/'+REPO+path,{
    method,redirect:'error',
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
    body:data===undefined?undefined:JSON.stringify(data),
    signal:AbortSignal.timeout(20000)
  });
  if(!res.ok) throw Error('GitHub '+method+' '+path.split('?')[0]+' HTTP '+res.status);
  return res.json();
}

export async function main(){
  const e=process.env;
  assert.equal(e.GITHUB_REPOSITORY,REPO);
  assert.equal(e.GITHUB_REF,'refs/heads/'+BASE_BRANCH);
  assert.equal(e.LIFEPILOT_AGENT_APPROVED,'yes');
  if(!e.GITHUB_TOKEN || !e.OPENROUTER_API_KEY || !/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||'') || !/^\d+$/.test(e.GITHUB_RUN_ID||'')) throw Error('Missing required runner inputs');

  const issue=await githubApi(e.GITHUB_TOKEN,'/issues/'+TASK_NO);
  const approved=validateTask(issue);
  console.log('APPROVED_TASK='+approved.number+' TARGET='+approved.target);
  assert.equal(await readFile(TARGET_FILE,'utf8'),EXPECTED_BEFORE,'Synthetic source changed unexpectedly');

  const keyResponse=await fetch('https://openrouter.ai/api/v1/key',{
    headers: {Authorization:'Bearer '+e.OPENROUTER_API_KEY},
    redirect:'error',signal:AbortSignal.timeout(10000)
  });
  if(!keyResponse.ok) throw Error('Key metadata HTTP '+keyResponse.status);
  validateLimit(await keyResponse.json());
  console.log('KEY_CAP=VERIFIED_ONE_USD_LIFETIME');

  const generated=await generatePatch(e.OPENROUTER_API_KEY);
  await writeFile(TARGET_FILE,generated.code);
  console.log('AI_GENERATED_PATCH_MODEL='+generated.model+' TOKENS='+generated.tokens);
  console.log('PATCH_START');
  execFileSync('git',['diff','--',TARGET_FILE],{stdio:'inherit',timeout:10000});
  console.log('PATCH_END');

  execFileSync(process.execPath,['--test',TEST_FILE],{stdio:'inherit',timeout:30000});
  console.log('GENERATED_PATCH_TESTS=PASS');

  const outputBranch='agent-output/synthetic-label-run-'+e.GITHUB_RUN_ID;
  await githubApi(e.GITHUB_TOKEN,'/git/refs','POST',{ref:'refs/heads/'+outputBranch,sha:e.GITHUB_SHA});
  const old=await githubApi(e.GITHUB_TOKEN,'/contents/'+TARGET_FILE+'?ref='+encodeURIComponent(outputBranch));
  await githubApi(e.GITHUB_TOKEN,'/contents/'+TARGET_FILE,'PUT',{
    message:'AI agent: update fictional label under approved task #80',
    branch:outputBranch,sha:old.sha,
    content:Buffer.from(generated.code,'utf8').toString('base64')
  });
  console.log('OUTPUT_BRANCH='+outputBranch);

  const runURL='https://github.com/'+REPO+'/actions/runs/'+e.GITHUB_RUN_ID;
  const pr=await githubApi(e.GITHUB_TOKEN,'/pulls','POST',{
    head:outputBranch,base:BASE_BRANCH,draft:true,
    title:'Draft agent proof: generated and tested synthetic patch (#80)',
    body:'## Proof of unattended coding\\n\\nApproved issue: #80\\nWorkflow: '+runURL+'\\nAI free model: '+generated.model+'\\nFile: '+TARGET_FILE+'\\nTests: node --test '+TEST_FILE+' (passed).\\n\\nSynthetic-only, draft, no merge or deploy.'
  });
  if(!pr?.draft || !pr?.html_url) throw Error('Draft PR confirmation missing');
  console.log('DRAFT_PR='+pr.html_url);
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  main().catch(err=>{console.error('UNATTENDED_PROOF_FAILED: '+(err?.message||'unknown'));process.exitCode=1;});
}
