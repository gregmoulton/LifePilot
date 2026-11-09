# Daily command center — October 29, 2026

67 tests: `node --test development/shared-agenda/test/*.test.mjs development/shared-agenda/test/*.test.cjs` (Node24). Includes 31 legacy transaction/import/recovery/approval tests against the retained shell, 36 storage/sync/command tests. Existing 84-test baseline separately passed against current application sources with the DOM harness extended to support normal DOM methods. 38 Radar assertions pass.

Remembered opt-in shared sync reconnects on reload and retains offline local edits. Lost cloud receipts reconcile by exact profile comparison. Conflicting whole profiles are reviewed, revision-checked and both archived before the owner chooses a copy. Recovery downloads remain available. No auto merge.

Primary text/speech request supports adding, completing, HOLD, release and reschedule. Exact unique task names or #IDs required. Review then one approval; stale or partially invalid batches never save. Completion minutes are optional and unknown time stays unreported. Request drafts survive reload without executing.

Hosted synthetic QA: A/B separate local keys and isolated D1 sandbox, mixed command review/save/reload, auto reconnect, reschedule versus HOLD conflict, choose shared copy, exported recovery file verified to retain both actual variants. Real cloud owner profile not populated by QA. Physical devices/microphone remain unverified. Bounded language, no paid AI. Offline cold start not promised; 1MB profile cap; 20 retained conflict records with fail-closed quota handling.

Full framework integration remains in existing Sites source repository, same project/audience. No main/Render/Pure changes, merge or public production release.
