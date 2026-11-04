import { EDGE, sameRect, STEP_SECONDS } from "../core";
import type { BirdTuning, ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourState } from "./behaviour";
import type { BehaviourTraversalFrame } from "./behaviourReach";
import { type BirdState, stepBird } from "./bird";
import { ordinaryTransitControl } from "./forcedTransitProfile";
import type { Track } from "./motion";
import { finishPlatformBird, preparePlatformBird } from "./platformBird";

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

export interface ForcedTransitRiderContext {
  readonly bird: BirdState;
  readonly terrainSolids: readonly Rect[];
  readonly tuning: BirdTuning;
  readonly unknownPush: boolean;
}

export interface ForcedTransitTakeoffBody {
  readonly airCarryVx: number;
  readonly prefix: "none" | "release";
  readonly releasedBody?: BirdState;
  readonly rider: ForcedTransitRiderContext;
  readonly takeoff: BirdState;
}

// Ephemeral identity-bound evidence, not a saved or extrapolated mover trajectory.
export interface ForcedTransitForecast {
  readonly afterOne: Rect;
  readonly afterOneSeconds: number;
  readonly afterTwo: Rect;
  readonly afterTwoSeconds: number;
  readonly carrier: ForcedTransitCarrier;
  readonly context: ForcedTransitForecastContext;
  readonly ordinaryBody?: ForcedTransitTakeoffBody;
}

function finiteRect(rect: Rect): boolean {
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite);
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
  rider: ForcedTransitRiderContext,
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
  const firstFrames = sample(context.seconds, STEP_SECONDS);
  const secondFrames = sample(context.seconds + STEP_SECONDS, STEP_SECONDS);
  const first = firstFrames?.find(({ owner }) => owner === carrier.owner);
  const second = secondFrames?.find(({ owner }) => owner === carrier.owner);
  if (
    !first ||
    !second ||
    !sameRect(first.before, carrier.rect, EDGE) ||
    !sameRect(first.after, second.before, EDGE) ||
    !finiteRect(second.after)
  ) {
    return undefined;
  }
  const ordinaryBody =
    firstFrames && secondFrames && projectOrdinaryBody(rider, firstFrames, secondFrames);
  return {
    afterOne: first.after,
    afterOneSeconds: context.seconds + STEP_SECONDS,
    afterTwo: second.after,
    afterTwoSeconds: context.seconds + STEP_SECONDS + STEP_SECONDS,
    carrier,
    context,
    ...(ordinaryBody && { ordinaryBody }),
  };
}

function projectOrdinaryBody(
  rider: ForcedTransitRiderContext,
  first: NonNullable<ReturnType<NonNullable<BehaviourTraversalFrame["sample"]>>>,
  second: NonNullable<ReturnType<NonNullable<BehaviourTraversalFrame["sample"]>>>,
): ForcedTransitTakeoffBody | undefined {
  if (rider.unknownPush || !ordinaryTransitControl(rider.tuning, rider.bird)) {
    return undefined;
  }
  const objects = (frames: typeof first) =>
    frames.map((frame) => ({ ...frame, object: frame.owner }));
  const solids = (frames: typeof first) => [
    ...rider.terrainSolids,
    ...frames.filter(({ collision }) => collision === "solid").map(({ after }) => after),
  ];
  const ledges = first.filter(({ collision }) => collision === "ledge").map(({ after }) => after);
  const firstPrepared = preparePlatformBird(
    rider.tuning,
    rider.terrainSolids,
    solids(first),
    objects(first),
    rider.bird,
  );
  if (firstPrepared.crushed) {
    return undefined;
  }
  if (!rider.bird.jumpHeld || rider.bird.bufferLeft > 0) {
    return {
      airCarryVx: firstPrepared.riding
        ? firstPrepared.dx / STEP_SECONDS
        : firstPrepared.bird.carryVx,
      prefix: "none",
      rider,
      takeoff: firstPrepared.bird,
    };
  }
  const releasedBody = finishPlatformBird(
    STEP_SECONDS,
    firstPrepared,
    stepBird(
      rider.tuning,
      solids(first),
      ledges,
      STEP_SECONDS,
      { jumpHeld: false, move: 0 },
      firstPrepared.bird,
    ),
  );
  const nextPrepared = preparePlatformBird(
    rider.tuning,
    rider.terrainSolids,
    solids(second),
    objects(second),
    releasedBody,
  );
  if (nextPrepared.crushed || (!nextPrepared.bird.grounded && nextPrepared.bird.coyoteLeft <= 0)) {
    return undefined;
  }
  return {
    airCarryVx: nextPrepared.riding ? nextPrepared.dx / STEP_SECONDS : nextPrepared.bird.carryVx,
    prefix: "release",
    releasedBody,
    rider,
    takeoff: nextPrepared.bird,
  };
}

export function forcedTransitTakeoffBody(
  context: ForcedTransitForecastContext,
  rider: ForcedTransitRiderContext,
  carrier: ForcedTransitCarrier,
  forecast: ForcedTransitForecast | undefined,
): ForcedTransitTakeoffBody | undefined {
  const body = forecast?.ordinaryBody;
  if (
    !body ||
    !forcedTransitTakeoffOrigin(context, rider.bird, carrier, forecast) ||
    rider.unknownPush ||
    !ordinaryTransitControl(rider.tuning, rider.bird) ||
    rider.terrainSolids !== body.rider.terrainSolids
  ) {
    return undefined;
  }
  const riderKeys = [
    ...new Set([...Object.keys(rider.bird), ...Object.keys(body.rider.bird)]),
  ].filter((key) => key !== "dash") as (keyof BirdState)[];
  if (riderKeys.some((key) => rider.bird[key] !== body.rider.bird[key])) {
    return undefined;
  }
  const profileKeys = [
    ...new Set([...Object.keys(rider.tuning), ...Object.keys(body.rider.tuning)]),
  ].filter((key) => !["dash", "doubleJump", "walkSpeed"].includes(key)) as (keyof BirdTuning)[];
  if (profileKeys.some((key) => rider.tuning[key] !== body.rider.tuning[key])) {
    return undefined;
  }
  return body;
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
