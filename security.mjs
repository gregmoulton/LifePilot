import {createHmac,randomBytes,scrypt as derive,pbkdf2 as derivePbkdf2,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive),pbkdf2=promisify(derivePbkdf2),COOKIE='__Host-lp_owner';
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const validPasswordHash=s=>/^(?:scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}|pbkdf2\$600000\$[a-f0-9]{32}\$[a-f0-9]{64})$/.test(s);
export function loadConfig(env=process.env){
 if(env.OPENAI_MODEL&&env.OPENAI_MODEL!=='gpt-4.1-mini')throw Error('Invalid security configuration');
 const int=(k,d,max)=>{const n=Number(env[k]??d);if(!Number.isSafeInteger(n)||n<1||n>max)throw Error('Invalid security configuration');return n};
 let origin=null,validRedis=false;try{const u=new URL(env.PUBLIC_ORIGIN);if(u.protocol==='https:'&&u.origin===env.PUBLIC_ORIGIN&&!u.username&&!u.password)origin=u.origin}catch{}
 try{const u=new URL(env.UPSTASH_REDIS_REST_URL);validRedis=u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash}catch{}
 const passwordHash=env.OWNER_PASSWORD_HASH||'',sessionSecret=env.SESSION_SECRET||'';
 return {origin,passwordHash,sessionSecret,redisUrl:env.UPSTASH_REDIS_REST_URL||'',redisToken:env.UPSTASH_REDIS_REST_TOKEN||'',key:env.OPENAI_API_KEY||'',model:'gpt-4.1-mini',
 dailyRequests:int('AI_DAILY_REQUEST_LIMIT',20,100),dailyTokens:int('AI_DAILY_TOKEN_LIMIT',100000,500000),perMinute:int('AI_REQUESTS_PER_MINUTE',6,12),outputTokens:int('AI_MAX_OUTPUT_TOKENS',256,1024),concurrency:int('AI_MAX_CONCURRENCY',1,2),
 authReady:!!origin&&validPasswordHash(passwordHash)&&Buffer.byteLength(sessionSecret)>=32,storeReady:validRedis&&!!env.UPSTASH_REDIS_REST_TOKEN};
}
export async function verifyPassword(value,stored){
 if(typeof value!=='string'||Buffer.byteLength(value)>256||!validPasswordHash(stored))return false;
 const parts=stored.split('$');
 if(parts[0]==='pbkdf2')return equal(await pbkdf2(value,Buffer.from(parts[2],'hex'),600000,32,'sha256'),Buffer.from(parts[3],'hex'));
 return equal(await scrypt(value,Buffer.from(parts[1],'hex'),64,{N:16384,r:8,p:1}),Buffer.from(parts[2],'hex'));
}
export function issueSession(secret,now=Date.now()){
 const csrf=randomBytes(24).toString('base64url'),exp=Math.floor(now/1000)+3600,body=Buffer.from(JSON.stringify({exp,csrf})).toString('base64url');
 return {csrf,cookie:`${COOKIE}=${body}.${createHmac('sha256',secret).update(body).digest('base64url')}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600`};
}
export function readSession(req,secret,now=Date.now()){
 const entries=(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));if(entries.length!==1)return null;
 const token=entries[0].slice(COOKIE.length+1);if(token.length>512)return null;const [body,mac,...extra]=token.split('.');if(!body||!mac||extra.length||!equal(mac,createHmac('sha256',secret).update(body).digest('base64url')))return null;
 try{const s=JSON.parse(Buffer.from(body,'base64url').toString());return Number.isInteger(s.exp)&&s.exp>Math.floor(now/1000)&&s.exp<=Math.floor(now/1000)+3600&&/^[-_a-zA-Z0-9]{32}$/.test(s.csrf)?s:null}catch{return null}
}
export const clearSessionCookie=()=>`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;
export const validCsrf=(req,s,origin)=>req.headers.origin===origin&&typeof req.headers['x-csrf-token']==='string'&&equal(req.headers['x-csrf-token'],s.csrf);
