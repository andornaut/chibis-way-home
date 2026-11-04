import type { TraversalSafety } from "@andornaut/game-kit/terrain/traversal";

import { abilityFor } from "../ai/ability";
import type {
  BehaviourAction,
  BehaviourCondition,
  BehaviourMotion,
  BehaviourNode,
  BehaviourPlan,
  BirdTuning,
  DialogueLine,
  HazardPhase,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types";
import {
  BEHAVIOUR_ABILITIES,
  type BehaviourAbilityParams,
  behaviourAbilityParams,
  type TraversalAdvance,
} from "./behaviourAbilities";
import { animateSegments, syncAnimation } from "./behaviourAnimation";
import {
  advanceAttackClock,
  attackProtected,
  attackReady,
  type BehaviourAttackState,
  canEnterAttack,
  enterAttack,
} from "./behaviourAttack";
import { alignmentBlocked, flightDestination } from "./behaviourFlight";
import type { FlightSelectionState } from "./behaviourFlightSelection";
import { type BehaviourIdleState, observeIdle } from "./behaviourIdle";
import {
  advancePursuitIntent,
  capturePursuitIntent,
  type PursuitIntentState,
  safeIntentHover,
} from "./behaviourIntent";
import { type BehaviourPerception, perceiveBehaviour } from "./behaviourPerception";
import {
  type BehaviourGeometry,
  type BehaviourWorld,
  flightContactApproach,
  overheadFlightGoal,
  overheadFlightGoalForRect,
  overheadFlightRoute,
  targetReachable,
} from "./behaviourReach";
import {
  type BehaviourRecoveryContext,
  idleReady,
  recoveryStep,
} from "./behaviourRecoveryAbilities";
import { prepareSupport } from "./behaviourSupport";
import { contactBox, nodeOf, pursuitTrack, trackEndpoint, travelHeading } from "./behaviourTrack";
import {
  type BehaviourRearmState,
  type BehaviourTraversalState,
  probeRearm,
} from "./behaviourTraversal";
import { birdBox, type BirdState, EDGE } from "./bird";
import { contactFrameAt, spriteFrameOrigin } from "./bodyContact";
import { collisionCandidates } from "./collisionIndex";
import { type FlyLandingState, supportContact } from "./flyLanding";
import { hopLift } from "./motion";
import { targetInCurrentView, targetInSameChunk, targetVisible } from "./perception";

export interface BehaviourState extends BehaviourAttackState {
  readonly idleWatchdog?: BehaviourIdleState;
  readonly groundReposition?: BehaviourIdleState;
  readonly rearm?: BehaviourRearmState;
  readonly traversal?: BehaviourTraversalState;
  readonly anchor?: Point;
  readonly pursuit?: {
    readonly phase: "engaged" | "escaped";
    readonly unreachableSeconds: number;
    readonly settled: boolean;
  };
  readonly animationTag?: string;
  readonly animationSeconds?: number;
  readonly axis?: "x" | "y";
  readonly flightApproachDirection?: -1 | 1;
  readonly flightTarget?: Point;
  readonly intent?: PursuitIntentState;
  readonly intentDecision?: number;
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

// Resolve a complete graph once; malformed transitions fail before a stage starts.
export function layoutBehaviour(tile: number, plan: BehaviourPlan): BehaviourPlan {
  const valid = (value: number) => Number.isFinite(value) && value >= 0;
  if (!Number.isFinite(plan.distance) || !plan.states[plan.initial]) {
    throw new Error("Invalid behaviour extent or initial state");
  }
  if (
    plan.pursuit &&
    (!valid(plan.pursuit.distance) ||
      plan.pursuit.distance === 0 ||
      (plan.pursuit.unreachableGraceSeconds !== null &&
        !valid(plan.pursuit.unreachableGraceSeconds)) ||
      (plan.pursuit.escapeDistance !== undefined && !valid(plan.pursuit.escapeDistance)) ||
      !plan.pursuit.escaped.line ||
      !plan.pursuit.escaped.speaker)
  ) {
    throw new Error("Invalid pursuit configuration");
  }
  if (plan.attackCooldownSeconds !== undefined && !valid(plan.attackCooldownSeconds)) {
    throw new Error("Invalid attack cooldown");
  }
  const watchdog = plan.idleWatchdog;
  if (
    watchdog &&
    (!plan.pursuit ||
      ![watchdog.seconds, watchdog.minMovement, watchdog.distance].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      !Number.isInteger(watchdog.maxAttempts) ||
      watchdog.maxAttempts <= 0 ||
      plan.states[watchdog.resume]?.motion.kind !== "pursue" ||
      (plan.states[watchdog.resume]?.onEnter?.length ?? 0) > 0)
  ) {
    throw new Error("Invalid idle watchdog configuration");
  }
  const groundReposition = plan.groundReposition;
  if (groundReposition) {
    const resume = plan.states[groundReposition.resume];
    if (
      !plan.pursuit ||
      ![
        groundReposition.intervalSeconds,
        groundReposition.distance,
        groundReposition.minDistance,
      ].every((value) => Number.isFinite(value) && value > 0) ||
      groundReposition.minDistance > groundReposition.distance ||
      !Number.isSafeInteger(groundReposition.maxAttempts) ||
      groundReposition.maxAttempts <= 0 ||
      !resume ||
      resume.attack ||
      resume.onEnter?.length ||
      resume.motion.kind !== "pursue" ||
      resume.motion.mode !== "ground" ||
      !resume.motion.traversal
    ) {
      throw new Error("Invalid periodic ground reposition configuration");
    }
  }
  const states = Object.fromEntries(
    Object.entries(plan.states).map(([key, node]) => {
      if (
        node.allowGroundReposition &&
        (!groundReposition ||
          node.attack ||
          node.onEnter?.length ||
          node.motion.kind !== "pursue" ||
          node.motion.mode !== "ground" ||
          !node.motion.traversal ||
          (node.track?.axis ?? plan.axis) !== "x")
      ) {
        throw new Error(`Invalid periodic ground reposition state ${key}`);
      }
      if (
        node.attack &&
        (plan.attackCooldownSeconds === undefined ||
          !node.attack.id ||
          !["tell", "committed", "completed"].includes(node.attack.phase))
      ) {
        throw new Error(`Invalid attack phase in ${key}`);
      }
      for (const transition of node.transitions) {
        const target = plan.states[transition.to]?.attack;
        if (
          node.attack?.phase === "committed" &&
          (!target || target.id !== node.attack.id || target.phase === "tell")
        ) {
          throw new Error(`Committed attack requires a completed boundary in ${key}`);
        }
        if (
          target?.phase === "committed" &&
          (!node.attack || node.attack.id !== target.id || node.attack.phase === "completed")
        ) {
          throw new Error(`Committed attack requires a tell in ${key}`);
        }
      }
      const track = node.track ?? plan;
      if (!["x", "y"].includes(track.axis) || !Number.isFinite(track.distance)) {
        throw new Error(`Invalid behaviour track in ${key}`);
      }
      if (
        (node.animation !== null &&
          (typeof node.animation !== "string" || node.animation.length === 0)) ||
        (node.motion.kind !== "wait" &&
          node.motion.kind !== "fly" &&
          node.motion.kind !== "pursue" &&
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
        node.motion.kind === "pursue" &&
        (!plan.pursuit ||
          !["ground", "fly"].includes(node.motion.mode) ||
          !valid(node.motion.speed) ||
          node.motion.speed === 0)
      ) {
        throw new Error(`Invalid pursuit motion in ${key}`);
      }
      if (node.motion.kind === "pursue" && node.motion.intent) {
        const intent = node.motion.intent;
        const range = (value: { readonly min: number; readonly max: number }) =>
          Number.isFinite(value.min) && Number.isFinite(value.max) && value.min <= value.max;
        if (
          node.attack ||
          node.onEnter?.length ||
          (node.motion.mode === "ground" && !node.motion.traversal) ||
          ![intent.decisionSeconds, intent.pauseSeconds, intent.offset].every(range) ||
          intent.decisionSeconds.min <= 0 ||
          intent.pauseSeconds.min < 0 ||
          !Number.isFinite(intent.pauseChance) ||
          intent.pauseChance < 0 ||
          intent.pauseChance > 1
        ) {
          throw new Error(`Invalid sampled pursuit intent in ${key}`);
        }
      }
      if (
        node.motion.kind === "pursue" &&
        node.motion.mode === "fly" &&
        node.motion.overhead &&
        (!Number.isFinite(node.motion.overhead.ahead) ||
          node.motion.overhead.ahead <= 0 ||
          !valid(node.motion.overhead.clearance))
      ) {
        throw new Error(`Invalid overhead pursuit in ${key}`);
      }
      if (
        node.motion.kind === "fly" &&
        (!valid(node.motion.speed) ||
          node.motion.speed === 0 ||
          (node.motion.to === "support"
            ? !plan.pursuit
            : typeof node.motion.to === "string"
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
      if (node.motion.kind === "fly" && node.motion.to === "support" && node.motion.selection) {
        const selection = node.motion.selection;
        if (
          selection.kind !== "varied" ||
          ![selection.distance, selection.minDistance, selection.clearance].every(
            (value) => Number.isFinite(value) && value > 0,
          ) ||
          selection.minDistance > selection.distance ||
          !Number.isSafeInteger(selection.maxAttempts) ||
          selection.maxAttempts <= 0
        ) {
          throw new Error(`Invalid supported flight selection in ${key}`);
        }
      }
      if (
        node.motion.kind === "pursue" &&
        node.motion.mode === "ground" &&
        node.motion.traversal &&
        (![
          node.motion.traversal.gravity,
          node.motion.traversal.jumpSpeed,
          node.motion.traversal.maxFallSpeed,
        ].every((value) => Number.isFinite(value) && value > 0) ||
          !Number.isFinite(node.motion.traversal.prepSeconds) ||
          node.motion.traversal.prepSeconds < 0)
      ) {
        throw new Error(`Invalid ground traversal in ${key}`);
      }
      if (
        node.motion.kind === "fly" &&
        node.motion.to === "target-x" &&
        (!valid(node.motion.leadSeconds) ||
          !valid(node.motion.maxLead) ||
          (node.motion.ahead !== undefined && !valid(node.motion.ahead)))
      ) {
        throw new Error(`Invalid horizontal target lead in ${key}`);
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
          if (
            condition.kind === "attack-ready" ||
            condition.kind === "targeted-attack-allowed" ||
            condition.kind === "boundary" ||
            condition.kind === "visible" ||
            condition.kind === "line-of-sight" ||
            condition.kind === "alignment-blocked" ||
            condition.kind === "pursuit-ended"
          ) {
            return condition;
          }
          if (condition.kind === "flight-approach-direction") {
            if (![-1, 1].includes(condition.direction)) {
              throw new Error(`Invalid flight approach direction in ${key}`);
            }
            return condition;
          }
          if (condition.kind === "horizontal-gap") {
            if (
              !["at-least", "below"].includes(condition.comparison) ||
              !valid(condition.distance)
            ) {
              throw new Error(`Invalid horizontal gap in ${key}`);
            }
            return { ...condition, distance: condition.distance * tile };
          }
          if (condition.kind === "arrived") {
            if (condition.target !== undefined && !["live", "intent"].includes(condition.target)) {
              throw new Error(`Invalid arrival target in ${key}`);
            }
            if (
              condition.target === "intent" &&
              (node.attack !== undefined ||
                node.motion.kind !== "pursue" ||
                node.motion.mode !== "fly" ||
                node.motion.overhead === undefined ||
                node.motion.intent === undefined)
            ) {
              throw new Error(`Intent arrival requires sampled overhead pursuit in ${key}`);
            }
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
                  ...(node.motion.kind === "pursue" &&
                    node.motion.intent && {
                      intent: {
                        ...node.motion.intent,
                        offset: {
                          max: node.motion.intent.offset.max * tile,
                          min: node.motion.intent.offset.min * tile,
                        },
                      },
                    }),
                  ...(node.motion.kind === "pursue" &&
                    node.motion.mode === "ground" &&
                    node.motion.traversal && {
                      traversal: {
                        gravity: node.motion.traversal.gravity * tile,
                        jumpSpeed: node.motion.traversal.jumpSpeed * tile,
                        maxFallSpeed: node.motion.traversal.maxFallSpeed * tile,
                        prepSeconds: node.motion.traversal.prepSeconds,
                      },
                    }),
                  ...(node.motion.kind === "pursue" &&
                    node.motion.mode === "fly" &&
                    node.motion.overhead && {
                      overhead: {
                        ahead: node.motion.overhead.ahead * tile,
                        clearance: node.motion.overhead.clearance * tile,
                      },
                    }),
                  ...(node.motion.kind === "fly"
                    ? node.motion.to === "support"
                      ? node.motion.selection
                        ? {
                            selection: {
                              ...node.motion.selection,
                              clearance: node.motion.selection.clearance * tile,
                              distance: node.motion.selection.distance * tile,
                              minDistance: node.motion.selection.minDistance * tile,
                            },
                          }
                        : {}
                      : typeof node.motion.to === "string"
                        ? {
                            ...(node.motion.to === "target-x" && {
                              ...(node.motion.ahead !== undefined && {
                                ahead: node.motion.ahead * tile,
                              }),
                              maxLead: node.motion.maxLead * tile,
                            }),
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
  return {
    ...plan,
    ...(groundReposition && {
      groundReposition: {
        ...groundReposition,
        distance: groundReposition.distance * tile,
        minDistance: groundReposition.minDistance * tile,
      },
    }),
    ...(watchdog && {
      idleWatchdog: {
        ...watchdog,
        distance: watchdog.distance * tile,
        minMovement: watchdog.minMovement * tile,
      },
    }),
    ...(plan.pursuit && {
      pursuit: {
        ...plan.pursuit,
        distance: plan.pursuit.distance * tile,
        ...(plan.pursuit.escapeDistance !== undefined && {
          escapeDistance: plan.pursuit.escapeDistance * tile,
        }),
      },
    }),
    distance: plan.distance * tile,
    states,
  };
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
    facing: plan.distance < 0 ? -1 : 1,
    stateKey: plan.initial,
  });
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
    // Timed hazard boundaries tolerate arithmetic rounding, without extending legacy clocks.
    const rounding =
      object.behaviour?.states[state.stateKey]?.hazardPhase === undefined
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
      return (
        overheadFlightRoute(world, object, at, target) !== undefined &&
        at.y + object.height <= tracked.y - motion.overhead.clearance + EDGE &&
        state.flightApproachDirection * (at.x + object.width / 2 - tracked.x - tracked.width / 2) >=
          motion.overhead.ahead - EDGE &&
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
    return (
      at[axis] ===
      trackEndpoint(object, travelHeading(nodeOf(object, state.stateKey).motion, state), state)
    );
  }
  if (condition.kind === "reachable" || condition.kind === "lost-target") {
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

interface PursuitKinds {
  readonly flight: boolean;
  readonly flyGateway: string | undefined;
  readonly groundTraversal: boolean;
  // The first ground pursuit with a traversal profile and the first overhead flight, in state
  // order.
  readonly groundTraversalMotion: BehaviourMotion | undefined;
  readonly overhead: BehaviourMotion | undefined;
}

const pursuitKindsCache = new WeakMap<BehaviourPlan, PursuitKinds>();

function pursuitKinds(plan: BehaviourPlan): PursuitKinds {
  const cached = pursuitKindsCache.get(plan);
  if (cached) {
    return cached;
  }
  let flight = false;
  let flyGateway: string | undefined;
  let groundTraversal = false;
  let groundTraversalMotion: BehaviourMotion | undefined;
  let overhead: BehaviourMotion | undefined;
  for (const [key, { motion }] of Object.entries(plan.states)) {
    if (motion.kind === "pursue") {
      flight ||= motion.mode === "fly";
      if (motion.mode === "fly") {
        flyGateway ??= key;
        if (motion.overhead) {
          overhead ??= motion;
        }
      }
      groundTraversal ||= motion.mode === "ground" && Boolean(motion.traversal);
      if (motion.mode === "ground" && motion.traversal) {
        groundTraversalMotion ??= motion;
      }
    }
  }
  const kinds = { flight, flyGateway, groundTraversal, groundTraversalMotion, overhead };
  pursuitKindsCache.set(plan, kinds);
  return kinds;
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

function updatePursuit(
  perception: BehaviourPerception,
  object: ObjectLayout,
  seconds: number,
  at: Point,
  state: BehaviourState,
): BehaviourState {
  const { target: bird, tuning, world } = perception;
  let currentState = state;
  const config = object.behaviour!.pursuit;
  if (!config) {
    return currentState;
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
  const prior = currentState.pursuit;
  const observer = { ...at, height: object.height, width: object.width };
  const target = birdBox(tuning, bird);
  const aware =
    targetInSameChunk(world, observer, target) || targetInCurrentView(world, observer, target);
  if (prior?.phase === "escaped" && prior.settled && inside && reachable !== true) {
    const motion = pursuitKinds(object.behaviour!).groundTraversalMotion;
    if (motion?.kind === "pursue" && motion.mode === "ground") {
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
  const canAcquire = !prior || (prior.phase === "escaped" && prior.settled && inside && reachable);
  if (canAcquire && aware) {
    const unreachableSeconds = reachable === false ? seconds : 0;
    return {
      ...currentState,
      pursuit: {
        phase:
          outsideEscape || (reachable === false && timedOut(unreachableSeconds))
            ? "escaped"
            : "engaged",
        settled: false,
        unreachableSeconds,
      },
    };
  }
  if (prior?.phase !== "engaged") {
    return currentState;
  }
  const unreachableSeconds =
    reachable === true
      ? 0
      : reachable === false
        ? prior.unreachableSeconds + seconds
        : prior.unreachableSeconds;
  const escaped = outsideEscape || (reachable === false && timedOut(unreachableSeconds));
  return {
    ...currentState,
    pursuit: { phase: escaped ? "escaped" : "engaged", settled: false, unreachableSeconds },
  };
}

// One advance's loop-carried state across its slices.
interface BehaviourRun {
  readonly actions: BehaviourEvent[];
  capturedIntent: boolean;
  current: Point;
  readonly instant: Set<string>;
  intentPause: boolean | undefined;
  next: BehaviourState;
  readonly segments: BehaviourSegment[];
  time: number;
  traversalStep: TraversalAdvance | undefined;
}

interface BehaviourRunContext {
  readonly deferToAttack: boolean;
  readonly escaped: DialogueLine | undefined;
  readonly flyGateway: string | undefined;
  readonly object: ObjectLayout;
  readonly perception: BehaviourPerception;
  readonly seconds: number;
  readonly watchdog: BehaviourPlan["idleWatchdog"];
}

interface SliceDecision {
  // Whether the graph would take an arrival transition with the body at a point after that
  // many more seconds of the decided state.
  readonly arrives: (at: Point, seconds: number, state: BehaviourState) => boolean;
  readonly frame: ReturnType<typeof contactFrameAt> | undefined;
  readonly node: BehaviourNode;
  // Whether the motion follows a sampled pursuit intent this slice.
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
// entry and its effects, the first matching transition and any sampled intent, then how long
// the decision holds before an animation, cooldown or elapsed boundary.
function decideSlice(context: BehaviourRunContext, run: BehaviourRun): SliceOutcome {
  const { deferToAttack, escaped, flyGateway, object, perception, seconds, watchdog } = context;
  const { target: bird, tuning, world } = perception;
  const plan = object.behaviour!;
  const { actions, current, instant, segments, time, traversalStep } = run;
  let { capturedIntent, intentPause, next } = run;
  const save = () => {
    run.capturedIntent = capturedIntent;
    run.intentPause = intentPause;
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
    next = enterState(perception, object, current, flyGateway, next);
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
    next = enterState(perception, object, current, plan.initial, {
      ...next,
      anchor: current,
      pursuit: { ...next.pursuit, settled: true },
    });
    node = nodeOf(object, next.stateKey);
  }
  if (watchdog && !deferToAttack && idleReady(object, world, current, next)) {
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
    const entered = enterState(perception, object, current, next.stateKey, next);
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
  const transition =
    traversalStep !== undefined ||
    next.traversal?.preparation !== undefined ||
    settling ||
    (node.motion.kind === "fly" &&
      node.motion.to === "support" &&
      !supported &&
      !selectionFallback) ||
    (node.motion.kind === "wait" && node.motion.support === "required" && !supported) ||
    (node.motion.kind === "pursue" && next.traversal && !next.traversal.physical.grounded)
      ? undefined
      : node.transitions.find(
          ({ to, when }) =>
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
    next = enterState(perception, object, current, transition.to, next);
    save();
    return { kind: "again" };
  }
  if (time >= seconds) {
    save();
    return { kind: "end" };
  }
  const sampledMotion =
    node.motion.kind === "pursue" &&
    node.motion.intent !== undefined &&
    !attackProtected(node, next) &&
    !settling &&
    next.pursuit?.phase === "engaged";
  if (sampledMotion && node.motion.kind === "pursue" && node.motion.intent) {
    const previous = next.intent;
    const needsCapture = !previous || previous.remainingSeconds <= 0;
    let capture =
      needsCapture &&
      !next.traversal?.preparation &&
      (!next.traversal || next.traversal.physical.grounded);
    if (needsCapture && node.motion.mode === "fly" && previous) {
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
    if (needsCapture && capture && !capturedIntent) {
      let intent = capturePursuitIntent(
        world,
        node.motion.intent,
        tuning,
        bird,
        next.intentDecision ?? 0,
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
        intentDecision: (next.intentDecision ?? 0) + 1,
        ...(node.motion.mode === "fly" &&
          node.motion.overhead && { flightApproachDirection: intent.travelDirection }),
      };
      if (next.traversal) {
        const fresh = { ...next.traversal, inputs: [] };
        delete (fresh as { searchedAt?: Point }).searchedAt;
        next = { ...next, traversal: fresh };
      }
      capturedIntent = true;
      intentPause = undefined;
    }
    if (intentPause === undefined) {
      intentPause =
        (next.intent?.pauseRemainingSeconds ?? 0) > 0 &&
        (node.motion.mode === "ground"
          ? supportContact(object, world, current) &&
            !next.traversal?.preparation &&
            (!next.traversal || next.traversal.physical.grounded)
          : safeIntentHover(world, seconds - time, object, current));
    }
  }
  const frame = object.contact
    ? contactFrameAt(object.contact, next.animationTag as string, next.animationSeconds ?? 0)
    : undefined;
  let slice = Math.min(seconds - time, frame?.remaining ?? Infinity);
  if ((next.attackCooldownRemainingSeconds ?? 0) > 0) {
    slice = Math.min(slice, next.attackCooldownRemainingSeconds!);
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
  const { instant, intentPause, segments } = run;
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
  // An escaped flier settles before its chase ability, which finishes any airborne leg.
  const primary = behaviourAbilityParams(node.motion);
  const chosen: BehaviourAbilityParams[] = [
    ...(settling && node.motion.kind === "pursue"
      ? [{ kind: "escape-settle" as const, motion: node.motion }]
      : []),
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
        intent: { paused: intentPause === true, sampled: sampledMotion },
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
// act each motion without character-specific sequencing.
export function advanceBehaviour(
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
    enter: (point, key, current) => enterState(perception, object, point, key, current),
    firstTransition: (point, current) =>
      nodeOf(object, current.stateKey).transitions.find(
        ({ to, when }) =>
          canEnterAttack(nodeOf(object, to), current) &&
          when.every((condition) => matches(perception, object, point, current, condition)),
      )?.to,
    object,
    perception,
    seconds,
  };
  const actions: BehaviourEvent[] = [];
  const segments: BehaviourSegment[] = [];
  const instant = new Set<string>();
  const current = at;
  let next = updatePursuit(perception, object, seconds, at, state);
  const escaped =
    state.pursuit?.phase !== "escaped" && next.pursuit?.phase === "escaped"
      ? plan.pursuit?.escaped
      : undefined;
  if (next.traversal?.preparation && next.pursuit?.phase !== "engaged") {
    const withoutPreparation = { ...next };
    delete (withoutPreparation as { traversal?: BehaviourTraversalState }).traversal;
    next = withoutPreparation;
  }
  const periodic = plan.groundReposition;
  let deferToAttack = false;
  if (periodic && next.pursuit) {
    const prior = next.groundReposition ?? { anchor: at, seconds: 0 };
    next = {
      ...next,
      groundReposition: prior.recovery
        ? prior
        : { ...prior, seconds: Math.min(periodic.intervalSeconds, prior.seconds + seconds) },
    };
    const reposition = recoveryStep(recovery, { kind: "periodic-reposition" }, at, next);
    next = reposition.state;
    deferToAttack = reposition.deferToAttack === true;
    if (reposition.step) {
      return {
        ...reposition.step,
        state: advanceAttackClock(seconds, reposition.step.state),
        ...(escaped && { escaped }),
      };
    }
  }
  const watchdog = plan.idleWatchdog;
  if (watchdog && next.pursuit && !next.idleWatchdog) {
    next = { ...next, idleWatchdog: { anchor: at, seconds: 0 } };
  }
  if (watchdog && !deferToAttack) {
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
    deferToAttack,
    escaped,
    flyGateway,
    object,
    perception,
    seconds,
    watchdog,
  };
  const run: BehaviourRun = {
    actions,
    capturedIntent: false,
    current,
    instant,
    intentPause: undefined,
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

export { contactBox } from "./behaviourTrack";
export { sweptContact } from "./sweptContact";
