import type {
  BehaviourAction,
  BehaviourCondition,
  BehaviourNode,
  BehaviourPlan,
  BirdTuning,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types";
import {
  type BehaviourGeometry,
  type BehaviourWorld,
  behaviourWorld,
  targetReachable,
} from "./behaviourReach";
import { birdBox, type BirdState, EDGE } from "./bird";
import { collisionCandidates } from "./collisionIndex";
import { hopLift } from "./motion";
import { overlaps } from "./rect";

export interface BehaviourState {
  readonly axis?: "x" | "y";
  readonly flightTarget?: Point;
  readonly pendingEntry?: boolean;
  readonly active: boolean;
  readonly elapsed: number;
  readonly facing: -1 | 1;
  readonly hop?: {
    readonly elapsed: number;
    readonly groundY: number;
    readonly height: number;
    readonly seconds: number;
  };
  readonly stateKey: string;
}

export interface BehaviourSegment {
  readonly axis?: "x" | "y";
  readonly end: number;
  readonly facing: -1 | 1;
  readonly from: Point;
  readonly start: number;
  readonly to: Point;
}

export interface BehaviourEvent {
  readonly action: BehaviourAction;
  readonly axis?: "x" | "y";
  readonly at: Point;
  readonly facing: -1 | 1;
  readonly time: number;
}

export interface BehaviourStep {
  readonly actions: readonly BehaviourEvent[];
  readonly at: Point;
  readonly segments: readonly BehaviourSegment[];
  readonly state: BehaviourState;
}

// Resolve a complete graph once; malformed transitions fail before a stage starts.
export function layoutBehaviour(tile: number, plan: BehaviourPlan): BehaviourPlan {
  const valid = (value: number) => Number.isFinite(value) && value >= 0;
  if (!Number.isFinite(plan.distance) || !plan.states[plan.initial]) {
    throw new Error("Invalid behaviour extent or initial state");
  }
  const states = Object.fromEntries(
    Object.entries(plan.states).map(([key, node]) => {
      const track = node.track ?? plan;
      if (!["x", "y"].includes(track.axis) || !Number.isFinite(track.distance)) {
        throw new Error(`Invalid behaviour track in ${key}`);
      }
      if (
        (node.animation !== null &&
          (typeof node.animation !== "string" || node.animation.length === 0)) ||
        (node.motion.kind !== "wait" &&
          node.motion.kind !== "fly" &&
          (!valid(node.motion.speed) ||
            ![-1, 1, "facing", "target"].includes(node.motion.direction))) ||
        (node.motion.kind === "move" && (node.motion.speed === 0 || track.distance === 0)) ||
        (node.motion.kind === "hop" &&
          (track.axis !== "x" ||
            !valid(node.motion.hopHeight) ||
            node.motion.hopHeight === 0 ||
            !valid(node.motion.hopSeconds) ||
            node.motion.hopSeconds === 0 ||
            (node.motion.speed > 0 && track.distance === 0)))
      ) {
        throw new Error(`Invalid behaviour motion or animation in ${key}`);
      }
      if (
        node.motion.kind === "fly" &&
        (!valid(node.motion.speed) ||
          node.motion.speed === 0 ||
          (node.motion.to === "target"
            ? ![
                node.motion.bounds.x,
                node.motion.bounds.y,
                node.motion.bounds.width,
                node.motion.bounds.height,
              ].every(Number.isFinite) ||
              node.motion.bounds.width <= 0 ||
              node.motion.bounds.height <= 0
            : !Number.isFinite(node.motion.to.x) || !Number.isFinite(node.motion.to.y)))
      ) {
        throw new Error(`Invalid flight in ${key}`);
      }
      const onEnter = node.onEnter?.map((action): BehaviourAction => {
        const finitePoint = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
        if (action.kind === "spawn") {
          if (
            !action.character ||
            !finitePoint(action.offset) ||
            !finitePoint(action.velocity) ||
            !valid(action.gravity) ||
            !valid(action.armSeconds) ||
            (action.armingAnimation !== undefined && action.armingAnimation.length === 0) ||
            !valid(action.lifeSeconds) ||
            action.lifeSeconds === 0 ||
            !Number.isSafeInteger(action.maxAlive) ||
            action.maxAlive < 1
          ) {
            throw new Error(`Invalid spawn action in ${key}`);
          }
          return {
            ...action,
            gravity: action.gravity * tile,
            offset: { x: action.offset.x * tile, y: action.offset.y * tile },
            velocity: { x: action.velocity.x * tile, y: action.velocity.y * tile },
          };
        }
        if (
          (action.visual &&
            (!action.visual.art ||
              !action.visual.animation ||
              !finitePoint(action.visual.offset))) ||
          !valid(action.range) ||
          !valid(action.height) ||
          !valid(action.seconds) ||
          !finitePoint(action.velocity)
        ) {
          throw new Error(`Invalid force action in ${key}`);
        }
        return {
          ...action,
          ...(action.visual && {
            visual: {
              ...action.visual,
              offset: { x: action.visual.offset.x * tile, y: action.visual.offset.y * tile },
            },
          }),
          height: action.height * tile,
          range: action.range * tile,
          velocity: { x: action.velocity.x * tile, y: action.velocity.y * tile },
        };
      });
      const transitions = node.transitions.map((transition) => {
        if (!plan.states[transition.to] || transition.when.length === 0) {
          throw new Error(`Invalid behaviour transition in ${key}`);
        }
        const when = transition.when.map((condition): BehaviourCondition => {
          if (condition.kind === "boundary") {
            return condition;
          }
          const amount =
            condition.kind === "elapsed"
              ? condition.seconds
              : condition.kind === "nearby"
                ? condition.range
                : condition.tolerance;
          if (!valid(amount)) {
            throw new Error(`Invalid behaviour condition in ${key}`);
          }
          return condition.kind === "nearby"
            ? { ...condition, range: condition.range * tile }
            : condition.kind !== "elapsed"
              ? { ...condition, tolerance: condition.tolerance * tile }
              : condition;
        });
        return { ...transition, when };
      });
      return [
        key,
        {
          ...node,
          ...(onEnter && { onEnter }),
          ...(node.track && { track: { ...node.track, distance: node.track.distance * tile } }),
          motion:
            node.motion.kind === "wait"
              ? node.motion
              : {
                  ...node.motion,
                  speed: node.motion.speed * tile,
                  ...(node.motion.kind === "fly"
                    ? node.motion.to === "target"
                      ? {
                          bounds: {
                            height: node.motion.bounds.height * tile,
                            width: node.motion.bounds.width * tile,
                            x: node.motion.bounds.x * tile,
                            y: node.motion.bounds.y * tile,
                          },
                        }
                      : { to: { x: node.motion.to.x * tile, y: node.motion.to.y * tile } }
                    : {}),
                  ...(node.motion.kind === "hop"
                    ? { hopHeight: node.motion.hopHeight * tile }
                    : {}),
                },
          transitions,
        },
      ];
    }),
  );
  return { ...plan, distance: plan.distance * tile, states };
}

function nodeOf(object: ObjectLayout, key: string): BehaviourNode {
  const node = object.behaviour?.states[key];
  if (!node) {
    throw new Error(`No behaviour state ${key} for ${object.character}`);
  }
  return node;
}

function enterState(
  tuning: BirdTuning,
  object: ObjectLayout,
  bird: BirdState,
  at: Point,
  key: string,
  state: BehaviourState,
): BehaviourState {
  const node = nodeOf(object, key);
  let facing =
    node.motion.kind !== "wait" &&
    node.motion.kind !== "fly" &&
    typeof node.motion.direction === "number"
      ? node.motion.direction
      : state.facing;
  if (
    node.enter === "face-target" ||
    (node.motion.kind !== "wait" &&
      node.motion.kind !== "fly" &&
      node.motion.direction === "target")
  ) {
    const axis = node.track?.axis ?? object.behaviour?.axis ?? "x";
    const mine = at[axis] + (axis === "x" ? object.width : object.height) / 2;
    const target = bird[axis] + (axis === "x" ? tuning.width : tuning.height) / 2;
    facing = target < mine ? -1 : 1;
  }
  if (node.motion.kind === "fly" && node.motion.to === "target") {
    const target = birdBox(tuning, bird);
    const mine = contactBox(object, at, facing, node.track?.axis ?? object.behaviour?.axis);
    facing = target.x + target.width / 2 < mine.x + mine.width / 2 ? -1 : 1;
  }
  const next: BehaviourState = {
    ...state,
    axis: node.track?.axis ?? object.behaviour?.axis ?? "x",
    elapsed: 0,
    facing,
    pendingEntry: true,
    stateKey: key,
  };
  delete (next as { flightTarget?: Point }).flightTarget;
  if (node.motion.kind === "fly" && node.motion.to === "target") {
    const contact = contactBox(object, at, facing, next.axis);
    const target = birdBox(tuning, bird);
    const x = target.x + target.width / 2 - contact.width / 2 - (contact.x - at.x);
    const y = target.y + target.height / 2 - contact.height / 2 - (contact.y - at.y);
    return {
      ...next,
      flightTarget: {
        x: Math.max(
          object.origin.x + node.motion.bounds.x,
          Math.min(object.origin.x + node.motion.bounds.x + node.motion.bounds.width, x),
        ),
        y: Math.max(
          object.origin.y + node.motion.bounds.y,
          Math.min(object.origin.y + node.motion.bounds.y + node.motion.bounds.height, y),
        ),
      },
    };
  }
  return next;
}

export function startBehaviour(
  tuning: BirdTuning,
  object: ObjectLayout,
  bird: BirdState,
): BehaviourState {
  const plan = object.behaviour;
  if (!plan) {
    throw new Error(`No behaviour for ${object.character}`);
  }
  return enterState(tuning, object, bird, object.origin, plan.initial, {
    active: object.scene === undefined,
    elapsed: 0,
    facing: plan.distance < 0 ? -1 : 1,
    stateKey: plan.initial,
  });
}

// Collision uses the object's contact box. Vertical movers do not flip their
// horizontal art merely because they reverse vertical travel.
export function contactBox(
  object: ObjectLayout,
  at: Point,
  facing: -1 | 1,
  axis = object.behaviour?.axis,
): Rect {
  const box = object.hitbox ?? { height: object.height, width: object.width, x: 0, y: 0 };
  return {
    ...box,
    x: at.x + (facing === 1 || axis === "y" ? box.x : object.width - box.x - box.width),
    y: at.y + box.y,
  };
}

function heading(node: BehaviourNode, state: BehaviourState): -1 | 1 {
  return node.motion.kind !== "wait" &&
    node.motion.kind !== "fly" &&
    typeof node.motion.direction === "number"
    ? node.motion.direction
    : state.facing;
}

function endpoint(object: ObjectLayout, direction: -1 | 1, state: BehaviourState): number {
  const plan = nodeOf(object, state.stateKey).track ?? object.behaviour;
  if (!plan) {
    throw new Error(`No behaviour for ${object.character}`);
  }
  const origin = object.origin[plan.axis];
  return direction === 1
    ? Math.max(origin, origin + plan.distance)
    : Math.min(origin, origin + plan.distance);
}

function matches(
  tuning: BirdTuning,
  object: ObjectLayout,
  world: BehaviourWorld,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
  condition: BehaviourCondition,
): boolean {
  if (condition.kind === "elapsed") {
    return state.elapsed >= condition.seconds;
  }
  if (condition.kind === "arrived") {
    const motion = nodeOf(object, state.stateKey).motion;
    if (motion.kind !== "fly") {
      return false;
    }
    const target =
      motion.to === "target"
        ? state.flightTarget
        : { x: object.origin.x + motion.to.x, y: object.origin.y + motion.to.y };
    return (
      target !== undefined && Math.hypot(at.x - target.x, at.y - target.y) <= condition.tolerance
    );
  }
  if (condition.kind === "boundary") {
    const axis = state.axis ?? object.behaviour?.axis ?? "x";
    return at[axis] === endpoint(object, heading(nodeOf(object, state.stateKey), state), state);
  }
  if (condition.kind === "reachable" || condition.kind === "lost-target") {
    const reachable = targetReachable(
      tuning,
      object,
      world,
      at,
      contactBox(object, at, state.facing, state.axis),
      state.hop?.groundY ?? at.y,
      condition.tolerance,
      nodeOf(object, state.stateKey).track ?? object.behaviour,
      bird,
    );
    return condition.kind === "reachable" ? reachable : !reachable;
  }
  if (condition.kind === "same-ground") {
    return (
      bird.grounded &&
      Math.abs(bird.y + tuning.height - ((state.hop?.groundY ?? at.y) + object.height)) <=
        condition.tolerance
    );
  }
  const hers = birdBox(tuning, bird);
  return (
    condition.kind === "nearby" &&
    Math.hypot(
      hers.x + hers.width / 2 - at.x - object.width / 2,
      hers.y + hers.height / 2 - at.y - object.height / 2,
    ) <= condition.range
  );
}

function reachable(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  state: BehaviourState,
  direction: -1 | 1,
  desired: number,
): number {
  const axis = state.axis ?? object.behaviour?.axis ?? "x";
  const edge = endpoint(object, direction, state);
  let to = direction === 1 ? Math.min(edge, desired) : Math.max(edge, desired);
  const box = contactBox(object, at, state.facing, state.axis);
  const across = axis === "x" ? "y" : "x";
  const depth = axis === "x" ? "height" : "width";
  const length = axis === "x" ? "width" : "height";
  const consider = (solid: Rect) => {
    if (box[across] >= solid[across] + solid[depth] || solid[across] >= box[across] + box[depth]) {
      return;
    }
    if (direction === 1 && box[axis] + box[length] <= solid[axis]) {
      to = Math.min(to, at[axis] + solid[axis] - box[axis] - box[length]);
    } else if (direction === -1 && box[axis] >= solid[axis] + solid[length]) {
      to = Math.max(to, at[axis] + solid[axis] + solid[length] - box[axis]);
    }
  };
  const delta = to - at[axis];
  const sweep = {
    ...box,
    [axis]: Math.min(box[axis], box[axis] + delta),
    [length]: box[length] + Math.abs(delta),
  };
  for (const solid of collisionCandidates(world.solids, sweep)) {
    consider(solid);
  }
  for (const platform of world.platforms ?? []) {
    if (platform.owner !== object && platform.collision === "solid") {
      consider(platform.rect);
    }
  }
  return to;
}

function hopY(object: ObjectLayout, world: BehaviourWorld, at: Point, desired: number): number {
  let to = desired;
  const down = desired > at.y;
  const consider = (solid: Rect, ledge: boolean) => {
    if (at.x >= solid.x + solid.width || at.x + object.width <= solid.x) {
      return;
    }
    if (down && at.y + object.height <= solid.y + EDGE) {
      to = Math.min(to, solid.y - object.height);
    } else if (!down && !ledge && at.y >= solid.y + solid.height - EDGE) {
      to = Math.max(to, solid.y + solid.height);
    }
  };
  const sweep = {
    height: object.height + Math.abs(desired - at.y) + 2 * EDGE,
    width: object.width,
    x: at.x,
    y: Math.min(at.y, desired) - EDGE,
  };
  for (const solid of collisionCandidates(world.solids, sweep)) {
    consider(solid, false);
  }
  for (const platform of world.platforms ?? []) {
    if (platform.owner !== object) {
      consider(platform.rect, platform.collision === "ledge");
    }
  }
  return to;
}

// Axis-separated swept clipping prevents flight from crossing solid cover.
function flightAxis(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  axis: "x" | "y",
  desired: number,
): number {
  let to = desired;
  const across = axis === "x" ? "y" : "x";
  const depth = axis === "x" ? "height" : "width";
  const length = axis === "x" ? "width" : "height";
  const body = { ...at, height: object.height, width: object.width };
  const sweep = {
    ...body,
    [axis]: Math.min(at[axis], desired) - EDGE,
    [length]: object[length] + Math.abs(desired - at[axis]) + 2 * EDGE,
  };
  const solids = [
    ...collisionCandidates(world.solids, sweep),
    ...(world.platforms ?? [])
      .filter((platform) => platform.owner !== object && platform.collision === "solid")
      .map((platform) => platform.rect),
  ];
  for (const solid of solids) {
    if (at[across] >= solid[across] + solid[depth] || at[across] + object[depth] <= solid[across]) {
      continue;
    }
    if (desired > at[axis] && at[axis] + object[length] <= solid[axis] + EDGE) {
      to = Math.min(to, solid[axis] - object[length]);
    }
    if (desired < at[axis] && at[axis] >= solid[axis] + solid[length] - EDGE) {
      to = Math.max(to, solid[axis] + solid[length]);
    }
  }
  return to;
}

// Generic state graphs choose the motion, animation and transition order. The executor knows
// only bounded move/wait/hop primitives and conditions; it has no character-specific cycle.
export function stepBehaviour(
  tuning: BirdTuning,
  object: ObjectLayout,
  geometry: BehaviourGeometry,
  seconds: number,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
): BehaviourStep {
  const plan = object.behaviour;
  if (!plan || seconds <= 0) {
    return { actions: [], at, segments: [], state };
  }
  if (!state.active) {
    return {
      actions: [],
      at,
      segments: [{ end: seconds, facing: state.facing, from: at, start: 0, to: at }],
      state,
    };
  }
  const world = behaviourWorld(geometry);
  const actions: BehaviourEvent[] = [];
  const segments: BehaviourSegment[] = [];
  const instant = new Set<string>();
  let current = at;
  let next = state;
  let time = 0;
  while (true) {
    const node = nodeOf(object, next.stateKey);
    const track = node.track ?? plan;
    if (next.pendingEntry) {
      next = enterState(tuning, object, bird, current, next.stateKey, next);
      for (const action of node.onEnter ?? []) {
        actions.push({ action, at: current, axis: track.axis, facing: next.facing, time });
      }
      next = { ...next, pendingEntry: false };
    }
    if (
      node.motion.kind !== "wait" &&
      node.motion.kind !== "fly" &&
      node.motion.direction === "target"
    ) {
      const mine = current[track.axis] + (track.axis === "x" ? object.width : object.height) / 2;
      const target = bird[track.axis] + (track.axis === "x" ? tuning.width : tuning.height) / 2;
      if (target !== mine) {
        next = { ...next, facing: target < mine ? -1 : 1 };
      }
    }
    const transition = node.transitions.find(({ when }) =>
      when.every((condition) => matches(tuning, object, world, bird, current, next, condition)),
    );
    if (transition) {
      if (instant.has(next.stateKey)) {
        throw new Error(`Instant behaviour transition cycle for ${object.character}`);
      }
      instant.add(next.stateKey);
      next = enterState(tuning, object, bird, current, transition.to, next);
      continue;
    }
    if (time >= seconds) {
      break;
    }
    let slice = seconds - time;
    for (const { when } of node.transitions) {
      if (
        when.every(
          (condition) =>
            condition.kind === "elapsed" ||
            matches(tuning, object, world, bird, current, next, condition),
        )
      ) {
        const threshold = Math.max(
          0,
          ...when
            .filter((condition) => condition.kind === "elapsed")
            .map((condition) => condition.seconds),
        );
        if (threshold > next.elapsed) {
          slice = Math.min(slice, threshold - next.elapsed);
        }
      }
    }
    if (node.motion.kind === "hop" && !next.hop) {
      next = {
        ...next,
        hop: {
          elapsed: 0,
          groundY: current.y,
          height: node.motion.hopHeight,
          seconds: node.motion.hopSeconds,
        },
      };
    }
    const hop = next.hop;
    if (hop) {
      slice = Math.min(
        slice,
        (hop.elapsed < hop.seconds / 2 ? hop.seconds / 2 : hop.seconds) - hop.elapsed,
      );
    }
    const to = { ...current };
    if (node.motion.kind === "fly") {
      const target =
        node.motion.to === "target"
          ? next.flightTarget
          : { x: object.origin.x + node.motion.to.x, y: object.origin.y + node.motion.to.y };
      if (!target) {
        throw new Error("Target flight must capture its destination on entry");
      }
      const distance = Math.hypot(target.x - current.x, target.y - current.y);
      if (distance > EDGE) {
        slice = Math.min(slice, distance / node.motion.speed);
        const fraction = Math.min(1, (node.motion.speed * slice) / distance);
        to.x = flightAxis(
          object,
          world,
          current,
          "x",
          current.x + (target.x - current.x) * fraction,
        );
        to.y = flightAxis(
          object,
          world,
          { ...current, x: to.x },
          "y",
          current.y + (target.y - current.y) * fraction,
        );
        if (to.x !== current.x) {
          next = { ...next, facing: to.x < current.x ? -1 : 1 };
        }
      }
    }
    if (node.motion.kind !== "wait" && node.motion.kind !== "fly" && node.motion.speed > 0) {
      const direction = heading(node, next);
      let desired = current[track.axis] + direction * node.motion.speed * slice;
      if (node.motion.direction === "target") {
        const target =
          bird[track.axis] +
          (track.axis === "x" ? tuning.width - object.width : tuning.height - object.height) / 2;
        desired = direction === 1 ? Math.min(desired, target) : Math.max(desired, target);
      }
      const end = reachable(object, world, current, next, direction, desired);
      const moving = Math.abs(end - current[track.axis]) / node.motion.speed;
      if (moving > 0) {
        slice = Math.min(slice, moving);
        to[track.axis] = end;
      }
    }
    if (hop) {
      const elapsed = Math.min(hop.seconds, hop.elapsed + slice);
      const desired = hop.groundY - hopLift(hop.height, hop.seconds, elapsed);
      to.y = hopY(object, world, { ...current, x: to.x }, desired);
      if (elapsed >= hop.seconds - EDGE || (desired > current.y && to.y < desired - EDGE)) {
        const landed = { ...next };
        delete landed.hop;
        next = landed;
      } else {
        next = { ...next, hop: { ...hop, elapsed } };
      }
    }
    const end = time + slice;
    segments.push({ axis: track.axis, end, facing: next.facing, from: current, start: time, to });
    current = to;
    next = { ...next, elapsed: next.elapsed + slice };
    time = end > time ? end : seconds;
    instant.clear();
  }
  return { actions, at: current, segments, state: next };
}

// A positive interval of relative swept overlap catches contact between fixed frames without
// treating an edge graze or a diagonal bounding-box overlap as a collision.
export function sweptContact(a: Rect, aEnd: Point, b: Rect, bEnd: Point): boolean {
  if (overlaps(a, b)) {
    return true;
  }
  let enter = 0;
  let leave = 1;
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height";
    const velocity = aEnd[axis] - a[axis] - (bEnd[axis] - b[axis]);
    if (velocity === 0) {
      if (a[axis] >= b[axis] + b[size] || b[axis] >= a[axis] + a[size]) {
        return false;
      }
      continue;
    }
    const first = (b[axis] - a[axis] - a[size]) / velocity;
    const last = (b[axis] + b[size] - a[axis]) / velocity;
    enter = Math.max(enter, Math.min(first, last));
    leave = Math.min(leave, Math.max(first, last));
  }
  return enter < leave;
}
