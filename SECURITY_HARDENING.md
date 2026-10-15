# Life Pilot Security Hardening v0.1

Local implementation for existing `ai-copilot` branch, based on commit
`9a3ee549632bdd04cab2f80482d13cb3ba151b60`. Uncommitted and not deployed.
The currently hosted service is unchanged and still has the audit's exposure.

## Security design

### Single owner authentication

Owner enters a password over HTTPS at the existing app. The server verifies a
salted password hash using timing-safe comparison. The offline Chrome helper uses
PBKDF2-HMAC-SHA-256 with 600,000 iterations, a 16-byte salt and 32-byte output.
Existing scrypt hashes (N=16384, r=8, p=1, 64-byte output) remain supported.
Only the hash is configured server-side. No owner password is bundled or created.
Login issues a signed, one-hour `__Host-` cookie with Secure, HttpOnly,
SameSite=Strict and Path=/. The session signing secret stays server-side.
The client retains only the CSRF value in memory. Password input clears on submit.
No login credential, cookie or CSRF value is placed in task backups/localStorage.

Every paid AI request requires a valid, unexpired signature plus a matching CSRF
value and the exact configured HTTPS Origin. Origin is a supplementary CSRF check,
not authentication. Missing/forged cookies are rejected before quota or AI access.
Forwarded headers and client-selected identities are not trusted. Password login
is globally limited to 20 attempts per fixed 15-minute UTC window using Redis.

This is a single-owner MVP, not an identity provider or MFA system. Anyone who
knows the owner password can log in. Browser logout clears that browser's cookie;
a captured cookie remains valid until its one-hour expiry. Rotating the signing
secret would invalidate all sessions, but no rotation is performed here. Owner
password changes alone do not revoke already issued sessions. No third-party
authentication service or duplicate project was created.

### Durable usage and concurrency

Render Free's filesystem is ephemeral and cannot provide restart-safe counters.
`quota.mjs` implements a Redis REST adapter compatible with Upstash, using one
atomic EVAL reservation. Following separate setup approval, the Upstash Free
database `lifepilot-security-dev` was created in Oregon. Eviction is off.
Its REST URL and token were saved in the existing Render service using Save only;
no deployment was triggered. Live quota operation remains unverified.

Redis owns the UTC clock, daily count, conservative token units, minute count,
login attempts and concurrency leases. Every instance uses a fixed namespace.
App restarts and deployments cannot reset these records. Daily records expire
after 48 hours. Task content, passwords and API credentials are never stored there.
Use a durable, non-evicting datastore; never flush or change its namespace to
reset an exhausted budget. Datastore deletion/loss/rollback cannot be solved by
the application and requires operator review before resuming AI.

Defaults:

| Protection | Default | Configuration ceiling |
|---|---:|---:|
| AI requests per UTC day | 20 | 100 |
| Conservative token units per UTC day | 100,000 | 500,000 |
| AI requests per fixed UTC minute | 6 | 12 |
| Output tokens per request | 256 | 1,024 |
| Shared concurrent upstream requests | 1 | 2 |
| Authenticated input size | 12,000 bytes | fixed |
| Current tasks in one AI request | 50 | fixed |

Token reservation is full serialized UTF-8 request bytes + 8,192 framing units +
the output cap. It is intentionally conservative, not measured usage or an exact
dollar budget. Failures, timeouts and rejected AI outputs consume the reservation.
There are no automatic model retries or refunds. Model is fixed to gpt-4.1-mini;
an incompatible OPENAI_MODEL configuration fails startup rather than selecting a
more expensive model. Explicit output cap is sent as max_completion_tokens.

An atomic lease lasts 60 seconds and survives app restart. OpenAI timeout is 25
seconds. Fully received responses release the lease; ambiguous errors/timeouts
retain it until expiry. A network abort cannot guarantee the remote provider has
stopped computing. Failed lease release temporarily blocks AI rather than opening
extra capacity. Rate and concurrency controls are global for the single owner,
independent of proxy-IP interpretation.

Quota unavailability, malformed store responses, missing security settings or
missing OpenAI key fail closed. No local-file or in-memory production fallback.
Public /health returns only {ok:true}: liveness, not key validity or readiness.

### Human authority and offline behavior

AI returns one validated proposal and never writes task state. Browser confirmation
is required to execute it. Cancel and stale-revision checks remain. Model text uses
textContent, and invalid calendar dates/unknown target IDs are rejected. Manual
tasks and offline commands work signed out, over local HTTP, or when AI/quota fails.
The existing v0.25 browser storage key and v0.4 separation remain unchanged.

## Required deployment configuration (NAMES only)

Existing Render service → Environment → Environment Variables:

