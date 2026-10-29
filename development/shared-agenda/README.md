# Daily command center candidate — October 29, 2026

Builds on draft PR55. Uses the same owner-private Sites project and profile key. No changes to main, Render, The Pure or existing real records.

- Remembered opt-in sync: reconnect after reload, retain offline local edits, reconcile a lost save response by comparing the exact shared profile.
- Whole-profile conflicts: show both agendas, recheck cloud revision and local snapshot, retain both recovery copies before applying the owner's selection. Download recovery copies remains available. No automatic merge.
- Primary typed/spoken request field, editable review, one explicit approval. Add, complete, HOLD, release HOLD and reschedule supported. Unique task name or #ID required; no guessed match.
- Completion time optional: unreported time is recorded as not provided, not fabricated as zero.
- Reviewed batch requires an unchanged profile snapshot; invalid later action rolls back every earlier action. Existing HOLD/prerequisite guards retained.
- Unapproved request text survives reload on the same browser; re-review required after restart. No automatic execution of restored text.

## Tests
Node24: `node --test development/shared-agenda/test/*.test.mjs`.
36 tests cover SQLite storage/auth/CAS, sync recovery/conflicts/restart/draft protection, command parsing, approval, atomicity and prerequisite regression.

## Limits
Bounded language patterns, not unrestricted AI. Browser speech availability/permission varies; physical microphone testing pending. Offline edits work in an already loaded page; offline cold-start is not promised. Profile cap 1MB; at most20 retained conflict snapshots, and quota failure blocks replacement. Full integration source and starter retained in the existing Sites source repository. No paid AI calls, new credentials or automatic destructive migration.
