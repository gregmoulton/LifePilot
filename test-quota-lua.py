"""Execute the actual Lua quota scripts against a Redis-command fixture.

Optional stronger local check: python3 test-quota-lua.py (requires liblua5.4).
No packages, remote services, API keys, or credentials are used.
This is not a live Redis persistence/availability test.
"""
import ctypes
import ctypes.util
import json
import subprocess

scripts = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {LOGIN_SCRIPT,RESERVE_SCRIPT,RELEASE_SCRIPT} from './quota.mjs';console.log(JSON.stringify({LOGIN_SCRIPT,RESERVE_SCRIPT,RELEASE_SCRIPT}))"
], text=True))
lib = ctypes.CDLL(ctypes.util.find_library('lua5.4'))
lib.luaL_newstate.restype = ctypes.c_void_p
lib.luaL_openlibs.argtypes = [ctypes.c_void_p]
lib.luaL_loadstring.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lib.lua_pcallk.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_longlong, ctypes.c_void_p]
lib.lua_tolstring.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
lib.lua_tolstring.restype = ctypes.c_char_p
lib.lua_close.argtypes = [ctypes.c_void_p]
source = r'''
local db,expires={},{}
local now=86400*20000
redis={}
function redis.call(cmd,k,a,b)
 if cmd=='TIME' then return {tostring(now),'0'} end
 if expires[k] and expires[k]<=now then db[k]=nil;expires[k]=nil end
 if cmd=='GET' then return db[k] end
 if cmd=='INCR' then db[k]=(db[k] or 0)+1;return db[k] end
 if cmd=='EXPIRE' then expires[k]=now+tonumber(a);return 1 end
 if cmd=='HGET' then return db[k] and db[k][a] end
 if cmd=='HINCRBY' then db[k]=db[k] or {};db[k][a]=(db[k][a] or 0)+tonumber(b);return db[k][a] end
 if cmd=='ZREMRANGEBYSCORE' then if db[k] then for id,score in pairs(db[k]) do if score<=tonumber(b) then db[k][id]=nil end end end;return 1 end
 if cmd=='ZCARD' then local n=0;for _ in pairs(db[k] or {}) do n=n+1 end;return n end
 if cmd=='ZADD' then db[k]=db[k] or {};db[k][b]=tonumber(a);return 1 end
 if cmd=='ZREM' then if db[k] then db[k][a]=nil end;return 1 end
 error('Unknown fixture command '..cmd)
end
KEYS={'lifepilot:security:v1'}
function reserve(limit,tokens,rate,concurrency,amount,id)
 ARGV={limit,tokens,rate,concurrency,amount,id};return reserveScript()
end
function reset() db={};expires={};now=86400*20000 end
'''
for name, target in [('LOGIN_SCRIPT','loginScript'),('RESERVE_SCRIPT','reserveScript'),('RELEASE_SCRIPT','releaseScript')]:
    source += f"\nlocal_chunk = [=[{scripts[name]}]=]\n{target}=assert(load(local_chunk))\n"
source += r'''
assert(reserve(2,100,6,1,40,'a')=='ok')
assert(reserve(2,100,6,1,40,'b')=='busy')
ARGV={'a'};releaseScript()
assert(reserve(2,100,6,1,70,'b')=='tokens')
assert(reserve(2,100,6,1,40,'b')=='ok')
ARGV={'b'};releaseScript()
assert(reserve(2,100,6,1,1,'c')=='daily')
-- Re-running the same script (new app client) cannot reset the shared counter.
reserveScript=assert(load([=[RESERVE_PLACEHOLDER]=]))
assert(reserve(2,100,6,1,1,'c')=='daily')
now=now+86400
assert(reserve(2,100,6,1,40,'next-day')=='ok')
reset()
assert(reserve(10,1000,1,1,40,'a')=='ok');ARGV={'a'};releaseScript()
assert(reserve(10,1000,1,1,40,'b')=='rate');now=now+61
assert(reserve(10,1000,1,1,40,'b')=='ok')
reset()
assert(reserve(10,1000,6,1,40,'crashed')=='ok');now=now+59
assert(reserve(10,1000,6,1,40,'replacement')=='busy');now=now+2
assert(reserve(10,1000,6,1,40,'replacement')=='ok')
reset()
for i=1,20 do assert(loginScript()==1) end
assert(loginScript()==0);now=now+901;assert(loginScript()==1)
'''.replace('RESERVE_PLACEHOLDER', scripts['RESERVE_SCRIPT'])
state = lib.luaL_newstate()
try:
    lib.luaL_openlibs(state)
    result = lib.luaL_loadstring(state, source.encode())
    if not result:
        result = lib.lua_pcallk(state, 0, 0, 0, 0, None)
    if result:
        raise AssertionError(lib.lua_tolstring(state, -1, None).decode())
    print('PASS: actual Lua scripts: concurrency, token budget, daily limit, client restart, UTC rollover, rate window, crash lease expiry, login throttle')
finally:
    lib.lua_close(state)
