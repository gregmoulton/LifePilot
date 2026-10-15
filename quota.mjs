// Atomic shared quotas. Redis stores counts and request IDs, never task content.
export const LOGIN_SCRIPT=`
local t=tonumber(redis.call('TIME')[1])
local key=KEYS[1]..':login:'..math.floor(t/900)
local n=redis.call('INCR',key)
redis.call('EXPIRE',key,1800)
return n<=20 and 1 or 0`;
export const RESERVE_SCRIPT=`
local t=tonumber(redis.call('TIME')[1])
local daily=KEYS[1]..':day:'..math.floor(t/86400)
local minute=KEYS[1]..':minute:'..math.floor(t/60)
local leases=KEYS[1]..':leases'
redis.call('ZREMRANGEBYSCORE',leases,'-inf',t)
if redis.call('ZCARD',leases)>=tonumber(ARGV[4]) then return 'busy' end
if tonumber(redis.call('GET',minute) or '0')>=tonumber(ARGV[3]) then return 'rate' end
if tonumber(redis.call('HGET',daily,'requests') or '0')>=tonumber(ARGV[1]) then return 'daily' end
if tonumber(redis.call('HGET',daily,'tokens') or '0')+tonumber(ARGV[5])>tonumber(ARGV[2]) then return 'tokens' end
redis.call('HINCRBY',daily,'requests',1)
redis.call('HINCRBY',daily,'tokens',tonumber(ARGV[5]))
redis.call('EXPIRE',daily,172800)
redis.call('INCR',minute)
redis.call('EXPIRE',minute,120)
redis.call('ZADD',leases,t+60,ARGV[6])
redis.call('EXPIRE',leases,120)
return 'ok'`;
export const RELEASE_SCRIPT=`return redis.call('ZREM',KEYS[1]..':leases',ARGV[1])`;
export class RedisQuota{
 constructor({url,token,fetchImpl=fetch}){this.url=url;this.token=token;this.fetchImpl=fetchImpl}
 async run(script,args=[]){const r=await this.fetchImpl(this.url,{method:'POST',headers:{authorization:`Bearer ${this.token}`,'content-type':'application/json'},body:JSON.stringify(['EVAL',script,1,'lifepilot:security:v1',...args.map(String)]),signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('Quota unavailable');const text=await r.text();if(text.length>4096)throw Error('Quota unavailable');const d=JSON.parse(text);if(d.error||!Object.hasOwn(d,'result'))throw Error('Quota unavailable');return d.result}
 async allowLogin(){return await this.run(LOGIN_SCRIPT)===1}
 async reserve(c,tokens,id){const r=await this.run(RESERVE_SCRIPT,[c.dailyRequests,c.dailyTokens,c.perMinute,c.concurrency,tokens,id]);if(!['ok','busy','rate','daily','tokens'].includes(r))throw Error('Quota unavailable');return r}
 async release(id){await this.run(RELEASE_SCRIPT,[id])}
}
