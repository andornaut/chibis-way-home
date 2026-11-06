import type { Ability } from "../ai/ability";
import { EDGE, STEP_SECONDS } from "../core";
import type { Point, Rect } from "../data/types";
import type { BehaviourState } from "./behaviour";
import type {
  BehaviourAbilityContext,
  BehaviourAbilityParams,
  BehaviourActor,
  BehaviourMotionStep,
} from "./behaviourAbilities";
import { syncAnimation } from "./behaviourAnimation";
import {
  advanceMapEdge,
  blockMapChase,
  failMapEdge,
  type MapPlan,
  planMapLeg,
} from "./behaviourMapPursuit";
import {
  type BehaviourWorld,
  flightAxis,
  groundPursuitEnd,
  overheadFlightGoal,
  overheadFlightGoalForRect,
  overheadFlightRoute,
} from "./behaviourReach";
import { contactBox, pursuitTrack } from "./behaviourTrack";
import { advanceTraversal, advanceTraversalLeg } from "./behaviourTraversal";
import { birdBox } from "./bird";
import { flyLandingRoute } from "./flyLanding";

type PursuitAbility<Kind extends BehaviourAbilityParams["kind"]> = Ability<
  BehaviourAbilityContext,
  Extract<BehaviourAbilityParams, { readonly kind: Kind }>,
  BehaviourActor,
  BehaviourMotionStep
>;

interface PursuitAim {
  // The tracked rect: the scorer's held move or a traversal goal, else Chibi's live body.
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

// The scorer's held move keeps its own facing through the chase.
function intentFacing({ intent }: BehaviourAbilityContext, state: BehaviourState): BehaviourState {
  return intent.sampled && state.intent ? { ...state, facing: state.intent.facing } : state;
}

// Direct flight towards the chase target, clipped by solid terrain.
export const AIR_CHASE: PursuitAbility<"air-chase"> = {
  act: (context, { motion }, actor) => {
    const { slice } = context;
    if (!pursuing(actor.state)) {
      return { slice, state: actor.state, to: actor.to };
    }
    const aim = pursuitAim(context, motion.speed, actor);
    const { at } = actor;
    const { world } = context.perception;
    const dy = aim.targetY - at.y;
    const fraction = Math.min(1, aim.travel / (Math.hypot(aim.dx, dy) || 1));
    const x = flightAxis(context.object, world, at, "x", at.x + aim.dx * fraction);
    const to = { x, y: flightAxis(context.object, world, { ...at, x }, "y", at.y + dy * fraction) };
    return { slice, state: intentFacing(context, aim.state), to };
  },
};

// Ascends above Chibi, then follows the collision-checked overhead route to the approach goal
// along the captured travel side. The slice ends at the ascent's top, or where a scored
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
      } else if (intent.sampled && state.intent && route && vertical <= EDGE) {
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
    return { slice, state: intentFacing(context, next), to };
  },
};

type GroundChaseMotion = Extract<
  BehaviourAbilityParams,
  { readonly kind: "ground-chase" }
>["motion"];

// A pace walks its whole leg at the pace speed, searched or not.
function paceMotion(speed: number, motion: GroundChaseMotion): GroundChaseMotion {
  return {
    ...motion,
    speed,
    ...(motion.traversal && { traversal: { ...motion.traversal, speed } }),
  };
}

// The first movement-map leg toward Chibi for an engaged ground pursuer standing on its map,
// with its plan state; undefined when the on-demand planner chases instead.
function mapLeg(
  { object, perception, seconds, time }: BehaviourAbilityContext,
  motion: GroundChaseMotion,
  hers: Rect,
  world: BehaviourWorld,
  { at, state }: BehaviourActor,
): MapPlan | undefined {
  const traversal = state.traversal;
  const pace = object.behaviour!.pursuit!.pace;
  const entry = perception.world.groundMap?.();
  if (
    !entry ||
    !pace ||
    state.pursuit?.phase !== "engaged" ||
    (traversal &&
      (traversal.inputs.length > 0 ||
        (traversal.physical.x === at.x &&
          traversal.physical.y === at.y &&
          !traversal.physical.grounded)))
  ) {
    return undefined;
  }
  return planMapLeg(
    world,
    object,
    entry,
    pace,
    pace.speed * Math.max(seconds - time, 0),
    state.mapPursuit,
    at,
    hers,
  );
}

