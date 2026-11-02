# Today release candidate — backup and rollback gates (2026-11-02 Arizona)

**Status: proposed review procedure, NOT an authorized migration.** This document is for the isolated Today candidate stacked on [PR #72](https://github.com/gregmoulton/LifePilot/pull/72), exact parent `383c1b6067090201ce2a4ea9a4bcc83b209241d5`. Do not merge, deploy, change the owner's real profile, enroll shared sync, or spend money under this plan.

## Verified source behavior and hazards

- The candidate still uses browser-local key `lifepilot-v02-profile` and `LifePilotStorage` with a Web Locks save boundary. Before each successful change it retains `:last-good`; a confirmed restore preserves displaced bytes in `:recovery-original`. These slots are **not** a durable substitute for a separately downloaded backup.
- The app's **Export Backup** downloads a JSON copy of the displayed profile. The **Import** path **replaces** the current local profile after confirmation, and the candidate normalizes selected legacy goal fields. It is **not** a non-destructive additive merge. Avoid importing the owner's data until compatibility and explicit consent are established.
- `shared-sync.js` may transmit an enrolled profile to the private shared endpoint. The candidate's local-only browser harness does not verify authenticated HTTPS sync, migration, or cross-device recovery.
- A preview on the **same browser origin** as v0.4 may access the same local storage key. A candidate preview must have a separate isolated HTTPS origin and a clearly identified exact source SHA; a URL path or query string alone does not isolate localStorage.
- Existing hosted preview provenance advertises older PR59/91 tests; do **not** present it as the integrated #72 candidate until the exact code is independently verified.

## Read-only preparation (no owner data modification)

1. Confirm the **current** live v0.4 URL and its real profile are intact. On **Android phone** and **Chromebook**, separately use the existing **Export Backup** action, without importing or resetting anything. Keep the two files private and labeled by device and Arizona timestamp; do not upload them to a public issue, PR, fixture, or chat.
2. On each device, independently confirm that the downloaded JSON is nonempty, parses as JSON, contains a `goals` array, and includes expected existing goal/task history and HOLD/dates. Record the count and any mismatches privately. A successful download click alone is not sufficient evidence.
3. Before testing a preview, require a **separate HTTPS origin** with a verifiable exact candidate commit and browser security/owner-only access. Start with **synthetic data only** and do **not** connect the real shared agenda. Preserve the original v0.4 tab/profile.
4. Run the synthetic candidate tests on both devices: create Today and Unscheduled tasks, HOLD one, edit with review, reload, verify exact task IDs/status/date, export, and exercise confirmed restore/rollback using **only synthetic** records. Record failures per device.
5. Only after all synthetic checks and explicit separate owner approval: define and review a reversible real-profile migration. Make a second timestamped real backup, verify compatibility, establish rollback instructions and a clean cross-device reconciliation procedure. Do not silently replace an existing profile or let a candidate automatically adopt a shared profile.

## Automated evidence and limits

`test/shared-agenda-browser.py` includes a synthetic browser test of exported JSON, exact prior `:last-good` bytes, restore, retained `:recovery-original` and reload-preserved HOLD/date. GitHub CI must pass on the **exact new PR head** before this test is counted. This is a browser-fixture test, not proof of real-profile safety or authenticated HTTPS behavior.

## Gate status

- Gate 5 — exact-source authenticated HTTPS preview: **PENDING**.
- Gate 6 — backup, legacy import, rollback and no-data-loss validation: **PENDING**; this PR covers only a synthetic portion.
- Gates 7–8 — physical Android/Chromebook acceptance: **PENDING**.
- Gate 9 — owner release authorization: **PENDING**.

**Rollback rule:** No changes to `main` or the deployed v0.4 during review. If a candidate fails, stop using the isolated preview, preserve its synthetic export, keep v0.4 unchanged, and record the exact failed gate. Never use an unverified new-version export to overwrite an old-version real profile.
