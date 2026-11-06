# THE PURE — release registry and link safety
_Last audited: 2026-11-06 (America/Phoenix)_

> **CURRENT VERIFIED ANDROID WORKOUT LINK: NONE.** Do not select a URL from the historical list and claim it is the latest release. A working heart-rate session in an earlier build does not prove a later URL is deployed or functional.

## Version map

| Label (use verbatim) | Source / URL | Verification and release status | Action |
| --- | --- | --- | --- |
| **THE PURE — PHONE V2 (historical candidate; preserve data)** | https://cozy-pixie-686e61.netlify.app/ | Previously described as approved phone-test V2. Current Android and deployment status **unverified**. Browser-origin storage may contain owner workout history (reported key `the-pure-phone-approved-v2`). | **PRESERVE; DO NOT OVERWRITE OR DELETE.** Not designated current release. |
| **THE PURE — HIT 1.6 REVIEW (source only)** | [PR #74](https://github.com/gregmoulton/LifePilot/pull/74), `review/pure-work-hit16-verified-save-20261101`, `prototypes/the-pure-hit-1-6-work-review/` | **DRAFT / NOT MERGED / NOT DEPLOYED.** Simulated tests are not Android acceptance. | Review and verify in isolated HTTPS preview. |
| **THE PURE — HIT 1.6 MOOFIT/HRM PREFLIGHT (source only)** | [PR #86](https://github.com/gregmoulton/LifePilot/pull/86), `fix/pure-hrm-preflight-20261103` | **DRAFT / NOT MERGED / NOT DEPLOYED.** Branch is stacked on PR #74. Owner reported earlier MOOFIT live BPM testing, but this does not verify a production build. | Do not present as a working public URL. |
| **THE PURE — RECOVERY/HIT FIELD TEST (OBSOLETE)** | https://ornate-pegasus-f4a5ab.netlify.app/ | **OLD / DO NOT USE.** This was mistakenly provided for a real November 6 workout and displayed an old field-test UI. | Remove from recommendations; retain until owner data is accounted for. |
| **THE PURE — EARLY HIT PROTOTYPE (OBSOLETE)** | https://delicate-dieffenbachia-4e3c7e.netlify.app/ | **OLD / DO NOT USE.** October 21 field-test candidate. | Archive; no workout recommendation. |
| **THE PURE — PRIVATE RECOVERY TEST (UNVERIFIED)** | https://the-pure-hit-recovery-test.poetichill16.chatgpt.site | **EXPERIMENTAL / NOT CURRENT.** Past candidate; availability and behavior not reverified. | Archive; no workout recommendation. |

## Release gate before any “Open The Pure” reply
1. Confirm the exact deployed origin URL, source commit/build identifier, owner, and product title **THE PURE**.
2. On the owner's **Android phone in Chrome**, verify an actual fresh start; MOOFIT pairing and **changing live BPM**; automatic voice/countdown; Push → Squat → Pull round changes; recovery toward 110 BPM with manual override; pause/resume; and saved-session read-back/reload. Practice/synthetic data must not contaminate workouts.
3. Confirm existing real workout history and export/backup are safe. **Never clear browser site data, change storage keys, overwrite production, or delete an origin until a verified backup and migration plan exists.**
4. Update this registry with **one canonical verified workout URL** and test date. Only then give that URL in ChatGPT.
5. Label all other links **OBSOLETE TEST — DO NOT USE**, not “working,” and avoid routing users there. Historical demos remain accessible only for archival comparison.

## Deployment/cleanup restrictions
- No live deploy, merge, overwrite, or spending authorized by this documentation.
- Netlify site ownership and deployment credentials are **not verified**; an obsolete URL in this table has **not** been deleted.
- GitHub draft PRs are not deploys. PR #70 merged only into a feature branch, not into a verified Android release.
- Preserve existing localStorage/session data even if an older UI is defective.
- This registry is documentation-only and should be merged only after owner review.