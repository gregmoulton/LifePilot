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
