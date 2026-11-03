import type { ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourState } from "./behaviour";
import type { BehaviourTraversalFrame } from "./behaviourReach";
import { EDGE } from "./bird";
import type { Track } from "./motion";
import { STEP_SECONDS } from "./step";

export interface ForcedTransitCarrier {
  readonly index: number;
  readonly owner: ObjectLayout;
  readonly rect: Rect;
  readonly state: BehaviourState | undefined;
  readonly track: Track;
}

export interface ForcedTransitForecastContext {
  readonly area: string;
  readonly attempt: number;
  readonly dtSeconds: number;
  readonly seconds: number;
}

// Ephemeral identity-bound evidence, not a saved or extrapolated mover trajectory.
export interface ForcedTransitForecast {
  readonly afterOne: Rect;
  readonly afterOneSeconds: number;
  readonly afterTwo: Rect;
  readonly afterTwoSeconds: number;
  readonly carrier: ForcedTransitCarrier;
  readonly context: ForcedTransitForecastContext;
}

function sameRect(left: Rect, right: Rect): boolean {
  return (["x", "y", "width", "height"] as const).every(
    (axis) =>
      Number.isFinite(left[axis]) &&
      Number.isFinite(right[axis]) &&
      Math.abs(left[axis] - right[axis]) < EDGE,
  );
}

function predictable(carrier: ForcedTransitCarrier): boolean {
  const object = carrier.owner;
  if (!object.forcedTransit || object.orbit || object.reaction.kind !== "none") {
    return false;
  }
  const plan = object.behaviour;
  const state = carrier.state;
  if (
    state &&
    (state.activeAttack ||
      state.groundReposition ||
      state.hop ||
      state.idleWatchdog ||
      state.landing ||
      state.pendingEntry ||
      state.pursuit ||
      state.traversal)
  ) {
    return false;
  }
  if (!plan) {
    return (
      object.motion.variance === 0 && ["static", "linear", "ease"].includes(object.motion.algorithm)
    );
  }
  return (
    !plan.pursuit &&
    !plan.idleWatchdog &&
    !plan.groundReposition &&
    Object.values(plan.states).every(
      (node) =>
        !node.attack &&
        !node.enter &&
        !node.onEnter?.length &&
        !node.allowGroundReposition &&
        !node.allowIdleReposition &&
        ((node.motion.kind === "wait" && !node.motion.support) ||
          (node.motion.kind === "move" && typeof node.motion.direction === "number")) &&
        node.transitions.every(({ when }) =>
          when.every(({ kind }) => kind === "elapsed" || kind === "boundary"),
        ),
    )
  );
}

export function forecastForcedTransit(
  context: ForcedTransitForecastContext,
  sample: BehaviourTraversalFrame["sample"],
  carrier: ForcedTransitCarrier,
): ForcedTransitForecast | undefined {
  if (
    context.dtSeconds !== STEP_SECONDS ||
    !Number.isFinite(context.seconds) ||
    !sample ||
    !predictable(carrier)
  ) {
    return undefined;
  }
  const first = sample(context.seconds, STEP_SECONDS)?.find(({ owner }) => owner === carrier.owner);
  const second = sample(context.seconds + STEP_SECONDS, STEP_SECONDS)?.find(
    ({ owner }) => owner === carrier.owner,
  );
  if (
    !first ||
    !second ||
    !sameRect(first.before, carrier.rect) ||
    !sameRect(first.after, second.before) ||
    !sameRect(second.after, second.after)
  ) {
    return undefined;
  }
  return {
    afterOne: first.after,
    afterOneSeconds: context.seconds + STEP_SECONDS,
    afterTwo: second.after,
    afterTwoSeconds: context.seconds + STEP_SECONDS + STEP_SECONDS,
    carrier,
    context,
  };
}

export function forcedTransitTakeoffOrigin(
  context: ForcedTransitForecastContext,
  jump: { readonly bufferLeft: number; readonly jumpHeld: boolean },
  carrier: ForcedTransitCarrier,
  forecast: ForcedTransitForecast | undefined,
): Point | undefined {
  if (
    !forecast ||
    context.dtSeconds !== STEP_SECONDS ||
    context.area !== forecast.context.area ||
    context.attempt !== forecast.context.attempt ||
    context.seconds !== forecast.context.seconds ||
    context.dtSeconds !== forecast.context.dtSeconds ||
    carrier.index !== forecast.carrier.index ||
    carrier.owner !== forecast.carrier.owner ||
    carrier.state !== forecast.carrier.state ||
    carrier.track !== forecast.carrier.track ||
    !(["x", "y", "width", "height"] as const).every(
      (axis) => carrier.rect[axis] === forecast.carrier.rect[axis],
    ) ||
    !Number.isFinite(jump.bufferLeft) ||
    forecast.afterOneSeconds !== context.seconds + STEP_SECONDS ||
    forecast.afterTwoSeconds !== context.seconds + STEP_SECONDS + STEP_SECONDS
  ) {
    return undefined;
  }
  const at = jump.jumpHeld && jump.bufferLeft <= 0 ? forecast.afterTwo : forecast.afterOne;
  return { x: at.x, y: at.y };
}
