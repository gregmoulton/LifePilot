// Pure, read-only classification of caller-supplied Life Pilot profile bytes.
// No storage access, writes, logging, network calls, or automatic recovery.
export function classifyProfileBytes(raw) {
  if (raw === null || raw === undefined) return { status: 'absent' };
  if (typeof raw !== 'string') return { status: 'invalid-input' };
  let profile;
  try { profile = JSON.parse(raw); }
  catch { return { status: 'invalid-json' }; }
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) ||
      !Array.isArray(profile.goals)) return { status: 'invalid-shape' };
  if (profile.goals.some(goal => !goal || typeof goal !== 'object' ||
      Array.isArray(goal))) return { status: 'invalid-shape' };
  if (profile.decision_register !== undefined &&
      !Array.isArray(profile.decision_register)) return { status: 'invalid-shape' };
  return {
    status: profile.goals.length === 0 ? 'empty' : 'populated',
    goalCount: profile.goals.length,
    decisionCount: Array.isArray(profile.decision_register) ?
      profile.decision_register.length : 0
  };
}
