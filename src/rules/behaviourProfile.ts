import type { BehaviourMotion, BehaviourPlan } from "../data/types/index.ts";

export interface PursuitKinds {
  readonly flight: boolean;
  readonly flyGateway: string | undefined;
  readonly groundTraversal: boolean;
  // The first ground pursuit with a traversal profile and the first overhead flight, in state
  // order.
  readonly groundTraversalMotion: BehaviourMotion | undefined;
  readonly overhead: BehaviourMotion | undefined;
}

const pursuitKindsCache = new WeakMap<BehaviourPlan, PursuitKinds>();

export function pursuitKinds(plan: BehaviourPlan): PursuitKinds {
  const cached = pursuitKindsCache.get(plan);
  if (cached) {
    return cached;
  }
  let flight = false;
  let flyGateway: string | undefined;
  let groundTraversal = false;
  let groundTraversalMotion: BehaviourMotion | undefined;
  let overhead: BehaviourMotion | undefined;
  for (const [key, { motion }] of Object.entries(plan.states)) {
    if (motion.kind === "pursue") {
      flight ||= motion.mode === "fly";
      if (motion.mode === "fly") {
        flyGateway ??= key;
        if (motion.overhead) {
          overhead ??= motion;
        }
      }
      groundTraversal ||= motion.mode === "ground" && Boolean(motion.traversal);
      if (motion.mode === "ground" && motion.traversal) {
        groundTraversalMotion ??= motion;
      }
    }
  }
  const kinds = { flight, flyGateway, groundTraversal, groundTraversalMotion, overhead };
  pursuitKindsCache.set(plan, kinds);
  return kinds;
}
