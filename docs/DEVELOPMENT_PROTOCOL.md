# Life Pilot — Accelerated Development Protocol
Approved 2026-10-15.

## Objective
Maximize tested, integrated 1.0 functionality per active development session, minimize owner interruptions, preserve current working releases.

## Work authorization
Routine code, isolated branches, tests, documentation and non-destructive validation can proceed without step-by-step approval. Seek explicit approval for expenses, credentials, access/security changes, irreversible migrations, and consequential production releases. No paid API calls without approval.

## Execution order
1. Review repository baseline and identify highest-dependency integration work.
2. Batch implementation, automated tests, fixes and commits within one active session.
3. Prefer end-to-end vertical slices over disconnected features.
4. Keep main and current hosted user data stable; stage changes in branches.
5. Request decisions only when genuinely blocking progress, with one recommended choice and alternatives.
6. Update docs/LIFE_PILOT_1_0_ROADMAP.md completion scores only with evidence.
7. End sessions with COMPLETED / BLOCKED / NEXT and links to code or tests.

## Status semantics
ACTIVE = work underway within the current assistant turn only.
IDLE = assistant turn ended; no development occurs in background.
BLOCKED = external action/approval needed.
DONE = tested and verified to the acceptance level reported.

## Delivery acceleration
Prioritize Prime progress integration, Refresh proposal UI, unified storage/navigation, AI CoPilot security integration, then regression and release. Avoid expanding 1.0 scope with cross-device sync or autonomous background agents. Reestimate delivery windows if active development cadence changes.

## Core requirement — visible, evidence-based development progress (all projects)
This is mandatory for every current and future development project, not just Prime Workout.

1. At the start of a session, display the project's current verified completion percentage and a clearly labeled progress bar, with the next milestone and target date if one is established.
2. During a session, show updated checkpoints when material milestones have been completed and verified. Do not increase a percentage merely because code was written, committed, or a pull request was opened.
3. Ground each percentage in a defined milestone/acceptance checklist or weighted roadmap. Distinguish implemented, tested, deployed, and owner-accepted work; identify unverified work separately.
4. At the end of each session, report COMPLETED / TESTED / BLOCKED / NEXT, the verified percentage, and a link to the relevant change when available.
5. Provide a one-click or copyable exact **Continue development** prompt so the owner can activate the next session without restating context. Ask the owner only for genuine blockers, consequential release approvals, or necessary device testing.
6. Clearly state that progress updates occur during active assistant turns only; there is no background development or automatically moving progress bar between turns. Never imply otherwise.
7. Protect the existing working release and user data; do not deploy consequential changes without explicit approval.

This requirement applies to Life Pilot, Prime Workout, Refresh, CoPilot, Prime Life Recovery software, and subsequent software projects unless the owner explicitly changes it.

## Build and handoff provenance

For Life Pilot and The Pure, package a `build-info.json` beside the app entry point with
`node scripts/write-build-provenance.cjs CONFIG OUTPUT`. Run against the exact Git
commit that supplies the app files. Each app's Build details panel displays the
manifest and provides a copyable Work handoff.

The config supplies `project`, `version`, `repository`, `review`, `issue`,
`branch`, `environment`, `origin`, `status`, `storage`, and `nextStep`.
Supply `createdAt` as UTC ISO-8601 with milliseconds from the source of record, or
leave it unknown. The generator records the source commit and commit time and
stamps the build separately. Use a dedicated origin for Android review. Include
`?build=FULL_SHA` in each review link to catch a stale URL or incorrect deployment.

Record automated test, deployment, physical Android test, and owner acceptance
separately in `automatedTest`, `deployed`, `androidTest`, and `ownerAccepted`.
Use null until evidence exists. Each receipt needs `at`, `commit`, and a
`reference` to the underlying record. Deployment, Android, and acceptance
receipts also need the exact `origin`. Keep receipts with the published handoff
and reuse the original `builtAt` when attaching post-build evidence for that build.

Handoff and status records must carry their actual created, updated and last
verified UTC timestamps and current status. Display dates in America/Phoenix
(MST). Keep unknown fields empty in stored data and label them in the display.
An automated result alone cannot mark an app owner-verified.
