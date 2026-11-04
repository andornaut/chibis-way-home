import type { Ability } from "../ai/ability";
import { EDGE } from "../core";
import type { Point, Rect } from "../data/types";
import type { BehaviourState } from "./behaviour";
import type {
  BehaviourAbilityContext,
  BehaviourAbilityParams,
  BehaviourActor,
  BehaviourMotionStep,
} from "./behaviourAbilities";
import { syncAnimation } from "./behaviourAnimation";
import { pauseGroundIntent } from "./behaviourIntent";
import {
  flightAxis,
  groundPursuitEnd,
  overheadFlightGoal,
  overheadFlightGoalForRect,
  overheadFlightRoute,
} from "./behaviourReach";
import { contactBox, pursuitTrack } from "./behaviourTrack";
import { advanceTraversal } from "./behaviourTraversal";
import { birdBox } from "./bird";
import { flyLandingRoute } from "./flyLanding";

type PursuitAbility<Kind extends BehaviourAbilityParams["kind"]> = Ability<
  BehaviourAbilityContext,
  Extract<BehaviourAbilityParams, { readonly kind: Kind }>,
  BehaviourActor,
  BehaviourMotionStep
>;

interface PursuitAim {
  // The tracked rect: a held sampled intent or traversal goal, else Chibi's live body.
  readonly hers: Rect;
  readonly dx: number;
  readonly state: BehaviourState;
  readonly targetY: number;
  readonly travel: number;
}

// Chases only while engaged or still finishing an airborne traversal leg.
function pursuing(state: BehaviourState): boolean {
  return (
    state.pursuit?.phase === "engaged" ||
    (state.traversal !== undefined && !state.traversal.physical.grounded)
  );
}

// The contact-centred chase target inside the pursuit leash, facing it unless a traversal
// takeoff is preparing.
function pursuitAim(
  { intent, object, perception, slice }: BehaviourAbilityContext,
  speed: number,
  { at, state }: BehaviourActor,
): PursuitAim {
  const hers =
    intent.sampled && state.intent
      ? state.intent.target
      : intent.sampled && state.traversal
        ? state.traversal.target
        : birdBox(perception.tuning, perception.target);
  const contact = contactBox(object, at, state.facing, state.axis);
  const leash = object.behaviour!.pursuit!.distance;
  const targetX = Math.max(
    object.origin.x - leash,
    Math.min(
      object.origin.x + leash,
      hers.x + hers.width / 2 - contact.width / 2 - (contact.x - at.x),
    ),
  );
  const targetY = hers.y + hers.height / 2 - contact.height / 2 - (contact.y - at.y);
  const dx = targetX - at.x;
  return {
    dx,
    hers,
    state: {
      ...state,
      facing: state.traversal?.preparation
        ? state.facing
        : dx === 0
          ? state.facing
          : dx < 0
            ? -1
            : 1,
    },
    targetY,
    travel: speed * slice,
  };
}

// A held sampled intent keeps its own facing through the chase.
function intentFacing({ intent }: BehaviourAbilityContext, state: BehaviourState): BehaviourState {
  return intent.sampled && state.intent ? { ...state, facing: state.intent.facing } : state;
}

// Direct flight towards the chase target, clipped by solid terrain; a sampled pause hovers.
export const AIR_CHASE: PursuitAbility<"air-chase"> = {
  act: (context, { motion }, actor) => {
    const { slice } = context;
    if (!pursuing(actor.state)) {
      return { slice, state: actor.state, to: actor.to };
    }
    const aim = pursuitAim(context, motion.speed, actor);
    let to = actor.to;
    if (!(context.intent.sampled && context.intent.paused)) {
      const { at } = actor;
      const { world } = context.perception;
      const dy = aim.targetY - at.y;
      const fraction = Math.min(1, aim.travel / (Math.hypot(aim.dx, dy) || 1));
      const x = flightAxis(context.object, world, at, "x", at.x + aim.dx * fraction);
      to = { x, y: flightAxis(context.object, world, { ...at, x }, "y", at.y + dy * fraction) };
    }
    return { slice, state: intentFacing(context, aim.state), to };
  },
};

// Ascends above Chibi, then follows the collision-checked overhead route to the approach goal
// along the captured travel side. The slice ends at the ascent's top, or where a sampled
// approach crosses Chibi's live goal and the graph would arrive, so live guards observe it.
export const OVERHEAD_SWOOP: PursuitAbility<"overhead-swoop"> = {
  act: (context, { motion }, actor) => {
    const { intent, object, perception } = context;
    const overhead = motion.overhead!;
    const { at, state } = actor;
    let { slice } = context;
    if (state.pursuit?.phase === "engaged" && state.flightApproachDirection !== undefined) {
      const target = overheadFlightGoalForRect(
        overhead,
        state.flightApproachDirection,
        intent.sampled && state.intent
          ? state.intent.target
          : birdBox(perception.tuning, perception.target),
        object,
      );
      const vertical = Math.abs(target.y - at.y);
      const route = overheadFlightRoute(perception.world, object, at, target);
      if (vertical > EDGE && route) {
        slice = Math.min(slice, vertical / motion.speed);
      } else if (intent.sampled && state.intent && !intent.paused && route && vertical <= EDGE) {
        const live = overheadFlightGoal(
          perception.tuning,
          overhead,
          state.flightApproachDirection,
          perception.target,
          object,
        );
        const remaining = target.x - at.x,
          crossing = live.x - at.x;
        const crossingSeconds = Math.abs(crossing) / motion.speed;
        if (
          crossing * remaining > 0 &&
          Math.abs(crossing) <= Math.abs(remaining) &&
          crossingSeconds <= slice &&
          context.arrives({ x: live.x, y: at.y }, crossingSeconds, state)
        ) {
          slice = crossingSeconds;
        }
      }
    }
    if (!pursuing(state)) {
      return { slice, state, to: actor.to };
    }
    const aim = pursuitAim({ ...context, slice }, motion.speed, actor);
    let next = aim.state;
    let to = actor.to;
    if (!(intent.sampled && intent.paused)) {
      if (next.flightApproachDirection === undefined) {
        throw new Error("Overhead pursuit requires a committed approach direction");
      }
      const goal = overheadFlightGoalForRect(
        overhead,
        next.flightApproachDirection,
        aim.hers,
        object,
      );
      const route = overheadFlightRoute(perception.world, object, at, goal);
      if (route) {
        let remaining = aim.travel;
        let position = at;
        for (const waypoint of route) {
          const distance = Math.hypot(waypoint.x - position.x, waypoint.y - position.y);
          const fraction = Math.min(1, remaining / (distance || 1));
          position = {
            x: position.x + (waypoint.x - position.x) * fraction,
            y: position.y + (waypoint.y - position.y) * fraction,
          };
          remaining -= distance * fraction;
          if (fraction < 1) {
            break;
          }
        }
        to = { x: position.x, y: position.y };
        next = { ...next, facing: to.x === at.x ? next.facing : to.x < at.x ? -1 : 1 };
      }
    }
    return { slice, state: intentFacing(context, next), to };
  },
};

