'use strict';
// Capture and constrained Vosk grammar from the owner-tested Nov 6 music lab.
const PureLocalVoiceEngine = (() => {
 const modelUrl='https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
 const units=['zero','one','two','three','four','five','six','seven','eight','nine'];
 const teens=['ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
 const tens=['twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
 const counts=[...units,...teens,...tens.flatMap(n=>[n,...units.slice(1).map(u=>n+' '+u)])];
 // Owner #115/#122: 'Push, 12 reps' / 'Correct Push, 11 reps' — exercise + number + 'reps', so ambient speech and a skipped
 // exercise can never become a count. Bare 'push done' is recognized only so the app can ask for the number.
 const cats=['push','squat','squats','pull'],small=counts.slice(0,61);
 const grammar=JSON.stringify([...counts.map(n=>n+' reps'),
  ...cats.flatMap(c=>small.flatMap(n=>[c+' '+n+' reps',c+' done '+n+' reps',c+' complete '+n+' reps','correct '+c+' '+n+' reps','correct '+c+' to '+n+' reps','change '+c+' to '+n+' reps'])),'hold','hold recovery',...cats.map(c=>c+' done'),...cats.map(c=>c+' complete'),
  'undo last entry','undo','read back my round','read back','[unk]']);
 class Voice {
  constructor({onState,onError,onText}){Object.assign(this,{onState,onError,onText});this.wanted=false;this.running=false;this.listening=false;this.attempts=0;}
  preload(){
   if(this.modelReady)return this.modelReady;
   this.modelReady=Promise.resolve().then(()=>new Promise((resolve,reject)=>{
    const model=new Vosk.Model(modelUrl,-2);
    const fail=error=>{clearTimeout(timer);model.terminate();reject(Error(error||'Voice model unavailable'));};
    const timer=setTimeout(()=>fail('Voice model download timed out'),90000);
    model.on('error',e=>fail(e.error));
    model.on('load',e=>{if(!e.result)return fail();clearTimeout(timer);resolve(model);});
   })).catch(e=>{this.modelReady=null;throw e;});
   return this.modelReady;
  }
  start({gesture=false}={}){
   if(this.running)return;
   if(gesture){this.needsGesture=false;this.attempts=0;clearTimeout(this.retry);this.retry=null;}
   if(this.needsGesture||this.retry)return;
   this.wanted=this.running=true;
   this.onState('Opening microphone · preparing local voice…');
   this.open().catch(e=>{if(this.running&&!this.listening)this.onError(e.message);});
  }
  async open(){
   const s={};this.session=s;
   try{
    s.context=new AudioContext({sampleRate:16000});
    // Request capture synchronously from Start, even if the model is still loading.
    const microphone=navigator.mediaDevices./* Call-mode processing off: on Android it switches app sound to quiet 'phone call' audio and mutes cues (owner test Nov 12). */getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
    const stream=await microphone;
    if(this.session!==s){stream.getTracks().forEach(t=>t.stop());return;}
    s.stream=stream;
    this.onState('Microphone connected · loading local voice model…');
    const model=await this.preload();
    if(this.session!==s)return;
    const context=s.context;
    await context.audioWorklet.addModule('voice-music-worklet.js');
    await context.resume();
    if(this.session!==s)return;
    const recognizer=new model.KaldiRecognizer(context.sampleRate,grammar);
    s.recognizer=recognizer;
    recognizer.on('result',({result})=>{if(this.session===s&&result.text){this.attempts=0;this.onText(result.text);}});
    recognizer.on('error',()=>{if(this.session===s)this.recover(s);});
    for(const t of stream.getAudioTracks())t.addEventListener('ended',()=>{if(this.session===s)this.recover(s);});
    s.source=context.createMediaStreamSource(stream);
    s.capture=new AudioWorkletNode(context,'pure-voice-capture');
    s.capture.port.onmessage=({data})=>{if(this.session===s)recognizer.acceptWaveformFloat(data,context.sampleRate);};
    s.source.connect(s.capture).connect(context.destination);
    this.listening=true;
    this.onState('Listening — say “twelve reps”.');
   }catch(e){
    if(this.session!==s)return;
    this.release();
    this.wanted=false;this.needsGesture=true;
    this.onError('Local voice unavailable: '+e.message+'. Tap Enable voice to retry.');
   }
  }
  recover(s){
   if(this.session!==s)return;
   this.release();
   if(!this.wanted)return;
   if(++this.attempts>4){this.wanted=false;this.needsGesture=true;this.onError('Microphone could not reconnect. Tap Enable voice to retry.');return;}
   this.onState('Reconnecting local voice…');
   this.retry=setTimeout(()=>{this.retry=null;if(this.wanted)this.start();},this.attempts*500);
  }
  beep(){
   const ctx=this.session?.context;
   if(!this.listening||ctx?.state!=='running')return;
   try{const tone=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime;
    tone.frequency.value=880;gain.gain.setValueAtTime(.045,t);gain.gain.exponentialRampToValueAtTime(.001,t+.075);
    tone.connect(gain).connect(ctx.destination);tone.start(t);tone.stop(t+.08);
   }catch{}
  }
  release(){
   const s=this.session;this.session=null;this.running=this.listening=false;
   if(!s)return;
   if(s.capture)s.capture.port.onmessage=null;
   s.stream?.getTracks().forEach(t=>t.stop());
   try{s.recognizer?.remove();}catch{}
   s.context?.close().catch(()=>{});
  }
  stop(){clearTimeout(this.retry);this.retry=null;this.wanted=false;this.release();this.onState('Microphone off.');}
 }
 return {Voice};
})();
