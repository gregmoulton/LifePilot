// Same profile validation contract as the retained local store.
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const collection = value => Array.isArray(value) && value.every(object);
  const copy = value => value === null ? null : JSON.parse(JSON.stringify(value));
export function validProfile(value) {
    if (!object(value) || !collection(value.goals)) return false;
    for (const goal of value.goals) for (const key of ['known_context', 'next_actions']) {
      if (goal[key] !== undefined && !Array.isArray(goal[key])) return false;
    }
    for (const key of ['decision_register', 'system_improvement_log']) {
      if (value[key] !== undefined && !collection(value[key])) return false;
    }
    if (value.agenda !== undefined && (!object(value.agenda) || value.agenda.version !== 1 || !['events', 'proposals', 'rejections'].every(key => collection(value.agenda[key])))) return false;
    if (value.execution !== undefined) {
      if (!object(value.execution)) return false;
      for (const key of ['programs', 'milestones', 'tasks', 'observations', 'experiments', 'reviews']) {
        if (value.execution[key] !== undefined && !collection(value.execution[key])) return false;
      }
    }
    return true;
  }
