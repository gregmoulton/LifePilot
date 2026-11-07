# Direct Agenda task editing — October 29, 2026 (Arizona)

## Behavior
Each unfinished Agenda row exposes Edit. The editor changes name, optional date (including Today or unscheduling), priority, and goal/program/milestone links. It shows a live review summary and saves once through the existing durable transaction. Completed tasks are not editable here. Existing status, HOLD, prerequisites, time records, identity and unknown data are preserved.

The original scheduled timestamp is retained when editing other fields. Explicit date changes replace a scheduled time and the UI explains this. Current links and legacy priorities remain untouched unless the owner chooses a replacement. Invalid/missing context choices fail closed.

## Draft and concurrency safety
The task edit is stored separately from profile data and restored after reload without applying it. Shared refresh/adoption and conflict resolution wait while the draft is open. Saving checks an unchanged complete profile snapshot; concurrent local/remote changes cannot be silently overwritten. Cancel removes only the draft. Failed profile saves retain the original profile plus the attempted version in existing recovery storage and keep the edit draft available.

## Verification
105 Node integration tests passed before hosted acceptance, including model validation, unchanged-field/no-op behavior, invalid dates and forged fields, HOLD and unknown-field retention, exact timestamp preservation, local save failure/recovery, restored draft, cancellation, stale edit and shared refresh protection. Separate84-test regression suite passed; overlap exists. Build and final hosted acceptance are recorded in the draft PR and Issue24.

No paid calls, migrations, merges or public production releases. The Pure remains a separate unchanged workstream.
