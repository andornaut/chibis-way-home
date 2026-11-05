import { type Ability, abilityFor, type AbilityTable } from "../ai/ability";
import type { ObjectLayout, Point } from "../data/types";
import type { BehaviourState, BehaviourStep } from "./behaviour";
import { animateSegments } from "./behaviourAnimation";
import { attackProtected } from "./behaviourAttack";
import {
  advanceIdleRecovery,
  type BehaviourIdleState,
  observeIdle,
  planIdleRecovery,
} from "./behaviourIdle";
import type { BehaviourPerception } from "./behaviourPerception";
import type { BehaviourWorld } from "./behaviourReach";
import { nodeOf } from "./behaviourTrack";
import type { BehaviourTraversalState } from "./behaviourTraversal";
import { birdBox } from "./bird";
import { landingSupport, supportContact } from "./flyLanding";

type BehaviourRecoveryParams = { readonly kind: "idle-recovery" };

export interface BehaviourRecoveryContext {
  // Enters a graph state at a point, as a transition would.
  readonly enter: (at: Point, key: string, state: BehaviourState) => BehaviourState;
  readonly object: ObjectLayout;
  readonly perception: BehaviourPerception;
  readonly seconds: number;
}

interface BehaviourRecoveryStep {
  readonly state: BehaviourState;
  // The whole step, when recovery moved the body instead of the graph.
  readonly step?: BehaviourStep;
}

type RecoveryAbility<Kind extends BehaviourRecoveryParams["kind"]> = Ability<
  BehaviourRecoveryContext,
  Extract<BehaviourRecoveryParams, { readonly kind: Kind }>,
  { readonly at: Point; readonly state: BehaviourState },
  BehaviourRecoveryStep
>;

// A supported dwell that allows idle reposition: an engaged overhead flyer may recover only from
// such a perch, never during its overhead approach or attack.
function perchedWait(object: ObjectLayout, state: BehaviourState): boolean {
  const node = nodeOf(object, state.stateKey);
  return (
    node.motion.kind === "wait" &&
    node.motion.support === "required" &&
    node.allowIdleReposition === true
  );
}

export function idleReady(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  state: BehaviourState,
): boolean {
  const watchdog = object.behaviour!.idleWatchdog,
    idle = state.idleWatchdog;
  if (!watchdog || !idle || idle.recovery) {
    return false;
  }
  const node = nodeOf(object, state.stateKey);
  const recovery = nodeOf(object, watchdog.resume).motion;
  const overheadEngaged =
    state.pursuit?.phase === "engaged" &&
    recovery.kind === "pursue" &&
    recovery.mode === "fly" &&
    recovery.overhead !== undefined;
  if (overheadEngaged && !perchedWait(object, state)) {
    return false;
  }
  // A perched overhead flyer recovers only from actual support.
  const flyingHover =
    !overheadEngaged &&
    recovery.kind === "pursue" &&
    recovery.mode === "fly" &&
    (node.motion.kind === "wait" || (node.motion.kind === "pursue" && node.motion.mode === "fly"));
  return (
    world.traversalFrame !== undefined &&
    !attackProtected(node, state) &&
    node.allowIdleReposition === true &&
    node.motion.kind !== "hop" &&
    node.motion.kind !== "fly" &&
    !node.onEnter?.length &&
    !state.hop &&
    (!state.traversal || (state.traversal.physical.grounded && !state.traversal.preparation)) &&
    (supportContact(object, world, at) || flyingHover) &&
    idle.seconds >= watchdog.seconds &&
    (idle.attemptedAt === undefined || idle.seconds - idle.attemptedAt >= watchdog.seconds)
  );
}

// Bounded, verified supported recovery after an acquired actor has stayed idle too long.
const IDLE_RECOVERY: RecoveryAbility<"idle-recovery"> = {
  act: (context, _, { at, state }) => {
    const { object, perception, seconds } = context;
    const { world } = perception;
    const watchdog = object.behaviour!.idleWatchdog,
      idle = state.idleWatchdog;
    if (!watchdog || !idle) {
      return { state };
    }
    const motion = nodeOf(object, watchdog.resume).motion;
    if (motion.kind !== "pursue") {
      throw new Error("Idle recovery requires a pursuit profile");
    }
    if (
      state.pursuit?.phase === "engaged" &&
      motion.mode === "fly" &&
      motion.overhead &&
      !perchedWait(object, state)
    ) {
      const pending = { ...idle };
      delete (pending as { recovery?: BehaviourIdleState["recovery"] }).recovery;
      return { state: { ...state, idleWatchdog: pending } };
    }
    const prepared = idleReady(object, world, at, state)
      ? planIdleRecovery(
          world,
          birdBox(perception.tuning, perception.target),
          object,
          motion,
          seconds,
          state.facing,
          idle,
          at,
        )
      : idle;
    const active = { ...state, idleWatchdog: prepared };
    if (!prepared.recovery) {
      return { state: active };
    }
    delete (active as { traversal?: BehaviourTraversalState }).traversal;
    const advanced = advanceIdleRecovery(world, object, motion, seconds, prepared, at);
    const animated = animateSegments(
      object,
      seconds,
      {
        ...active,
        ...(advanced.idle.recovery?.kind === "ground" && {
          traversal: advanced.idle.recovery.traversal,
        }),
      },
      advanced.segments,
      world.traversalFrame?.timeSeconds,
    );
    let next = {
      ...animated.state,
      idleWatchdog: observeIdle(watchdog, seconds, advanced.segments, advanced.idle),
      ...(advanced.idle.recovery?.kind === "ground" && {
        traversal: advanced.idle.recovery.traversal,
      }),
    };
    // A perch recovery lands back in its own dwell on the new support, keeping the dwell's clock
    // so its graph continues; other recoveries resume pursuit.
    if (advanced.finished) {
      const support = perchedWait(object, state)
        ? landingSupport(object, world, advanced.at)
        : undefined;
      next = support
        ? {
            ...next,
            landing: { speed: next.landing?.speed ?? motion.speed, status: "supported", support },
          }
        : {
            ...context.enter(advanced.at, watchdog.resume, next),
            idleWatchdog: next.idleWatchdog,
            pendingEntry: false,
          };
    }
    return {
      state: next,
      step: { actions: [], at: advanced.at, segments: animated.segments, state: next },
    };
  },
};

const BEHAVIOUR_RECOVERIES: AbilityTable<
  BehaviourRecoveryContext,
  BehaviourRecoveryParams,
  { readonly at: Point; readonly state: BehaviourState },
  BehaviourRecoveryStep
> = { "idle-recovery": IDLE_RECOVERY };

export function recoveryStep(
  context: BehaviourRecoveryContext,
  params: BehaviourRecoveryParams,
  at: Point,
  state: BehaviourState,
): BehaviourRecoveryStep {
  return abilityFor(BEHAVIOUR_RECOVERIES, params)!.act(context, params, { at, state });
}
