import { stepTraversal } from "@andornaut/game-kit/runtime/terrain/traversal";

import { EDGE } from "../../core/index.ts";
import type { BehaviourMotion, ObjectLayout, Point } from "../../data/types/index.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { type BehaviourTraversalState, traversalContext } from "./behaviourTraversal.ts";

// Whether a ground pursuer the planner reports as unsupported rests in place: at its recorded
// physical pose, with no planned input or takeoff preparation, a step under gravity alone leaves
// it where it is. Its hitbox rests on terrain that does not span its width, so it is not
// airborne and will not land by waiting: its graph and scorer run, and its idle watchdog arms.
export function restingPursuer(
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: BehaviourMotion,
  seconds: number,
  traversal: BehaviourTraversalState | undefined,
  at: Point,
): boolean {
  const physical = traversal?.physical;
  if (
    motion.kind !== "pursue" ||
    motion.mode !== "ground" ||
    !physical ||
    physical.grounded ||
    traversal.preparation ||
    traversal.inputs.length > 0 ||
    physical.x !== at.x ||
    physical.y !== at.y ||
    Math.abs(physical.vy) > EDGE
  ) {
    return false;
  }
  const context = traversalContext(world, seconds, object, motion);
  const frame = world.traversalFrame;
  if (!context || !frame) {
    return false;
  }
  const still = stepTraversal(
    { ...context, safe: () => true },
    { jump: false, move: 0, timeSeconds: frame.timeSeconds },
    physical,
  );
  return (
    still.status === "ok" &&
    still.state.x === physical.x &&
    still.state.y === physical.y &&
    Math.abs(still.state.vy) <= EDGE
  );
}
