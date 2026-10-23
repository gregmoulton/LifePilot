# Profile storage safety — first implementation slice

This feature-branch change protects the published v0.4 profile format. It does not replace the separate agenda prototype or connect cloud services. No production deployment is authorized by this PR.

## Compatibility and privacy

- Keeps `lifepilot-v02-profile` and the existing JSON structure. Unknown profile and goal fields are preserved.
- Adds only one companion browser key, `lifepilot-v02-profile:last-good`, containing the previous successfully loaded profile before replacement/reset.
- No network requests, analytics, server, credentials, subscriptions or paid dependencies are added. Recovery downloads stay on the user's device.
- Browser storage and the previous backup are not encrypted. They remain subject to browser clearing, device loss and origin boundaries; external backup exports are still necessary.

## Save behavior

`storage.js` validates the loaded profile, serializes cooperating clients using Web Locks, checks that the stored raw profile still matches the opened version, retains the prior version, writes the candidate and verifies a readback. A stale tab is rejected rather than merged automatically. No timestamps or wrappers are inserted into exported profiles.

`persistence.js` provides a transaction boundary around the existing mutation handlers. Nested helpers retain their synchronous return behavior; external calls return a promise that resolves after saving. Rendering and success notices are delayed until persistence succeeds. On failure the UI rolls back, retains the attempted profile in memory for a local recovery download and blocks further edits until reload. The standard export still represents the displayed profile; the warning explicitly offers the unsaved version separately.

Import and reset use the same boundary. A confirmed reset retains the old profile in the companion backup. Goal/program/task, Motivation Lab approval and System Improvement Log handlers remain in place; this does not add autonomous changes.

## Recovery

On a failed save, keep the page open, use **Download unsaved changes**, resolve browser storage availability and close other editing tabs, then reload the saved profile. Import the downloaded candidate only after reviewing it against the latest saved data.

Unreadable JSON or invalid collection shapes are quarantined in place: the app refuses fresh/import writes and offers **Download stored data** and **Download previous backup**. This PR deliberately does not automatically repair or erase corrupted data. Keep the raw recovery download before any manual storage recovery. A guided, explicitly confirmed backup-restoration workflow is a follow-up; do not release this as a complete recovery UX yet.

## Limits and required review

- Writes require Web Locks (current Chrome on HTTPS or localhost). Unsupported contexts are read-only on save failure; there is no unsafe lock fallback.
- Old app versions do not participate in the lock. Close older editing tabs before testing this candidate. This is not cross-device synchronization.
- The readback establishes browser storage success, not a guarantee against browser/OS data loss.
- Tests use synthetic profiles and VM/browser-API fixtures. They are not physical Android testing or real user-profile testing.
- The ai-copilot agenda prototype still needs its own integration PR. Its known persistence defects are not fixed by this change.
- No automatic restore, concurrent-edit merge, cloud sync, AI changes or deployment is included.

## Validation

Run `node --test test/*.test.cjs prime-workout/structure.test.mjs prime-workout/regression.test.mjs`.

The new tests exercise corruption/inaccessible storage, missing locks, backup and primary write failures, stale concurrent writers, reset backup, snapshot isolation, eight-goal legacy compatibility, execution records, approval behavior, System Improvement Log, export/restart, and failed-save recovery downloads. Existing Prime Workout tests are regression checks only; that app is not modified.
