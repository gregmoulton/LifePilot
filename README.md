# Life Pilot AI CoPilot — Security Hardening v0.1

Security hardening for the existing `ai-copilot` development branch.
Render auto-deploys this branch. Published v0.4 on `main` remains separate.

Owner authentication, durable shared request/token budgets, output cap and shared
concurrency leases are implemented. AI fails closed until authentication and a
durable Redis REST store are configured. Manual/offline task controls still work.
AI proposals retain the existing explicit Confirm change approval flow.

See [SECURITY_HARDENING.md](SECURITY_HARDENING.md) for the design, limits, variable
names, tests, remaining risks and deployment approvals. No credentials are bundled.
The separately approved Upstash Free datastore is configured in Render. Owner
settings were provisioned by the owner. No paid service or API test was enabled.

## Local checks (no API key needed)

```sh
node --check server.mjs
node --check security.mjs
node --check quota.mjs
node --test test.mjs
# Optional actual Lua-script checks when liblua5.4 is already available:
python3 test-quota-lua.py
```

Run `node server.mjs` and open http://localhost:8787 for manual/offline controls.
AI login requires HTTPS plus the security configuration documented above. Node
20+ is required; this workspace used Node 24.19.0. Automated tests mock all external
services and do not make paid requests.

## Data and scope

Current task storage remains browser localStorage under
`lifepilot-command-center-demo-v06`. This preview does not import v0.4 profiles,
change the published v0.4 storage key or provide cross-device sync. Export backups.
Only clicking Ask AI sends the command/current task context to OpenAI, after owner
authentication and allowance checks. There is no email/calendar integration or
autonomous task execution.
