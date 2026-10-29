const OWNER='greg.moulton2@gmail.com',MAX=1048576;
const response=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function sharedProfile(request,db,validProfile){
 const identity=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
 if(!identity||email?.toLowerCase()!==OWNER)return response(401,{error:'Owner sign-in required'});
 const owner=identity+(new URL(request.url).searchParams.get('sandbox')==='1'?':sandbox':'');
 if(!['GET','PUT'].includes(request.method))return response(405,{error:'Method not allowed'});
 if(request.method==='PUT'&&request.headers.get('origin')!==new URL(request.url).origin)return response(403,{error:'Request not allowed'});
 if(!db)return response(503,{error:'Shared storage unavailable; local data unchanged'});
 try{
  if(request.method==='GET'){
   const row=await db.prepare('SELECT revision,payload,updated_at FROM shared_profiles WHERE owner_id=?').bind(owner).first();
   return response(200,row?{revision:row.revision,profile:JSON.parse(row.payload),updated_at:row.updated_at}:{revision:0,profile:null});
  }
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return response(415,{error:'JSON required'});
  const reader=request.body?.getReader();if(!reader)return response(400,{error:'Missing profile'});
  const parts=[];let length=0;while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>MAX){await reader.cancel();return response(413,{error:'Profile exceeds 1 MB; export a backup'});}parts.push(part.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return response(400,{error:'Invalid JSON'});}
  if(!body||!Number.isSafeInteger(body.revision)||body.revision<0||!validProfile(body.profile))return response(400,{error:'Invalid profile or revision'});
  const payload=JSON.stringify(body.profile),at=new Date().toISOString();
  const result=body.revision===0
   ?await db.prepare('INSERT INTO shared_profiles(owner_id,revision,payload,updated_at) VALUES(?,1,?,?) ON CONFLICT(owner_id) DO NOTHING').bind(owner,payload,at).run()
   :await db.prepare('UPDATE shared_profiles SET previous_payload=payload,payload=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(payload,at,owner,body.revision).run();
  if(result.meta.changes!==1)return response(409,{error:'Another device saved changes. Review both copies before continuing.'});
  return response(200,{revision:body.revision+1,updated_at:at});
 }catch{return response(503,{error:'Shared save could not be confirmed. Keep your local copy; retry after checking shared data.'});}
}
