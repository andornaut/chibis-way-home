import {
  findTraversal,
  stepTraversal,
  type TraversalInput,
  type TraversalResult,
  type TraversalSafety,
  type TraversalState,
} from "@andornaut/game-kit/terrain/traversal";

import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours";
import type {
  BehaviourIdleWatchdog,
  BehaviourMotion,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types";
import type { BehaviourWorld } from "./behaviourReach";
import { traversalContext, type TraversalSupport } from "./behaviourTraversal";
import { EDGE } from "./bird";
import { flyLandingPath, flyLandingRoute, supportedLanding } from "./flyLanding";

type PursuitMotion = Extract<BehaviourMotion, { kind: "pursue" }>;
type IdleStatus = TraversalResult<TraversalSupport>["status"] | "invalidated";
type Recovery =
  | {
      readonly kind: "ground";
      readonly goal: Rect;
      readonly physical: TraversalState<TraversalSupport>;
      readonly inputs: readonly TraversalInput[];
    }
  | { readonly kind: "fly"; readonly target: Point };
export interface BehaviourIdleState {
  readonly anchor: Point;
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
    if (
      Math.hypot(segment.to.x - state.anchor.x, segment.to.y - state.anchor.y) >= config.minMovement
    ) {
      state = {
        anchor: segment.to,
        seconds: 0,
        ...(state.recovery && { recovery: state.recovery, status: "found" as const }),
      };
    } else {
      state = { ...state, seconds: state.seconds + duration };
    }
  }
  return { ...state, seconds: state.seconds + Math.max(0, seconds - accounted) };
}

function candidates(
  config: BehaviourIdleWatchdog,
  object: ObjectLayout,
  world: BehaviourWorld,
  facing: -1 | 1,
  at: Point,
): readonly Point[] {
  const bounds = world.traversalFrame!.bounds;
  const leash = object.behaviour!.pursuit!.distance;
  const positions: Point[] = [];
  for (const support of [
    ...world.solids,
    ...(world.platforms ?? []).filter(({ owner }) => owner !== object).map(({ rect }) => rect),
  ]) {
    const y = support.y - object.height;
    const dy = y - at.y;
    if (
      Math.abs(dy) > config.distance ||
      y < bounds.y ||
      y + object.height > bounds.y + bounds.height
    ) {
      continue;
    }
    const radius = Math.sqrt(Math.max(0, config.distance ** 2 - dy ** 2));
    const low = Math.max(support.x, bounds.x, object.origin.x - leash, at.x - radius);
    const high = Math.min(
      support.x + support.width - object.width,
      bounds.x + bounds.width - object.width,
      object.origin.x + leash,
      at.x + radius,
    );
    if (low > high) {
      continue;
    }
    for (const x of facing === 1
      ? [low, high, Math.max(low, Math.min(high, at.x))]
      : [high, low, Math.max(low, Math.min(high, at.x))]) {
      const target = { x, y };
      if (
        Math.hypot(x - at.x, dy) < config.minMovement ||
        !supportedLanding(object, world, target)
      ) {
        continue;
      }
      if (
        !positions.some((point) => Math.abs(point.x - x) <= EDGE && Math.abs(point.y - y) <= EDGE)
      ) {
        positions.push(target);
      }
    }
  }
  return positions.sort((a, b) => {
    const side = (point: Point) => (Math.sign(point.x - at.x) === -facing ? 0 : 1);
    return (
      side(a) - side(b) ||
      Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y) ||
      a.x - b.x ||
      a.y - b.y
    );
  });
}

function groundGoal(
  config: BehaviourIdleWatchdog,
  stepDistance: number,
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  target: Point,
): Rect {
  const dy = target.y - at.y;
  const radius = Math.sqrt(Math.max(0, config.distance ** 2 - dy ** 2));
  const minimum = Math.sqrt(Math.max(0, config.minMovement ** 2 - dy ** 2));
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
  const config = object.behaviour!.idleWatchdog!;
  const attempted = { ...prior, attemptedAt: prior.seconds };
  if (!world.traversalFrame) {
    return { ...attempted, status: "geometry-unavailable" };
  }
  const targets = candidates(config, object, world, facing, at);
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
        return { ...attempted, recovery: { kind: "fly", target }, status: "found" };
      }
      continue;
    }
    const context = traversalContext(world, seconds, object, motion);
    if (!context) {
      return { ...attempted, status: "geometry-unavailable" };
    }
    const start = { ...at, fallFromY: at.y + object.height, grounded: true, vy: 0 };
    const goal = groundGoal(config, motion.speed * seconds, object, world, at, target);
    const result = findTraversal(context, {
      ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
      goal,
      start,
      timeSeconds: world.traversalFrame.timeSeconds,
    });
    if (result.status === "found") {
      return {
        ...attempted,
        recovery: { goal, inputs: result.inputs, kind: "ground", physical: start },
        status: "found",
      };
    }
    if (result.status !== "unreachable") {
      status = result.status;
    }
  }
  return { ...attempted, status };
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
          ? clear("found")
          : { ...prior, recovery: { kind: "fly", target } },
      segments,
    };
  }
  if (motion.mode !== "ground") {
    throw new Error("Ground recovery requires its authored pursuit profile");
  }
  const context = traversalContext(world, seconds, object, motion);
  const input = recovery.inputs[0];
  if (!context || !world.traversalFrame) {
    return {
      at,
      finished: false,
      idle: { ...prior, status: "geometry-unavailable" },
      segments: [{ end: seconds, from: at, start: 0, to: at }],
    };
  }
  const timeSeconds = world.traversalFrame.timeSeconds;
  let step = stepTraversal(
    context,
    { jump: input?.jump ?? false, move: input?.move ?? 0, timeSeconds },
    recovery.physical,
  );
  if (step.status !== "ok" && !recovery.physical.grounded) {
    step = stepTraversal(context, { jump: false, move: 0, timeSeconds }, recovery.physical);
  }
  if (step.status !== "ok") {
    const finished = recovery.physical.grounded && supportedLanding(object, world, at);
    const status =
      step.status === "budget-exhausted"
        ? "budget-exhausted"
        : step.status === "geometry-unavailable"
          ? "geometry-unavailable"
          : "invalidated";
    return {
      at,
      finished,
      idle: finished ? clear(status) : { ...prior, status },
      segments: [{ end: seconds, from: at, start: 0, to: at }],
    };
  }
  const box = { ...step.state, height: object.height, width: object.width };
  const reached =
    step.state.grounded &&
    box.x >= recovery.goal.x - EDGE &&
    box.x + box.width <= recovery.goal.x + recovery.goal.width + EDGE &&
    box.y >= recovery.goal.y - EDGE &&
    box.y + box.height <= recovery.goal.y + recovery.goal.height + EDGE;
  const exhausted = recovery.inputs.length <= 1 && step.state.grounded;
  const finished = (reached || exhausted) && supportedLanding(object, world, step.state);
  const status = reached ? "found" : "invalidated";
  const idle = finished
    ? clear(status)
    : {
        ...prior,
        recovery: { ...recovery, inputs: recovery.inputs.slice(1), physical: step.state },
      };
  return {
    at: { x: step.state.x, y: step.state.y },
    finished,
    idle,
    segments: step.segments.map((leg: TraversalSafety) => ({
      end: leg.endSeconds - timeSeconds,
      from: leg.from,
      start: leg.startSeconds - timeSeconds,
      to: leg.to,
    })),
  };
}
