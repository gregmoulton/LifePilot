/* Free, bounded task capture. Unsupported instructions require clarification. */
(function(root){
function parseTaskRequest(text,now=new Date()){
 if(typeof text!=='string'||text.length>4000)throw Error('Keep the request under 4,000 characters.');
 const lines=text.split(/[;\n]+/).map(x=>x.trim()).filter(Boolean);if(!lines.length||lines.length>20)throw Error('Describe 1 to 20 tasks, separated by lines or semicolons.');
 return lines.map(line=>{
  if(/^(delete|remove|hold|reschedule)\b|^(complete|finish|move|change|update)\s+(?:my\s+|the\s+)?task\b/i.test(line))throw Error('This capture adds tasks only. Use task controls for changes.');
  let name=line.replace(/^(?:please\s+)?(?:add\s+(?:a\s+task\s+(?:to\s+)?)?|i\s+(?:need|want|have)\s+to\s+)/i,'').trim(),agenda_importance='normal',due='';
  const priority=name.match(/(?:[, ]+)(high|normal|low)\s+priority\s*[.!]?$/i);
  if(priority){agenda_importance=priority[1].toLowerCase();name=name.slice(0,priority.index).trim();}
  const when=name.match(/(?:[, ]+)(today|tomorrow|on\s+\d{4}-\d{2}-\d{2})\s*[.!]?$/i);
  if(when){const term=when[1].toLowerCase();if(term.startsWith('on ')){due=term.slice(3);const d=new Date(due+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==due)throw Error('Check the requested date.');}else{const d=new Date(now);if(term==='tomorrow')d.setDate(d.getDate()+1);due=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}name=name.slice(0,when.index).trim();}
  if(!name||name.length>200)throw Error('Each task needs a name up to 200 characters.');
  if(/\b(next week|next month|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|every day|daily|weekly)\b/i.test(name))throw Error('Use today, tomorrow, or on YYYY-MM-DD. Recurring tasks are not supported here yet.');
  return {name,due,agenda_importance};
 });
}
root.LifePilotCapture={parseTaskRequest};
})(globalThis);
if(typeof document!=='undefined'){
 const captureRender=render;
 render=function(){captureRender();const workspace=$('agendaWorkspace');if(!workspace)return;
 const panel=workspace.querySelector('.panel');panel.insertAdjacentHTML('afterbegin','<details><summary>Tell Life Pilot what you need to do</summary><label for="captureRequest">Your tasks</label><textarea id="captureRequest" rows="3" placeholder="I need to get a debit card today, high priority; pick up auction items today, low priority"></textarea><p class="mini">Separate tasks with semicolons or new lines. Say today, tomorrow, or on YYYY-MM-DD. Review before saving.</p><div class="row"><button type="button" onclick="captureSpeak()">Speak tasks</button><button type="button" onclick="captureReview()">Review tasks</button></div><p id="captureStatus" role="status"></p></details>');};
 function captureReview(){try{const tasks=LifePilotCapture.parseTaskRequest($('captureRequest').value);agendaBatchDraft={base:JSON.stringify(profile),tasks:tasks.map(t=>({...t,id:'agenda-'+uid()}))};agendaRenderBatch();$('captureStatus').textContent='Review the task names, dates and priorities below. Nothing has been saved.';$('agendaBatchReview').scrollIntoView({block:'nearest'});}catch(e){$('captureStatus').textContent=e.message;}}
 function captureSpeak(){const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){$('captureStatus').textContent='Voice recognition is unavailable in this browser. You can type or use your keyboard microphone.';return;}const speech=new Recognition();speech.lang='en-US';speech.interimResults=false;speech.onresult=e=>{$('captureRequest').value=e.results[0][0].transcript;$('captureStatus').textContent='Speech entered. Review tasks before saving.';};speech.onerror=()=>{$('captureStatus').textContent='Could not hear the request. Try again or type it.';};speech.onend=()=>{};try{speech.start();$('captureStatus').textContent='Listening…';}catch{$('captureStatus').textContent='Microphone unavailable. Type your request instead.';}}
 render();
}
