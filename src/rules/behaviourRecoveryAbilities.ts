import { type Ability, abilityFor, type AbilityTable } from "../ai/ability";
import { scopedStreams } from "../ai/randomStreams";
import type { ObjectLayout, Point } from "../data/types";
import type { BehaviourState, BehaviourStep } from "./behaviour";
import { animateSegments } from "./behaviourAnimation";
import { attackProtected } from "./behaviourAttack";
import {
  advanceIdleRecovery,
  advanceSupportedRecovery,
  type BehaviourIdleState,
  observeIdle,
  planIdleRecovery,
  planSupportedRecovery,
  preferredGroundWalk,
} from "./behaviourIdle";
import type { BehaviourPerception } from "./behaviourPerception";
import type { BehaviourWorld } from "./behaviourReach";
import { nodeOf } from "./behaviourTrack";
import type { BehaviourTraversalState } from "./behaviourTraversal";
import { birdBox } from "./bird";
import { landingSupport, supportContact } from "./flyLanding";

type BehaviourRecoveryParams =
  { readonly kind: "idle-recovery" } | { readonly kind: "periodic-reposition" };

export interface BehaviourRecoveryContext {
  // Enters a graph state at a point, as a transition would.
  readonly enter: (at: Point, key: string, state: BehaviourState) => BehaviourState;
  // The target of the first transition the graph would take now, if any.
  readonly firstTransition: (at: Point, state: BehaviourState) => string | undefined;
  readonly object: ObjectLayout;
  readonly perception: BehaviourPerception;
  readonly seconds: number;
}

interface BehaviourRecoveryStep {
  // Whether a periodic reposition yielded to a ready attack tell.
  readonly deferToAttack?: boolean;
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

// A seeded supported ground walk every interval while engaged, deferring to a ready tell.
const PERIODIC_REPOSITION: RecoveryAbility<"periodic-reposition"> = {
  act: (context, _, { at, state }) => {
    const { object, perception, seconds } = context;
    const { world } = perception;
    const config = object.behaviour!.groundReposition!,
      prior = state.groundReposition!;
    const node = nodeOf(object, state.stateKey),
      motion = nodeOf(object, config.resume).motion;
    if (motion.kind !== "pursue" || motion.mode !== "ground") {
      throw new Error("Periodic reposition requires ground pursuit physics");
    }
    const eligible =
      state.pursuit?.phase === "engaged" &&
      node.allowGroundReposition === true &&
      !attackProtected(node, state) &&
      !node.onEnter?.length &&
      !state.hop &&
      !state.idleWatchdog?.recovery &&
      (!state.traversal || (state.traversal.physical.grounded && !state.traversal.preparation)) &&
      supportContact(object, world, at);
    const firstTransition =
      !prior.recovery &&
      eligible &&
      prior.seconds >= config.intervalSeconds &&
      context.firstTransition(at, state);
    const attackOpportunity =
      firstTransition && nodeOf(object, firstTransition).attack?.phase === "tell";
    if (attackOpportunity) {
      return { deferToAttack: true, state };
    }
    const policy = {
      distance: config.distance,
      fullFrameGoal: true,
      maxAttempts: config.maxAttempts,
      minMovement: config.minDistance,
    };
    const selectionWorld = {
      ...world,
      ...(world.decisions && { decisions: scopedStreams("ground-periodic", world.decisions) }),
    };
    let prepared = prior;
    if (
      !prepared.recovery &&
      eligible &&
      !attackOpportunity &&
      prepared.seconds >= config.intervalSeconds
    ) {
      // Periodic variation requires its per-object seed, never a deterministic-facing fallback.
      prepared = { ...prepared, anchor: at };
      prepared = world.decisions
        ? planSupportedRecovery(
            preferredGroundWalk,
            policy,
            selectionWorld,
            object,
            motion,
            seconds,
            state.facing,
            prepared,
            at,
          )
        : { ...prepared, status: "geometry-unavailable" };
      if (!prepared.recovery) {
        return { state: { ...state, groundReposition: { ...prepared, seconds: 0 } } };
      }
    }
    if (!prepared.recovery) {
      return { state };
    }
    const active = { ...state, groundReposition: prepared };
    delete (active as { traversal?: BehaviourTraversalState }).traversal;
    const advanced = advanceSupportedRecovery(policy, world, object, motion, seconds, prepared, at);
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
    let next: BehaviourState = {
      ...animated.state,
      groundReposition: {
        ...advanced.idle,
        seconds: advanced.finished ? 0 : advanced.idle.seconds,
      },
      ...(advanced.idle.recovery?.kind === "ground" && {
        traversal: advanced.idle.recovery.traversal,
      }),
      ...(object.behaviour!.idleWatchdog &&
        state.idleWatchdog && {
          idleWatchdog: observeIdle(
            object.behaviour!.idleWatchdog,
            seconds,
            advanced.segments,
            state.idleWatchdog,
          ),
        }),
    };
    if (advanced.finished) {
      next = {
        ...context.enter(advanced.at, config.resume, next),
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
> = { "idle-recovery": IDLE_RECOVERY, "periodic-reposition": PERIODIC_REPOSITION };

export function recoveryStep(
  context: BehaviourRecoveryContext,
  params: BehaviourRecoveryParams,
  at: Point,
  state: BehaviourState,
): BehaviourRecoveryStep {
  return abilityFor(BEHAVIOUR_RECOVERIES, params)!.act(context, params, { at, state });
}
