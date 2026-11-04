import { EDGE } from "../core";
import type { ObjectLayout, Point } from "../data/types";
import type { BehaviourState } from "./behaviour";
import type { BehaviourPerception } from "./behaviourPerception";
import { flightAxis, overheadFlightGoal, overheadFlightRoute } from "./behaviourReach";
import { contactBox, nodeOf } from "./behaviourTrack";
import { birdBox } from "./bird";

// Where a target flight is heading now: its captured target, live aligned drop point or
// anchored point. Undefined for other motions or a missing capture.
export function flightDestination(
  perception: BehaviourPerception,
  object: ObjectLayout,
  at: Point,
  state: BehaviourState,
): Point | undefined {
  const { target: bird, tuning } = perception;
  const motion = nodeOf(object, state.stateKey).motion;
  if (motion.kind !== "fly") {
    return undefined;
  }
  if (motion.to === "support") {
    return undefined;
  }
  if (motion.to === "target") {
    return state.flightTarget;
  }
  if (motion.to === "target-x") {
    if (!state.flightTarget) {
      return undefined;
    }
    const contact = contactBox(object, at, state.facing, state.axis);
    const target = birdBox(tuning, bird);
    if (motion.ahead !== undefined && state.flightApproachDirection === undefined) {
      throw new Error("Ahead alignment requires a committed overhead approach direction");
    }
    const ahead = motion.ahead === undefined ? 0 : motion.ahead * state.flightApproachDirection!;
    const lead = Math.max(-motion.maxLead, Math.min(motion.maxLead, bird.vx * motion.leadSeconds));
    return {
      x: target.x + target.width / 2 - contact.width / 2 - (contact.x - at.x) + ahead + lead,
      y: state.flightTarget.y,
    };
  }
  return {
    x: (state.anchor ?? object.origin).x + motion.to.x,
    y: (state.anchor ?? object.origin).y + motion.to.y,
  };
}

// Whether the current motion cannot align: a pending varied selection, an unroutable overhead
// goal, or a drop point outside its bounds or behind terrain.
export function alignmentBlocked(
  perception: BehaviourPerception,
  object: ObjectLayout,
  at: Point,
  state: BehaviourState,
): boolean {
  const { target: bird, tuning, world } = perception;
  const motion = nodeOf(object, state.stateKey).motion;
  if (motion.kind === "fly" && motion.to === "support" && motion.selection) {
    return state.flightSelection?.status === "pending";
  }
  if (motion.kind === "pursue" && motion.mode === "fly" && motion.overhead) {
    if (state.flightApproachDirection === undefined) {
      return true;
    }
    const target = overheadFlightGoal(
      tuning,
      motion.overhead,
      state.flightApproachDirection,
      bird,
      object,
    );
    return overheadFlightRoute(world, object, at, target) === undefined;
  }
  if (motion.kind !== "fly" || motion.to !== "target-x") {
    return false;
  }
  const target = flightDestination(perception, object, at, state);
  if (!target) {
    return true;
  }
  const origin = state.anchor ?? object.origin;
  return (
    target.x < origin.x + motion.bounds.x - EDGE ||
    target.x > origin.x + motion.bounds.x + motion.bounds.width + EDGE ||
    target.y < origin.y + motion.bounds.y - EDGE ||
    target.y > origin.y + motion.bounds.y + motion.bounds.height + EDGE ||
    Math.abs(flightAxis(object, world, at, "x", target.x) - target.x) > EDGE
  );
}
