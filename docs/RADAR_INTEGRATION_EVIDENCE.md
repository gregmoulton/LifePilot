# Agenda + Forward Radar integration candidate — October 24, 2026

This feature branch is stacked on PR #27 at `48e1f13820e27d30784708e6ff001952effbdcad`. It is a draft engineering candidate, not a merged or deployed release. Main, ai-copilot/Render and The Pure are not modified.

## Source provenance and targeted repairs

Grok's owner-supplied task-planning ZIP SHA-256 is `5b0b691d5669208dd1f0aeb6a5f520f137424ca144d181f8c9f7fc68bc046b55`. Its `forward-radar.js` is the baseline; its custom test script is retained as `test/radar-original.cjs` with only the require path adjusted. No physical-sensor code is included. No external dependency or paid service is added.

Repairs preserve the existing scoring algorithm: local date-only parsing/invalid-date rejection; one carryover history entry per local day; validated horizon parameter with N calendar days including today; done/waiting aliases and unknown-state safety; duplicate task-ID rejection. Browser export uses globalThis, including test contexts. Clock/timezone semantics use the running device's local timezone; multi-timezone scheduling configuration is not implemented.

## Implemented vertical slice

- Today's Agenda is the default on normal app boot. Existing Overview, Goal Stack, Execution, Motivation Lab, Evidence and System Improvement Log remain.
- `agenda-model.js` projects the original `profile.execution.tasks` into Today, Upcoming, HOLD, Completed and Needs review. Missed/partial results remain Needs review, preserving measured effort; missing prerequisites remain blocked. One-off tasks need no invented goal relationship.
- Add, complete, HOLD/release and Refresh/approve/reject use the same transactional save boundary. Completion records actual minutes and a before-event; repeated completion is idempotent. No completed-history deletion control is introduced.
- Optional additive `profile.agenda` version-1 metadata stores events, proposals and rejection memory. Existing JSON schema version, key and unknown fields remain. Unsupported/malformed Agenda metadata fails closed.
- Refresh calls Grok's patched engine. It stores proposed actions only, not carried task copies. Repeated Refresh cannot increment persisted task counters, clone tasks or rewrite due dates. IDs/due dates remain stable until an explicit action.
- Approval checks the exact task snapshot. Reschedule asks the owner for the new date and confirmation. Prioritize adds a visible flag and sorts approved priorities first; approved proposals also enter the existing decision register; prerequisite acknowledgement records review and does not complete or remove the dependency. Stale proposals are retired on Refresh; rejection memory survives restart.
- No automatic migration/import of `lifepilot-command-center-demo-v06`, AI command integration, cloud sync or new authentication. Those remain later slices. Existing legacy hold/waiting statuses are displayed safely but require reviewed migration before release; newly created Agenda holds can be released manually.

## Validation

Commands:

```
TZ=America/Phoenix node test/radar-original.cjs
node --test test/*.test.cjs prime-workout/structure.test.mjs prime-workout/regression.test.mjs
```

Original Grok script: **38 assertions pass** (not 38 node:test cases). Integrated Node suite: **57 checks pass**, comprising 40 inherited storage/legacy/unchanged Prime checks and 17 new Radar/Agenda checks. Tests use only fictional records.

New evidence covers Phoenix/UTC date-only boundaries; horizon limits; idempotent carryover; status aliases; duplicate completion conflicts; dependency cycles; non-mutating projections; stable original records across Refresh; explicit/stale approval; rejection/restart; completion/effort/history; HOLD/prerequisite enforcement; stale retirement; durable UI-command application and failed-approval rollback.

Isolated managed Chrome UI, with disposable data and a labeled lock fixture: added a dated task, displayed overdue carryover, generated a proposal without changing its due date, rejected it and refreshed without resurfacing, moved the task to HOLD, released it, and completed it with seven actual minutes. A real iframe reload retained Completed (1), the original due date and seven actual minutes. This is desktop Chrome, not physical Android.

## Remaining release gates / limits

- Native Web Locks is absent in the supported HTTP internal preview. Fixture-based UI checks are not native secure-origin locking verification. PR #27's HTTPS/native-lock and real browser file export/restore gates remain open.
- Physical Android/Chromebook acceptance is pending; no release-ready mobile claim.
- Existing legacy inline handlers outside the new Agenda still require identifier hardening. The new row controls use escaped data attributes and delegated listeners.
- The independent ai-copilot prototype store is not imported or replaced. Cloud-sync scope remains unresolved. No live AI request was made.
- Agenda event/proposal history is uncapped for preservation; retention/compaction needs review before high-volume use. Rejections suppress the same task/action until the owner changes that policy; there is no expiry UI.
- A reviewed legacy/prototype import bridge, richer task editing/project linking and the unified CoPilot command adapter are not complete in this slice.

Owner approval is required before merge or deployment. Do not push this branch to Render's auto-deployed ai-copilot branch.
