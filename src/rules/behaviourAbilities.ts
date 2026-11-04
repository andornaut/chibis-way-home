import type { TraversalSafety } from "@andornaut/game-kit/terrain/traversal";

import type { Ability, AbilityResult, AbilityTable } from "../ai/ability";
import type { BehaviourMotion, ObjectLayout, Point } from "../data/types";
import type { BehaviourState } from "./behaviour";
import { alignmentBlocked, flightDestination } from "./behaviourFlight";
import type { BehaviourPerception } from "./behaviourPerception";
import {
  AIR_CHASE,
  ESCAPE_SETTLE,
  GROUND_CHASE,
  OVERHEAD_SWOOP,
} from "./behaviourPursuitAbilities";
import { type BehaviourWorld, flightAxis } from "./behaviourReach";
import { groundBoss, nodeOf, trackReach, travelHeading } from "./behaviourTrack";
import { type advanceTraversal, supportFall } from "./behaviourTraversal";
import { EDGE } from "./bird";
import { carryLandingSupport } from "./flyLanding";

type Motion<Kind extends BehaviourMotion["kind"]> = Extract<
  BehaviourMotion,
  { readonly kind: Kind }
>;

// Which ability acts a motion: the graph decides the motion; the ability moves the body.
export type BehaviourAbilityParams =
  | {
      readonly kind: "air-chase";
      readonly motion: Extract<Motion<"pursue">, { readonly mode: "fly" }>;
    }
  | { readonly kind: "escape-settle"; readonly motion: Motion<"pursue"> }
  | { readonly kind: "ground-fall"; readonly motion: Motion<"move" | "wait"> }
  | {
      readonly kind: "ground-chase";
      readonly motion: Extract<Motion<"pursue">, { readonly mode: "ground" }>;
    }
  | {
      readonly kind: "overhead-swoop";
      readonly motion: Extract<Motion<"pursue">, { readonly mode: "fly" }>;
    }
  | {
      readonly kind: "supported-landing";
      readonly motion: Extract<Motion<"fly">, { readonly to: "support" }>;
    }
  | {
      readonly kind: "target-flight";
      readonly motion: Exclude<Motion<"fly">, { readonly to: "support" }>;
    }
  | { readonly kind: "track-travel"; readonly motion: Motion<"hop" | "move"> }
  | { readonly kind: "wait"; readonly motion: Motion<"wait"> };

export function behaviourAbilityParams(
  motion: BehaviourMotion,
): BehaviourAbilityParams | undefined {
  switch (motion.kind) {
    case "hop":
    case "move":
      return { kind: "track-travel", motion };
    case "fly":
      return motion.to === "support"
        ? { kind: "supported-landing", motion }
        : { kind: "target-flight", motion };
    case "pursue":
      return motion.mode === "ground"
        ? { kind: "ground-chase", motion }
        : motion.overhead
          ? { kind: "overhead-swoop", motion }
          : { kind: "air-chase", motion };
    case "wait":
      return { kind: "wait", motion };
    default:
      return undefined;
  }
}

// A ground boss's committed move or recovery wait falls once its support has gone; a hop still
// in the air keeps its own arc.
export function groundFallParams(
  object: ObjectLayout,
  state: BehaviourState,
): Extract<BehaviourAbilityParams, { readonly kind: "ground-fall" }> | undefined {
  const node = nodeOf(object, state.stateKey);
  const { motion } = node;
  return (motion.kind === "move" || motion.kind === "wait") &&
    !state.hop &&
    node.attack?.phase === "committed" &&
    (state.axis ?? object.behaviour?.axis ?? "x") === "x" &&
    groundBoss(object)
    ? { kind: "ground-fall", motion }
    : undefined;
}

const groundPhysics = new WeakMap<ObjectLayout, Extract<Motion<"pursue">, { mode: "ground" }>>();

function groundPhysicsOf(object: ObjectLayout) {
  let motion = groundPhysics.get(object);
  if (!motion) {
    const found = Object.values(object.behaviour!.states).find(
      ({ motion }) => motion.kind === "pursue" && motion.mode === "ground" && motion.traversal,
    )?.motion;
    if (found?.kind !== "pursue" || found.mode !== "ground") {
      return undefined;
    }
    motion = found;
    groundPhysics.set(object, motion);
  }
  return motion;
}

