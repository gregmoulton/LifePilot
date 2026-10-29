# Shared agenda candidate — October 29, 2026

16 Node tests: `node --test development/shared-agenda/test/*.test.mjs` with Node 24.

Uses existing owner-private Sites identity and D1. Exact user ID owns real and isolated sandbox rows. CAS revisions prevent stale writes, previous shared payload retained. Local-first saving, explicit enrollment, no silent upload. Automatic remote refresh preserves unfinished capture drafts and uses the local transaction queue.

Typed or browser speech capture supports task lists separated by semicolons/new lines, today/tomorrow/on YYYY-MM-DD, suffix high/normal/low priority. Editable review required; no paid AI calls. No separate Google OAuth stack or unrestricted AI interpretation.

Hosted smoke: sandbox device A cloud upload, device B adoption and HOLD save, automatic refresh on A, reload persistence. Real owner cloud profile not populated by QA. Physical Android/Chromebook and speech recognition remain unverified.

Limitations: reconnect once per page session, conflict export/reload/reconnect, 1 MB profile cap, no automatic merge. Existing local data and backups preserved. Full Site integration source retained in existing Sites source repository. No merge/public production release.
