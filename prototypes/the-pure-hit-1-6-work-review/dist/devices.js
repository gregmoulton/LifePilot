'use strict';
// No AI service or API key: explicit speech commands and standard Bluetooth HR.
const PureDevices=(()=>{
 const numbers={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
 function command(text){const s=text.toLowerCase().replace(/[.,!?]/g,'').replace(/-/g,' ').trim().replace(/\s+/g,' ');
  const actions={'confirm':'confirm','cancel':'cancel','pause':'pause','pause workout':'pause','resume':'resume','resume workout':'resume','continue recovery':'recover','end workout':'end','save workout':'save','finish and save':'save','finish and save workout':'save','discard workout':'discard','start workout':'start'};if(actions[s])return {type:actions[s]};
  const correction=s.match(/^correction (.+)$/);if(correction){const c=command(correction[1]);return c?.type==='reps'?{type:'correct',value:c.value}:null}
  const m=s.match(/^(?:record |log )?(\d{1,4}|[a-z ]+) reps?$/);if(!m)return null;const words=m[1].split(' ');let n;if(/^\d+$/.test(m[1]))n=+m[1];else if(words.length===1)n=numbers[words[0]];else if(words.length===2&&numbers[words[0]]>=20&&numbers[words[0]]%10===0&&numbers[words[1]]>0&&numbers[words[1]]<10)n=numbers[words[0]]+numbers[words[1]];return Number.isInteger(n)&&n<=9999?{type:'reps',value:n}:null;
 }
 function heartRate(value){if(!(value instanceof DataView)||value.byteLength<2)throw Error('Incomplete heart-rate packet');const flags=value.getUint8(0),wide=!!(flags&1);if(wide&&value.byteLength<3)throw Error('Incomplete 16-bit heart-rate packet');const bpm=wide?value.getUint16(1,true):value.getUint8(1);if(bpm<30||bpm>240)throw Error('Heart rate outside supported range');if((flags&4)&&!(flags&2))throw Error('Monitor reports no skin contact');return bpm}
 class Voice {
  constructor({recognition,onText,onState,onError,clock=()=>Date.now(),schedule=globalThis.setTimeout,cancel=globalThis.clearTimeout}){Object.assign(this,{recognition,onText,onState,onError,clock,schedule,cancel});this.running=false;this.seen=new Set();this.wanted=false;this.rapidEnds=0;this.restartTimer=null}
  start(){
   if(!this.wanted){this.enabledAt=this.clock();this.rapidEnds=0}this.wanted=true;if(this.running)return;
   if(!this.recognition){this.wanted=false;throw Error('Speech recognition is unavailable in this browser. Manual controls still work.')}
   const r=new this.recognition();this.r=r;this.running=true;this.startedAt=this.clock();this.seen.clear();
   r.lang='en-US';r.continuous=true;r.interimResults=false;r.maxAlternatives=1;
   r.onstart=()=>{if(this.r===r&&this.running)this.onState('Listening — say “twelve reps” or a workout command.')};
   r.onresult=e=>{if(!this.running||this.r!==r)return;for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal||this.seen.has(i))continue;this.seen.add(i);this.rapidEnds=0;this.onText(e.results[i][0].transcript);if(this.r!==r||!this.running)break}};
   r.onerror=e=>{if(this.r!==r||!this.running)return;if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error))this.wanted=false;if(e.error==='no-speech'){this.onState('Voice enabled — waiting for your rep command.');return}this.onError('Microphone: '+e.error+'. Manual controls remain available.')};
   r.onend=()=>{
    if(this.r!==r||!this.running)return;this.running=false;
    this.rapidEnds=this.clock()-this.startedAt<1000?this.rapidEnds+1:0;
    if(this.wanted&&(this.rapidEnds<=12||this.clock()-this.enabledAt<10000)&&typeof this.schedule==='function'){
     this.onState('Voice enabled — reconnecting microphone…');
     // Normal short Chrome recognition sessions must not disable a hands-free workout.
     // Back off repeated immediate exits, but keep a finite circuit breaker for a broken service.
     const delay=this.rapidEnds<=3?500:Math.min(2500,500+(this.rapidEnds-3)*200);
     this.restartTimer=this.schedule(()=>{this.restartTimer=null;if(this.wanted&&!this.running&&this.r===r)try{this.start()}catch(e){this.onError(e.message)}},delay);
    }else{this.wanted=false;this.onState('Microphone off. Tap Enable voice to resume.');}
   };
   try{r.start()}catch(e){this.running=false;this.wanted=false;throw e}
  }
  stop(){this.wanted=false;if(this.restartTimer!==null&&typeof this.cancel==='function')this.cancel(this.restartTimer);this.restartTimer=null;this.running=false;this.r?.abort();this.onState('Microphone off.')}
 }
 class Monitor {
  constructor({bluetooth,onReading,onState,clock=()=>Date.now()}){Object.assign(this,{bluetooth,onReading,onState,clock});this.device=null;this.characteristic=null;this.latest=null;this.listener=e=>{try{const bpm=heartRate(e.target.value);this.latest={bpm,timestamp:this.clock()};this.onReading(this.latest)}catch(e){this.latest=null;this.onState(e.message)}};this.disconnected=()=>{this.latest=null;this.onState('Monitor disconnected. Reconnect or use manual HR.')}}
  async connect(){if(!this.bluetooth)throw Error('Bluetooth is unavailable here. Use Chrome on Android or manual HR.');this.disconnect();const device=await this.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});this.device=device;device.addEventListener('gattserverdisconnected',this.disconnected);try{const server=await device.gatt.connect(),service=await server.getPrimaryService('heart_rate');this.characteristic=await service.getCharacteristic('heart_rate_measurement');this.characteristic.addEventListener('characteristicvaluechanged',this.listener);await this.characteristic.startNotifications();this.onState('Connected. Waiting for a heart-rate reading.')}catch(e){this.disconnect();throw e}}
  fresh(){return this.latest&&this.clock()-this.latest.timestamp<=15000&&this.clock()>=this.latest.timestamp?this.latest:null}
  disconnect(){this.latest=null;if(this.characteristic)this.characteristic.removeEventListener('characteristicvaluechanged',this.listener);this.characteristic=null;if(this.device){this.device.removeEventListener('gattserverdisconnected',this.disconnected);if(this.device.gatt.connected)this.device.gatt.disconnect()}this.device=null}
 }
 return {command,heartRate,Voice,Monitor};
})();
if(typeof module!=='undefined')module.exports=PureDevices;
