# Life Pilot — AI CoPilot integration preview

This is a **development package**, not a deployed service. The existing v0.25 task data stays in browser localStorage under the same key. No GitHub files are changed.

## Run on Chromebook or development machine

Requires Node.js 20+ and an OpenAI API key with billing enabled.

```bash
cd copilot-milestone
export OPENAI_API_KEY='YOUR_KEY_HERE'
node server.mjs
```

Open `http://localhost:8787` in the same machine's browser. Never paste the API key into chat, GitHub, or the HTML. If no key is set, the app runs and offline commands work, but Ask AI reports unavailable.

## Scope

- AI converts conversational requests into **one proposed task addition or update**.
- The browser displays a confirmation and applies nothing without approval.
- Ambiguous/unsupported commands result in no proposed change.
- Current tasks and command text are sent to OpenAI when **Ask AI** is clicked; local task storage remains in the browser.
- No email, calendar, remote account access, automatic changes, or cloud sync.
- No authentication/multiuser support. **Local development only. Do not expose this server to the public internet.**

## Deployment blockers

Before a public daily-use deployment: add user authentication, persistent server-side storage and backup/sync, CSRF and request-size hardening, monitoring/cost caps, and HTTPS hosting. Review privacy disclosures and task conflict handling. No deployment is authorized yet.

## Test

```bash
node --check server.mjs
node --check app-check.js
node test.mjs
```

The test starts a local server without a key and checks health, no-key handling, and disallowed origins. End-to-end AI calls require a configured key and human review.
