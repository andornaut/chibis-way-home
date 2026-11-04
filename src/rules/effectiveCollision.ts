import type { Collision, HazardPhase, ObjectLayout } from "../data/types";
import type { BehaviourState } from "./behaviour";

// Only a fully labelled stationary clock may change lethal contact. Actor and support
// lifecycles remain outside this contract.
export function validateHazardPhases(object: ObjectLayout): void {
  const plan = object.behaviour;
  if (!plan || !Object.values(plan.states).some((node) => node.hazardPhase !== undefined)) {
    return;
  }
  const invalid = () => {
    throw new Error(`Hazard phases require a stationary elapsed-only cycle: ${object.character}`);
  };
  if (
    object.collision !== "hazard" ||
    object.contact ||
    object.orbit ||
    object.scene !== undefined ||
    object.reaction.kind !== "none" ||
    object.motion.algorithm !== "static" ||
    plan.distance !== 0 ||
    plan.pursuit ||
    plan.idleWatchdog ||
    plan.groundReposition ||
    plan.spotted ||
    plan.attackCooldownSeconds !== undefined
  ) {
    invalid();
  }
  for (const node of Object.values(plan.states)) {
    const condition = node.transitions[0]?.when[0];
    if (
      !["inactive", "warning", "active"].includes(node.hazardPhase ?? "") ||
      node.motion.kind !== "wait" ||
      node.motion.support !== undefined ||
      node.track ||
      node.enter ||
      node.attack ||
      (node.onEnter?.length ?? 0) > 0 ||
      node.allowIdleReposition ||
      node.allowGroundReposition ||
      node.transitions.length !== 1 ||
      node.transitions[0]!.when.length !== 1 ||
      condition?.kind !== "elapsed" ||
      !Number.isFinite(condition.seconds) ||
      condition.seconds <= 0
    ) {
      invalid();
    }
  }
  const visited = new Set<string>();
  let key = plan.initial;
  while (!visited.has(key)) {
    visited.add(key);
    const node = plan.states[key];
    if (!node) {
      invalid();
    }
    key = node!.transitions[0]!.to;
  }
  if (key !== plan.initial || visited.size !== Object.keys(plan.states).length) {
    invalid();
  }
}

export function effectiveHazardPhase(
  object: ObjectLayout,
  state: Pick<BehaviourState, "stateKey"> | undefined,
): HazardPhase | undefined {
  const plan = object.behaviour;
  if (!plan) {
    return undefined;
  }
  const node = plan.states[state?.stateKey ?? plan.initial];
  if (!node) {
    throw new Error(`Missing behaviour state for ${object.character}`);
  }
  return node.hazardPhase;
}

// A dead boss has no collision.
export function effectiveCollision(
  object: ObjectLayout,
  state: Pick<BehaviourState, "defeat" | "stateKey"> | undefined,
): Collision {
  if (state?.defeat) {
    return "none";
  }
  const phase = effectiveHazardPhase(object, state);
  return phase === undefined ? object.collision : phase === "active" ? "hazard" : "none";
}
