# Life Pilot Delivery Command Center — isolated draft

**Status:** Standalone mobile-first command center source, **not merged and not deployed**. Do not enable GitHub Pages or replace `main/index.html` through this PR. This artifact is additive under `ops/delivery-command-center/` only.

## Scope and protections

- Production v0.4: `https://gregmoulton.github.io/LifePilot/` — DO NOT overwrite, merge, redeploy or migrate this production profile without explicit owner release approval.
- Source was branched from `main` at `4710a5ec56dccd9436fec48369d513144306d7de`. Other draft branches (including Claude's #101/#103/#105 and The Pure #74/#86/#98) are not edited.
- `index.html` is a self-contained static page, with no service worker, external JS/CSS, authentication token, production-profile read or write, GitHub mutations or secret access. It issues only `GET` requests to the GitHub public API on manual/initial refresh.
- GitHub API fetches current PR heads and dependencies, current `main`, and recent Actions workflow runs. No fetch does **not** imply a pass. API errors leave the dated snapshot visible, flagged as snapshot.
- Snapshot is anchored to the repository evidence viewed on November 9, 2026. Claude-reported tests are labeled as reported and links are available to the source PR comments. The snapshot does not pretend to be live status.
- Owner physical tests use local browser storage scoped to the command-center origin and are keyed to PR #, full 40-character SHA, device, origin, timestamp, result and notes. Retests are required after the head changes. Evidence can be exported/imported as JSON. Local test entries do **not** record external approvals or sync between devices.
- Exception filters include failed CI, failed physical tests, branch SHA drift, unexpected bases, conflicts, old PRs, missing evidence, reported broken previews and decisions requiring owner approval.
- Original failed The Pure voice-preview link and the reported replacement practice origin are explicitly distinguished. Replacement is not called owner-verified until Android Chrome is actually used.
- HTTPS simulation is distinct from live HTTPS-origin production validation; browser CI is distinct from physical owner acceptance.

## Usage (review only)

Open `index.html` using a local/static server or an **isolated HTTPS preview** that is not the production domain. For a fully operational public-API refresh, prefer a separately authenticated/isolated HTTPS preview. Opening the HTML directly as `file://` is possible but may restrict local storage and cross-origin fetch behavior; owner evidence storage is origin-scoped. Never inject a real Life Pilot profile into the dashboard.

When preview hosting is available:
1. Put only this folder's static HTML at a separate HTTPS origin.
2. Confirm the URL in **Android Chrome** and on **Chromebook Chrome**, not only a deployment return code.
3. Check View → Exceptions, and run `Refresh GitHub`.
4. Open The Pure practice preview in full Android Chrome, verify it loads, and record actual voice/music behavior with fictional data. A link failure should be logged as blocked, not counted as a failed voice feature.
5. Before approval, verify exact GitHub HEAD SHA, Actions evidence, HTTPS-origin gate, device acceptance on that SHA, and the explicit owner decision. Keep all current application PRs draft until approval.

## Known limitations

This is an **operations dashboard prototype**, not an autonomous agent or release service. Public GitHub API requests may hit unauthenticated rate limits. Workflow results are not a substitute for reviewing individual CI jobs or artifacts; stale workflow evidence is never an automatic release authorization. External cross-origin preview links cannot reliably be checked for liveness with browser JS; only prior reported failures and owner test records are surfaced. A SHA from GitHub `main` is not proof of the exact bytes served by a CDN. Local evidence is not authoritative or shared until explicitly exported/reviewed.

## Source evidence (as of 2026-11-09)

- PR #101: `c9d7c88`, Nov 9 strict Agenda and task history-retention fix, three GitHub workflows green at reported head; earlier physical acceptance was on `37e0b08` and requires reconsideration at current head.
- PR #103: `38cc7db`, updated base/conflicts resolved, 9/9 CI checks reported; final re-review outstanding.
- PR #105: `8278f5f`, stacked UI with 9/9 reported checks; code review and owner physical acceptance outstanding.
- PR #98: Nov 9 visual acceptance direction. An old Android link had documented `ERR_FAILED`; a replacement anonymous HTTPS practice link was posted Nov 8 but was not yet physically accepted for the feature workflow.
- Simulation gate `preview/upgrade_gate.py` reported 22/22 after stacking, but this is not live production upgrade validation.

**Release constraint:** Zero deploys, zero merges and zero production/profile mutations from this artifact.