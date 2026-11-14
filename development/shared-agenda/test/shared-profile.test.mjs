import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {profileForOwner} from '../lib/shared-profile.mjs';import {validProfile} from '../lib/profile-validator.js';
const valid=validProfile,sharedProfile=(r,db,v)=>profileForOwner(r,db,v,'owner'),p={goals:[],unknown:{keep:true},execution:{tasks:[{id:'a',name:'Fictional',custom:7}]}};
function setup(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_friendly_hannibal_king.sql',import.meta.url),'utf8'));const db={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async run(){return {meta:sql.prepare(query).run(...args)};}};}};}};return {db,sql};}
function req(method='GET',body,headers={}){return new Request('https://pilot.test/api/profile',{method,headers:{origin:'https://pilot.test','content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
test('storage refuses without a verified owner id and ignores identity headers',async()=>{const {db,sql}=setup();for(const id of [undefined,'',null,7])for(const method of ['GET','PUT'])assert.equal((await profileForOwner(req(method,method==='PUT'?{revision:0,profile:p}:undefined),db,valid,id)).status,401);assert.equal(sql.prepare('SELECT COUNT(*) n FROM shared_profiles').get().n,0);assert.equal((await profileForOwner(req('PUT',{revision:0,profile:p},{'oai-authenticated-user-id':'forged'}),db,valid,'owner')).status,200);assert.deepEqual(sql.prepare('SELECT owner_id FROM shared_profiles').all().map(r=>r.owner_id),['owner']);});
test('create, restart read and CAS update retain complete unknown data and previous copy',async()=>{const {db,sql}=setup();assert.deepEqual(await (await sharedProfile(req(),db,valid)).json(),{revision:0,profile:null});assert.equal((await sharedProfile(req('PUT',{revision:0,profile:p}),db,valid)).status,200);assert.deepEqual((await (await sharedProfile(req(),db,valid)).json()).profile,p);const next={...p,extra:'new'};assert.equal((await sharedProfile(req('PUT',{revision:1,profile:next}),db,valid)).status,200);assert.deepEqual(JSON.parse(sql.prepare('SELECT previous_payload FROM shared_profiles').get().previous_payload),p);assert.equal((await (await sharedProfile(req(),db,valid)).json()).revision,2);});
test('two stale devices cannot overwrite winning write or its backup',async()=>{const {db,sql}=setup();await sharedProfile(req('PUT',{revision:0,profile:p}),db,valid);const writes=await Promise.all([sharedProfile(req('PUT',{revision:1,profile:{...p,winner:'A'}}),db,valid),sharedProfile(req('PUT',{revision:1,profile:{...p,winner:'B'}}),db,valid)]);assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);const r=sql.prepare('SELECT * FROM shared_profiles').get();assert.equal(r.revision,2);assert.deepEqual(JSON.parse(r.previous_payload),p);});
test('duplicate initial creation, foreign origin, invalid profile and revision fail without change',async()=>{const {db}=setup();await sharedProfile(req('PUT',{revision:0,profile:p}),db,valid);for(const [body,headers,status] of [[{revision:0,profile:p},{},409],[{revision:1,profile:p},{origin:'https://evil.test'},403],[{revision:1,profile:{}},{},400],[{revision:-1,profile:p},{},400]])assert.equal((await sharedProfile(req('PUT',body,headers),db,valid)).status,status);assert.equal((await (await sharedProfile(req(),db,valid)).json()).revision,1);});
test('oversized and failed requests never claim cloud save',async()=>{const {db}=setup();assert.equal((await sharedProfile(req('PUT',{revision:0,profile:{goals:[],large:'x'.repeat(1048576)}}),db,valid)).status,413);assert.equal((await sharedProfile(req('PUT',{revision:0,profile:p}),null,valid)).status,503);assert.equal((await sharedProfile(req('PUT',{revision:0,profile:p}),{prepare(){throw Error('outage');}},valid)).status,503);assert.equal((await (await sharedProfile(req(),db,valid)).json()).revision,0);});

test('sandbox sync never modifies the owner real shared agenda',async()=>{const {db}=setup();await sharedProfile(req('PUT',{revision:0,profile:p}),db,valid);const q=req('PUT',{revision:0,profile:{goals:[],qa:true}});const sandbox=new Request(q.url+'?sandbox=1',q);assert.equal((await sharedProfile(sandbox,db,valid)).status,200);assert.deepEqual((await (await sharedProfile(req(),db,valid)).json()).profile,p);});

test('goal/program/milestone task links and context audit survive shared save, restart and backup',async()=>{const {db,sql}=setup(),linked={goals:[{id:'g',name:'Fictional goal'}],execution:{programs:[{id:'p',name:'Fictional program',goal_id:'g'}],milestones:[{id:'m',name:'Fictional milestone',goal_id:'g',program_id:'p'}],tasks:[{id:'t',name:'Fictional task',goal_id:'g',program_id:'p',milestone_id:'m',unknown:8}]},agenda:{version:1,events:[{type:'context_changed',task_id:'t',context:{goal_id:'g',program_id:'p',milestone_id:'m'}}],proposals:[],rejections:[]}};assert.equal((await sharedProfile(req('PUT',{revision:0,profile:linked}),db,valid)).status,200);assert.deepEqual((await (await sharedProfile(req(),db,valid)).json()).profile,linked);const changed=JSON.parse(JSON.stringify(linked));delete changed.execution.tasks[0].milestone_id;assert.equal((await sharedProfile(req('PUT',{revision:1,profile:changed}),db,valid)).status,200);assert.deepEqual(JSON.parse(sql.prepare('SELECT previous_payload FROM shared_profiles').get().previous_payload),linked)});

test('blank sync preserves the exact active row and backup until a current revision is explicitly replaced', async () => {
 const {db,sql}=setup();
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/fictional-legacy-v04.json',import.meta.url),'utf8'));
 const put=(revision,profile,intent)=>sharedProfile(req('PUT',{revision,profile,intent}),db,valid);
 const row=()=>sql.prepare('SELECT * FROM shared_profiles').get();
 assert.equal((await put(0,fixture)).status,200);
 assert.equal((await put(1,{...fixture,label:'Fictional edit'})).status,200);
 const before=row();
 for (const blank of [{goals:[]},{goals:[],decision_register:[],execution:{tasks:[]},label:'Empty draft'}]) {
  assert.equal((await put(2,blank)).status,409);
  assert.deepEqual(row(),before);
 }
 assert.equal((await put(2,{goals:[]},'restore')).status,400);
 assert.equal((await put(1,{goals:[]},'reviewed-replacement')).status,409);
 assert.deepEqual(row(),before);
 assert.equal((await put(2,{goals:[]},'reviewed-replacement')).status,200);
 assert.equal(row().revision,3);
 assert.equal(row().previous_payload,before.payload);
 assert.deepEqual(JSON.parse(row().payload),{goals:[]});
 assert.equal((await put(3,{goals:[],label:'Fictional empty profile edit'})).status,200);
});

test('task-only profiles are protected against an empty sync', async () => {
 const {db,sql}=setup();
 assert.equal((await sharedProfile(req('PUT',{revision:0,profile:p}),db,valid)).status,200);
 const before=sql.prepare('SELECT * FROM shared_profiles').get();
 assert.equal((await sharedProfile(req('PUT',{revision:1,profile:{goals:[]}}),db,valid)).status,409);
 assert.deepEqual(sql.prepare('SELECT * FROM shared_profiles').get(),before);
});