// Ground pursuit: a native planner traversal, planned once per step and sampled at this slice,
// or bounded travel along the leash on the current floor. On its movement map, an engaged
// pursuer takes the map's next leg or paces where no path reaches Chibi.
export const GROUND_CHASE: PursuitAbility<"ground-chase"> = {
  act: (context, { motion }, actor) => {
    const { object, perception, seconds, slice, time } = context;
    if (!pursuing(actor.state)) {
      return { slice, state: actor.state, to: actor.to };
    }
    const { world } = perception;
    const { at } = actor;
    const aim = pursuitAim(context, motion.speed, actor);
    let next = aim.state;
    if (!motion.traversal) {
      const desired = at.x + Math.max(-aim.travel, Math.min(aim.travel, aim.dx));
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
    const planned = context.traversal ? undefined : mapLeg(context, motion, aim.hers, timed, actor);
    const leg = planned?.leg;
    // The pace starts, and every turn holds, for a seeded pause facing Chibi, except within the
    // chase pause's clearance after an attack, where it walks on.
    const prior = next.mapPursuit;
    const turned = leg?.kind === "pace" && prior?.paceDirection !== planned!.state.paceDirection;
    const paceTurns = (prior?.paceTurns ?? 0) + (turned ? 1 : 0);
    const plan = planned && { ...planned, state: { ...planned.state, paceTurns } };
    if (leg?.kind === "pace") {
      const clearance = object.behaviour!.pursuit!.relief?.pause.tellClearanceSeconds ?? 0;
      const since = next.scorer?.sinceAttackSeconds;
      let holdSeconds = prior?.paceHoldSeconds ?? 0;
      if (since !== undefined && since < clearance - EDGE) {
        holdSeconds = 0;
      } else if (turned) {
        if (!world.decisions) {
          throw new Error("Pace pauses require an object-local decision context");
        }
        const { max, min } = object.behaviour!.pursuit!.pace!.pauseSeconds;
        holdSeconds = min + world.decisions(`pace:${paceTurns - 1}`)() * (max - min);
      }
      if (holdSeconds > EDGE) {
        const mine = at.x + object.width / 2;
        const theirs = aim.hers.x + aim.hers.width / 2;
        const held: BehaviourState = {
          ...next,
          facing: theirs === mine ? next.facing : theirs < mine ? -1 : 1,
          mapPursuit: { ...plan!.state, paceHoldSeconds: Math.max(0, holdSeconds - slice) },
        };
        return { slice, state: syncAnimation(object, held), to: { ...actor.to } };
      }
    }
    // A takeoff within the preparation interval of the last preparation launches without one.
    const now = timed.traversalFrame?.timeSeconds ?? 0;
    const interval = motion.traversal.prepIntervalSeconds;
    const physics =
      interval !== undefined &&
      next.takeoffPreparedAt !== undefined &&
      !next.traversal?.preparation &&
      now - next.takeoffPreparedAt < interval - EDGE
        ? { ...motion, traversal: { ...motion.traversal, prepSeconds: 0 } }
        : motion;
    const advanced =
      context.traversal ??
      (leg?.kind === "edge"
        ? advanceTraversalLeg(timed, object, physics, seconds - time, next.traversal, leg, at)
        : leg?.kind === "pace"
          ? advanceTraversalLeg(
              timed,
              object,
              paceMotion(object.behaviour!.pursuit!.pace!.speed, motion),
              seconds - time,
              next.traversal,
              { commands: [], goal: leg.goal, walk: true },
              at,
            )
          : advanceTraversal(timed, object, physics, seconds - time, next.traversal, at, aim.hers));
    const started = advanced.traversal?.preparation?.startedAtSeconds;
    if (started !== undefined && started !== next.traversal?.preparation?.startedAtSeconds) {
      next = { ...next, takeoffPreparedAt: started };
    }
    if (plan) {
      const result = advanced as { readonly consumed?: number; readonly failed?: boolean };
      next = {
        ...next,
        mapPursuit:
          leg?.kind === "chase"
            ? seconds - time + EDGE >= STEP_SECONDS &&
              advanced.at.x === at.x &&
              !advanced.traversal?.preparation &&
              !advanced.traversal?.inputs.length
              ? blockMapChase(
                  object.behaviour!.pursuit!.pace!,
                  at.x + (object.hitbox?.x ?? 0),
                  aim.hers.x + aim.hers.width / 2 - (object.hitbox?.width ?? object.width) / 2,
                  plan.state,
                )
              : plan.state
            : leg?.kind !== "edge"
              ? plan.state
              : result.failed
                ? failMapEdge(leg.edge, plan.state)
                : result.consumed !== undefined || advanced.traversal?.inputs.length
                  ? advanceMapEdge(leg, result.consumed, plan.state)
                  : plan.state,
      };
    }
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
    // A map leg faces its travel; chasing faces Chibi or the held intent.
    const facing =
      leg && leg.kind !== "chase" && !next.traversal?.preparation && endPoint.x !== at.x
        ? endPoint.x < at.x
          ? -1
          : 1
        : undefined;
    return {
      resynced: true,
      ...(segments && { segments }),
      slice,
      state: facing ? { ...next, facing } : intentFacing(context, next),
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
