import type {
  BehaviourCondition,
  BehaviourNode,
  BehaviourPlan,
  DuckTuning,
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
import { duckBox, type DuckState, EDGE } from "./duck";
import { hopLift } from "./motion";
import { overlaps } from "./rect";

export interface BehaviourState {
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
  readonly end: number;
  readonly facing: -1 | 1;
  readonly from: Point;
  readonly start: number;
  readonly to: Point;
}

export interface BehaviourStep {
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
      if (
        (node.animation !== null &&
          (typeof node.animation !== "string" || node.animation.length === 0)) ||
        (node.motion.kind !== "wait" &&
          (!valid(node.motion.speed) ||
            ![-1, 1, "facing", "target"].includes(node.motion.direction))) ||
        (node.motion.kind === "move" && (node.motion.speed === 0 || plan.distance === 0)) ||
        (node.motion.kind === "hop" &&
          (plan.axis !== "x" ||
            !valid(node.motion.hopHeight) ||
            node.motion.hopHeight === 0 ||
            !valid(node.motion.hopSeconds) ||
            node.motion.hopSeconds === 0 ||
            (node.motion.speed > 0 && plan.distance === 0)))
      ) {
        throw new Error(`Invalid behaviour motion or animation in ${key}`);
      }
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
          motion:
            node.motion.kind === "wait"
              ? node.motion
              : {
                  ...node.motion,
                  speed: node.motion.speed * tile,
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
  tuning: DuckTuning,
  object: ObjectLayout,
  duck: DuckState,
  at: Point,
  key: string,
  state: BehaviourState,
): BehaviourState {
  const node = nodeOf(object, key);
  let facing =
    node.motion.kind !== "wait" && typeof node.motion.direction === "number"
      ? node.motion.direction
      : state.facing;
  if (
    node.enter === "face-target" ||
    (node.motion.kind !== "wait" && node.motion.direction === "target")
  ) {
    const axis = object.behaviour?.axis ?? "x";
    const mine = at[axis] + (axis === "x" ? object.width : object.height) / 2;
    const target = duck[axis] + (axis === "x" ? tuning.width : tuning.height) / 2;
    facing = target < mine ? -1 : 1;
  }
  return { ...state, elapsed: 0, facing, stateKey: key };
}

export function startBehaviour(
  tuning: DuckTuning,
  object: ObjectLayout,
  duck: DuckState,
): BehaviourState {
  const plan = object.behaviour;
  if (!plan) {
    throw new Error(`No behaviour for ${object.character}`);
  }
  return enterState(tuning, object, duck, object.origin, plan.initial, {
    active: object.scene === undefined,
    elapsed: 0,
    facing: plan.distance < 0 ? -1 : 1,
    stateKey: plan.initial,
  });
}

// Collision uses the object's contact box. Vertical movers do not flip their
// horizontal art merely because they reverse vertical travel.
export function contactBox(object: ObjectLayout, at: Point, facing: -1 | 1): Rect {
  const box = object.hitbox ?? { height: object.height, width: object.width, x: 0, y: 0 };
  return {
    ...box,
    x:
      at.x +
      (facing === 1 || object.behaviour?.axis === "y" ? box.x : object.width - box.x - box.width),
    y: at.y + box.y,
  };
}

function heading(node: BehaviourNode, state: BehaviourState): -1 | 1 {
  return node.motion.kind !== "wait" && typeof node.motion.direction === "number"
    ? node.motion.direction
    : state.facing;
}

function endpoint(object: ObjectLayout, direction: -1 | 1): number {
  const plan = object.behaviour;
  if (!plan) {
    throw new Error(`No behaviour for ${object.character}`);
  }
  const origin = object.origin[plan.axis];
  return direction === 1
    ? Math.max(origin, origin + plan.distance)
    : Math.min(origin, origin + plan.distance);
}

function matches(
  tuning: DuckTuning,
  object: ObjectLayout,
  world: BehaviourWorld,
  duck: DuckState,
  at: Point,
  state: BehaviourState,
  condition: BehaviourCondition,
): boolean {
  if (condition.kind === "elapsed") {
    return state.elapsed >= condition.seconds;
  }
  if (condition.kind === "boundary") {
    const axis = object.behaviour?.axis ?? "x";
    return at[axis] === endpoint(object, heading(nodeOf(object, state.stateKey), state));
  }
  if (condition.kind === "reachable" || condition.kind === "lost-target") {
    const reachable = targetReachable(
      tuning,
      object,
      world,
      at,
      contactBox(object, at, state.facing),
      state.hop?.groundY ?? at.y,
      condition.tolerance,
      duck,
    );
    return condition.kind === "reachable" ? reachable : !reachable;
  }
  if (condition.kind === "same-ground") {
    return (
      duck.grounded &&
      Math.abs(duck.y + tuning.height - ((state.hop?.groundY ?? at.y) + object.height)) <=
        condition.tolerance
    );
  }
  const hers = duckBox(tuning, duck);
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
  const axis = object.behaviour?.axis ?? "x";
  const edge = endpoint(object, direction);
  let to = direction === 1 ? Math.min(edge, desired) : Math.max(edge, desired);
  const box = contactBox(object, at, state.facing);
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
  for (const solid of world.solids) {
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
  for (const solid of world.solids) {
    consider(solid, false);
  }
  for (const platform of world.platforms ?? []) {
    if (platform.owner !== object) {
      consider(platform.rect, platform.collision === "ledge");
    }
  }
  return to;
}

// Generic state graphs choose the motion, animation and transition order. The executor knows
// only bounded move/wait/hop primitives and conditions; it has no character-specific cycle.
export function stepBehaviour(
  tuning: DuckTuning,
  object: ObjectLayout,
  geometry: BehaviourGeometry,
  seconds: number,
  duck: DuckState,
  at: Point,
  state: BehaviourState,
): BehaviourStep {
  const plan = object.behaviour;
  if (!plan || seconds <= 0) {
    return { at, segments: [], state };
  }
  if (!state.active) {
    return {
      at,
      segments: [{ end: seconds, facing: state.facing, from: at, start: 0, to: at }],
      state,
    };
  }
  const world = behaviourWorld(geometry);
  const segments: BehaviourSegment[] = [];
  const instant = new Set<string>();
  let current = at;
  let next = state;
  let time = 0;
  while (true) {
    const node = nodeOf(object, next.stateKey);
    if (node.motion.kind !== "wait" && node.motion.direction === "target") {
      const mine = current[plan.axis] + (plan.axis === "x" ? object.width : object.height) / 2;
      const target = duck[plan.axis] + (plan.axis === "x" ? tuning.width : tuning.height) / 2;
      if (target !== mine) {
        next = { ...next, facing: target < mine ? -1 : 1 };
      }
    }
    const transition = node.transitions.find(({ when }) =>
      when.every((condition) => matches(tuning, object, world, duck, current, next, condition)),
    );
    if (transition) {
      if (instant.has(next.stateKey)) {
        throw new Error(`Instant behaviour transition cycle for ${object.character}`);
      }
      instant.add(next.stateKey);
      next = enterState(tuning, object, duck, current, transition.to, next);
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
            matches(tuning, object, world, duck, current, next, condition),
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
    if (node.motion.kind !== "wait" && node.motion.speed > 0) {
      const direction = heading(node, next);
      let desired = current[plan.axis] + direction * node.motion.speed * slice;
      if (node.motion.direction === "target") {
        const target =
          duck[plan.axis] +
          (plan.axis === "x" ? tuning.width - object.width : tuning.height - object.height) / 2;
        desired = direction === 1 ? Math.min(desired, target) : Math.max(desired, target);
      }
      const end = reachable(object, world, current, next, direction, desired);
      const moving = Math.abs(end - current[plan.axis]) / node.motion.speed;
      if (moving > 0) {
        slice = Math.min(slice, moving);
        to[plan.axis] = end;
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
    segments.push({ end, facing: next.facing, from: current, start: time, to });
    current = to;
    next = { ...next, elapsed: next.elapsed + slice };
    time = end > time ? end : seconds;
    instant.clear();
  }
  return { at: current, segments, state: next };
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
