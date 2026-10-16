// node --test prime-workout/regression.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
function boot(initial=null){
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
  const elements=Object.fromEntries(ids.map(id=>[id,{value:id==='progress-exercise'?'All exercises':'',hidden:false,textContent:'',children:[],files:[],replaceChildren(){this.children=[]},append(...children){this.children.push(...children)},reset(){}}]));
  const records=initial===null?{}:{'prime-workout-mvp-v01':initial};
  const alerts=[];let fail=false,download,blobText='';
  const document={getElementById:id=>elements[id],createElement:tag=>({tag,children:[],append(...children){this.children.push(...children)},click(){download=this}})};
  const context={document,localStorage:{getItem:key=>records[key]??null,setItem(key,value){if(fail)throw Error('quota');records[key]=value}},alert:message=>alerts.push(message),confirm:()=>true,window:{scrollTo(){}},crypto:{randomUUID:()=> 'test-id'},Date,Blob:class{constructor(parts){blobText=parts.join('')}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:()=>{}};
  vm.runInNewContext(script,context);
  return {elements,records,alerts,setFailure(value){fail=value},getBackup(){return JSON.parse(blobText)},getDownload(){return download},getEntries(){return JSON.parse(records['prime-workout-mvp-v01']||'[]')}};
}
function save(app,reps='8'){const e=app.elements;e.date.value='2026-10-15';e.exercise.value='Inverted row';e.sets.value='3';e.reps.value=reps;e.effort.value='7';e.notes.value='neutral';e.form.onsubmit({preventDefault(){}})}
test('script parses and app boots',()=>{assert.ok(script);new vm.Script(script);assert.match(boot().elements.progress.textContent,/0 total reps/)});
test('save, edit and delete',()=>{const app=boot();save(app);assert.equal(app.getEntries()[0].reps,8);app.elements.history.children[0].children[1].onclick();assert.equal(Number(app.elements.reps.value),8);app.elements.reps.value='10';app.elements.form.onsubmit({preventDefault(){}});assert.equal(app.getEntries()[0].reps,10);app.elements.history.children[0].children[2].onclick();assert.equal(app.getEntries().length,0)});
test('export, restore, reject malformed backup',async()=>{const app=boot();save(app);app.elements.export.onclick();assert.equal(app.getDownload().download,'prime-workout-backup.json');const backup=app.getBackup();assert.equal(backup.schema,'prime-workout-v01');app.elements.history.children[0].children[2].onclick();app.elements.import.files=[{text:async()=>JSON.stringify(backup)}];await app.elements.import.onchange({target:app.elements.import});assert.equal(app.getEntries().length,1);app.elements.import.files=[{text:async()=>JSON.stringify({...backup,exercises:[{...backup.exercises[0],sets:-1}]})}];await app.elements.import.onchange({target:app.elements.import});assert.equal(app.getEntries().length,1);assert.ok(app.alerts.some(x=>x.includes('Invalid backup format')))});
test('failed save and delete preserve records',()=>{const app=boot();save(app);app.setFailure(true);save(app,'9');assert.equal(app.getEntries()[0].reps,8);app.elements.history.children[0].children[2].onclick();assert.equal(app.getEntries().length,1)});
test('corrupt storage disables saving',()=>{const app=boot('{broken');save(app);assert.equal(app.records['prime-workout-mvp-v01'],'{broken');assert.ok(app.alerts.some(x=>x.includes('Saving disabled')))});
test('small screen styles and accessible tap targets present',()=>{assert.match(html,/@media\(max-width:520px\)/);assert.match(html,/min-height:44px/)});
