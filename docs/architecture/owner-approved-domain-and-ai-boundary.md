# Life Pilot: owner-approved domain and AI boundary contract

Status: implementation contract, **not** a claim that runtime controls are shipped. Owner approval: 2026-11-10. Related: #108 #109 #110 #111.

## Product invariants

- **Form follows function; as simple as possible, but no simpler.** User sees a concise, useful daily overview, not a task-entry form.
- Final approved **light CRM-like** visual references take precedence over historical neon/dark and green mockups. Recover and reconcile actual final ~15 renders before implementing styles. No independent visual redesign.
- Life Pilot owns domain state and approval history; AI models are replaceable untrusted inference providers.
- A conversational CoPilot is **never** a developer agent. It cannot change code, deployments, design tokens, permissions, or database schema.
- No purchases, paid API activation, real-data migration, deployment, or consequential mutations without applicable owner authorization.

## Distinct domain entities

| Type | Meaning | Completion criterion |
| --- | --- | --- |
| Aspiration | Uncommitted possibility being explored | User commits, defers, or dismisses |
| Goal | Desired outcome with target and evidence | Outcome verified |
| Project | Scoped coordinated work producing deliverables | Deliverables accepted |
| Milestone | Significant checkpoint for a goal or project | Evidence recorded |
| Task | Actionable step with owner/status | Action verified |

Relationships are many-to-many: a project may advance several goals; a goal may have several projects. No forced one-parent hierarchy. Edges carry provenance, verification state, and impact; inferred dependencies are marked as hypotheses until validated.

## Core record contract (conceptual)

Each record has id, owner_id, type, title, lifecycle_state, created_at, updated_at, source/provenance and version. Goals additionally have target_date, target_metric and actual/forecast evidence; projects have deliverables and acceptance criteria. Links are typed and evidence-backed. Decisions store actor, timestamp, rationale, approved/rejected status, and reversible change history.

## AI action boundary

1. Model receives a minimal authorized context snapshot and narrowly scoped tool descriptions.
2. Model returns structured *proposals*, never executable instructions.
3. Backend validates schema, tenant isolation, ownership, permissions, current versions, and approval requirement.
4. Proposed changes display a readable diff and await explicit owner approval where required.
5. Backend commits authorized mutations transactionally and records immutable audit evidence; supports rollback/undo where feasible.
6. Untrusted retrieved content and model output cannot elevate permissions or issue code/deployment commands.

## Acceptance scenarios

- A vague idea (e.g., guitar/singing or part-time Europe) remains an **Aspiration** until the user explicitly commits.
- A BH employment **Project** may link to income and career **Goals**; practicum linkage is provisional until eligibility verified.
- A deferred bank option is not repeatedly recommended in violation of the recorded restriction.
- A model switch (OpenAI/Claude/Grok) retains all Life Pilot records and approvals.
- Prompt injection attempting to edit UI, spend money, alter another user's data, or bypass approval is rejected and logged.
- The same domain model renders as a readable mobile-first light CRM interface; owner visually accepts screenshots compared with approved final renders.

## Incremental delivery order

1. Confirm active branches and coordinate with Claude's security work; no overlapping edits.
2. Implement schema/relations + approval checks in isolated tests with fictional data.
3. Wire one provider adapter, one exploration-to-goal workflow, one dependency view, and one persisted daily briefing.
4. Compare actual UI screenshots to approved references at matching Android and Chromebook viewport sizes.
5. Verify owner auth, isolation, migration safety, tests, and owner acceptance before promotion.

This contract is intentionally provider-neutral and independent of frontend framework.
