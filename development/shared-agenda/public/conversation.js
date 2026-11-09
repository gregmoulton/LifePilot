/* Free, bounded task capture. Unsupported instructions require clarification. */
(function(root){
function parseTaskRequest(text,now=new Date()){
 if(typeof text!=='string'||text.length>4000)throw Error('Keep the request under 4,000 characters.');
 const lines=text.split(/[;\n]+/).map(x=>x.trim()).filter(Boolean);if(!lines.length||lines.length>20)throw Error('Describe 1 to 20 tasks, separated by lines or semicolons.');
 return lines.map(line=>{
  if(/^(delete|remove|hold|reschedule)\b|^(complete|finish|move|change|update)\s+(?:my\s+|the\s+)?task\b/i.test(line))throw Error('This capture adds tasks only. Use task controls for changes.');
  let name=line.replace(/^(?:please\s+)?(?:add\s+(?:a\s+task\s+(?:to\s+)?)?|i\s+(?:need|want|have)\s+to\s+)/i,'').trim(),agenda_importance='normal',due='';
  let hasPriority=false,hasDate=false;
  for(let pass=0;pass<3;pass++){
   const priority=name.match(/(?:[, ]+)(high|normal|low)\s+priority\s*[.!]?$/i);
   if(priority){if(hasPriority)throw Error('Use one priority per task.');hasPriority=true;agenda_importance=priority[1].toLowerCase();name=name.slice(0,priority.index).trim();continue;}
   const when=name.match(/(?:[, ]+)(today|tomorrow|on\s+\d{4}-\d{2}-\d{2})\s*[.!]?$/i);
   if(!when)break;if(hasDate)throw Error('Use one date per task.');hasDate=true;
   const term=when[1].toLowerCase();if(term.startsWith('on ')){due=term.slice(3);const d=new Date(due+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==due)throw Error('Check the requested date.');}else{const d=new Date(now);if(term==='tomorrow')d.setDate(d.getDate()+1);due=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}name=name.slice(0,when.index).trim();
  }
  if(!name||name.length>200)throw Error('Each task needs a name up to 200 characters.');
  if(/\b(next week|next month|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|every day|daily|weekly)\b/i.test(name))throw Error('Use today, tomorrow, or on YYYY-MM-DD. Recurring tasks are not supported here yet.');
  return {name,due,agenda_importance};
 });
}
function parseActions(text,profile,now=new Date()){
 if(typeof text!=='string'||text.length>4000)throw Error('Keep the request under 4,000 characters.');
 const lines=text.split(/[;\n]+/).map(x=>x.trim()).filter(Boolean);if(!lines.length||lines.length>20)throw Error('Describe 1 to 20 instructions.');
 const tasks=profile.execution?.tasks||[],normalize=s=>s.trim().replace(/^['"]|['"]$/g,'').toLowerCase();
 const find=name=>{const matches=tasks.filter(t=>normalize(t.name||'')===normalize(name)||'#'+t.id===name.trim());if(matches.length!==1)throw Error(matches.length?'More than one task matches. Use its #ID or a unique name.':'No task matches "'+name+'". Check the task name.');return matches[0];};
 const findContext=(kind,name)=>{const list=kind==='goal'?(profile.goals||[]):(profile.execution?.[kind+'s']||[]),matches=list.filter(x=>normalize(x.name||'')===normalize(name)||'#'+x.id===name.trim());if(matches.length!==1)throw Error(matches.length?'More than one '+kind+' matches. Use its #ID.':'No '+kind+' matches "'+name+'".');return LifePilotAgenda.resolveContext(profile,{[kind+'_id']:matches[0].id});};
 return lines.map(line=>{
  let m;
  if((m=line.match(/^link\s+(.+?)\s+to\s+(goal|program|milestone)\s+(.+)$/i)))return {type:'set-context',task_id:find(m[1]).id,context:findContext(m[2].toLowerCase(),m[3])};
  if((m=line.match(/^make\s+(.+?)\s+standalone$/i)))return {type:'set-context',task_id:find(m[1]).id,context:{}};

  if((m=line.match(/^(?:(?:I\s+)?(?:completed|finished)|complete|finish)\s+(.+?)(?:\s+in\s+(\d+(?:\.\d+)?)\s+minutes?)?$/i)))return {type:'complete',task_id:find(m[1]).id,minutes:m[2]===undefined?null:Number(m[2])};
  if((m=line.match(/^plan\s+(.+?)\s+(today|tomorrow|on\s+\d{4}-\d{2}-\d{2})$/i)))return {type:'reschedule',task_id:find(m[1]).id,due:parseTaskRequest('placeholder '+m[2],now)[0].due};
  if((m=line.match(/^(?:set|make)\s+(.+?)\s+(?:to\s+)?(high|normal|low)\s+priority$/i)))return {type:'set-priority',task_id:find(m[1]).id,agenda_importance:m[2].toLowerCase()};
  if((m=line.match(/^mark\s+(.+?)\s+(?:as\s+)?(?:done|complete)$/i)))return {type:'complete',task_id:find(m[1]).id,minutes:null};
  if((m=line.match(/^put\s+(.+?)\s+on\s+hold$/i)))return {type:'hold',task_id:find(m[1]).id};
  if((m=line.match(/^(hold|resume|release)\s+(.+)$/i)))return {type:m[1].toLowerCase()==='hold'?'hold':'release',task_id:find(m[2]).id};
  if((m=line.match(/^(?:reschedule|move)\s+(.+?)\s+(?:to|for)\s+(today|tomorrow|\d{4}-\d{2}-\d{2})$/i))){const due=parseTaskRequest('placeholder '+(/^\d/.test(m[2])?'on ':'')+m[2],now)[0].due;return {type:'reschedule',task_id:find(m[1]).id,due};}
  if(/^(?:delete|remove|reschedule|move|change|update|set|make|plan|link)\b/i.test(line)&&!/^change of address\b/i.test(line))throw Error('Use complete NAME, hold NAME, resume NAME, or reschedule NAME to tomorrow.');
  const task=parseTaskRequest(line,now)[0],context=task.name.match(/^(.+?)\s+for\s+(goal|program|milestone)\s+(.+)$/i);if(context){task.name=context[1].trim();Object.assign(task,findContext(context[2].toLowerCase(),context[3]));}return {type:'add',task};
 });
}
root.LifePilotCapture={parseTaskRequest,parseActions};
})(globalThis);

const captureCount=(n,word)=>n+' '+word+(n===1?'':'s');
let captureCommandDraft=null;
if(typeof document!=='undefined'){
 const captureRender=render;
 render=function(){
  captureRender();const workspace=$('agendaWorkspace');if(!workspace)return;
  const panel=workspace.querySelector('.panel');
  panel.insertAdjacentHTML('afterbegin','<section><h3>What needs doing?</h3><label for="captureRequest">Add tasks or tell Life Pilot what changed</label><textarea id="captureRequest" rows="3" maxlength="4000" oninput="captureRememberDraft()" placeholder="Get a debit card today, high priority; hold auction pickup"></textarea><p class="mini">Add “for goal NAME” or “for milestone NAME” to connect a task. Use “plan TASK today” or “set TASK high priority”. Separate instructions with semicolons or new lines. Review before saving.</p><div class="row"><button type="button" onclick="captureSpeak()">Speak</button><button type="button" onclick="captureReview()">Review instructions</button><button type="button" class="secondary" onclick="captureClear()">Clear request</button></div><p id="captureStatus" role="status"></p><div id="captureCommandReview"></div></section>');
  try{$('captureRequest').value=localStorage.getItem(KEY+':capture-draft')||'';}catch{}
  const form=panel.querySelector('form');if(form){const details=document.createElement('details');details.innerHTML='<summary>Add a task manually</summary>';form.before(details);details.append(form);}
  captureRenderReview();
 };
 function captureRememberDraft(){try{localStorage.setItem(KEY+':capture-draft',$('captureRequest').value);}catch{$('captureStatus').textContent='Draft could not be saved on this device. Keep this page open.';}}
 function captureReview(){
  captureCommandDraft=null;captureRenderReview();captureRememberDraft();
  try{
   const commands=LifePilotCapture.parseActions($('captureRequest').value,profile).map(c=>c.type==='add'?{...c,task:{...c.task,id:'agenda-'+uid()}}:c);
   const before=JSON.stringify(profile);LifePilotAgenda.apply(profile,{type:'reviewed-commands',before,commands,approved:true});
   captureCommandDraft={before,commands};captureRenderReview();$('captureStatus').textContent='Review the changes below. Nothing has been saved.';
  }catch(e){$('captureStatus').textContent=e.message;}
 }
 function captureContextLabel(refs){const context=LifePilotAgenda.taskContext(profile,refs);return context?['goal','program','milestone'].filter(k=>context[k]).map(k=>context[k].name).join(' → '):'Standalone task';}
 function captureContextOptions(current){const selected=LifePilotAgenda.resolveContext(profile,current),items=[{label:'Standalone task',refs:{}}];for(const kind of ['goal','program','milestone'])for(const item of (kind==='goal'?profile.goals||[]:profile.execution?.[kind+'s']||[])){try{const refs=LifePilotAgenda.resolveContext(profile,{[kind+'_id']:item.id});items.push({label:captureContextLabel(refs)+' · #'+item.id,refs});}catch{ /* Invalid existing links remain untouched and are not offered for new tasks. */ }}return items.map(item=>'<option value="'+esc(JSON.stringify(item.refs))+'" '+(['goal','program','milestone'].every(k=>item.refs[k+'_id']===selected[k+'_id'])?'selected':'')+'>'+esc(item.label)+'</option>').join('');}
 function captureRenderReview(){
  const box=$('captureCommandReview');if(!box)return;if(!captureCommandDraft){box.innerHTML='';return;}
  box.innerHTML='<h3>Review '+captureCount(captureCommandDraft.commands.length,'instruction')+'</h3>'+captureCommandDraft.commands.map((c,i)=>{
   const target=profile.execution?.tasks?.find(t=>t.id===c.task_id),label={add:'Add',complete:'Complete',hold:'Put on HOLD',release:'Release HOLD',reschedule:'Reschedule','set-priority':'Change priority','set-context':'Change task links'}[c.type];
   const heading='<p><b>'+esc(label)+': '+esc(c.task?.name||target?.name||c.task_id)+'</b></p>';
   const contextPicker=c.type==='add'?'<details><summary>Goal or milestone (optional)</summary><label for="commandContext'+i+'">Connect this task</label><select id="commandContext'+i+'">'+captureContextOptions(c.task)+'</select></details>':'';
   if(c.type==='set-context')return '<div class="line">'+heading+'<p>'+esc(captureContextLabel(c.context))+'</p></div>';
   if(c.type==='add')return '<div class="line">'+heading+'<p class="mini">'+esc(captureContextLabel(c.task))+'</p><label for="commandName'+i+'">Task name</label><input id="commandName'+i+'" maxlength="200" value="'+esc(c.task.name)+'"><div class="row"><label>Date<input id="commandDue'+i+'" type="date" style="width:180px;max-width:100%" value="'+esc(c.task.due)+'"></label><label>Priority<select id="commandPriority'+i+'">'+['high','normal','low'].map(x=>'<option value="'+x+'" '+(x===c.task.agenda_importance?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+contextPicker+'</div>';
   if(c.type==='set-priority')return '<div class="line">'+heading+'<p>Priority: '+esc(c.agenda_importance)+'</p></div>';
   if(c.type==='reschedule')return '<div class="line">'+heading+'<label>New date<input id="commandDue'+i+'" type="date" style="width:180px" value="'+esc(c.due)+'"></label></div>';
   if(c.type==='complete')return '<div class="line">'+heading+'<label>Actual minutes (optional)<input id="commandMinutes'+i+'" type="number" min="0" step="any" style="width:140px" value="'+(c.minutes===null?'':c.minutes)+'"></label><p class="mini">Blank means time was not recorded.</p></div>';
   return '<div class="line">'+heading+'</div>';
  }).join('')+'<div class="row"><button type="button" onclick="captureConfirm(event)">Approve '+captureCount(captureCommandDraft.commands.length,'change')+'</button><button type="button" class="secondary" onclick="captureCancel()">Cancel review</button></div>';
 }
 function captureSaveReview(event){
  event?.preventDefault();if(!captureCommandDraft)throw Error('Review instructions first.');
  const commands=captureCommandDraft.commands.map((c,i)=>c.type==='add'?{...c,task:{id:c.task.id,name:$('commandName'+i).value,due:$('commandDue'+i).value,agenda_importance:$('commandPriority'+i).value,...JSON.parse($('commandContext'+i).value)}}:c.type==='reschedule'?{...c,due:$('commandDue'+i).value}:c.type==='complete'?{...c,minutes:$('commandMinutes'+i).value.trim()===''?null:Number($('commandMinutes'+i).value)}:c);
  profile=LifePilotAgenda.apply(profile,{type:'reviewed-commands',before:captureCommandDraft.before,commands,approved:true});save();notify(captureCount(commands.length,'change')+' saved');return true;
 }
 async function captureConfirm(event){if(await globalThis.captureSaveReview(event)===true){captureCommandDraft=null;try{localStorage.removeItem(KEY+':capture-draft');}catch{}render();}}
 function captureClear(){captureCommandDraft=null;$('captureRequest').value='';try{localStorage.removeItem(KEY+':capture-draft');}catch{}captureRenderReview();$('captureStatus').textContent='Request cleared. No task changes were made.';}
 function captureCancel(){captureCommandDraft=null;captureRenderReview();$('captureStatus').textContent='Review cancelled. Nothing was saved.';}
 function captureSpeak(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){$('captureStatus').textContent='Voice recognition is unavailable. Type or use your keyboard microphone.';return;}
  const speech=new Recognition();speech.lang='en-US';speech.interimResults=false;
  speech.onresult=e=>{$('captureRequest').value=e.results[0][0].transcript;captureRememberDraft();$('captureStatus').textContent='Speech entered. Review instructions before saving.';};
  speech.onerror=()=>{$('captureStatus').textContent='Could not hear the request. Try again or type it.';};
  try{speech.start();$('captureStatus').textContent='Listening…';}catch{$('captureStatus').textContent='Microphone unavailable. Type your request instead.';}
 }
 Object.assign(globalThis,{captureReview,captureRememberDraft,captureSpeak,captureSaveReview,captureConfirm,captureCancel,captureClear,captureContextOptions,captureContextLabel});
 render();
}
