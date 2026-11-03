// Synthetic sample data only. This is not production Life Pilot code.
export const PLANNING_STATES = Object.freeze(["scheduled", "done", "missed"]);

export function describeMockTask(task) {
  if (!task || typeof task !== "object") return "invalid";
  if (task.status === "done") return "completed";
  if (task.status === "missed") return "needs-review";
  return "upcoming";
}
