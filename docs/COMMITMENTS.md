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
- **Evidence comes only from Life Pilot task logs.** These are tasks for the linked goal, counted as completed tasks or summed `actual_minutes` by `recorded_at` within the week.
  - **Verified:** the target was met.
  - **Missed:** work for the goal was due or logged that week, and the target was not met.
  - **Unverified:** there was no evidence, or the evidence was ambiguous (a missing timestamp, a missing minutes value, an unreadable date). Missing evidence is never counted as missed.
- **Scoring is idempotent and append-only.** A finished week is scored once. Evidence that appears later does not rewrite it. No command can mark a week verified by hand.
- **Excused weeks are self-reported and unreviewed** (`self_reported: true`, `reviewed: false`). They are allowed once the week has started. A miss excused after scoring stays in the record, and the excused entry supersedes it. Verified weeks cannot be excused.
- **Every command adds an audit event.**
- **Imports cannot lose commitment records.** An ordinary import must keep every commitment, score, exception and history entry unchanged (`commitmentProblems`). Deliberate replacement goes through Restore, which lists what would be lost.

## Evidence

- `test/commitments.test.cjs`
- The commitment case in `test/browser-validation.py`
- `preview/upgrade_gate.py`, where an approved commitment survives rollback to production `main`
