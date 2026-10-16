# Life Pilot 1.0 — Delivery Roadmap
Baseline: 2026-10-15. Owner-facing planning document; estimates are not promises.

## Scope / definition of done
A usable single-owner Life Pilot application: goal/program/milestone/task command center; Refresh proposal engine; Prime Workout logging and progress; AI CoPilot behind authentication and approval; coherent navigation; durable backup/recovery; integrated regression tests; real-device acceptance testing. Cross-device cloud sync and proactive automations are **2.0**, not 1.0.

## Completion score (evidence-based)
Use fixed weights totaling 100. Award 0% for unstarted, 25% for design/code isolated, 50% for implementation integrated but untested, 75% for automated tests passing, and 100% only for deployed and owner-verified acceptance. Where appropriate, intermediate scores require explicit evidence. Never equate code committed with user acceptance.

| Workstream | Weight | Baseline earned | Evidence / gap |
| --- | ---: | ---: | --- |
| Goal Stack / execution foundation | 20 | 20 | v0.4 published, owner acceptance Oct 11 |
| Prime Workout | 15 | 8 | Hosted logging and persistence user-tested; progress isolated branch, not integrated |
| Refresh task consolidation | 15 | 4 | Engine and initial tests isolated; no command center integration |
| AI CoPilot secure workflow | 20 | 5 | Security code on ai-copilot; configuration/runtime integration not validated |
| Unified UX and data interoperability | 15 | 0 | v0.4, CoPilot, Prime have separate storage/entry points |
| Regression, recovery and 1.0 acceptance | 15 | 3 | Existing v0.4 tests/backups, not integrated suite |
| **Total** | **100** | **40** | **Provisional baseline, not measured calendar time** |

## Proposed delivery windows (assuming focused development sessions and no external blockers)
- **Oct 15–22:** integrate Prime progress, strengthen tests and backup handling; Refresh adapters/proposal UI.
- **Oct 23–Nov 1:** unify navigation and records, approval workflow, import/export compatibility.
- **Nov 2–12:** secure CoPilot integration, authentication and budget controls; no paid API calls without approval.
- **Nov 13–20:** end-to-end regression, Chromebook/mobile acceptance, bug fixes, release candidate.
- **Target 1.0 acceptance: Nov 20, 2026**; planning range **Nov 13–Dec 4**. This is a scenario estimate, not a guaranteed delivery date; idle periods and deployment dependencies move it.

## Progress reporting
After each substantive development session update workstream earned points, total score, evidence links/commits, blockers, next step, and estimated delivery window. Do not advance scores based solely on plans. A session ends when the assistant finishes its response; no background development is implied.

## Scope guardrails
No paid service, credential change, deployment change affecting existing live functionality, or irreversible data migration without owner approval. Keep cloud synchronization and autonomous integrations out of 1.0 unless separately approved.