| Name | Requirement |
|---|---|
| PUBLIC_ORIGIN | Exact existing HTTPS app origin, no trailing slash/path |
| OWNER_PASSWORD_HASH | Offline helper: PBKDF2-SHA256, 600000 iterations; legacy scrypt also supported |
| SESSION_SECRET | At least 32 random bytes; separate from all other credentials |
| UPSTASH_REDIS_REST_URL | Approved durable store HTTPS root URL |
| UPSTASH_REDIS_REST_TOKEN | Server-side datastore credential |
| OPENAI_API_KEY | Existing server-side credential; unchanged |
| OPENAI_MODEL | Optional; only gpt-4.1-mini accepted |
| PORT | Render-provided runtime port; unchanged |
| AI_DAILY_REQUEST_LIMIT | Optional; default 20 |
| AI_DAILY_TOKEN_LIMIT | Optional; default 100000 conservative units |
| AI_REQUESTS_PER_MINUTE | Optional; default 6 |
| AI_MAX_OUTPUT_TOKENS | Optional; default 256 |
| AI_MAX_CONCURRENCY | Optional; default 1 |

No sample credential values or actual hashes are included. Strong owner password,
hash and independent session secret must be provisioned securely only after approval.
The browser requires HTTPS for AI sign-in; local HTTP remains useful for manual
work. Automated local tests supply synthetic HTTPS Origin/cookies to a loopback
server. A real browser HTTPS integration test remains required before release.

## Verification

Run `node --test test.mjs` with Node 20+ (tested here with Node 24.19.0).
All 11 test groups pass. Requests are loopback only with generated test fixtures
and mocked upstream responses. No OpenAI/Redis credentials or paid requests used.

Covered: absent/forged/expired sessions; CSRF and Origin; secure login cookie,
session restore/logout and login throttle; missing config/key/store; output cap;
daily request/token and minute limits; concurrent requests; conservative failure
accounting; error redaction; input/output validation; Redis REST protocol; persistent
external-store fixture reloaded across app/store restart; actual frontend handlers
for offline use, pending/confirm/cancel, revision checks and expired login.

Optional `python3 test-quota-lua.py` requires local liblua5.4. It executes the actual
Lua source against a Redis-command fixture: concurrency, token budget, daily limit,
new app client, UTC rollover, minute window, crash lease expiry and login throttle.
This is not a live Redis durability/failover test. No server packages were installed.

Still required after separate approval: live Redis adapter/persistence verification,
HTTPS cookie behavior in Chrome/mobile, authenticated negative-access checks, and
then ONE fictional OpenAI request (no automatic application).

## Approval required before deployment

1. Free-tier database creation and Render connection setup approved and completed.
   No paid plan enabled. Live Redis operation still requires verification.
2. Owner completes `tools/owner-setup.html` locally in Chrome and saves
   OWNER_PASSWORD_HASH, SESSION_SECRET and PUBLIC_ORIGIN in Render with Save only.
   Helper contains no external resources, network requests or persistent storage.
   Generated values are sensitive; never paste them into chat or commit them.
   This helper is not served by the application. No owner credentials generated here.
3. Approve push/commit and deployment together: Render auto-deploys ai-copilot.
   Do not push merely to review this code. Configure/verify prerequisites first.
4. Separately authorize live tests, including any paid OpenAI request. None was run.

No material benefit identified in paid hosting or a full multi-user identity
system for this owner-only development milestone. A managed identity provider with
MFA should be reconsidered before broader users or sensitive data.

## Limitations and operating costs

Redis outage/free quota exhaustion disables AI. Public login can be spammed to
exhaust its throttle or datastore allowance: availability is not DDoS-proof. Render
Free cold starts persist. Signed cookies and CSRF are not protection against a fully
compromised browser/origin; the inherited inline script CSP remains a limitation.
No database, cloud sync, encrypted task storage, monitoring service or background
agent is added. Existing browser backups still matter.

OpenAI prepaid credit and auto-reload OFF remain useful independent controls; its
displayed organization budget is not an enforced dollar ceiling. Other projects or
direct use of API keys bypass this application's quotas. Default quota can admit
fewer than 20 calls because conservative token units also apply. No exact monetary
savings or production security certification is claimed.

Sources checked 2026-10-15:
- https://render.com/docs/free
- https://render.com/docs/disks
- https://upstash.com/docs/redis/features/restapi
- https://redis.io/docs/latest/develop/programmability/eval-intro/
- https://upstash.com/pricing/redis (free plan proposed; not activated)

Password hashing reference: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

## Release authorization — October 15, 2026

Owner approved committing, pushing and deploying these tested security changes
to the existing ai-copilot branch and Render service. Six required variable names
were verified saved in Render; values were not validated. Owner reports the three
owner settings saved using Save only. No paid OpenAI test is authorized.
