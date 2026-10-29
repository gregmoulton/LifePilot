# Shared agenda candidate — October 29, 2026

Owner-private Sites D1 sync, revision conflict protection, local-first saves and opt-in enrollment. Full application source remains in the existing Sites source repository.

Run with Node 24: `node --test development/shared-agenda/test/*.test.mjs` (14 tests).

Bounded task capture supports lines/semicolons, today/tomorrow/on YYYY-MM-DD and suffix high/normal/low priority. Editable review is required. No paid AI calls or separate Google OAuth stack. Uses existing Sites authentication.

Unverified: hosted D1/identity, physical devices and microphone. Conflicts require export/reload/reconnect; no automatic merge. Reconnect each page session. 1 MB profile cap. Existing local data/unknown fields and prior shared copy retained. No production release or merge.
