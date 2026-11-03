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
  constructor({recognition,onText,onState,onError,clock=()=>Date.now(),schedule=globalThis.setTimeout,cancel=globalThis.clearTimeout}){Object.assign(this,{recognition,onText,onState,onError,clock,schedule,cancel});this.running=false;this.listening=false;this.needsGesture=false;this.seen=new Set();this.wanted=false;this.rapidEnds=0;this.restartTimer=null}
  start({gesture=false}={}){
   if(gesture){this.needsGesture=false;if(this.restartTimer!==null&&typeof this.cancel==='function')this.cancel(this.restartTimer);this.restartTimer=null;}
   if(this.needsGesture||this.restartTimer!==null)return;
   if(!this.wanted){this.enabledAt=this.clock();this.rapidEnds=0}this.wanted=true;if(this.running)return;
   if(!this.recognition){this.wanted=false;this.needsGesture=true;throw Error('Speech recognition is unavailable in this browser. Manual controls still work.')}
   const r=new this.recognition();this.r=r;this.running=true;this.listening=false;this.startedAt=this.clock();this.seen.clear();
   r.lang='en-US';r.continuous=true;r.interimResults=false;r.maxAlternatives=1;
   r.onstart=()=>{if(this.r===r&&this.running){this.listening=true;this.onState('Listening — say “twelve reps” or a workout command.')}};
   r.onresult=e=>{if(!this.running||this.r!==r)return;for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal||this.seen.has(i))continue;this.seen.add(i);this.rapidEnds=0;this.onText(e.results[i][0].transcript);if(this.r!==r||!this.running)break}};
   r.onerror=e=>{if(this.r!==r||!this.running)return;this.listening=false;if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){this.wanted=false;this.needsGesture=true;}if(e.error==='no-speech'){this.onState('Voice enabled — waiting for your rep command.');return}this.onError('Microphone: '+e.error+'. Manual controls remain available.')};
   r.onend=()=>{
    if(this.r!==r||!this.running)return;this.running=false;this.listening=false;
    this.rapidEnds=this.clock()-this.startedAt<1000?this.rapidEnds+1:0;
    if(this.wanted&&(this.rapidEnds<=12||this.clock()-this.enabledAt<10000)&&typeof this.schedule==='function'){
     this.onState('Voice enabled — reconnecting microphone…');
     // Normal short Chrome recognition sessions must not disable a hands-free workout.
     // Back off repeated immediate exits, but keep a finite circuit breaker for a broken service.
     const delay=this.rapidEnds<=3?500:Math.min(2500,500+(this.rapidEnds-3)*200);
     this.restartTimer=this.schedule(()=>{this.restartTimer=null;if(this.wanted&&!this.running&&this.r===r)try{this.start()}catch(e){this.onError(e.message)}},delay);
    }else{if(this.wanted)this.needsGesture=true;this.wanted=false;this.onState('Voice disconnected. Tap Enable voice to retry.');}
   };
   this.onState('Connecting voice…');
   try{r.start()}catch(e){this.running=false;this.listening=false;this.wanted=false;this.needsGesture=true;throw e}
  }
  stop(){this.wanted=false;if(this.restartTimer!==null&&typeof this.cancel==='function')this.cancel(this.restartTimer);this.restartTimer=null;this.running=false;this.listening=false;const r=this.r;this.r=null;if(r)try{r.abort()}catch{}this.onState('Microphone off.')}
 }
 class Monitor {
  constructor({bluetooth,onReading,onState,clock=()=>Date.now(),schedule=globalThis.setTimeout,cancel=globalThis.clearTimeout,timeoutMs=12000}) {
   Object.assign(this,{bluetooth,onReading,onState,clock,schedule,cancel,timeoutMs});
   this.device=null;this.characteristic=null;this.latest=null;this.attempt=0;this.readingTimer=null;
   this.listener=e=>{if(!this.device)return;try{const bpm=heartRate(e.target.value);this.latest={bpm,timestamp:this.clock()};if(this.readingTimer!==null){this.cancel(this.readingTimer);this.readingTimer=null}this.onReading(this.latest)}catch(error){this.latest=null;this.onState(error.message)}};
   this.disconnected=()=>{this.disconnect();this.onState('Monitor disconnected. Reconnect or use manual HR.')};
  }
  async stage(promise,label,attempt,timeout=this.timeoutMs){
   let timer=null;
   try {
    const result=await Promise.race([promise,new Promise((_,reject)=>{timer=this.schedule(()=>reject(Error(label+' timed out. Please retry.')),timeout)})]);
    if(attempt!==this.attempt)throw Error('Connection interrupted or superseded. Please retry.');
    return result;
   }finally{if(timer!==null)this.cancel(timer)}
  }
  async connect({broadScan=false,previouslyAllowed=false}={}){
   if(!this.bluetooth)throw Error('Bluetooth is unavailable here. Use Chrome on Android or manual HR.');
   this.disconnect();
   const attempt=this.attempt;
   this.onState(previouslyAllowed?'Checking devices previously authorized in Chrome…':broadScan?'Choose MOOFIT, then tap Pair/Connect in the Bluetooth popup.':'Choose your heart-rate monitor, then tap Pair/Connect in the popup.');
   // A wearable can expose the standard heart-rate GATT service without advertising
   // that UUID during discovery. Match the device's advertised name as well.
   const discovery=broadScan
    ?{acceptAllDevices:true,optionalServices:['heart_rate']}
    :{filters:[{services:['heart_rate']},{namePrefix:'MOOFIT'},{namePrefix:'Moofit'},{namePrefix:'moofit'}],optionalServices:['heart_rate']};
   let device;
   if(previouslyAllowed){
    if(typeof this.bluetooth.getDevices!=='function')throw Error('Chrome cannot access previously authorized devices here. Try the Bluetooth picker.');
    const allowed=await this.stage(this.bluetooth.getDevices(),'Saved Bluetooth permissions',attempt);
    const matches=allowed.filter(d=>/moofit|heart.?rate|^hrm(?:\b|\d)|^hr\d/i.test(d.name||''));
    if(matches.length!==1)throw Error(matches.length?'More than one previously authorized heart monitor. Use the Bluetooth picker.':'No previously authorized MOOFIT found for this website. Select it in the Bluetooth picker first.');
    device=matches[0];
   }else{
    // The chooser itself may never resolve after the user taps Pair.
    // This timeout provides a visible error and leaves no active connection.
    device=await this.stage(this.bluetooth.requestDevice(discovery),'Chrome Bluetooth device selection',attempt,45000);
   }
   if(attempt!==this.attempt)throw Error('Connection cancelled. Please retry.');
   this.device=device;device.addEventListener('gattserverdisconnected',this.disconnected);
   try{
    this.onState('Chrome returned '+(device.name||'your selected monitor')+'. Connecting to heart-rate service…');
    const server=await this.stage(device.gatt.connect(),'Bluetooth connection',attempt);
    this.onState('Finding heart-rate service…');
    const service=await this.stage(server.getPrimaryService('heart_rate'),'Heart-rate service',attempt);
    this.onState('Finding heart-rate readings…');
    const characteristic=await this.stage(service.getCharacteristic('heart_rate_measurement'),'Heart-rate characteristic',attempt);
    this.characteristic=characteristic;
    characteristic.addEventListener('characteristicvaluechanged',this.listener);
    this.onState('Subscribing to live BPM…');
    await this.stage(characteristic.startNotifications(),'Live heart-rate subscription',attempt);
    if(!this.fresh()){
     this.onState('Connected. Waiting for first live BPM reading…');
     this.readingTimer=this.schedule(()=>{
      this.readingTimer=null;
      if(attempt!==this.attempt||this.fresh())return;
      this.disconnect();
      this.onState('No live BPM received within '+Math.round(this.timeoutMs/1000)+' seconds. Check that MOOFIT is worn and transmitting, then retry.');
     },this.timeoutMs);
     this.readingTimer?.unref?.();
    }
   }catch(error){if(attempt===this.attempt)this.disconnect();throw error}
  }
  fresh(){return this.latest&&this.clock()-this.latest.timestamp<=15000&&this.clock()>=this.latest.timestamp?this.latest:null}
  disconnect(){
   this.attempt++;this.latest=null;
   if(this.readingTimer!==null){this.cancel(this.readingTimer);this.readingTimer=null}
   if(this.characteristic)this.characteristic.removeEventListener('characteristicvaluechanged',this.listener);
   this.characteristic=null;
   if(this.device){this.device.removeEventListener('gattserverdisconnected',this.disconnected);if(this.device.gatt?.connected)this.device.gatt.disconnect()}
   this.device=null;
  }
 }
 return {command,heartRate,Voice,Monitor};
})();
if(typeof module!=='undefined')module.exports=PureDevices;
