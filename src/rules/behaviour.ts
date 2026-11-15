import type { TraversalSafety } from "@andornaut/game-kit/runtime/terrain/traversal";

import { abilityFor } from "../ai/ability.ts";
import { collisionCandidates, contactFrameAt, EDGE, spriteFrameOrigin } from "../core/index.ts";
import type {
  BehaviourAction,
  BehaviourCondition,
  BehaviourNode,
  BehaviourPlan,
  BirdTuning,
  DialogueLine,
  HazardPhase,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types/index.ts";
import {
  BEHAVIOUR_ABILITIES,
  type BehaviourAbilityParams,
  behaviourAbilityParams,
  groundFallParams,
  type TraversalAdvance,
} from "./behaviourAbilities.ts";
import { animateSegments, syncAnimation } from "./behaviourAnimation.ts";
import {
  advanceAttackClock,
  attackProtected,
  attackReady,
  type BehaviourAttackState,
  canEnterAttack,
  clearTellCancels,
  enterAttack,
} from "./behaviourAttack.ts";
import { alignmentBlocked, flightDestination } from "./behaviourFlight.ts";
import type { FlightSelectionState } from "./behaviourFlightSelection.ts";
import { type BehaviourIdleState, observeIdle } from "./behaviourIdle.ts";
import {
  advancePursuitIntent,
  type PursuitIntentState,
  safeIntentHover,
} from "./behaviourIntent.ts";
import {
  type BehaviourInterludeContext,
  chasePauseHold,
  giveUpDraw,
  homeWalk,
  startChasePause,
  wanderStep,
} from "./behaviourInterludes.ts";
import { type BehaviourMapPursuitState, mapCovers, mapReachable } from "./behaviourMapPursuit.ts";
import { recordBehaviourWork } from "./behaviourObserver.ts";
import { type BehaviourPerception, perceiveBehaviour } from "./behaviourPerception.ts";
import { pursuitKinds } from "./behaviourProfile.ts";
import {
  type BehaviourGeometry,
  type BehaviourWorld,
  flightContactApproach,
  overheadFlightGoal,
  overheadFlightGoalForRect,
  overheadFlightRoute,
  targetReachable,
} from "./behaviourReach.ts";
import {
  type BehaviourRecoveryContext,
  idleReady,
  recoveryStep,
} from "./behaviourRecoveryAbilities.ts";
import {
  advanceScorer,
  type BehaviourScorerState,
  type BossScorerValues,
  decideScored,
  moveIntent,
  openingScorerState,
  scorerAttacked,
} from "./behaviourScorer.ts";
import { prepareSupport } from "./behaviourSupport.ts";
import {
  contactBox,
  groundBoss,
  nodeOf,
  pursuitTrack,
  trackEndpoint,
  trackReach,
  travelHeading,
  travelLimit,
} from "./behaviourTrack.ts";
import {
  type BehaviourRearmState,
  type BehaviourTraversalState,
  probeRearm,
} from "./behaviourTraversal.ts";
import { birdBox, type BirdState } from "./bird.ts";
import { type FlyLandingState, supportContact } from "./flyLanding.ts";
import { hopLift } from "./motion.ts";
import { targetInCurrentView, targetInSameChunk, targetVisible } from "./perception.ts";

export { layoutBehaviour } from "./behaviourLayout.ts";

export interface BehaviourState extends BehaviourAttackState {
  // A dead boss's removal: the seconds since it died.
  readonly defeat?: { readonly seconds: number };
  readonly idleWatchdog?: BehaviourIdleState;
  readonly mapPursuit?: BehaviourMapPursuitState;
  // Zone seconds at which the last pursuit takeoff preparation started.
  readonly takeoffPreparedAt?: number;
  readonly rearm?: BehaviourRearmState;
  readonly traversal?: BehaviourTraversalState;
  readonly anchor?: Point;
  readonly pursuit?: {
    readonly phase: "engaged" | "escaped";
    readonly unreachableSeconds: number;
    readonly settled: boolean;
    // Seconds since this engagement began, and since the chase ended.
    readonly engagedSeconds?: number;
    readonly endedSeconds?: number;
    // Engagements so far, this one included; each draws its give-up time from its own stream.
    readonly engagements?: number;
    // The engaged seconds this engagement's chase relief gives up at, at a chase pause.
    readonly giveUpSeconds?: number;
    // Engaged, a chase pause reached the give-up time and the next update ends pursuit; escaped,
    // the chase ended by giving up.
    readonly giveUp?: true;
    // A ground boss whose chase ended walks back toward its encounter position once settled.
    readonly home?: true;
  };
  // A chase pause: the boss holds facing Chibi for the remaining seconds.
  readonly chasePause?: { readonly remainingSeconds: number };
  // The wander: moves so far, then either the walk's goal x and heading, or the hold left before
  // the next move. A flyer's hop records its zone start time and the hold to follow its landing.
  readonly wander?: BehaviourWanderState;
  readonly animationTag?: string;
  readonly animationSeconds?: number;
  readonly axis?: "x" | "y";
  readonly flightApproachDirection?: -1 | 1;
  readonly flightTarget?: Point;
  readonly intent?: PursuitIntentState;
  readonly scorer?: BehaviourScorerState;
  readonly flightDecision?: number;
  readonly flightSelection?: FlightSelectionState;
  readonly landing?: FlyLandingState;
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
  // The axis position captured on entry to a move or hop with a distance.
  readonly travelFrom?: number;
}

export interface BehaviourWanderState {
  // Where the last walk began.
  readonly from?: number;
  readonly goal?: number;
  readonly heading?: -1 | 1;
  readonly holdSeconds: number;
  readonly hop?: { readonly every: number; readonly hold: number; readonly startedAt: number };
  readonly moves: number;
}

export interface BehaviourSegment {
  readonly hazardPhase?: HazardPhase;
  readonly frame?: string;
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
  readonly escaped?: DialogueLine;
  readonly actions: readonly BehaviourEvent[];
  readonly at: Point;
  readonly segments: readonly BehaviourSegment[];
  readonly state: BehaviourState;
}

function enterState(
  perception: BehaviourPerception,
  object: ObjectLayout,
  at: Point,
  key: string,
  state: BehaviourState,
): BehaviourState {
  const { target: bird, tuning } = perception;
  const node = nodeOf(object, key);
  const leavingPursuit =
    nodeOf(object, state.stateKey).motion.kind === "pursue" && node.motion.kind !== "pursue";
  const anchor = leavingPursuit && !state.hop ? at : state.anchor;
  let facing =
    node.motion.kind !== "wait" &&
    node.motion.kind !== "fly" &&
    node.motion.kind !== "pursue" &&
    typeof node.motion.direction === "number"
      ? node.motion.direction
      : state.facing;
  if (
    node.enter === "face-target" ||
    (node.motion.kind !== "wait" &&
      node.motion.kind !== "fly" &&
      node.motion.kind !== "pursue" &&
      node.motion.direction === "target")
  ) {
    const axis = node.track?.axis ?? object.behaviour?.axis ?? "x";
    const mine = at[axis] + (axis === "x" ? object.width : object.height) / 2;
    const target = bird[axis] + (axis === "x" ? tuning.width : tuning.height) / 2;
    facing = target < mine ? -1 : 1;
  }
  if (node.motion.kind === "fly" && typeof node.motion.to === "string") {
    const target = birdBox(tuning, bird);
    const mine = contactBox(object, at, facing, node.track?.axis ?? object.behaviour?.axis);
    facing = target.x + target.width / 2 < mine.x + mine.width / 2 ? -1 : 1;
  }
  const next: BehaviourState = {
    ...state,
    ...(anchor && { anchor }),
    axis: node.motion.kind === "pursue" ? "x" : (node.track?.axis ?? object.behaviour?.axis ?? "x"),
    elapsed: 0,
    facing,
    pendingEntry: true,
    stateKey: key,
  };
  delete (next as { flightTarget?: Point }).flightTarget;
  delete (next as { intent?: PursuitIntentState }).intent;
  if ((node.motion.kind === "move" || node.motion.kind === "hop") && node.motion.distance) {
    (next as { travelFrom: number }).travelFrom = at[next.axis!];
  } else {
    delete (next as { travelFrom?: number }).travelFrom;
  }
  if (
    key !== state.stateKey ||
    !(node.motion.kind === "fly" && node.motion.to === "support" && node.motion.selection)
  ) {
    delete (next as { flightSelection?: FlightSelectionState }).flightSelection;
  }
  if (
    !(node.motion.kind === "fly" && node.motion.to === "support") &&
    !(node.motion.kind === "wait" && node.motion.support === "required")
  ) {
    delete (next as { landing?: FlyLandingState }).landing;
  }
  if (leavingPursuit || (state.stateKey !== key && next.traversal?.preparation)) {
    delete (next as { traversal?: BehaviourTraversalState }).traversal;
  }
  if (node.motion.kind === "pursue" && node.motion.mode === "fly" && node.motion.overhead) {
    if (node.attack?.phase === "tell") {
      if (next.flightApproachDirection === undefined) {
        throw new Error("Overhead tell requires a committed approach direction");
      }
    } else {
      (next as { flightApproachDirection: -1 | 1 }).flightApproachDirection =
        bird.vx === 0 ? bird.facing : bird.vx < 0 ? -1 : 1;
    }
  }
  let animation = syncAnimation(object, next);
  if (node.attack?.phase === "tell" && object.contact) {
    animation = { ...animation, animationSeconds: 0 };
  }
  if (node.motion.kind === "fly" && node.motion.to === "target-x") {
    return { ...animation, flightTarget: { x: at.x, y: at.y } };
  }
  if (node.motion.kind === "fly" && node.motion.to === "target") {
    const contact = contactBox(object, at, facing, next.axis);
    const target = birdBox(tuning, bird);
    const x = target.x + target.width / 2 - contact.width / 2 - (contact.x - at.x);
    const y = target.y + target.height / 2 - contact.height / 2 - (contact.y - at.y);
    return {
      ...animation,
      flightTarget: {
        x: Math.max(
          (anchor ?? object.origin).x + node.motion.bounds.x,
          Math.min(
            (anchor ?? object.origin).x + node.motion.bounds.x + node.motion.bounds.width,
            x,
          ),
        ),
        y: Math.max(
          (anchor ?? object.origin).y + node.motion.bounds.y,
          Math.min(
            (anchor ?? object.origin).y + node.motion.bounds.y + node.motion.bounds.height,
            y,
          ),
        ),
      },
    };
  }
  return animation;
}

// Only applied entries count; track-clear previews and initial construction use enterState.
function transitionState(
  perception: BehaviourPerception,
  object: ObjectLayout,
  at: Point,
  key: string,
  state: BehaviourState,
): BehaviourState {
  const next = enterState(perception, object, at, key, state);
  if (next.stateKey !== state.stateKey) {
    recordBehaviourWork(perception.world.observation, "transitions", 1);
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
  return enterState(perceiveBehaviour(tuning, [], bird), object, object.origin, plan.initial, {
    active: object.scene === undefined,
    elapsed: 0,
    facing: plan.facing ?? (plan.distance < 0 ? -1 : 1),
    stateKey: plan.initial,
  });
}

// The scorer's inputs from the snapshot and the boss's own state, in layout units.
function scorerValues(
  perception: BehaviourPerception,
  object: ObjectLayout,
  at: Point,
  state: BehaviourState,
): BossScorerValues {
  const { target: bird, tuning } = perception;
  const body = horizontalBodyBounds(object, at, state);
  const target = birdBox(tuning, bird);
  const heightDelta = at.y + object.height - (target.y + target.height);
  const scorer = state.scorer ?? openingScorerState(object.behaviour!.scorer!);
  return {
    distance: Math.hypot(
      target.x + target.width / 2 - (at.x + object.width / 2),
      target.y + target.height / 2 - (at.y + object.height / 2),
    ),
    heightDelta,
    heightGap: Math.abs(heightDelta),
    horizontalGap: Math.max(0, body.x - target.x - target.width, target.x - body.x - body.width),
    lineOfSight: matches(perception, object, at, state, { kind: "line-of-sight" }) ? 1 : 0,
    specialDueSeconds: scorer.specialDueSeconds,
    targetSpeed: Math.abs(bird.vx),
    threatSeconds: scorer.threatSeconds,
  };
}

function horizontalBodyBounds(object: ObjectLayout, at: Point, state: BehaviourState): Rect {
  const contact = object.contact;
  if (!contact) {
    return contactBox(object, at, state.facing, state.axis);
  }
  if (state.animationTag === undefined || state.animationSeconds === undefined) {
    throw new Error(`Missing silhouette pose for ${object.art}`);
  }
  const frame = contactFrameAt(contact, state.animationTag, state.animationSeconds).frame;
  const rows = contact.frames[frame];
  if (!rows?.length) {
    throw new Error(`Missing opaque body bounds for ${object.art}`);
  }
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const [y, from, to] of rows) {
    left = Math.min(left, from);
    right = Math.max(right, to);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y + 1);
  }
  const origin = spriteFrameOrigin(contact.frame, object, at);
  const flipped = state.facing < 0 && (state.axis ?? object.behaviour?.axis) !== "y";
  return {
    height: bottom - top,
    width: right - left,
    x: origin.x + (flipped ? contact.frame.width - right : left),
    y: origin.y + top,
  };
}

