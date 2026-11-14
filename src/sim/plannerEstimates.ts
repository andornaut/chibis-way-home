import type { BirdTuning } from "../data/types/index.ts";

// Legacy planner heuristic, distinct from ballistic height and native held-jump reach.
export function legacyPlannerJumpHeight(tuning: BirdTuning): number {
  return (tuning.jumpSpeed * tuning.jumpRiseTime) / 2;
}
