import { collisionCandidates } from "../core";
import type {
  BehaviourMotion,
  BehaviourNode,
  BehaviourPlan,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types";
import type { BehaviourState } from "./behaviour";
import { type BehaviourTrack, type BehaviourWorld, groundSupportEnd } from "./behaviourReach";

export function nodeOf(object: ObjectLayout, key: string): BehaviourNode {
  const node = object.behaviour?.states[key];
  if (!node) {
    throw new Error(`No behaviour state ${key} for ${object.character}`);
  }
  return node;
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

// A fixed travel direction, or the current facing for facing- and target-relative travel.
export function travelHeading(motion: BehaviourMotion, state: BehaviourState): -1 | 1 {
  return motion.kind !== "wait" &&
    motion.kind !== "fly" &&
    motion.kind !== "pursue" &&
    typeof motion.direction === "number"
    ? motion.direction
    : state.facing;
}

// The current state's track end in a direction, measured from its anchor.
export function trackEndpoint(
  object: ObjectLayout,
  direction: -1 | 1,
  state: BehaviourState,
): number {
  const plan = nodeOf(object, state.stateKey).track ?? object.behaviour;
  if (!plan) {
    throw new Error(`No behaviour for ${object.character}`);
  }
  const origin = (state.anchor ?? object.origin)[plan.axis];
  return direction === 1
    ? Math.max(origin, origin + plan.distance)
    : Math.min(origin, origin + plan.distance);
}

const groundBosses = new WeakMap<BehaviourPlan, boolean>();

// A ground boss: a pursuer that chases on the ground and never flies.
export function groundBoss(object: ObjectLayout): boolean {
  const plan = object.behaviour;
  if (!plan?.pursuit) {
    return false;
  }
  let ground = groundBosses.get(plan);
  if (ground === undefined) {
    const modes = Object.values(plan.states).flatMap(({ motion }) =>
      motion.kind === "pursue" ? [motion.mode] : motion.kind === "fly" ? ["fly"] : [],
    );
    ground = modes.includes("ground") && !modes.includes("fly");
    groundBosses.set(plan, ground);
  }
  return ground;
}

// How far along its track axis the contact box can travel towards desired before the track
// end, solid terrain or another object's solid platform stops it. A ground boss's committed
// horizontal move, and any move after an escape, also stops at the edge of its connected
// support, and does not travel once that support has gone.
export function trackReach(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  state: BehaviourState,
  direction: -1 | 1,
  desired: number,
): number {
  const axis = state.axis ?? object.behaviour?.axis ?? "x";
  const edge = trackEndpoint(object, direction, state);
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
  const node = nodeOf(object, state.stateKey);
  if (
    axis === "x" &&
    node.motion.kind === "move" &&
    (node.attack?.phase === "committed" || state.pursuit?.phase === "escaped") &&
    groundBoss(object)
  ) {
    to = groundSupportEnd(object, world, pursuitTrack(object), at, box, to);
  }
  return to;
}

// The pursuit leash as a horizontal track centred on the boss's origin.
export function pursuitTrack(object: ObjectLayout): BehaviourTrack {
  const distance = object.behaviour!.pursuit!.distance;
  return {
    axis: "x",
    distance: distance * 2,
    origin: { x: object.origin.x - distance, y: object.origin.y },
  };
}
