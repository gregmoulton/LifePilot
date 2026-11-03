// Metadata only. Never request a completion or print key identifiers.
try {
 const key=process.env.OPENROUTER_API_KEY;
 if(!key)throw Error();
 const r=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok){console.log(JSON.stringify({httpStatus:r.status}));process.exitCode=1;}
 else {
 const {data:d}=await r.json();
 const limit=typeof d?.limit==='number'?d.limit:null;
 const reset=d?.limit_reset===null?'none':d?.limit_reset===undefined?'unknown':'resetting';
 const pass=limit!==null&&limit>=0&&limit<=1&&reset==='none';
 console.log(JSON.stringify({limit,reset,pass}));if(!pass)process.exitCode=1;
 }
}catch{console.log('Metadata check unavailable');process.exitCode=1;}
