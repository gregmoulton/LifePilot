# Life Pilot POE Optimization Contract (Isolated)

**Issue**: #61 [AI worker: Grok] POE optimization contract + fictional fixture tests (isolated)

**Status**: Isolated design + deterministic fixtures. No live Agenda, no shared-sync edits, no production changes.

**Scope**: Smallest Goal → inferred requirement → dependency → ranked recommendation → owner approve/defer/reject → revised forecast workflow.

**References**:
- #43 acceptance suite (scenarios)
- #41 approved 18-goal baseline + additive #19
- #40 recommendation semantics (rank, rationale, rejection memory, no side effects)
- #21 coordination (Work integrates)

## Core Model

```
Goal (id, title, ownerTargetDate, status)
  └── Requirement (id, goalId, description, inferredFrom, status: open|met|unknown)
       └── Dependency (id, fromReqId, toReqId|external, type: hard|preference|resource, status)
            └── Recommendation (id, type: next|alternative|warning, rankScore, rationale, assumptions, impacts)
                 └── Decision (recommendationId, action: approve|defer|reject, timestamp, note)
                      └── ForecastRevision (goalId, previousForecast, newForecast, reason)
```

All data is fictional. No real balances, health metrics, or personal data.

### Ranking Rules (deterministic)

Score = (urgency * 0.3) + (benefit * 0.25) + (feasibility * 0.2) + (alignment * 0.15) - (risk * 0.1)

- urgency: days to owner target (higher if closer or overdue)
- benefit: estimated progress contribution (0-1)
- feasibility: known prerequisites met (0-1)
- alignment: owner priority weight (0-1)
- risk: resource conflict or unknown external (0-1)

Higher score ranks first. Ties broken by goal ID then recommendation ID.

### Rejection Memory

Rejected recommendations are suppressed unless material new evidence (new dependency status, new resource, date slip > 14 days) appears. Deferrals resurface after stated window or on material change. Approvals trigger forecast revision and mark related requirements as in-progress.

### No Side Effects

Recommendations are proposals only. Approval records decision and revises forecast; does not execute external actions, alter tasks, or mutate profile storage.

## Integration Contract (for Work)

**Input** (pure function):
```js
optimize(goals, requirements, dependencies, decisions, now) → {
  recommendations: RankedRecommendation[],
  forecasts: Forecast[],
  suppressed: string[] // rejected without new evidence
}
```

**Output fields**:
- recommendations[].id, type, rankScore, rationale, assumptions[], crossGoalImpacts[], proposedForecastDelta
- forecasts[].goalId, ownerTarget, previousForecast, newForecast, confidence

**Persistence boundary**: Caller (Agenda / profile) owns storage of Decision and ForecastRevision. Module is pure and side-effect free.

**Test contract**: Deterministic fixtures must produce identical ranked output for identical inputs. At least three cases covering conflict, unknown input, rejection memory, and approval reforecast.

## Assumptions

- Dates are ISO strings; comparison is chronological.
- Unknowns stay unknown (no invented balances or completion).
- Preference dependencies do not hard-block.
- Resource conflicts surface as warnings, not automatic reallocation.
- Additive Goal #19 does not alter the locked 18-goal baseline targets.

## Handoff to Work

- Drop `poe-optimizer.js` + `fixtures/` into an isolated feature branch.
- Wire `optimize()` behind existing approval gate.
- Persist Decision records under profile.execution or equivalent additive field.
- Re-run the three fixture cases in the acceptance suite from #43.
- Do not merge until owner acceptance of the vertical slice.
