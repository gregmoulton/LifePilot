# The Pure — max-round experiment (review build)

This is an isolated, self-contained HTML trial for the workout experiment, not the existing live release. The source intentionally ships without personal maximum-test results. Enter an actual dated baseline in Setup before testing (the separately delivered private owner test build has the owner’s provided baseline entered).

## Trial protocol
- Circuit order: standard push-ups → inverted rows → bodyweight squats; configurable 2–5 rounds (default 3).
- Each set is an honest, technically sound **max-quality-reps** trial; stop when proper form deteriorates. No preassigned 70/80% rep prescription.
- Record actual reps, optionally observed peak HR, rest HR and recovery elapsed seconds.
- Recovery checkpoint defaults to **110 BPM** as an experimental observation, not a medical clearance or automatic permission to resume. No unverified automatic increase.
- Preserve round-by-round records, compute per-exercise totals and changes across the workout, and keep original max-test snapshots with the session.
- The 130% unlock denominator is unresolved. This prototype does **not** auto-advance the exercise ladder. It captures data for making that decision later.
- The monitor connection is an optional standard Bluetooth Heart Rate Profile attempt, not a verified integration for any particular HW401 device. Manual readings always work.

## Storage boundaries
- Uses a new localStorage key `the-pure-max-round-lab-v1`, leaving existing Life Pilot and Prime Workout keys alone.
- In-progress and completed sessions are saved locally in that browser; no cross-device sync.
- JSON backup/restore, CSV export, and session delete. Conditioned/penalty reps are not included in session totals.
- Does not update `main`, the live The Pure site, or existing hosted data.

## Validation (October 18, 2026)
- JavaScript parse and static smoke tests passed under Node 22.
- Automated Chromium (Playwright) DOM tests passed for recorded baselines (private fixture), a complete 9-set circuit, round navigation, numeric and HR entries, undo, session totals and per-exercise decline, JSON and CSV exports, partial-session save, and persisted data reloaded in the isolated test browser environment.
- No JavaScript page errors in those checks.
- NOT tested on the user's Android device. Actual BLE pairing/notifications and persistent on-device browsing have **not** been verified.

## Review required before any production update
- Try on the intended phone, verify the manual HR workflow and optional BLE pairing, determine if training to technical max in every round creates undue fatigue, and confirm round count / next-rung criteria.
- Do not merge or deploy over working versions without owner review and explicit release approval.
