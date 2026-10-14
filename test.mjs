import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const port=18787;
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,OPENAI_API_KEY:'',PORT:String(port)},stdio:'ignore'});
try{
 let up=false;for(let i=0;i<30;i++){try{const r=await fetch(`http://localhost:${port}/health`);if(r.ok){up=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
 assert(up,'Server did not start');
 const health=await (await fetch(`http://localhost:${port}/health`)).json();assert.equal(health.aiConfigured,false);
 const page=await fetch(`http://localhost:${port}/`);assert.equal(page.status,200);assert((await page.text()).includes('Ask AI'));
 const noKey=await fetch(`http://localhost:${port}/api/copilot`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:'add task call Rene',tasks:[]})});assert.equal(noKey.status,503);
 const origin=await fetch(`http://localhost:${port}/api/copilot`,{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'});assert.equal(origin.status,403);
 console.log('PASS: health, frontend delivery, missing-key refusal, origin refusal');
}finally{child.kill()}
