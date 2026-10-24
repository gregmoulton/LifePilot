# Agenda and storage pre-release validation — October 24, 2026

Assignment #1 continues issues #21, #24 and #25 and draft PRs #27/#28.
Base: PR #28, `c31514d9e5beb5e7b18e302820725950d0f67bd2`.
Branch: `fix/agenda-storage-validation-20261024`.
No merge, deployment, production/profile migration, paid service or Pure change.
All browser data is generated fictionally in disposable contexts and temporary
directories. No downloaded profile files are committed.

## Reproduced and repaired

1. **Execution bypassed Agenda HOLD.** Put a linked planned task on HOLD in Agenda,
   switch to Execution, select Record result → completed → 7. PR #28 saves the
   completion despite HOLD. `completeTask` now enforces HOLD, and Motivation Lab
   excludes held tasks when collecting missed commitments. Release HOLD before
   completing; prerequisite checks remain in force.
2. **A stale Motivation Lab schedule reopened completed/changed tasks.** Propose a
   schedule experiment for an overdue linked task; complete it in Agenda with
   seven actual minutes; approve the earlier experiment. PR #28 changes it back
   to planned, replaces its current due date and sets current actual minutes to
   zero (old data survives only in history). The same stale approval can replace
   a newer approved Agenda reschedule. Schedule reviews now capture additive
   `task_snapshots`, check every referenced record before any mutation, and reject
   changed, completed, held, missing or ambiguous targets. An unchanged review
   still approves after export/restart and retains earlier results in history.

Older pending schedule reviews without snapshots require a new review; no base
state is inferred or silently migrated. Their records remain available to export
or reject. Other review types retain their existing behavior. Snapshot copies
increase backup size in proportion to the reviewed tasks and their history.

Four new regression cases failed against #28 before the fixes. Those four plus
one positive schedule/restart case now pass. Existing failed-save and caught-error
fixtures also exercise the new snapshot boundary, rather than failing early on
missing metadata. Existing storage protection is retained; this PR does not
replace already completed work in #27/#28.

## Actual results

Environment: Node 24.19.0, Python 3.12, Playwright 1.62.0, Chromium 154.0.8037.57,
Linux; browser timezone America/Phoenix.

| Command | Result |
| --- | --- |
| `node --test test/*.test.cjs prime-workout/structure.test.mjs prime-workout/regression.test.mjs` | **62 passed, 0 failed** (57 inherited + 5 new; includes 10 unchanged Prime checks) |
| `TZ=America/Phoenix node test/radar-original.cjs` | **38 assertions passed, 0 failed**, separate from the Node test count |
| `python3 test/browser-validation.py` | **10 browser tests passed, 0 failed** |
| `git diff --check` | Passed |

The browser suite serves source on loopback and asserts `isSecureContext === true`
and native `navigator.locks.request`. Localhost is a browser-trusted secure origin;
no lock replacement, insecure-origin flag or HTTPS-error bypass is used.

Browser evidence:

- An independent tab holds the application's named native lock. Two other tabs
  queue actual Agenda additions; `navigator.locks.query()` observes both pending
  requests and durable storage remains unchanged while blocked. Releasing the lock
  lets one save; the stale writer is rejected with no false success. Its actual
  downloaded unsaved JSON contains the rejected task. Reload and reapply preserves
  both edits. Closing a lock-holder tab also releases the lock and permits saving.
- Real Export Backup download is saved to disk, parsed, compared with the complete
  fictional profile, selected through the welcome import input, and verified after
  reload. The fixture includes eight goals, stable goal/program/milestone/task
  relationships, unknown nested fields, Unicode and an Improvement Log. Before
  export, browser actions create rejection/proposal/event history and completion
  with seven actual minutes; those records round-trip too.
- After deliberately corrupting the disposable store, the downloaded file is
  selected through Restore a backup file. Confirmed restore retains every field;
  Download pre-recovery data produces the exact original corrupt bytes.
- Reset retains the previous backup; cancelled restore leaves storage unchanged;
  confirmed restore recovers it. Invalid import, stale-tab restore, and an earlier
  different recovery copy cannot overwrite current data. Both recovery copies
  remain downloadable. Corrupt storage cannot be overwritten by Start Fresh.
- Explicit injected primary-write failure rolls back memory, avoids a success
  receipt, preserves stored bytes, and produces a real downloadable attempted
  profile. This is fault injection into Storage, **not** a native quota exhaustion
  claim; Web Locks remains native throughout.
- Both integration repairs are exercised through browser navigation and controls.
  Failed stale approval leaves completion/effort intact after reload.

## Reproduce browser checks

```sh
python3 -m pip install playwright==1.62.0
python3 -m playwright install chromium
python3 test/browser-validation.py
```

An existing browser can be selected with `CHROMIUM_PATH=/usr/bin/chromium`.
The suite otherwise uses an installed `chromium` or Playwright's downloaded one.
It starts/stops its own loopback server, never launches a personal browser profile,
and deletes all downloaded fictional files when each test ends. In a sandbox that
blocks sockets/browser subprocesses, the test command needs execution permission.
CI now runs both the existing Node checks and this browser suite; its branch filter
also includes `feature/**` so this PR stacked on #28 receives checks.

## Remaining gates / next

- Physical Android/Chromebook acceptance and owner release acceptance are still
  unverified. Desktop headless Chromium is not physical-device evidence.
- Localhost native-lock evidence closes the prior mock-only gap. A deployed HTTPS
  origin, its browser/storage policy and other browser engines were not tested;
  no production was accessed or changed for this assignment.
- Existing limitations remain: same-origin backups share browser-clearing/device
  loss risk; an earlier different recovery copy blocks another restore; legacy held
  statuses still require reviewed migration; prototype import, CoPilot bridging,
  cloud sync and wider legacy inline-handler hardening are outside this repair.
- Review the incremental PR against #28, then perform device/owner acceptance and
  obtain separate merge/deploy authorization. No such authorization was requested
  or exercised here.

Overall Life Pilot completion is not rebaselined. The roadmap's historical 40%
is provisional and is not increased by these draft validation results. Development
occurs only during active implementation sessions.