// Ground pursuit: a native planner traversal, planned once per step and sampled at this slice,
// or bounded travel along the leash on the current floor. A sampled pause holds on support.
export const GROUND_CHASE: PursuitAbility<"ground-chase"> = {
  act: (context, { motion }, actor) => {
    const { intent, object, perception, seconds, slice, time } = context;
    if (!pursuing(actor.state)) {
      return { slice, state: actor.state, to: actor.to };
    }
    const { world } = perception;
    const { at } = actor;
    const aim = pursuitAim(context, motion.speed, actor);
    let next = aim.state;
    if (!motion.traversal) {
      const desired =
        at.x +
        (intent.sampled && intent.paused ? 0 : Math.max(-aim.travel, Math.min(aim.travel, aim.dx)));
      const x = groundPursuitEnd(
        object,
        world,
        pursuitTrack(object),
        at,
        contactBox(object, at, next.facing, "x"),
        desired,
      );
      return { slice, state: intentFacing(context, next), to: { ...actor.to, x } };
    }
    const timed = {
      ...world,
      ...(world.traversalFrame && {
        traversalFrame: {
          ...world.traversalFrame,
          timeSeconds: world.traversalFrame.timeSeconds + time,
        },
      }),
    };
    const advanced =
      context.traversal ??
      (intent.sampled && intent.paused
        ? pauseGroundIntent(timed, object, motion, seconds - time, next.traversal, at)
        : advanceTraversal(timed, object, motion, seconds - time, next.traversal, at, aim.hers));
    const endSeconds = (world.traversalFrame?.timeSeconds ?? 0) + time + slice;
    const startSeconds = (world.traversalFrame?.timeSeconds ?? 0) + time;
    const pointAt = (atSeconds: number): Point => {
      const leg = advanced.segments?.find(
        (leg) => leg.endSeconds >= atSeconds && leg.endSeconds > leg.startSeconds,
      );
      if (!leg) {
        return advanced.at;
      }
      const fraction = Math.max(
        0,
        Math.min(1, (atSeconds - leg.startSeconds) / (leg.endSeconds - leg.startSeconds)),
      );
      return {
        x: leg.from.x + (leg.to.x - leg.from.x) * fraction,
        y: leg.from.y + (leg.to.y - leg.from.y) * fraction,
      };
    };
    const endPoint = pointAt(endSeconds);
    const segments = advanced.segments
      ?.filter((leg) => leg.endSeconds > startSeconds && leg.startSeconds < endSeconds)
      .map((leg) => ({
        ...leg,
        endSeconds: Math.min(endSeconds, leg.endSeconds),
        from: { ...leg.from, ...pointAt(Math.max(startSeconds, leg.startSeconds)) },
        startSeconds: Math.max(startSeconds, leg.startSeconds),
        to: { ...leg.to, ...pointAt(Math.min(endSeconds, leg.endSeconds)) },
      }));
    next = syncAnimation(
      object,
      { ...next, ...(advanced.traversal && { traversal: advanced.traversal }) },
      (world.traversalFrame?.timeSeconds ?? 0) + time,
    );
    return {
      resynced: true,
      ...(segments && { segments }),
      slice,
      state: intentFacing(context, next),
      to: { x: endPoint.x, y: endPoint.y },
      traversal: advanced,
    };
  },
};

// After an escape, a pursuer flies towards its nearest proven supported landing at pursuit
// speed before the graph settles it.
export const ESCAPE_SETTLE: PursuitAbility<"escape-settle"> = {
  act: ({ object, perception, slice }, { motion }, { at, state, to }) => {
    const { world } = perception;
    const target = flyLandingRoute(object, world, at)?.[0];
    if (!target) {
      return { slice, state, to };
    }
    const distance = Math.hypot(target.x - at.x, target.y - at.y);
    const limited = Math.min(slice, distance / motion.speed);
    const fraction = Math.min(1, (motion.speed * limited) / distance);
    const x = flightAxis(object, world, at, "x", at.x + (target.x - at.x) * fraction);
    return {
      slice: limited,
      state,
      to: {
        x,
        y: flightAxis(object, world, { ...at, x }, "y", at.y + (target.y - at.y) * fraction),
      },
    };
  },
};
