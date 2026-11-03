import { randomStream } from "@andornaut/game-kit/random";
import {
  findTraversal,
  type TraversalCommand,
  type TraversalContext,
  type TraversalRequest,
  type TraversalResult,
  type TraversalSafety,
} from "@andornaut/game-kit/terrain/traversal";

import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours";
import type {
  BehaviourIdleWatchdog,
  BehaviourMotion,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types";
import { supportedDestinations } from "./behaviourDestinations";
import type { BehaviourWorld } from "./behaviourReach";
import {
  advanceTraversalTo,
  type BehaviourTraversalState,
  traversalContext,
  type TraversalSupport,
} from "./behaviourTraversal";
import { EDGE } from "./bird";
import { flyLandingPath, flyLandingRoute, supportedLanding } from "./flyLanding";

type PursuitMotion = Extract<BehaviourMotion, { kind: "pursue" }>;
type IdleStatus = TraversalResult<TraversalSupport>["status"] | "invalidated";
type Recovery =
  | {
      readonly kind: "ground";
      readonly footprint?: TraversalContext<TraversalSupport>["body"];
      readonly traversal: BehaviourTraversalState;
    }
  | { readonly kind: "fly"; readonly origin: Point; readonly target: Point };
export interface BehaviourIdleState {
  readonly anchor: Point;
  readonly decision?: number;
  readonly seconds: number;
  readonly attemptedAt?: number;
  readonly status?: IdleStatus;
  readonly recovery?: Recovery;
}
export interface IdleSegment {
  readonly start: number;
  readonly end: number;
  readonly from: Point;
  readonly to: Point;
}

export function observeIdle(
  config: BehaviourIdleWatchdog,
  seconds: number,
  segments: readonly IdleSegment[],
  prior: BehaviourIdleState,
): BehaviourIdleState {
  let state = prior,
    accounted = 0;
  for (const segment of segments) {
    const duration = Math.max(0, segment.end - segment.start);
    accounted += duration;
    if (Math.abs(segment.to.x - state.anchor.x) >= config.minMovement) {
      state = {
        anchor: segment.to,
        ...(state.decision !== undefined && { decision: state.decision }),
        seconds: 0,
        ...(state.recovery && { recovery: state.recovery, status: "found" as const }),
      };
    } else {
      state = { ...state, seconds: state.seconds + duration };
    }
  }
  return { ...state, seconds: state.seconds + Math.max(0, seconds - accounted) };
}

function groundGoal(
  config: Pick<BehaviourIdleWatchdog, "distance" | "minMovement">,
  stepDistance: number,
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  target: Point,
): Rect {
  const dy = target.y - at.y;
  const radius = Math.sqrt(Math.max(0, config.distance ** 2 - dy ** 2));
  const minimum = config.minMovement;
  const support = [
    ...world.solids,
    ...(world.platforms ?? []).filter(({ owner }) => owner !== object).map(({ rect }) => rect),
  ].find(
    (rect) =>
      Math.abs(rect.y - target.y - object.height) <= EDGE &&
      rect.x <= target.x + EDGE &&
      rect.x + rect.width >= target.x + object.width - EDGE,
  )!;
  const bounds = world.traversalFrame!.bounds,
    leash = object.behaviour!.pursuit!.distance;
  let low = Math.max(support.x, bounds.x, object.origin.x - leash, at.x - radius);
  let high = Math.min(
    support.x + support.width - object.width,
    bounds.x + bounds.width - object.width,
    object.origin.x + leash,
    at.x + radius,
  );
  if (target.x < at.x) {
    low = Math.max(low, target.x);
    high = Math.min(high, at.x - minimum, target.x + stepDistance);
  } else if (target.x > at.x) {
    low = Math.max(low, at.x + minimum, target.x - stepDistance);
    high = Math.min(high, target.x);
  }
  return {
    height: object.height + 2 * EDGE,
    width: high - low + object.width + 2 * EDGE,
    x: low - EDGE,
    y: target.y - EDGE,
  };
}

export function planIdleRecovery(
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: PursuitMotion,
  seconds: number,
  facing: -1 | 1,
  prior: BehaviourIdleState,
  at: Point,
): BehaviourIdleState {
  return planSupportedRecovery(
    undefined,
    object.behaviour!.idleWatchdog!,
    world,
    object,
    motion,
    seconds,
    facing,
    prior,
    at,
  );
}

// Native traversal validates and charges every suggested tick before accepting the landing.
export function preferredGroundWalk(
  context: TraversalContext<TraversalSupport>,
  request: TraversalRequest<TraversalSupport>,
): readonly TraversalCommand[] | undefined {
  const { goal, start } = request;
  if (
    !start.grounded ||
    Math.abs(goal.y + context.epsilon - start.y - context.body.offset.y) > context.epsilon
  ) {
    return undefined;
  }
  const centre = start.x + context.body.offset.x + context.body.width / 2;
  const target = goal.x + goal.width / 2;
  if (centre === target) {
    return undefined;
  }
  const move = target < centre ? (-1 as const) : (1 as const);
  return Array.from({ length: request.horizonSteps }, () => ({ jump: false, move }));
}

export function planSupportedRecovery(
  prefer:
    | ((
        context: TraversalContext<TraversalSupport>,
        request: TraversalRequest<TraversalSupport>,
      ) => readonly TraversalCommand[] | undefined)
    | undefined,
  config: Pick<BehaviourIdleWatchdog, "distance" | "maxAttempts" | "minMovement"> & {
    readonly fullFrameGoal?: boolean;
  },
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: PursuitMotion,
  seconds: number,
  facing: -1 | 1,
  prior: BehaviourIdleState,
  at: Point,
): BehaviourIdleState {
  const attempted = { ...prior, attemptedAt: prior.seconds };
  if (!world.traversalFrame) {
    return { ...attempted, status: "geometry-unavailable" };
  }
  const decision = prior.decision ?? 0;
  const context = world.idleDecision;
  const random = context
    ? randomStream(context.seed, `${context.namespace}:${decision}`)
    : undefined;
  const chosen = { ...attempted, decision: decision + 1 };
  const targets = supportedDestinations(
    (target) => supportedLanding(object, world, target),
    config,
    object,
    world,
    facing,
    motion.mode,
    random,
    at,
  );
  const uncertain =
    world.traversalFrame.platforms.length > 0 ||
    (world.hazards ?? []).some(
      ({ owner }) =>
        owner !== object &&
        (owner.orbit !== undefined ||
          owner.behaviour !== undefined ||
          owner.motion.algorithm !== "static" ||
          owner.reaction.kind !== "none"),
    );
  let status: IdleStatus =
    targets.length > config.maxAttempts
      ? "budget-exhausted"
      : uncertain
        ? "geometry-unavailable"
        : "unreachable";
  for (const target of targets.slice(0, config.maxAttempts)) {
    if (motion.mode === "fly") {
      if (flyLandingPath(object, world, at, target)) {
        return { ...chosen, recovery: { kind: "fly", origin: at, target }, status: "found" };
      }
      continue;
    }
    const context = traversalContext(world, seconds, object, motion);
    if (!context) {
      return { ...chosen, status: "geometry-unavailable" };
    }
    const start = { ...at, fallFromY: at.y + object.height, grounded: true, vy: 0 };
    const frameGoal = groundGoal(config, motion.speed * seconds, object, world, at, target);
    // Convert the frame-origin landing interval into the native body's coordinate envelope.
    const footprint = config.fullFrameGoal ? context.body : undefined;
    const goal = footprint
      ? {
          height: frameGoal.height - object.height + footprint.height,
          width: frameGoal.width - object.width + footprint.width,
          x: frameGoal.x + footprint.offset.x,
          y: frameGoal.y + footprint.offset.y,
        }
      : frameGoal;
    const request: TraversalRequest<TraversalSupport> = {
      ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
      goal,
      start,
      timeSeconds: world.traversalFrame.timeSeconds,
    };
    const preferredInputs = prefer?.(context, request);
    const result = findTraversal(context, {
      ...request,
      ...(preferredInputs && { preferredInputs }),
    });
    if (result.status === "found") {
      return {
        ...chosen,
        recovery: {
          kind: "ground",
          ...(footprint && { footprint }),
          traversal: {
            geometry: "",
            inputs: result.inputs,
            physical: start,
            status: "found",
            target: goal,
          },
        },
        status: "found",
      };
    }
    if (result.status !== "unreachable") {
      status = result.status;
    }
  }
  return { ...chosen, status };
}

export function advanceIdleRecovery(
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: PursuitMotion,
  seconds: number,
  prior: BehaviourIdleState,
  at: Point,
): {
  readonly at: Point;
  readonly idle: BehaviourIdleState;
  readonly segments: readonly IdleSegment[];
  readonly finished: boolean;
} {
  return advanceSupportedRecovery(
    object.behaviour!.idleWatchdog!,
    world,
    object,
    motion,
    seconds,
    prior,
    at,
  );
}

export function advanceSupportedRecovery(
  config: Pick<BehaviourIdleWatchdog, "minMovement">,
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: PursuitMotion,
  seconds: number,
  prior: BehaviourIdleState,
  at: Point,
): {
  readonly at: Point;
  readonly idle: BehaviourIdleState;
  readonly segments: readonly IdleSegment[];
  readonly finished: boolean;
} {
  const recovery = prior.recovery!;
  const clear = (status: IdleStatus): BehaviourIdleState => {
    const rest = { ...prior, status };
    delete (rest as { recovery?: Recovery }).recovery;
    return rest;
  };
  if (recovery.kind === "fly") {
    let target = recovery.target;
    let path = flyLandingPath(object, world, at, target);
    if (!path) {
      if (supportedLanding(object, world, at)) {
        return {
          at,
          finished: true,
          idle: clear("invalidated"),
          segments: [{ end: seconds, from: at, start: 0, to: at }],
        };
      }
      const fallback = flyLandingRoute(object, world, at)?.at(-1);
      path = fallback ? flyLandingPath(object, world, at, fallback) : undefined;
      if (fallback && path) {
        target = fallback;
      }
    }
    if (!path) {
      return {
        at,
        finished: false,
        idle: { ...prior, status: "geometry-unavailable" },
        segments: [{ end: seconds, from: at, start: 0, to: at }],
      };
    }
    const segments: IdleSegment[] = [];
    let current = at,
      time = 0;
    for (const target of path) {
      const distance = Math.hypot(target.x - current.x, target.y - current.y);
      const duration = Math.min(seconds - time, distance / motion.speed);
      const fraction = distance === 0 ? 1 : Math.min(1, (motion.speed * duration) / distance);
      const to = {
        x: current.x + (target.x - current.x) * fraction,
        y: current.y + (target.y - current.y) * fraction,
      };
      segments.push({ end: time + duration, from: current, start: time, to });
      current = to;
      time += duration;
      if (time >= seconds) {
        break;
      }
    }
    const finished =
      time < seconds ||
      (path.length > 0 &&
        Math.hypot(current.x - path.at(-1)!.x, current.y - path.at(-1)!.y) <= EDGE);
    if (time < seconds) {
      segments.push({ end: seconds, from: current, start: time, to: current });
    }
    return {
      at: current,
      finished: finished && supportedLanding(object, world, current),
      idle:
        finished && supportedLanding(object, world, current)
          ? clear(
              Math.abs(current.x - recovery.origin.x) >= config.minMovement
                ? "found"
                : "invalidated",
            )
          : { ...prior, recovery: { ...recovery, target } },
      segments,
    };
  }
  if (motion.mode !== "ground") {
    throw new Error("Ground recovery requires its authored pursuit profile");
  }
  const advanced = advanceTraversalTo(
    world,
    object,
    motion,
    seconds,
    recovery.traversal,
    recovery.traversal.target,
    at,
  );
  const traversal = advanced.traversal;
  if (!traversal || !world.traversalFrame) {
    return {
      at,
      finished: false,
      idle: { ...prior, status: "geometry-unavailable" },
      segments: [{ end: seconds, from: at, start: 0, to: at }],
    };
  }
  const timeSeconds = world.traversalFrame.timeSeconds;
  const physical = traversal.physical;
  const goal = recovery.traversal.target;
  const box = recovery.footprint
    ? {
        height: recovery.footprint.height,
        width: recovery.footprint.width,
        x: physical.x + recovery.footprint.offset.x,
        y: physical.y + recovery.footprint.offset.y,
      }
    : { ...physical, height: object.height, width: object.width };
  const reached =
    physical.grounded &&
    box.x >= goal.x - EDGE &&
    box.x + box.width <= goal.x + goal.width + EDGE &&
    box.y >= goal.y - EDGE &&
    box.y + box.height <= goal.y + goal.height + EDGE;
  const exhausted = traversal.inputs.length === 0 && physical.grounded && !traversal.preparation;
  const finished = (reached || exhausted) && supportedLanding(object, world, physical);
  const status = reached
    ? "found"
    : traversal.status === "found"
      ? "invalidated"
      : traversal.status;
  return {
    at: advanced.at,
    finished,
    idle: finished ? clear(status) : { ...prior, recovery: { ...recovery, traversal } },
    segments: advanced.segments?.map((leg: TraversalSafety) => ({
      end: leg.endSeconds - timeSeconds,
      from: leg.from,
      start: leg.startSeconds - timeSeconds,
      to: leg.to,
    })) ?? [{ end: seconds, from: at, start: 0, to: advanced.at }],
  };
}
