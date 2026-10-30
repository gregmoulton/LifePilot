/**
 * Life Pilot POE Optimizer — isolated deterministic core
 * Pure functions only. No I/O, no side effects, no real data.
 * See POE_OPTIMIZATION_CONTRACT.md
 */

function daysBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.round(ms / 86400000);
}

function scoreRecommendation(rec, goal, now) {
  const urgency = Math.max(0, Math.min(1, (30 - daysBetween(now, goal.ownerTargetDate)) / 30));
  const benefit = rec.estimatedBenefit ?? 0.5;
  const feasibility = rec.feasibility ?? 0.6;
  const alignment = goal.priorityWeight ?? 0.5;
  const risk = rec.risk ?? 0.3;
  return +(urgency * 0.3 + benefit * 0.25 + feasibility * 0.2 + alignment * 0.15 - risk * 0.1).toFixed(3);
}

function hasMaterialChange(rec, decisions, now) {
  const last = decisions.filter(d => d.recommendationId === rec.id).pop();
  if (!last || last.action !== 'reject') return true;
  // Material if >14 days since rejection or new evidence flag
  return daysBetween(last.timestamp, now) > 14 || rec.newEvidence === true;
}

/**
 * @param {object[]} goals
 * @param {object[]} requirements
 * @param {object[]} dependencies
 * @param {object[]} decisions
 * @param {string} now ISO date
 * @returns {{ recommendations: object[], forecasts: object[], suppressed: string[] }}
 */
function optimize(goals, requirements, dependencies, decisions, now) {
  const suppressed = [];
  const candidates = [];

  for (const goal of goals) {
    const reqs = requirements.filter(r => r.goalId === goal.id && r.status !== 'met');
    for (const req of reqs) {
      const deps = dependencies.filter(d => d.fromReqId === req.id);
      const blocked = deps.some(d => d.type === 'hard' && d.status !== 'met');
      if (blocked) continue;

      const rec = {
        id: `rec-${goal.id}-${req.id}`,
        goalId: goal.id,
        requirementId: req.id,
        type: req.type || 'next',
        rationale: `Advance requirement "${req.description}" for Goal ${goal.id}.`,
        assumptions: req.assumptions || ['Owner provides any missing evidence'],
        estimatedBenefit: req.benefit ?? 0.6,
        feasibility: blocked ? 0.2 : 0.7,
        risk: deps.some(d => d.status === 'unknown') ? 0.6 : 0.2,
        newEvidence: req.newEvidence || false,
        crossGoalImpacts: req.impacts || []
      };
      rec.rankScore = scoreRecommendation(rec, goal, now);

      if (!hasMaterialChange(rec, decisions, now)) {
        suppressed.push(rec.id);
        continue;
      }
      candidates.push(rec);
    }
  }

  candidates.sort((a, b) => b.rankScore - a.rankScore || a.goalId.localeCompare(b.goalId));

  const forecasts = goals.map(g => {
    const approved = decisions.filter(d => d.action === 'approve' && d.goalId === g.id);
    const slip = approved.length ? 7 * approved.length : 0;
    const previous = g.currentForecast || g.ownerTargetDate;
    const newForecast = slip
      ? new Date(new Date(previous).getTime() + slip * 86400000).toISOString().slice(0, 10)
      : previous;
    return {
      goalId: g.id,
      ownerTarget: g.ownerTargetDate,
      previousForecast: previous,
      newForecast,
      confidence: slip ? 0.7 : 0.9
    };
  });

  return { recommendations: candidates.slice(0, 5), forecasts, suppressed };
}

// Export for both browser and Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { optimize, scoreRecommendation, daysBetween };
}
