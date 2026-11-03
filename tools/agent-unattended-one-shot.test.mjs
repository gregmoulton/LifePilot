import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTask,validateLimit,extractPatch,generatePatch,FREE_MODEL} from './agent-unattended-one-shot.mjs';

const task={number:80,state:'open',title:'[Agent proof] Approved synthetic task',body:'[agent-approved:synthetic-only:v1]'};
const expected='export const todayLabel = () => "Today";\n';

test('requires issue #80, open state and exact approval marker',()=>{
 assert.equal(validateTask(task).number,80);
 for(const bad of [
 {...task,number:76},{...task,state:'closed'},{...task,body:'unapproved'},
 {...task,pull_request:{}},{...task,title:'another issue'},null
 ]) assert.throws(()=>validateTask(bad));
});
test('extracts exact safe model patch from plaintext, markdown fence and typed content',()=>{
 const fence=String.fromCharCode(96).repeat(3);
 for(const value of [
 expected,fence+'js\n'+expected+fence,
 [{type:'text',text:expected}]
 ]) assert.equal(extractPatch({choices:[{message:{content:value}}]}),expected);
});
test('rejects absent, reasoning-only and unapproved code alterations',()=>{
 for(const value of [undefined,null,'', 'export const todayLabel=()=> "Todo";',
 'export const todayLabel=()=> "Today"; process.exit(0);','console.log("Today");']) {
  assert.throws(()=>extractPatch({choices:[{message:{content:value,reasoning:'Today'}}]}));
 }
});
test('fails closed unless provider cap is non-resetting $1 total',()=>{
 assert.equal(validateLimit({data:{limit:1,limit_reset:null}}),true);
 for(const v of [{data:{limit:100,limit_reset:null}},{data:{limit:1,limit_reset:'daily'}},{data:{limit:null,limit_reset:null}},{},null]) assert.throws(()=>validateLimit(v));
});
test('one model request with free-only slug; no code execution or automatic retry',async()=>{
 let count=0;
 const output=await generatePatch('dummy-key',async (_url,options)=>{
   count++;
   const request=JSON.parse(options.body);
   assert.equal(request.model,FREE_MODEL);
   assert.ok(request.model.endsWith(':free'));
   assert.equal(request.stream,false);
   assert.ok(request.max_tokens<=768);
   return {ok:true,json:async()=>({model:FREE_MODEL,usage:{total_tokens:33},choices:[{message:{content:expected}}]})};
 });
 assert.equal(count,1);assert.equal(output.code,expected);assert.equal(output.tokens,33);
});
