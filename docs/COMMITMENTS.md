# Commitment Contracts v1: Slice 1 (engine)

This covers issue #95. It was approved by ChatGPT on Nov 8, 2026 (PR #101 comment 6729217870) as local-only scorekeeping. It makes no payments and has no referees, notifications, network access or AI calls. Slice 1 is only the engine (`commitments.js`). The screens come in Slice 2.

## Data

The additive `profile.commitments` holds:

```
{ version: 1, items, evaluations, exceptions, events }
```

It is saved through the existing `storage.js` transaction layer, with last-good backup and read-back verification. Profiles without this field are unchanged.

## Rules

- **Draft, then approval.** A new commitment is a draft until the owner approves it explicitly (`approved: true`). The first scored week is the first full Monday-to-Sunday week in America/Phoenix after approval, or a later chosen start. It is never backdated.
- **48-hour cooling-off.** Revising or ending an active commitment takes effect at the first week boundary at least 48 hours away. Changes apply going forward only. Each revision is a new version, and earlier weeks keep their version. A waiting revision can be cancelled, and the cancelled terms are kept in the history. Only one revision may wait at a time. The goal cannot change.
- **Evidence comes only from native Life Pilot task logs.** "Verified" means verified against those logs, not by an independent referee. Task records can change (a schedule review resets a task and deletes `recorded_at`), so evidence is gathered from every native trace of a completion:
  - the current task record
  - the task's own `history` snapshots
  - Agenda `completed` events, which now also store `actual_minutes`

  An Agenda event's goal comes from its own pre-completion snapshot (`before.goal_id`), so it still counts for the original goal if the task record is later removed or relinked. (v1 has no screen for deleting or relinking tasks; this covers imports and edits.) The same completion seen in several places counts once. Each evidence item keeps its completion time (`completed_at`, or else `recorded_at`) separate from the time it was entered (`entered_at`). Evidence entered after its week ended is flagged `late`. Tasks count toward a "tasks" target only when completed. For a "minutes" target, partial results count too.
- **Scores.**
  - **Verified:** the target was met.
  - **Missed:** only when the record is reliable. Work for the goal was planned (due) that week, nothing about the week's logs is doubtful, and the target was not met.
  - **Unverified:** everything else. That covers no plan, work only logged, a task on HOLD or with an unrecognised status, a task reset or rescheduled by a review, duplicate task IDs, and missing or unreadable times or minutes. Missing evidence is never counted as missed.
- **Doubts are scoped to their own week.** A doubtful record affects only the weeks it can be placed in, by a readable due date (current or in history) or a dated completion. A problem that can't be placed in any week (for example, a completed task with no times and no due date) is listed under `notes` on every score with "timing unknown". It is never used to turn other, well-documented weeks unverified.
- **Verified needs reliable evidence.** Completions of a task whose identity or record is doubtful that week (a duplicate task ID, missing minutes) stay in the snapshot marked `doubtful`, but they aren't counted. `measured` is the reliable count. A week that reaches its target only by counting doubtful records is unverified, with a note saying so. Reconciliation follows the same rule.
- **Strict validation.** `validProfile` checks commitment records before every load and save:
  - unique IDs and known statuses
  - a goal on every commitment
  - at least one version, numbered in order, with a valid target and dates
  - drafts not yet in effect
  - active and ended commitments approved, with effective dates in order
  - scores and exceptions tied to existing commitments, with valid weeks and statuses
  - every event typed

  A malformed import is refused, and a malformed stored profile blocks saving without being overwritten.
- **Every score stores its evidence snapshot, its doubts and its notes.** Later edits to task records cannot remove evidence already on record.
- **Scoring is idempotent and append-only.** A finished week is scored once. If later native evidence, combined with what is already on record, shows a scored week met its target, a superseding entry is appended with `reason: 'later_native_evidence'`, the `supersedes` ID and a `late_evidence` flag. A `reconciled` audit event is added too. Existing entries are never rewritten, scores never go down, and no command can mark a week verified by hand.
- **Ended commitments are still scored and reconciled** for their in-scope weeks. A discarded draft is never scored.
- **Excused weeks are self-reported and unreviewed** (`self_reported: true`, `reviewed: false`). They are allowed once the week has started. A miss excused after scoring stays in the record, and the excused entry supersedes it. Verified weeks cannot be excused.
- **Every command adds an audit event.**
- **Imports cannot lose commitment records.** An ordinary import must keep every commitment, score, exception and history entry unchanged (`commitmentProblems`). Deliberate replacement goes through Restore, which lists what would be lost.

## Evidence

- `test/commitments.test.cjs`
- The commitment case in `test/browser-validation.py`
- `preview/upgrade_gate.py`, where an approved commitment survives rollback to production `main`
