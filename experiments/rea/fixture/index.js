// This deliberately throws if imported or executed.
// The isolated REA proof of concept must use static analysis ONLY.
import { describeMockTask } from "./rules.js";

export function summarizeSyntheticPlan(items) {
  return items.map((item) => ({ id: item.id, label: describeMockTask(item) }));
}

throw new Error("STATIC ANALYSIS ONLY: running the fixture is prohibited");
