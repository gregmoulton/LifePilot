# Next integration slice: Agenda, safe storage, Refresh and carryover

Prepared October 23, 2026 for Issue #24; implementation contract, not a claim of completed integration. Depends on reviewed PR #27. No merge/deploy or live-profile conversion is authorized by this document. The Pure stays outside this workstream.

## Scope and recommended approach

Add an Agenda projection and a single durable command boundary to the legacy-compatible profile. Reuse the existing HTML/JS architecture and Node backend. Preserve all original exports and data; do not replace main with ai-copilot's diverged index or silently combine its separate profile. Do not add a framework, cloud service, paid API or migration on app startup.

Use `profile.execution.tasks` as the authoritative task collection. One-off tasks may omit goal/program/milestone relationships. Existing relationships remain stable IDs; missing references are reported for review rather than reassigned. Preserve unknown fields, original source IDs/status and measured results. New optional `profile.agenda` metadata holds versioned events, proposal receipts and reviewed-import provenance; do not overwrite the legacy schema version.

### Read-only normalization contract

| Existing input | Agenda projection | Preservation rule |
| --- | --- | --- |
| execution `planned` | open; Today if unscheduled or due today/overdue, Upcoming if future | Original ID, due, prerequisites and program sequence unchanged |
| execution `completed` | Completed/history | Never inferred reopened by Refresh or a stale duplicate |
| execution `partial` / `missed` | Needs attention, with observed result shown | Preserve effort/recorded_at/history; explicit approval before scheduling another attempt |
| prototype `today` | Reviewed import becomes planned/open with source status retained | Namespace imported ID by source; no name-only deduplication |
| prototype `waiting` or explicit HOLD | HOLD; blocked reason/dependency visible | Exclude from executable recommendations until explicitly released |
| prototype `done` | Completed/history | Preserve completion and source ID; unresolved duplicate conflict blocks application |
| unknown status / invalid date / broken dependency | Needs review | Do not guess a date or treat as executable |

Adapter output (proposed internal DTO, not Grok's assumed API): stable task ID, name, original record reference, lifecycle, hold reason, goal/program/milestone IDs, prerequisites, due kind/value, original source/version, priority and feasibility context when explicitly supplied. Keep lifecycle, scheduling, actual effort and approval state separate.

Local date-only values are calendar dates in the profile's selected timezone; datetime-local values remain local wall times. Do not parse date-only strings as UTC instants. Missing/invalid timezone/date must be surfaced. Supply a fixed clock and timezone to deterministic tests.

## Durable commands

Proposed application-owned functions, to be implemented in the next feature branch:

- `projectAgenda(profile, {today, timezone})`: pure projections for Today, Upcoming, HOLD, Completed and Needs review. No task mutation, date rewrite or network.
- `executeAgendaCommand(repository, command)`: validates referenced IDs and base snapshot; produces a cloned candidate with additive event/receipt; commits through safe storage. Only committed results produce applied/success UI.
- `previewRefresh(normalizedSnapshot, reviewedEngine)`: calls Grok's exact reviewed entry point through an adapter. Output is proposals/reasons/conflicts, never direct task edits.
- `decideProposal(id, decision, baseToken)`: approve/reject explicitly. Approval and task change/event are one commit. Rejection memory is durable. A rejected/no-op/stale proposal cannot be silently applied.

Commands include task add, complete/result, reschedule, hold/release, proposal approval/rejection, and reviewed import. Manual/offline and later AI callers share the same boundary. Consequential changes require owner approval; no paid AI call is necessary for this slice.

The proposal envelope includes stable proposal ID, task IDs, engine/version provenance, reason/evidence, before/after description, requires_approval, base snapshot token and status (`proposed`, `rejected`, `applied`, `failed`). A task must not remain "approved" in memory when application fails. Successful command/event/receipt are atomic in one profile write; failed attempts remain recoverable in memory with explicit failure feedback, and cannot truthfully be called durable until a later save succeeds. No separate receipt write may override a newer tab.

## Carryover

Carryover is a projection of unfinished eligible tasks, not a daily cloning job. Keep task ID, original due date and completion history unchanged across midnight/reload. An overdue task remains visible until resolved, held or explicitly rescheduled. Completing it removes it from active projections after durable save and restart. HOLD items stay HOLD. Future commitments stay Upcoming. No background scheduler is claimed.

## Grok intake gate (Issue #25)

The owner reports a Forward Radar package with 38 passing tests. The package has not yet been independently obtained/run here. Do not rebuild its ranking/deduplication algorithms or copy the defective old Refresh MVP as a substitute.

Obtain exact source/immutable commit, entry point, dependencies/lockfiles, test command, all tests/fixtures and license/runtime notes. Review scripts before execution; run in isolation with fictional data and no credentials/network. Record package hash/version. Verify the reported tests plus independent integration cases: completed/stale duplicates, HOLD, dependency cycles, day/timezone boundaries, carryover, determinism, rejection memory, no input mutation and no automatic action application. Report defects for correction; adapt the interface only after examining the real API.

The Work adapter/proposal store may be prepared independently. Wiring the engine and claiming Radar completion are blocked on source delivery/review. Gemini #26 can independently verify UI/storage/approval/mobile behavior and the future Google Calendar fixture contract; do not start OAuth or integrations.

## Narrow delivery order and acceptance

1. Add pure profile/status/date adapter and fixture tests; no storage migration. Explicit reviewed import preview preserves both source stores and rejects conflicts atomically.
2. Add durable commands and agenda event/proposal namespace through #27's repository, with legacy export/restart tests.
3. Add Agenda UI using existing shell: Today, Upcoming, HOLD, Completed and Needs review. Carryover derived from unchanged records. Do not remove Motivation Lab or Improvement Log.
4. Review Grok source, implement its thin adapter, then connect Refresh previews and approve/reject actions. No algorithm rewrite.
5. Browser/mobile acceptance, synthetic backup restore and failure/reload checks; draft PR with exact evidence. Owner approval before merge/deploy.

| Gate | Required result |
| --- | --- |
| Eight-goal legacy + unknown fields | Before/after backup retains every field, execution record and Improvement Log entry |
| Reviewed prototype import | Stable source IDs; duplicate/conflict review; no startup migration or source deletion |
| Complete task + reload | Exactly one completion event; task absent from Today/Upcoming and present in history |
| Failure/quota/unsupported locks | No applied-success receipt; prior profile shown; attempted change recoverable |
| Two tabs / stale proposal | Losing write rejected; no lost winner; no stale approval |
| Midnight / multiple refreshes | Same carryover ID/due; no cloned tasks, duplicate proposals or automatic reschedule |
| HOLD / future / prerequisite | Correct projection; blocked task not executable; program sequence retained |
| Reject proposal + restart | Rejection retained and applied by the engine adapter contract; no silent resurfacing |
| Approved reschedule | Explicit date change and prior value/event recorded atomically |
| AI unavailable | Manual agenda and local proposal review remain usable without credentials/API |
| Mobile + recovery | Actual Chrome UI and Android acceptance distinguished from VM/synthetic fixtures |

Estimate after #27 review: 4–7 active engineering hours for adapter/commands/Agenda and integration QA, excluding source delivery, owner acceptance and unknown Grok defects. Re-estimate after source review. Cloud-sync scope and release origin need explicit reconciliation before cloud work; neither blocks a local synthetic integration slice.
