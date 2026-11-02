import type { BehaviourNode, BehaviourPlan } from "../data/types";

// Seam placement covers autonomous paths before acquisition, including every unguarded alternative.
export function unacquiredBehaviourNodes(plan: BehaviourPlan): readonly BehaviourNode[] {
  const reachable = new Set<string>();
  const pending = [plan.initial];
  while (pending.length > 0) {
    const key = pending.pop()!;
    if (reachable.has(key)) {
      continue;
    }
    const node = plan.states[key];
    if (!node) {
      throw new Error(`Missing behaviour state ${key}`);
    }
    reachable.add(key);
    for (const transition of node.transitions) {
      // Conditions within one transition are AND; separate transitions remain alternatives.
      const requiresAcquisition = transition.when.some(
        (condition) =>
          condition.kind === "pursuit-ended" ||
          (plan.pursuit !== undefined && condition.kind === "visible"),
      );
      if (!requiresAcquisition) {
        pending.push(transition.to);
      }
    }
  }
  return Object.entries(plan.states)
    .filter(([key]) => reachable.has(key))
    .map(([, node]) => node);
}
