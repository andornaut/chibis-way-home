import type { BehaviourMotion, ObjectLayout, Point } from "../data/types";
import type { BehaviourState } from "./behaviour";
import { selectSupportedFlight } from "./behaviourFlightSelection";
import type { BehaviourPerception } from "./behaviourPerception";
import type { BehaviourWorld } from "./behaviourReach";
import {
  type FlyLandingState,
  landingSupport,
  landingWorldAt,
  proveFlyLanding,
  supportContact,
} from "./flyLanding";

export interface BehaviourSupport {
  readonly state: BehaviourState;
  // Whether the body rests on certified support now.
  readonly supported: boolean;
  // The next proven landing waypoint, if a landing is still needed.
  readonly target: Point | undefined;
  // The support world at the slice start; undefined for motions without support.
  readonly world: BehaviourWorld | undefined;
}

// Evaluates support for a supported motion at a slice start: a varied perch selection, the
// nearest proven landing, or the carried support of a dwell, which restarts when it is lost
// or changes.
export function prepareSupport(
  { world }: BehaviourPerception,
  object: ObjectLayout,
  motion: BehaviourMotion,
  time: number,
  current: Point,
  state: BehaviourState,
): BehaviourSupport {
  const supportMotion =
    (motion.kind === "fly" && motion.to === "support") ||
    (motion.kind === "wait" && motion.support === "required");
  const supportWorld = supportMotion ? landingWorldAt(world, time) : undefined;
  let next = state;
  let supported =
    supportWorld !== undefined &&
    supportContact(object, supportWorld, current) &&
    (motion.kind !== "wait" || next.landing !== undefined);
  let landingTarget: Point | undefined;
  if (motion.kind === "fly" && motion.to === "support" && motion.selection) {
    const proof =
      supportWorld &&
      selectSupportedFlight(
        supportWorld,
        object,
        motion,
        next.facing,
        next.flightDecision ?? 0,
        current,
        next.flightSelection,
      );
    const selection = proof?.state ?? {
      entry: next.flightSelection?.entry ?? current,
      status: "pending" as const,
    };
    supported = selection.status === "supported";
    landingTarget = proof?.points?.[0];
    const support = supported && supportWorld && landingSupport(object, supportWorld, current);
    next = {
      ...next,
      flightDecision: proof?.decision ?? next.flightDecision ?? 0,
      flightSelection: selection,
      landing: {
        speed: motion.speed,
        status: selection.status,
        ...(support && { support }),
      },
    };
  } else if (supportMotion) {
    const speed = motion.kind === "fly" ? motion.speed : next.landing?.speed;
    const support = supportWorld && landingSupport(object, supportWorld, current);
    const previous = next.landing?.support;
    const changed =
      previous &&
      support &&
      (previous.owner !== support.owner || (!support.owner && previous.rect !== support.rect));
    if (speed !== undefined) {
      next = {
        ...next,
        landing: {
          ...next.landing,
          speed,
          status: supported ? "supported" : "pending",
          ...(support && { support }),
        },
      };
    }
    if (next.landing && !supported) {
      const withoutSupport = { ...next.landing };
      delete (withoutSupport as { support?: FlyLandingState["support"] }).support;
      const proof = supportWorld && proveFlyLanding(object, supportWorld, current, withoutSupport);
      next = { ...next, landing: proof?.state ?? { ...withoutSupport, status: "pending" } };
      landingTarget = proof?.points?.[0];
    }
    if (motion.kind === "wait" && (!supported || changed)) {
      next = { ...next, elapsed: 0 };
    }
  }
  return { state: next, supported, target: landingTarget, world: supportWorld };
}
