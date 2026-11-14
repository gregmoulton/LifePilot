# Proposed Pure workout summary integration

After the standalone release and migration checks in #115, Life Pilot can display
a private read-only workout summary. The Pure remains authoritative. Today task
completion continues to require the existing owner action.

## Version 1 payload

| Field | Contract |
| --- | --- |
| `schemaVersion` | Integer `1`. Reject unsupported versions. |
| `source` | Literal `the-pure`. |
| `workoutId` | Stable, opaque ID from the authoritative workout record. Backups and retries retain it. |
| `revision` | Positive integer incremented by The Pure for each committed correction. |
| `completedAt` | UTC RFC 3339 timestamp for a verified, saved completion. Life Pilot displays it in the viewer's local time. |
| `durationSeconds` | Optional nonnegative integer for known duration. Omit when unavailable. |

Only verified, saved, completed live workouts qualify. Practice, discarded,
partial and in-progress sessions stay in The Pure. The summary excludes raw
reps, heart rate, notes and credentials.

## Transport and lifecycle

- Use a private, authenticated read interface. The service derives owner
  identity from verified authorization and scopes every read to that owner.
  Workout IDs and account identifiers supplied by a client confer no access.
- Key the projection by verified owner, source and workout ID. Replaying the
  same revision yields one entry. A newer revision replaces the displayed
  fields. Older revisions have no effect. Conflicting content at the same
  revision is an integrity error.
- An authoritative removal must remove the corresponding projection. A fetch
  failure preserves the last known view with a stale indication. Missing
  authorization clears it from view. Keep the summary out of the task profile
  and its exports. Storage and transport are future implementation decisions.
- Before wiring either app, prove tenant isolation, duplicate/reordered
  revisions, corrections, removal and unavailable-source behavior with
  fictional records. Then verify on the approved origin on Android and
  Chromebook under #115. This contract adds no workout integration code.
