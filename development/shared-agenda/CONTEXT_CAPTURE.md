# Reviewed goal and milestone context — October 29, 2026 (Arizona)

## Scope
Existing goal/program/milestone collections remain authoritative. This slice connects new and unfinished tasks to them. It creates no goals, changes no deadlines, migrates no legacy records and does not infer or alter the master 18/19-goal roadmap.

## Supported requests
- `add Prepare answers for milestone First interview today, high priority`
- `add Research role for goal Career tomorrow`
- `link Call recruiter to milestone First interview`
- `make Call recruiter standalone`
Names must match uniquely, case-insensitively; #ID disambiguates. A milestone supplies its existing program and goal. Broken or mismatched ancestors stop the request. New task review includes an optional context picker; Standalone clears parsed context before approval. Existing-task links require explicit reviewed commands.

## Integrity
All mutations use the existing reviewed-command reducer, unchanged-profile snapshot and durable transaction wrapper. Unknown fields, HOLD, dates and task identity are preserved. Context changes record previous and new references. Completed task links cannot be changed here. Entire mixed batches fail atomically. Existing invalid links are displayed for review; they are never silently repaired or offered for a new task.

## Validation
- 91 Node integration tests pass, including parser, hierarchy, exact identity, ambiguity, duplicate/broken parents, stale approval, atomic rollback, failed local-save recovery, safe option escaping, selected-context identity independent of property order, exports/restart and actual SQLite shared-profile round trip/previous-copy retention.
- Separate current-source 84-test regression suite passes (overlap exists).
- Hosted UI acceptance and current exact-head CI are recorded in the draft PR after completion.

## Boundaries
Free bounded interpreter, not unrestricted AI. Standalone tasks remain supported. Goal definitions and milestone completion rules are unchanged. The Pure is a separate workstream and remains frozen for owner retest.

## Goal Stack visibility
Read-only linked-task counts reuse the Agenda projection, separating Today, upcoming, undated, HOLD, completed and invalid-context review. Prerequisite-blocked tasks count as HOLD; broken links count as review rather than completion. Ambiguous goal IDs show an unavailable count. No goal achievement percentage or automatic status change is inferred.

Execution integration: Agenda captures do not require a planned duration. The retained milestone task list now displays missing planned/actual time as not recorded, preserves an explicit zero, and never substitutes zero or undefined.