export interface BehaviourAbilityContext {
  // Whether the graph would take an arrival transition with the body at a point after that
  // many more seconds of this state.
  readonly arrives: (at: Point, seconds: number, state: BehaviourState) => boolean;
  // Whether the motion follows a sampled pursuit intent this slice, and whether it pauses.
  readonly intent: { readonly paused: boolean; readonly sampled: boolean };
  readonly object: ObjectLayout;
  readonly perception: BehaviourPerception;
  // The whole step's length; a traversal plans the rest of the step from the slice start.
  readonly seconds: number;
  // The slice decided so far; an ability may shorten it to its motion's next event.
  readonly slice: number;
  // Support evaluated for supported motions this slice: whether the body rests on it, the
  // proven landing waypoint and the support world at the slice start.
  readonly support: {
    readonly supported: boolean;
    readonly target: Point | undefined;
    readonly world: BehaviourWorld | undefined;
  };
  // Seconds into the step at the slice start.
  readonly time: number;
  readonly track: { readonly axis: "x" | "y" };
  // This step's traversal advance, planned once at its first slice.
  readonly traversal: TraversalAdvance | undefined;
}

export type TraversalAdvance = ReturnType<typeof advanceTraversal>;

export interface BehaviourActor {
  readonly at: Point;
  readonly state: BehaviourState;
  // The slice end chosen by earlier abilities this slice; the body's start when none acted.
  readonly to: Point;
}

// Segments are clipped traversal legs for this slice, animated against the traversal clock.
export interface BehaviourMotionStep extends AbilityResult<BehaviourState, TraversalSafety, never> {
  // Carried support waypoints, in seconds from the slice start.
  readonly carry?: readonly { readonly at: Point; readonly seconds: number }[];
  // Whether a supported dwell held this slice; undefined for motions without a dwell clock.
  readonly dwell?: boolean;
  // Whether the state's animation was synchronised to a traversal pose.
  readonly resynced?: boolean;
  readonly slice: number;
  readonly to: Point;
  readonly traversal?: TraversalAdvance;
}

type BehaviourAbility<Kind extends BehaviourAbilityParams["kind"]> = Ability<
  BehaviourAbilityContext,
  Extract<BehaviourAbilityParams, { readonly kind: Kind }>,
  BehaviourActor,
  BehaviourMotionStep
>;

// Straight flight towards target at speed, clipped by solid terrain, facing its travel.
export function flyToward(
  object: ObjectLayout,
  world: BehaviourWorld,
  slice: number,
  speed: number | undefined,
  target: Point | undefined,
  { at, state, to }: BehaviourActor,
): BehaviourMotionStep {
  const distance = target ? Math.hypot(target.x - at.x, target.y - at.y) : 0;
  if (!(target && speed !== undefined && distance > EDGE)) {
    return { slice, state, to };
  }
  const limited = Math.min(slice, distance / speed);
  const fraction = Math.min(1, (speed * limited) / distance);
  const x = flightAxis(object, world, at, "x", at.x + (target.x - at.x) * fraction);
  const y = flightAxis(object, world, { ...at, x }, "y", at.y + (target.y - at.y) * fraction);
  return {
    slice: limited,
    state: x === at.x ? state : { ...state, facing: x < at.x ? -1 : 1 },
    to: { x, y },
  };
}

// Gravity on a ground boss whose support has gone, before its committed motion acts.
const GROUND_FALL: BehaviourAbility<"ground-fall"> = {
  act: ({ object, perception, slice, time }, _, actor) => {
    const physics = groundPhysicsOf(object);
    const { world } = perception;
    const fall =
      physics &&
      supportFall(
        world.traversalFrame
          ? {
              ...world,
              traversalFrame: {
                ...world.traversalFrame,
                timeSeconds: world.traversalFrame.timeSeconds + time,
              },
            }
          : world,
        object,
        physics,
        slice,
        actor.state.traversal,
        actor.at,
      );
    return fall
      ? {
          segments: fall.segments,
          slice,
          state: { ...actor.state, traversal: fall.traversal },
          to: { x: fall.at.x, y: fall.at.y },
        }
      : { slice, state: actor.state, to: actor.to };
  },
};

