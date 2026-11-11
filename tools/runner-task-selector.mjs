// Fail-closed task selector for the future coding agent.
// No GitHub API calls, no model calls, no filesystem writes.
export function selectTask(issues, allowed = [76]) {
  if (!Array.isArray(issues) || !Array.isArray(allowed)) throw new TypeError('Invalid inputs');
  const candidates = issues.filter(i =>
    Number.isSafeInteger(i.number) &&
    allowed.includes(i.number) &&
    i.state === 'open' &&
    i.type !== 'pull_request' &&
    i.approved_for_agent === true &&
    i.risk === 'synthetic-only' &&
    i.requires_spend !== true &&
    i.requires_deploy !== true &&
    i.requires_profile_access !== true
  );
  candidates.sort((a,b) => a.number - b.number);
  return candidates[0] ? {number:candidates[0].number, title:String(candidates[0].title).slice(0,120)} : null;
}
