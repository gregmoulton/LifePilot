// Life Pilot Refresh — deterministic local consolidation, no external access.
// Input: {tasks: [{id,title,due,status,source,source_id,priority}], now?: ISO string}
// Output is a proposal only; this module never edits, deletes or sends tasks.
const active = s => !['done','completed','cancelled','canceled','archived'].includes(String(s||'').toLowerCase());
const clean = s => String(s??'').trim().replace(/\s+/g,' ');
const normalizedTitle = s => clean(s).toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ');
const parseDue = d => {if(!d)return null;const n=Date.parse(d);return Number.isFinite(n)?n:null};
export function prepareRefresh(input={}){
  const now=Date.parse(input.now||new Date().toISOString());
  if(!Number.isFinite(now))throw Error('Invalid now timestamp');
  if(!Array.isArray(input.tasks))throw Error('tasks must be an array');
  const unique=new Map(),duplicates=[],invalid=[];
  for(const raw of input.tasks){
    if(!raw||typeof raw!=='object'||!clean(raw.title)){invalid.push(raw);continue}
    const task={...raw,title:clean(raw.title),source:clean(raw.source)||'manual'};
    const due=parseDue(task.due);
    const key=task.source_id?task.source+':'+clean(task.source_id):normalizedTitle(task.title)+'|'+(due===null?'':new Date(due).toISOString().slice(0,10));
    if(unique.has(key)){
      const existing=unique.get(key);
      duplicates.push({key,kept:existing.id??null,duplicate:task.id??null});
      // Prefer an active record, but never silently delete either original.
      if(!active(existing.status)&&active(task.status))unique.set(key,task);
    }else unique.set(key,task);
  }
  const proposals=[...unique.values()].filter(t=>active(t.status)).map(t=>{
    const due=parseDue(t.due);
    const hours=due===null?null:(due-now)/3600000;
    const urgency=hours===null?'unscheduled':hours<0?'overdue':hours<=24?'today':hours<=168?'this-week':'later';
    const score=(urgency==='overdue'?100:urgency==='today'?80:urgency==='this-week'?50:urgency==='later'?20:10)+(String(t.priority).toLowerCase()==='high'?15:0);
    return {...t,urgency,score,reason:urgency==='unscheduled'?'No due date':urgency==='overdue'?'Past due':urgency==='today'?'Due within 24 hours':urgency==='this-week'?'Due within seven days':'Due later'};
  }).sort((a,b)=>b.score-a.score||(parseDue(a.due)??Infinity)-(parseDue(b.due)??Infinity)||a.title.localeCompare(b.title));
  return {generated_at:new Date(now).toISOString(),proposals,duplicates,invalid_count:invalid.length,source_count:input.tasks.length,requires_approval:true};
}