// Flight to an anchored point, a target captured on entry, or a live aligned drop point with
// bounded lead. A blocked drop alignment holds position.
const TARGET_FLIGHT: BehaviourAbility<"target-flight"> = {
  act: ({ object, perception, slice }, { motion }, actor) => {
    const target =
      motion.to === "target-x" && alignmentBlocked(perception, object, actor.at, actor.state)
        ? actor.at
        : flightDestination(perception, object, actor.at, actor.state);
    if (!target) {
      throw new Error("Target flight must capture its destination on entry");
    }
    return flyToward(object, perception.world, slice, motion.speed, target, actor);
  },
};

// Flight to the next proven landing waypoint of a varied perch or nearest support.
const SUPPORTED_LANDING: BehaviourAbility<"supported-landing"> = {
  act: ({ object, perception, slice, support }, { motion }, actor) =>
    flyToward(
      object,
      support.world ?? perception.world,
      slice,
      motion.speed,
      support.target,
      actor,
    ),
};

// Bounded travel along the state's track at the motion's speed, stopping at the track end,
// solid terrain and other solid platforms. Target-relative travel stops level with Chibi.
const TRACK_TRAVEL: BehaviourAbility<"track-travel"> = {
  act: ({ object, perception, slice, track }, { motion }, { at, state, to }) => {
    if (motion.speed <= 0) {
      return { slice, state, to };
    }
    const direction = travelHeading(motion, state);
    let desired = at[track.axis] + direction * motion.speed * slice;
    if (motion.direction === "target") {
      const { target: bird, tuning } = perception;
      const target =
        bird[track.axis] +
        (track.axis === "x" ? tuning.width - object.width : tuning.height - object.height) / 2;
      desired = direction === 1 ? Math.min(desired, target) : Math.max(desired, target);
    }
    const end = trackReach(object, perception.world, at, state, direction, desired);
    const moving = Math.abs(end - at[track.axis]) / motion.speed;
    return moving > 0
      ? { slice: Math.min(slice, moving), state, to: { ...to, [track.axis]: end } }
      : { slice, state, to };
  },
};

// A plain wait holds still. A supported dwell rides its support and counts only while that
// support still carries the body; without support it flies back to the proven landing.
const WAIT: BehaviourAbility<"wait"> = {
  act: ({ object, perception, slice, support, time }, { motion }, actor) => {
    if (motion.support !== "required") {
      return { slice, state: actor.state, to: actor.to };
    }
    const landing = actor.state.landing;
    if (!support.supported) {
      return {
        ...flyToward(
          object,
          support.world ?? perception.world,
          slice,
          landing?.speed,
          support.target,
          actor,
        ),
        dwell: false,
      };
    }
    if (!landing?.support) {
      return { dwell: false, slice, state: actor.state, to: actor.to };
    }
    const carried = carryLandingSupport(
      object,
      perception.world,
      time,
      slice,
      actor.at,
      landing.support,
    );
    return {
      carry: carried.points,
      dwell: carried.supported,
      slice,
      state: actor.state,
      to: { x: carried.at.x, y: carried.at.y },
    };
  },
};

export const BEHAVIOUR_ABILITIES: AbilityTable<
  BehaviourAbilityContext,
  BehaviourAbilityParams,
  BehaviourActor,
  BehaviourMotionStep
> = {
  "air-chase": AIR_CHASE,
  "escape-settle": ESCAPE_SETTLE,
  "ground-chase": GROUND_CHASE,
  "ground-fall": GROUND_FALL,
  "overhead-swoop": OVERHEAD_SWOOP,
  "supported-landing": SUPPORTED_LANDING,
  "target-flight": TARGET_FLIGHT,
  "track-travel": TRACK_TRAVEL,
  wait: WAIT,
};
