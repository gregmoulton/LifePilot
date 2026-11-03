'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Devices = require('../dist/devices.js');

test('Bluetooth GATT hang times out instead of freezing Connecting', async () => {
  let disconnected=false;
  const device={
    addEventListener(){},removeEventListener(){},
    gatt:{connected:true,disconnect(){disconnected=true;this.connected=false},connect(){return new Promise(()=>{})}}
  };
  const states=[];
  const m = new Devices.Monitor({bluetooth:{async requestDevice(){return device}},timeoutMs:15,onReading(){},onState:s=>states.push(s)});
  await assert.rejects(m.connect(),/Bluetooth connection timed out/);
  assert.equal(m.device,null);
  assert.equal(disconnected,true);
  assert.match(states.join(' | '),/Connecting to selected monitor/);
});

test('successful selected device does not count as live BPM before a real notification', async () => {
  let changed;
  const characteristic={addEventListener(event,fn){if(event==='characteristicvaluechanged')changed=fn},removeEventListener(){},async startNotifications(){}};
  const device={addEventListener(){},removeEventListener(){},gatt:{connected:true,disconnect(){this.connected=false},async connect(){return {getPrimaryService:async()=>({getCharacteristic:async()=>characteristic})}}}};
  const m=new Devices.Monitor({bluetooth:{async requestDevice(){return device}},onReading(){},onState(){}});
  await m.connect();
  assert.equal(m.fresh(),null,'pairing alone must not be treated as readiness');
  changed({target:{value:new DataView(Uint8Array.from([0,112]).buffer)}});
  assert.equal(m.fresh().bpm,112);
  m.disconnect();
  assert.equal(m.fresh(),null);
});

test('preworkout screen and consent dialog expose the required choices',()=>{
  const html=fs.readFileSync('dist/index.html','utf8');
  const app=fs.readFileSync('dist/app.js','utf8');
  for(const id of ['overviewConnectHr','overviewBpm','preflightHrm','hrmStartDialog','hrmRetry','hrmContinue','hrmCancel'])assert.match(html,new RegExp('id="'+id+'"'));
  assert(html.indexOf('id="overviewConnectHr"')<html.indexOf('id="start"'),'HRM check comes before workout start');
  assert.match(app,/monitorReading\(\)/);
  assert.match(app,/hrmDialog\.showModal/);
  assert.match(app,/hrmContinue/);
  assert.match(app,/started-without-hr-confirmed/);
});