function matches(
  perception: BehaviourPerception,
  object: ObjectLayout,
  at: Point,
  state: BehaviourState,
  condition: BehaviourCondition,
): boolean {
  const { target: bird, tuning, world } = perception;
  if (condition.kind === "attack-ready") {
    return attackReady(state);
  }
  if (condition.kind === "targeted-attack-allowed") {
    return world.targetedAttackWindow === "allowed";
  }
  if (condition.kind === "pursuit-ended") {
    return (
      object.behaviour?.pursuit !== undefined &&
      state.pursuit?.phase === "escaped" &&
      !state.pursuit.settled
    );
  }
  if (condition.kind === "flight-approach-direction") {
    return state.flightApproachDirection === condition.direction;
  }
  if (condition.kind === "track-room") {
    const axis = state.axis ?? object.behaviour?.axis ?? "x";
    const size = axis === "x" ? "width" : "height";
    const mine = at[axis] + object[size] / 2;
    const theirs = bird[axis] + tuning[size] / 2;
    const heading = theirs < mine ? -1 : 1;
    const turned: BehaviourState = { ...state, facing: heading };
    const end = trackEndpoint(object, heading, turned);
    return (
      Math.abs(trackReach(object, world, at, turned, heading, end) - at[axis]) >=
      condition.distance - EDGE
    );
  }
  if (condition.kind === "horizontal-gap") {
    const body = horizontalBodyBounds(object, at, state);
    const target = birdBox(tuning, bird);
    const gap = Math.max(0, body.x - target.x - target.width, target.x - body.x - body.width);
    return condition.comparison === "at-least"
      ? gap >= condition.distance
      : gap < condition.distance;
  }
  if (condition.kind === "alignment-blocked") {
    return alignmentBlocked(perception, object, at, state);
  }
  if (condition.kind === "line-of-sight") {
    return targetVisible(
      world,
      object,
      contactBox(object, at, state.facing, state.axis),
      birdBox(tuning, bird),
    );
  }
  if (condition.kind === "visible") {
    if (object.behaviour?.pursuit) {
      return state.pursuit?.phase === "engaged";
    }
    return targetVisible(
      world,
      object,
      contactBox(object, at, state.facing, state.axis),
      birdBox(tuning, bird),
    );
  }
  if (condition.kind === "elapsed") {
    // Timed hazard, clocked support and gust emitter boundaries tolerate arithmetic rounding,
    // without extending legacy clocks.
    const node = object.behaviour?.states[state.stateKey];
    const rounding =
      node?.hazardPhase === undefined &&
      node?.supportPhase === undefined &&
      node?.gustPhase === undefined
        ? 0
        : Number.EPSILON * Math.max(1, state.elapsed, condition.seconds) * 4;
    return state.elapsed + rounding >= condition.seconds;
  }
  if (condition.kind === "arrived") {
    const motion = nodeOf(object, state.stateKey).motion;
    if (motion.kind === "pursue" && motion.mode === "fly" && motion.overhead) {
      if (state.flightApproachDirection === undefined) {
        return false;
      }
      const tracked = condition.target === "intent" ? state.intent?.target : birdBox(tuning, bird);
      if (!tracked) {
        return false;
      }
      const target = overheadFlightGoalForRect(
        motion.overhead,
        state.flightApproachDirection,
        tracked,
        object,
      );
      // Within the tolerance of the goal on either side of its lead and clearance, on a
      // routable overhead path.
      return (
        overheadFlightRoute(world, object, at, target) !== undefined &&
        Math.hypot(at.x - target.x, at.y - target.y) <= condition.tolerance
      );
    }
    if (motion.kind !== "fly") {
      return false;
    }
    if (motion.to === "support") {
      return supportContact(object, world, at);
    }
    if (motion.to === "target-x" && alignmentBlocked(perception, object, at, state)) {
      return false;
    }
    const target = flightDestination(perception, object, at, state);
    return (
      target !== undefined && Math.hypot(at.x - target.x, at.y - target.y) <= condition.tolerance
    );
  }
  if (condition.kind === "boundary") {
    const axis = state.axis ?? object.behaviour?.axis ?? "x";
    const { motion } = nodeOf(object, state.stateKey);
    const heading = travelHeading(motion, state);
    const end = trackEndpoint(object, heading, state);
    // After an escape, a ground boss's track can outrun its support; the edge or wall that
    // stops it bounds the track there.
    return (
      at[axis] === end ||
      at[axis] === travelLimit(motion, state, heading) ||
      (state.pursuit?.phase === "escaped" &&
        axis === "x" &&
        groundBoss(object) &&
        Math.abs(trackReach(object, world, at, state, heading, end) - at[axis]) <= EDGE)
    );
  }
  if (condition.kind === "not") {
    return !matches(perception, object, at, state, condition.condition);
  }
  if (condition.kind === "blocked") {
    const axis = state.axis ?? object.behaviour?.axis ?? "x";
    const heading = travelHeading(nodeOf(object, state.stateKey).motion, state);
    const end = trackEndpoint(object, heading, state);
    return (
      at[axis] !== end &&
      Math.abs(trackReach(object, world, at, state, heading, end) - at[axis]) <= EDGE
    );
  }
  if (condition.kind === "track-clear") {
    const entered = enterState(perception, object, at, condition.state, state);
    const heading = travelHeading(nodeOf(object, condition.state).motion, entered);
    const end = trackEndpoint(object, heading, entered);
    return trackReach(object, world, at, entered, heading, end) === end;
  }
  if (condition.kind === "reachable" || condition.kind === "lost-target") {
    // A mapped ground pursuer paces where no path reaches Chibi instead of losing him.
    const entry = state.pursuit?.phase === "engaged" ? world.groundMap?.() : undefined;
    if (
      condition.kind === "lost-target" &&
      entry &&
      object.behaviour!.pursuit?.pace &&
      pursuitKinds(object.behaviour!).groundTraversal &&
      mapCovers(world, object, entry, at, birdBox(tuning, bird))
    ) {
      return false;
    }
    const reachable =
      state.pursuit?.phase === "engaged"
        ? pursuitReachable(perception, object, at, state)
        : targetReachable(
            tuning,
            object,
            world,
            at,
            contactBox(object, at, state.facing, state.axis),
            state.hop?.groundY ?? at.y,
            condition.tolerance,
            {
              ...(nodeOf(object, state.stateKey).track ?? object.behaviour!),
              ...(state.anchor && { origin: state.anchor }),
            },
            bird,
          );
    return condition.kind === "reachable" ? reachable === true : reachable === false;
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

function pursuitReachable(
  perception: BehaviourPerception,
  object: ObjectLayout,
  at: Point,
  state: BehaviourState,
): boolean | undefined {
  const { target: bird, tuning, world } = perception;
  const kinds = pursuitKinds(object.behaviour!);
  if (kinds.groundTraversal) {
    if (state.traversal?.status === "found" && !state.traversal.physical.grounded) {
      return true;
    }
    const connected = targetReachable(
      tuning,
      object,
      world,
      at,
      { ...at, height: object.height, width: object.width },
      at.y,
      EDGE,
      pursuitTrack(object),
      bird,
    );
    if (connected) {
      return true;
    }
    if (state.pursuit?.phase === "escaped") {
      return undefined;
    }
    // Engaged on the map, the route pursuit chose last says whether a path reaches Chibi.
    const entry = world.groundMap?.();
    const route = state.mapPursuit?.route;
    if (entry && mapCovers(world, object, entry, at, birdBox(tuning, bird))) {
      return route
        ? route.reachable
        : mapReachable(world, object, entry, at, birdBox(tuning, bird));
    }
    const previous = state.traversal;
    const hers = birdBox(tuning, bird);
    const sameTarget =
      previous &&
      hers.x + hers.width / 2 >= previous.target.x &&
      hers.x + hers.width / 2 <= previous.target.x + previous.target.width &&
      Math.abs(hers.y + hers.height - previous.target.y - previous.target.height) <= 2 * EDGE;
    return sameTarget && previous.status === "unreachable"
      ? false
      : sameTarget && previous.status === "found"
        ? true
        : undefined;
  }
  if (kinds.flight) {
    const current = nodeOf(object, state.stateKey).motion;
    const overhead =
      current.kind === "pursue" && current.mode === "fly" && current.overhead
        ? current
        : kinds.overhead;
    if (overhead?.kind === "pursue" && overhead.mode === "fly" && overhead.overhead) {
      if (!world.traversalFrame) {
        return undefined;
      }
      const direction =
        state.flightApproachDirection ?? (bird.vx === 0 ? bird.facing : bird.vx < 0 ? -1 : 1);
      const target = overheadFlightGoal(tuning, overhead.overhead, direction, bird, object);
      return overheadFlightRoute(world, object, at, target) !== undefined;
    }
    return (
      flightContactApproach(
        world,
        object,
        at,
        contactBox(object, at, state.facing, state.axis),
        birdBox(tuning, bird),
      ) !== undefined
    );
  }
  return targetReachable(
    tuning,
    object,
    world,
    at,
    contactBox(object, at, state.facing, "x"),
    state.hop?.groundY ?? state.anchor?.y ?? at.y,
    EDGE,
    pursuitTrack(object),
    bird,
  );
}

function observePursuit(
  perception: BehaviourPerception,
  reachable: boolean | undefined,
  evaluated: boolean,
  before: BehaviourState,
  at: Point,
  after: BehaviourState,
): void {
  const observation = perception.world.observation;
  if (!observation) {
    return;
  }
  observation.observer.record({
    at,
    from: before.stateKey,
    grace: after.pursuit
      ? {
          status: "captured",
          value: {
            reachable: !evaluated
              ? { status: "not_evaluated" }
              : reachable === undefined
                ? { status: "unknown" }
                : { status: "captured", value: reachable },
            unreachableSeconds: after.pursuit.unreachableSeconds,
          },
        }
      : { status: "not_evaluated" },
    kind: "pursuit",
    ...(observation.metadata && { metadata: observation.metadata }),
    scorer: after.scorer
      ? {
          status: "captured",
          value: {
            chaseSeconds: after.scorer.chaseSeconds,
            heldSeconds: after.scorer.heldSeconds,
            ...(after.scorer.move !== undefined && { move: after.scorer.move }),
            pressureSeconds: after.scorer.pressureSeconds,
            ...(after.scorer.sinceAttackSeconds !== undefined && {
              sinceAttackSeconds: after.scorer.sinceAttackSeconds,
            }),
            ...(after.scorer.sincePauseSeconds !== undefined && {
              sincePauseSeconds: after.scorer.sincePauseSeconds,
            }),
            specialDueSeconds: after.scorer.specialDueSeconds,
            threatSeconds: after.scorer.threatSeconds,
          },
        }
      : { status: "not_evaluated" },
    target: after.intent
      ? { status: "captured", value: after.intent.target }
      : { status: "not_evaluated" },
    to: after.stateKey,
    traversal: after.traversal
      ? {
          status: "captured",
          value: {
            preparing: after.traversal.preparation !== undefined,
            status: after.traversal.status,
            target: after.traversal.target,
          },
        }
      : { status: "not_evaluated" },
  });
}

function updatePursuit(
  perception: BehaviourPerception,
  object: ObjectLayout,
  seconds: number,
  at: Point,
  state: BehaviourState,
): { readonly reachable: boolean | undefined; readonly state: BehaviourState } {
  const { target: bird, tuning, world } = perception;
  let currentState = state;
  const config = object.behaviour!.pursuit;
  if (!config) {
    observePursuit(perception, undefined, false, state, at, currentState);
    return { reachable: undefined, state: currentState };
  }
  const inside =
    Math.abs(bird.x + tuning.width / 2 - object.origin.x - object.width / 2) <= config.distance;
  const outsideEscape =
    config.escapeDistance === undefined
      ? !inside
      : Math.hypot(
          bird.x + tuning.width / 2 - at.x - object.width / 2,
          bird.y + tuning.height / 2 - at.y - object.height / 2,
        ) > config.escapeDistance;
  const timedOut = (unreachableSeconds: number) =>
    config.unreachableGraceSeconds !== null && unreachableSeconds >= config.unreachableGraceSeconds;
  let reachable = pursuitReachable(perception, object, at, currentState);
  let reachableEvaluated = true;
  const ended = currentState.pursuit;
  // An ended chase counts toward its rearm cooldown, during which awareness never engages.
  const prior =
    ended?.phase === "escaped"
      ? { ...ended, endedSeconds: (ended.endedSeconds ?? 0) + seconds }
      : ended;
  if (prior && prior !== ended) {
    currentState = { ...currentState, pursuit: prior };
  }
  const cooled =
    prior?.phase !== "escaped" || prior.endedSeconds! >= (config.rearmSeconds ?? 0) - EDGE;
  const observer = { ...at, height: object.height, width: object.width };
  const target = birdBox(tuning, bird);
  const aware =
    targetInSameChunk(world, observer, target) || targetInCurrentView(world, observer, target);
  const entry = pursuitKinds(object.behaviour!).groundTraversal ? world.groundMap?.() : undefined;
  if (
    prior?.phase === "escaped" &&
    prior.settled &&
    cooled &&
    inside &&
    reachable !== true &&
    entry
  ) {
    // The map path that pursuit would follow is the rearm verdict.
    reachableEvaluated = aware;
    reachable = aware ? mapReachable(world, object, entry, at, target) : undefined;
  } else if (
    prior?.phase === "escaped" &&
    prior.settled &&
    cooled &&
    inside &&
    reachable !== true
  ) {
    const motion = pursuitKinds(object.behaviour!).groundTraversalMotion;
    if (motion?.kind === "pursue" && motion.mode === "ground") {
      reachableEvaluated = aware;
      const probed = probeRearm(
        world,
        seconds,
        object,
        motion,
        currentState.anchor ?? at,
        currentState.stateKey,
        aware,
        currentState.rearm,
        at,
        birdBox(tuning, bird),
      );
      currentState = {
        ...currentState,
        rearm: probed.rearm,
        ...(probed.reachable === true &&
          probed.rearm.goal && {
            traversal: {
              geometry: probed.rearm.geometry,
              inputs: probed.rearm.inputs,
              physical: { ...at, fallFromY: at.y + object.height, grounded: true, vy: 0 },
              searchedAt: at,
              status: "found" as const,
              target: probed.rearm.goal,
            },
          }),
      };
      reachable = probed.reachable;
    }
  }
  const canAcquire =
    !prior || (prior.phase === "escaped" && prior.settled && cooled && inside && reachable);
  if (canAcquire && aware) {
    const unreachableSeconds = reachable === false ? seconds : 0;
    const engagements = (prior?.engagements ?? 0) + 1;
    const acquired: BehaviourState = {
      ...currentState,
      pursuit: {
        engagedSeconds: 0,
        engagements,
        ...(config.relief && {
          giveUpSeconds: giveUpDraw(world, config.relief, engagements),
        }),
        phase:
          outsideEscape || (reachable === false && timedOut(unreachableSeconds))
            ? "escaped"
            : "engaged",
        settled: false,
        unreachableSeconds,
      },
      ...(currentState.scorer && { scorer: { ...currentState.scorer, chaseSeconds: 0 } }),
      // A wander resumes after the chase with a fresh move.
      ...(currentState.wander && {
        wander: { holdSeconds: 0, moves: currentState.wander.moves },
      }),
    };
    delete (acquired as { chasePause?: unknown }).chasePause;
    observePursuit(perception, reachable, reachableEvaluated, state, at, acquired);
    return { reachable, state: acquired };
  }
  if (prior?.phase !== "engaged") {
    observePursuit(perception, reachable, reachableEvaluated, state, at, currentState);
    return { reachable, state: currentState };
  }
  const unreachableSeconds =
    reachable === true
      ? 0
      : reachable === false
        ? prior.unreachableSeconds + seconds
        : prior.unreachableSeconds;
  const engagedSeconds = (prior.engagedSeconds ?? 0) + seconds;
  // Giving up: no movement path for the grace, or a chase pause at or past the give-up time.
  const gaveUp =
    (reachable === false && timedOut(unreachableSeconds)) ||
    prior.giveUp === true ||
    (currentState.chasePause !== undefined &&
      prior.giveUpSeconds !== undefined &&
      engagedSeconds >= prior.giveUpSeconds - EDGE);
  const escaped = outsideEscape || gaveUp;
  const next: BehaviourState = {
    ...currentState,
    pursuit: {
      ...(prior.engagements !== undefined && { engagements: prior.engagements }),
      ...(prior.giveUpSeconds !== undefined && { giveUpSeconds: prior.giveUpSeconds }),
      engagedSeconds,
      phase: escaped ? "escaped" : "engaged",
      settled: false,
      unreachableSeconds,
      ...(escaped && { home: true as const }),
      ...(gaveUp && !outsideEscape && { giveUp: true as const }),
    },
  };
  if (escaped) {
    delete (next as { chasePause?: unknown }).chasePause;
  }
  observePursuit(perception, reachable, reachableEvaluated, state, at, next);
  return { reachable, state: next };
}

// One advance's loop-carried state across its slices.
interface BehaviourRun {
  readonly actions: BehaviourEvent[];
  capturedIntent: boolean;
  current: Point;
  readonly instant: Set<string>;
  next: BehaviourState;
  readonly segments: BehaviourSegment[];
  time: number;
  traversalStep: TraversalAdvance | undefined;
}

interface BehaviourRunContext extends BehaviourInterludeContext {
  readonly flyGateway: string | undefined;
  readonly watchdog: BehaviourPlan["idleWatchdog"];
}

interface SliceDecision {
  // Whether the graph would take an arrival transition with the body at a point after that
  // many more seconds of the decided state.
  readonly arrives: (at: Point, seconds: number, state: BehaviourState) => boolean;
  readonly frame: ReturnType<typeof contactFrameAt> | undefined;
  readonly node: BehaviourNode;
  // Whether the motion follows the scorer's held move this slice.
  readonly sampled: boolean;
  readonly settling: boolean;
  readonly slice: number;
  readonly support: {
    readonly supported: boolean;
    readonly target: Point | undefined;
    readonly world: BehaviourWorld | undefined;
  };
  readonly supportMotion: boolean;
  readonly track: { readonly axis: "x" | "y" };
}

type SliceOutcome =
  | { readonly decision: SliceDecision; readonly kind: "act" }
  | { readonly kind: "again" }
  | { readonly kind: "end" }
  | { readonly kind: "hold"; readonly step: BehaviourStep };

// Decides one slice from the snapshot and the object's own state: support, escape settling,
// entry and its effects, the first matching unscored transition, then in the engaged state the
// scorer's attack or held move, then how long the decision holds before an animation, cooldown
// or elapsed boundary.
function decideSlice(context: BehaviourRunContext, run: BehaviourRun): SliceOutcome {
  const { escaped, flyGateway, object, perception, seconds, watchdog } = context;
  const { target: bird, tuning, world } = perception;
  const plan = object.behaviour!;
  const { actions, current, instant, segments, time, traversalStep } = run;
  let { capturedIntent, next } = run;
  const save = () => {
    run.capturedIntent = capturedIntent;
    run.next = next;
  };
  let node = nodeOf(object, next.stateKey);
  const supportMotion =
    (node.motion.kind === "fly" && node.motion.to === "support") ||
    (node.motion.kind === "wait" && node.motion.support === "required");
  const support = prepareSupport(perception, object, node.motion, time, current, next);
  next = support.state;
  const supportWorld = support.world;
  const supportPerception = supportWorld ? { ...perception, world: supportWorld } : perception;
  const supported = support.supported;
  const landingTarget = support.target;
  if (
    next.pursuit?.phase === "escaped" &&
    !next.pursuit.settled &&
    !attackProtected(node, next) &&
    next.stateKey === plan.initial &&
    node.motion.kind === "wait" &&
    flyGateway &&
    !next.hop &&
    !supportContact(object, world, current)
  ) {
    next = transitionState(perception, object, current, flyGateway, next);
    node = nodeOf(object, next.stateKey);
  }
  if (
    next.pursuit?.phase === "escaped" &&
    !next.pursuit.settled &&
    !attackProtected(node, next) &&
    (node.motion.kind === "pursue" || next.stateKey === plan.initial) &&
    !next.hop &&
    (!next.traversal || next.traversal.physical.grounded) &&
    (node.motion.kind !== "pursue" ||
      node.motion.mode !== "fly" ||
      supportContact(object, world, current))
  ) {
    next = transitionState(perception, object, current, plan.initial, {
      ...next,
      anchor: current,
      pursuit: { ...next.pursuit, settled: true },
    });
    node = nodeOf(object, next.stateKey);
  }
  if (
    time < seconds &&
    next.pursuit?.phase === "escaped" &&
    next.pursuit.settled &&
    next.pursuit.home &&
    !attackProtected(node, next) &&
    !next.hop &&
    (!next.traversal || next.traversal.physical.grounded)
  ) {
    const walked = homeWalk(context, current, next, time, actions, segments);
    if (walked.kind === "hold") {
      save();
      run.next = walked.step.state;
      return walked;
    }
    next = walked.state;
    node = nodeOf(object, next.stateKey);
  }
  if (watchdog && idleReady(object, world, current, next)) {
    // Keep the safe graph phase until the next complete physics step can prove its route.
    const remaining = seconds - time;
    const hold = [{ end: remaining, from: current, start: 0, to: current }];
    const animated = animateSegments(object, remaining, next, hold);
    next = advanceAttackClock(remaining, {
      ...animated.state,
      idleWatchdog: observeIdle(watchdog, remaining, hold, next.idleWatchdog!),
    });
    save();
    return {
      kind: "hold",
      step: {
        actions,
        at: current,
        segments: [
          ...segments,
          ...animated.segments.map((segment) => ({
            ...segment,
            end: segment.end + time,
            start: segment.start + time,
          })),
        ],
        state: next,
        ...(escaped && { escaped }),
      },
    };
  }
  const settling =
    next.pursuit?.phase === "escaped" &&
    !next.pursuit.settled &&
    !attackProtected(node, next) &&
    node.motion.kind === "pursue" &&
    node.motion.mode === "fly";
  const track = node.motion.kind === "pursue" ? pursuitTrack(object) : (node.track ?? plan);
  if (
    next.pendingEntry &&
    !(supportMotion && next.landing?.status === "pending") &&
    !(node.motion.kind === "wait" && node.motion.support === "required" && !supported)
  ) {
    const entered = transitionState(perception, object, current, next.stateKey, next);
    next = enterAttack(plan, node, supportMotion ? { ...entered, elapsed: next.elapsed } : entered);
    for (const action of node.onEnter ?? []) {
      actions.push({ action, at: current, axis: track.axis, facing: next.facing, time });
    }
    next = { ...next, pendingEntry: false };
  }
  if (
    node.motion.kind !== "wait" &&
    node.motion.kind !== "fly" &&
    node.motion.kind !== "pursue" &&
    node.motion.direction === "target"
  ) {
    const mine = current[track.axis] + (track.axis === "x" ? object.width : object.height) / 2;
    const target = bird[track.axis] + (track.axis === "x" ? tuning.width : tuning.height) / 2;
    if (target !== mine) {
      next = { ...next, facing: target < mine ? -1 : 1 };
    }
  }
  const selectionFallback =
    node.motion.kind === "fly" &&
    node.motion.to === "support" &&
    node.motion.selection !== undefined &&
    next.flightSelection?.status === "pending" &&
    node.attack?.phase !== "committed" &&
    node.attack?.phase !== "completed" &&
    next.activeAttack?.phase !== "committed";
  const fallback = next.traversal;
  const refreshableGroundFallback =
    time < seconds &&
    traversalStep === undefined &&
    node.motion.kind === "pursue" &&
    node.motion.mode === "ground" &&
    plan.scorer?.engaged === next.stateKey &&
    next.pursuit?.phase === "engaged" &&
    !next.activeAttack &&
    !attackProtected(node, next) &&
    !next.hop &&
    fallback?.status === "geometry-unavailable" &&
    fallback.inputs.length === 0 &&
    !fallback.preparation &&
    !fallback.physical.grounded &&
    fallback.physical.x === current.x &&
    fallback.physical.y === current.y &&
    Number.isFinite(fallback.physical.vy) &&
    Math.abs(fallback.physical.vy) <= EDGE &&
    (!next.intent || next.intent.remainingSeconds <= 0) &&
    supportContact(object, world, current);
  const graphHeld =
    traversalStep !== undefined ||
    next.traversal?.preparation !== undefined ||
    settling ||
    (node.motion.kind === "fly" &&
      node.motion.to === "support" &&
      !supported &&
      !selectionFallback) ||
    (node.motion.kind === "wait" && node.motion.support === "required" && !supported) ||
    (node.motion.kind === "pursue" &&
      next.traversal &&
      !next.traversal.physical.grounded &&
      !refreshableGroundFallback);
  const transition = graphHeld
    ? undefined
    : node.transitions.find(
        ({ score, to, when }) =>
          !score &&
          (!selectionFallback ||
            (when.length === 1 &&
              when[0]!.kind === "alignment-blocked" &&
              (() => {
                const fallback = nodeOf(object, to);
                return (
                  fallback.attack === undefined &&
                  fallback.motion.kind === "fly" &&
                  fallback.motion.to === "support" &&
                  !fallback.motion.selection
                );
              })())) &&
          canEnterAttack(nodeOf(object, to), next) &&
          !(supportMotion && !supported && nodeOf(object, to).attack?.phase === "completed") &&
          when.every((condition) =>
            condition.kind === "arrived" && supportMotion
              ? supported
              : matches(supportPerception, object, current, next, condition),
          ),
      );
  if (transition) {
    if (instant.has(next.stateKey)) {
      throw new Error(`Instant behaviour transition cycle for ${object.character}`);
    }
    instant.add(next.stateKey);
    next = transitionState(perception, object, current, transition.to, next);
    save();
    return { kind: "again" };
  }
  if (time < seconds && !graphHeld) {
    const wandered = wanderStep(transitionState, context, current, next, time, actions, segments);
    if (wandered?.kind === "again") {
      next = wandered.state;
      save();
      return { kind: "again" };
    }
    if (wandered) {
      save();
      run.next = wandered.step.state;
      return wandered;
    }
  }
  const scorer = plan.scorer;
  const sampledMotion =
    scorer !== undefined &&
    scorer.engaged === next.stateKey &&
    node.motion.kind === "pursue" &&
    !attackProtected(node, next) &&
    !settling &&
    next.pursuit?.phase === "engaged";
  const relief = plan.pursuit?.relief;
  if (time < seconds && sampledMotion && relief && !graphHeld && node.motion.kind === "pursue") {
    next = startChasePause(context, relief, current, next, time);
    if (next.chasePause) {
      const held = chasePauseHold(context, current, next, time, actions, segments);
      run.next = held.state;
      return { kind: "hold", step: held };
    }
  }
  // Attacks are scored at every slice boundary, including the step's end; moves only within it.
  if (sampledMotion && !graphHeld && node.motion.kind === "pursue") {
    const previous = next.intent;
    let capture =
      time < seconds &&
      (!previous || previous.remainingSeconds <= 0) &&
      !capturedIntent &&
      !next.traversal?.preparation &&
      (!next.traversal || next.traversal.physical.grounded || refreshableGroundFallback);
    if (capture && node.motion.mode === "fly" && previous) {
      const target =
        node.motion.overhead &&
        overheadFlightGoalForRect(
          node.motion.overhead,
          previous.travelDirection,
          previous.target,
          object,
        );
      capture =
        safeIntentHover(world, seconds - time, object, current) &&
        (!target || Math.abs(target.y - current.y) <= EDGE);
    }
    // Attacks are scored only at a slice that did not arrive here through instant transitions,
    // so a scored attack never closes an instant cycle.
    const clearance = relief?.pause.tellClearanceSeconds ?? 0;
    const sincePause = next.scorer?.sincePauseSeconds;
    const gated = node.transitions.filter(
      ({ score, to, when }) =>
        score &&
        instant.size === 0 &&
        (sincePause === undefined || sincePause >= clearance - EDGE) &&
        canEnterAttack(nodeOf(object, to), next) &&
        when.every((condition) => matches(supportPerception, object, current, next, condition)),
    );
    if (capture || gated.length > 0) {
      if (!world.decisions) {
        throw new Error("Scored pursuit requires an object-local decision context");
      }
      const prior = next.scorer ?? openingScorerState(scorer);
      const random = world.decisions(`scorer:${prior.decision}`);
      const { max, min } = scorer.decisionSeconds;
      const holdSeconds = min + random() * (max - min);
      const { choice } = decideScored(
        scorer,
        random,
        capture,
        prior,
        scorerValues(perception, object, current, next),
        gated,
      );
      const observation = world.observation;
      if (observation) {
        const action =
          choice.kind === "attack"
            ? choice.transition.to
            : choice.kind === "move"
              ? choice.move.id
              : prior.move;
        observation.observer.record({
          ...(action !== undefined && { action }),
          choice: choice.kind,
          kind: "choice",
          ...(observation.metadata && { metadata: observation.metadata }),
          state: next.stateKey,
        });
      }
      const counted = { ...prior, decision: prior.decision + 1 };
      if (choice.kind === "attack") {
        if (instant.has(next.stateKey)) {
          throw new Error(`Instant behaviour transition cycle for ${object.character}`);
        }
        instant.add(next.stateKey);
        next = transitionState(perception, object, current, choice.transition.to, {
          ...next,
          scorer: scorerAttacked(choice.transition, counted),
        });
        save();
        return { kind: "again" };
      }
      next = { ...next, scorer: counted };
      if (choice.kind === "move") {
        let intent = moveIntent(
          tuning,
          bird,
          choice.move.move,
          holdSeconds,
          next.facing,
          object,
          current,
        );
        if (node.motion.mode === "fly" && node.motion.overhead) {
          const goal = overheadFlightGoalForRect(
            node.motion.overhead,
            intent.travelDirection,
            intent.target,
            object,
          );
          intent = {
            ...intent,
            facing: goal.x === current.x ? next.facing : goal.x < current.x ? -1 : 1,
          };
        }
        next = {
          ...next,
          intent,
          scorer: { ...counted, heldSeconds: 0, move: choice.move.id },
          ...(node.motion.mode === "fly" &&
            node.motion.overhead && { flightApproachDirection: intent.travelDirection }),
        };
        if (next.traversal) {
          const fresh = { ...next.traversal, inputs: [] };
          delete (fresh as { searchedAt?: Point }).searchedAt;
          next = { ...next, traversal: fresh };
        }
        capturedIntent = true;
      }
    }
  }
  if (time >= seconds) {
    save();
    return { kind: "end" };
  }
  const frame = object.contact
    ? contactFrameAt(object.contact, next.animationTag as string, next.animationSeconds ?? 0)
    : undefined;
  let slice = Math.min(seconds - time, frame?.remaining ?? Infinity);
  if ((next.attackCooldownRemainingSeconds ?? 0) > 0) {
    slice = Math.min(slice, next.attackCooldownRemainingSeconds!);
  }
  if ((next.tellPauseRemainingSeconds ?? 0) > 0) {
    slice = Math.min(slice, next.tellPauseRemainingSeconds!);
  }
  for (const { when } of settling ? [] : node.transitions) {
    if (
      when.every(
        (condition) =>
          condition.kind === "elapsed" || matches(perception, object, current, next, condition),
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
  save();
  return {
    decision: {
      arrives: (point: Point, after: number, state: BehaviourState) => {
        const future = advanceAttackClock(after, {
          ...state,
          elapsed: state.elapsed + after,
          ...(object.contact && {
            animationSeconds: (state.animationSeconds ?? 0) + after,
          }),
        });
        return node.transitions.some(
          ({ to, when }) =>
            when.some((condition) => condition.kind === "arrived") &&
            canEnterAttack(nodeOf(object, to), future) &&
            when.every((condition) => matches(perception, object, point, future, condition)),
        );
      },
      frame,
      node,
      sampled: sampledMotion,
      settling,
      slice,
      support: { supported, target: landingTarget, world: supportWorld },
      supportMotion,
      track,
    },
    kind: "act",
  };
}

// Acts one decided slice: the hop clock, the registered motion abilities, the hop arc, the
// slice's segments, and the clocks the slice advances.
function actSlice(context: BehaviourRunContext, decision: SliceDecision, run: BehaviourRun): void {
  const { object, perception, seconds, watchdog } = context;
  const { world } = perception;
  const { node, settling, supportMotion, track } = decision;
  const { supported, target: landingTarget, world: supportWorld } = decision.support;
  const sampledMotion = decision.sampled;
  const { instant, segments } = run;
  let { current, next, time, traversalStep } = run;
  let { frame, slice } = decision;
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
  let traversalSegments: readonly TraversalSafety[] | undefined;
  let supportedDwell: boolean | undefined;
  let carryPoints: readonly { readonly at: Point; readonly seconds: number }[] | undefined;
  // An escaped flier settles before its chase ability, which finishes any airborne leg, and an
  // unsupported ground boss falls before its committed motion.
  const primary = behaviourAbilityParams(node.motion);
  const fall = groundFallParams(object, next);
  const chosen: BehaviourAbilityParams[] = [
    ...(settling && node.motion.kind === "pursue"
      ? [{ kind: "escape-settle" as const, motion: node.motion }]
      : []),
    ...(fall ? [fall] : []),
    ...(primary ? [primary] : []),
  ];
  for (const params of chosen) {
    const ability = abilityFor(BEHAVIOUR_ABILITIES, params);
    if (!ability) {
      continue;
    }
    const acted = ability.act(
      {
        arrives: decision.arrives,
        intent: { sampled: sampledMotion },
        object,
        perception,
        seconds,
        slice,
        support: { supported, target: landingTarget, world: supportWorld },
        time,
        track,
        traversal: traversalStep,
      },
      params,
      { at: current, state: next, to: { ...to } },
    );
    slice = acted.slice;
    next = acted.state;
    to.x = acted.to.x;
    to.y = acted.to.y;
    carryPoints = acted.carry;
    supportedDwell = acted.dwell;
    traversalStep = acted.traversal ?? traversalStep;
    if (acted.segments) {
      traversalSegments = acted.segments;
    }
    if (acted.resynced) {
      frame = object.contact
        ? contactFrameAt(object.contact, next.animationTag as string, next.animationSeconds ?? 0)
        : undefined;
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
  const segmentStart = segments.length;
  let animationAdvanced = false;
  if (carryPoints?.length) {
    let previous = current;
    let start = time;
    for (const point of carryPoints) {
      segments.push({
        axis: track.axis,
        end: time + point.seconds,
        facing: next.facing,
        from: previous,
        start,
        to: point.at,
        ...(frame && { frame: frame.frame }),
      });
      previous = point.at;
      start = time + point.seconds;
    }
    if (start < end) {
      segments.push({
        axis: track.axis,
        end,
        facing: next.facing,
        from: previous,
        start,
        to,
        ...(frame && { frame: frame.frame }),
      });
    }
  } else if (traversalSegments?.some((leg) => leg.endSeconds > leg.startSeconds)) {
    const animated = animateSegments(
      object,
      slice,
      next,
      traversalSegments
        .filter((leg) => leg.endSeconds > leg.startSeconds)
        .map((leg) => ({
          end: leg.endSeconds - world.traversalFrame!.timeSeconds - time,
          from: { x: leg.from.x, y: leg.from.y },
          start: leg.startSeconds - world.traversalFrame!.timeSeconds - time,
          to: { x: leg.to.x, y: leg.to.y },
        })),
      (world.traversalFrame?.timeSeconds ?? 0) + time,
      false,
    );
    next = animated.state;
    segments.push(
      ...animated.segments.map((segment) => ({
        ...segment,
        end: segment.end + time,
        start: segment.start + time,
      })),
    );
    animationAdvanced = true;
  } else {
    segments.push({
      axis: track.axis,
      end,
      facing: next.facing,
      from: current,
      start: time,
      to,
      ...(node.hazardPhase && { hazardPhase: node.hazardPhase }),
      ...(frame && { frame: frame.frame }),
    });
  }
  if (watchdog && next.idleWatchdog) {
    next = {
      ...next,
      idleWatchdog: observeIdle(watchdog, slice, segments.slice(segmentStart), next.idleWatchdog),
    };
  }
  current = to;
  next = {
    ...advanceAttackClock(slice, next),
    ...(sampledMotion && next.intent && { intent: advancePursuitIntent(slice, next.intent) }),
    ...(object.behaviour!.scorer && {
      scorer: advanceScorer(
        next.pursuit?.phase === "engaged" && !next.activeAttack,
        next.activeAttack !== undefined,
        slice,
        next.scorer ?? openingScorerState(object.behaviour!.scorer!),
      ),
    }),
    elapsed:
      supportedDwell !== undefined
        ? supportedDwell
          ? next.elapsed + slice
          : 0
        : supportMotion && next.landing?.status === "pending"
          ? next.elapsed
          : next.elapsed + slice,
    ...(object.contact &&
      !animationAdvanced && { animationSeconds: (next.animationSeconds ?? 0) + slice }),
  };
  time = end > time ? end : seconds;
  instant.clear();
  run.current = current;
  run.next = next;
  run.time = time;
  run.traversalStep = traversalStep;
}

// Fixtures and predictions that hold their own geometry perceive and advance in one call.
export function stepBehaviour(
  tuning: BirdTuning,
  object: ObjectLayout,
  geometry: BehaviourGeometry,
  seconds: number,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
): BehaviourStep {
  return advanceBehaviour(perceiveBehaviour(tuning, geometry, bird), object, seconds, at, state);
}

// Decides and acts for one object over one step from its perception snapshot and own state.
// Generic state graphs choose the motion, animation and transition order; registered abilities
// act each motion without character-specific sequencing. A pursuit that keeps clear then holds
// the step clear of Chibi (keptClear).
export function advanceBehaviour(
  perception: BehaviourPerception,
  object: ObjectLayout,
  seconds: number,
  at: Point,
  state: BehaviourState,
): BehaviourStep {
  return preparedAt(
    keptClear(perception, object, at, advanceUnclear(perception, object, seconds, at, state)),
  );
}

// Each takeoff preparation records its start once, whichever ability began it.
function preparedAt(step: BehaviourStep): BehaviourStep {
  const started = step.state.traversal?.preparation?.startedAtSeconds;
  const last = step.state.takeoffPreparedAt;
  return started !== undefined && (last === undefined || last < started - EDGE)
    ? { ...step, state: { ...step.state, takeoffPreparedAt: started } }
    : step;
}

// After an ended chase, until its rearm cooldown ends, a boss whose pursuit keeps clear never
// moves toward Chibi while he is within its escape distance: the step's horizontal movement
// toward his centre is cancelled, and for a flyer its vertical movement toward him too, its
// traversal dropped so it replans from there.
function keptClear(
  perception: BehaviourPerception,
  object: ObjectLayout,
  before: Point,
  step: BehaviourStep,
): BehaviourStep {
  const config = object.behaviour?.pursuit;
  const pursuit = step.state.pursuit;
  if (
    !config?.keepClear ||
    pursuit?.phase !== "escaped" ||
    (pursuit.endedSeconds ?? 0) >= (config.rearmSeconds ?? 0) - EDGE
  ) {
    return step;
  }
  const target = birdBox(perception.tuning, perception.target);
  const aim = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const separation = Math.hypot(
    before.x + object.width / 2 - aim.x,
    before.y + object.height / 2 - aim.y,
  );
  if (config.escapeDistance !== undefined && separation > config.escapeDistance) {
    return step;
  }
  const toward = (from: number, to: number, goal: number) =>
    Math.abs(to - goal) < Math.abs(from - goal) - EDGE;
  const holdX = toward(before.x + object.width / 2, step.at.x + object.width / 2, aim.x);
  const holdY =
    pursuitKinds(object.behaviour!).flight &&
    toward(before.y + object.height / 2, step.at.y + object.height / 2, aim.y);
  if (!holdX && !holdY) {
    return step;
  }
  const clear = (point: Point): Point => ({
    x: holdX ? before.x : point.x,
    y: holdY ? before.y : point.y,
  });
  const state = { ...step.state };
  delete (state as { traversal?: BehaviourTraversalState }).traversal;
  return {
    ...step,
    at: clear(step.at),
    segments: step.segments.map((segment) => ({
      ...segment,
      from: clear(segment.from),
      to: clear(segment.to),
    })),
    state,
  };
}

function advanceUnclear(
  perception: BehaviourPerception,
  object: ObjectLayout,
  seconds: number,
  at: Point,
  state: BehaviourState,
): BehaviourStep {
  const plan = object.behaviour;
  if (!plan || seconds <= 0) {
    return { actions: [], at, segments: [], state };
  }
  if (!state.active) {
    let next = syncAnimation(object, state);
    const segments: BehaviourSegment[] = [];
    let time = 0;
    while (time < seconds) {
      const frame = object.contact
        ? contactFrameAt(object.contact, next.animationTag as string, next.animationSeconds ?? 0)
        : undefined;
      const slice = Math.min(seconds - time, frame?.remaining ?? Infinity);
      segments.push({
        end: time + slice,
        facing: next.facing,
        from: at,
        start: time,
        to: at,
        ...(frame && { frame: frame.frame }),
      });
      if (object.contact) {
        next = { ...next, animationSeconds: (next.animationSeconds ?? 0) + slice };
      }
      time += slice;
    }
    return { actions: [], at, segments, state: next };
  }
  const recovery: BehaviourRecoveryContext = {
    enter: (point, key, current) => transitionState(perception, object, point, key, current),
    object,
    perception,
    seconds,
  };
  const actions: BehaviourEvent[] = [];
  const segments: BehaviourSegment[] = [];
  const instant = new Set<string>();
  const current = at;
  const pursuit = updatePursuit(perception, object, seconds, at, state);
  let next = pursuit.state;
  const escapedNow = state.pursuit?.phase !== "escaped" && next.pursuit?.phase === "escaped";
  const escaped = escapedNow ? plan.pursuit?.escaped : undefined;
  if (escapedNow) {
    next = clearTellCancels(next);
  }
  if (next.traversal?.preparation && next.pursuit?.phase !== "engaged") {
    const withoutPreparation = { ...next };
    delete (withoutPreparation as { traversal?: BehaviourTraversalState }).traversal;
    next = withoutPreparation;
  }
  const watchdog = plan.idleWatchdog;
  if (watchdog && next.pursuit && !next.idleWatchdog) {
    next = { ...next, idleWatchdog: { anchor: at, seconds: 0 } };
  }
  if (watchdog) {
    const initialRecovery = recoveryStep(recovery, { kind: "idle-recovery" }, at, next);
    next = initialRecovery.state;
    if (initialRecovery.step) {
      return {
        ...initialRecovery.step,
        state: advanceAttackClock(seconds, initialRecovery.step.state),
        ...(escaped && { escaped }),
      };
    }
  }
  const { flyGateway } = pursuitKinds(plan);
  const context: BehaviourRunContext = {
    escaped,
    flyGateway,
    object,
    perception,
    pursuitReachable: pursuit.reachable,
    seconds,
    watchdog,
  };
  const run: BehaviourRun = {
    actions,
    capturedIntent: false,
    current,
    instant,
    next,
    segments,
    time: 0,
    traversalStep: undefined,
  };
  while (true) {
    const outcome = decideSlice(context, run);
    if (outcome.kind === "hold") {
      return outcome.step;
    }
    if (outcome.kind === "end") {
      break;
    }
    if (outcome.kind === "act") {
      actSlice(context, outcome.decision, run);
    }
  }
  return { actions, at: run.current, segments, state: run.next, ...(escaped && { escaped }) };
}

export { contactBox } from "./behaviourTrack.ts";
