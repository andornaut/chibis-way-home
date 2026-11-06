import type { TraversalSafety } from "@andornaut/game-kit/terrain/traversal";

import { abilityFor } from "../ai/ability";
import { collisionCandidates, contactFrameAt, EDGE, spriteFrameOrigin } from "../core";
import type {
  BehaviourAction,
  BehaviourCondition,
  BehaviourMotion,
  BehaviourNode,
  BehaviourPlan,
  BirdTuning,
  ChaseRelief,
  DialogueLine,
  HazardPhase,
  ObjectLayout,
  Point,
  Rect,
  SecondsRange,
} from "../data/types";
import {
  BEHAVIOUR_ABILITIES,
  type BehaviourAbilityParams,
  behaviourAbilityParams,
  groundFallParams,
  type TraversalAdvance,
} from "./behaviourAbilities";
import { animateSegments, syncAnimation } from "./behaviourAnimation";
import {
  advanceAttackClock,
  attackProtected,
  attackReady,
  type BehaviourAttackState,
  canEnterAttack,
  clearTellCancels,
  enterAttack,
} from "./behaviourAttack";
import { alignmentBlocked, flightDestination } from "./behaviourFlight";
import type { FlightSelectionState } from "./behaviourFlightSelection";
import { type BehaviourIdleState, observeIdle } from "./behaviourIdle";
import { advancePursuitIntent, type PursuitIntentState, safeIntentHover } from "./behaviourIntent";
import { type BehaviourMapPursuitState, mapCovers, mapReachable } from "./behaviourMapPursuit";
import { type BehaviourPerception, perceiveBehaviour } from "./behaviourPerception";
import {
  type BehaviourGeometry,
  type BehaviourWorld,
  flightContactApproach,
  groundPursuitEnd,
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
import {
  advanceScorer,
  type BehaviourScorerState,
  type BossScorerValues,
  chasePauseDraw,
  decideScored,
  moveIntent,
  openingScorerState,
  scorerAttacked,
} from "./behaviourScorer";
import { prepareSupport } from "./behaviourSupport";
import {
  contactBox,
  groundBoss,
  nodeOf,
  pursuitTrack,
  trackEndpoint,
  trackReach,
  travelHeading,
  travelLimit,
} from "./behaviourTrack";
import {
  type BehaviourRearmState,
  type BehaviourTraversalState,
  probeRearm,
} from "./behaviourTraversal";
import { birdBox, type BirdState } from "./bird";
import { type FlyLandingState, supportContact } from "./flyLanding";
import { hopLift } from "./motion";
import { targetInCurrentView, targetInSameChunk, targetVisible } from "./perception";

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
    // Engaged, a chase pause rolled a give-up and the next update ends pursuit; escaped, the
    // chase ended by giving up.
    readonly giveUp?: true;
    // A ground boss whose chase ended walks back toward its encounter position once settled.
    readonly home?: true;
  };
  // A chase pause: the boss holds facing Chibi for the remaining seconds.
  readonly chasePause?: { readonly remainingSeconds: number };
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
  const validRange = ({ max, min }: SecondsRange) => valid(min) && valid(max) && min <= max;
  if (!Number.isFinite(plan.distance) || !plan.states[plan.initial]) {
    throw new Error("Invalid behaviour extent or initial state");
  }
  if (plan.facing !== undefined && plan.facing !== -1 && plan.facing !== 1) {
    throw new Error("Invalid behaviour facing");
  }
  if (
    plan.pursuit &&
    (!valid(plan.pursuit.distance) ||
      plan.pursuit.distance === 0 ||
      (plan.pursuit.unreachableGraceSeconds !== null &&
        !valid(plan.pursuit.unreachableGraceSeconds)) ||
      (plan.pursuit.escapeDistance !== undefined && !valid(plan.pursuit.escapeDistance)) ||
      (plan.pursuit.pace &&
        (![plan.pursuit.pace.distance, plan.pursuit.pace.speed].every(
          (value) => Number.isFinite(value) && value > 0,
        ) ||
          !validRange(plan.pursuit.pace.pauseSeconds))) ||
      (plan.pursuit.rearmSeconds !== undefined && !valid(plan.pursuit.rearmSeconds)) ||
      (plan.pursuit.relief &&
        (!plan.scorer ||
          !validRange(plan.pursuit.relief.pause.afterSeconds) ||
          !validRange(plan.pursuit.relief.pause.seconds) ||
          !valid(plan.pursuit.relief.pause.tellClearanceSeconds) ||
          !valid(plan.pursuit.relief.giveUp.fromSeconds) ||
          plan.pursuit.relief.giveUp.certainSeconds < plan.pursuit.relief.giveUp.fromSeconds ||
          !(plan.pursuit.relief.giveUp.chance >= 0 && plan.pursuit.relief.giveUp.chance <= 1))) ||
      !plan.pursuit.escaped.line ||
      !plan.pursuit.escaped.speaker)
  ) {
    throw new Error("Invalid pursuit configuration");
  }
  if (plan.attackCooldownSeconds !== undefined && !valid(plan.attackCooldownSeconds)) {
    throw new Error("Invalid attack cooldown");
  }
  const tellPause = plan.tellCancelPause;
  if (
    tellPause &&
    (plan.attackCooldownSeconds === undefined ||
      !Number.isSafeInteger(tellPause.cancels) ||
      tellPause.cancels <= 0 ||
      !valid(tellPause.seconds))
  ) {
    throw new Error("Invalid tell cancel pause");
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
  const scorer = plan.scorer;
  if (scorer) {
    const engaged = plan.states[scorer.engaged];
    const ids = scorer.moves.map(({ id }) => id);
    const curves = [
      ...scorer.moves.flatMap(({ considerations }) => considerations),
      ...Object.values(plan.states).flatMap(({ transitions }) =>
        transitions.flatMap(({ score }) => score?.considerations ?? []),
      ),
    ];
    if (
      !plan.pursuit ||
      engaged?.motion.kind !== "pursue" ||
      engaged.attack ||
      engaged.onEnter?.length ||
      scorer.moves.length === 0 ||
      new Set(ids).size !== ids.length ||
      !(
        scorer.decisionSeconds.min > 0 && scorer.decisionSeconds.min <= scorer.decisionSeconds.max
      ) ||
      !(scorer.due.anySeconds > 0 && scorer.due.specialSeconds > 0) ||
      !valid(scorer.due.openingSpecialSeconds) ||
      ![
        scorer.due.weight,
        scorer.hysteresis.bonus,
        scorer.hysteresis.epsilon,
        scorer.hysteresis.minHoldSeconds,
        scorer.pressure.graceSeconds,
        scorer.pressure.rampSeconds,
        scorer.pressure.weight,
        ...scorer.moves.map(({ base }) => base),
      ].every(valid) ||
      !curves.every(({ curve }) => Number.isFinite(curve.from) && Number.isFinite(curve.to)) ||
      !scorer.moves.every(
        ({ move }) =>
          move.kind === "chase" ||
          (move.kind === "cut-off"
            ? valid(move.leadSeconds) && valid(move.maxLead)
            : valid(move.distance)),
      )
    ) {
      throw new Error("Invalid boss scorer");
    }
  }
  // Spatial scorer inputs scale to pixels with their curve ranges; seconds and sight do not.
  const spatial = new Set(["distance", "heightDelta", "heightGap", "horizontalGap", "targetSpeed"]);
  const scaleConsideration = <
    Consideration extends {
      readonly curve: { readonly from: number; readonly to: number };
      readonly input: string;
    },
  >(
    consideration: Consideration,
  ): Consideration =>
    spatial.has(consideration.input)
      ? {
          ...consideration,
          curve: {
            ...consideration.curve,
            from: consideration.curve.from * tile,
            to: consideration.curve.to * tile,
          },
        }
      : consideration;
  const states = Object.fromEntries(
    Object.entries(plan.states).map(([key, node]) => {
      if (
        node.transitions.some(({ score }) => score) &&
        (key !== scorer?.engaged ||
          !node.transitions.every(
            ({ score }) =>
              !score || (valid(score.base) && (score.special === true || score.special === false)),
          ))
      ) {
        throw new Error(`Scored transitions require the scorer's engaged state in ${key}`);
      }
      if (
        node.attack &&
        (plan.attackCooldownSeconds === undefined ||
          !node.attack.id ||
          !["tell", "committed", "completed"].includes(node.attack.phase) ||
          (node.attack.continues && node.attack.phase !== "tell"))
      ) {
        throw new Error(`Invalid attack phase in ${key}`);
      }
      for (const transition of node.transitions) {
        const target = plan.states[transition.to]?.attack;
        const sameAttack = target !== undefined && target.id === node.attack?.id;
        if (
          node.attack?.phase === "committed" &&
          (!sameAttack || (target.phase === "tell" && !target.continues))
        ) {
          throw new Error(`Committed attack requires a completed boundary in ${key}`);
        }
        // No feints: a tell commits its own attack or cancels.
        if (
          node.attack?.phase === "tell" &&
          !node.attack.continues &&
          target &&
          (!sameAttack || target.phase === "completed" || target.continues)
        ) {
          throw new Error(`Tell must commit its attack or cancel in ${key}`);
        }
        if (
          node.attack?.continues &&
          (!sameAttack || (target.phase === "tell" && !target.continues))
        ) {
          throw new Error(`Continuing tell requires its committed attack or completion in ${key}`);
        }
        if (
          target?.continues &&
          (!sameAttack ||
            node.attack!.phase === "completed" ||
            (node.attack!.phase === "tell" && !node.attack!.continues))
        ) {
          throw new Error(`Continuing tell requires its committed attack in ${key}`);
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
        ((node.motion.kind === "move" || node.motion.kind === "hop") &&
          node.motion.distance !== undefined &&
          (!valid(node.motion.distance) || node.motion.distance === 0)) ||
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
          node.motion.traversal.speed,
        ].every((value) => Number.isFinite(value) && value > 0) ||
          !Number.isFinite(node.motion.traversal.prepSeconds) ||
          node.motion.traversal.prepSeconds < 0 ||
          (node.motion.traversal.prepIntervalSeconds !== undefined &&
            !(
              node.motion.traversal.prepIntervalSeconds >= 0 &&
              Number.isFinite(node.motion.traversal.prepIntervalSeconds)
            )))
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
        const resolve = (condition: BehaviourCondition): BehaviourCondition => {
          if (condition.kind === "not") {
            return { ...condition, condition: resolve(condition.condition) };
          }
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
          if (condition.kind === "blocked" || condition.kind === "track-clear") {
            const motion = (condition.kind === "blocked" ? node : plan.states[condition.state])
              ?.motion.kind;
            if (motion !== "move" && motion !== "hop") {
              throw new Error(`Invalid track condition in ${key}`);
            }
            return condition;
          }
          if (condition.kind === "flight-approach-direction") {
            if (![-1, 1].includes(condition.direction)) {
              throw new Error(`Invalid flight approach direction in ${key}`);
            }
            return condition;
          }
          if (condition.kind === "track-room") {
            if (
              (node.motion.kind !== "move" && node.motion.kind !== "hop") ||
              !valid(condition.distance)
            ) {
              throw new Error(`Invalid track room in ${key}`);
            }
            return { ...condition, distance: condition.distance * tile };
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
                key !== scorer?.engaged)
            ) {
              throw new Error(`Intent arrival requires scored overhead pursuit in ${key}`);
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
        };
        return {
          ...transition,
          ...(transition.score && {
            score: {
              ...transition.score,
              considerations: transition.score.considerations.map(scaleConsideration),
            },
          }),
          when: transition.when.map(resolve),
        };
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
                    node.motion.mode === "ground" &&
                    node.motion.traversal && {
                      traversal: {
                        gravity: node.motion.traversal.gravity * tile,
                        jumpSpeed: node.motion.traversal.jumpSpeed * tile,
                        maxFallSpeed: node.motion.traversal.maxFallSpeed * tile,
                        prepSeconds: node.motion.traversal.prepSeconds,
                        ...(node.motion.traversal.prepIntervalSeconds !== undefined && {
                          prepIntervalSeconds: node.motion.traversal.prepIntervalSeconds,
                        }),
                        speed: node.motion.traversal.speed * tile,
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
                  ...((node.motion.kind === "move" || node.motion.kind === "hop") &&
                  node.motion.distance !== undefined
                    ? { distance: node.motion.distance * tile }
                    : {}),
                },
          transitions,
        },
      ];
    }),
  );
  return {
    ...plan,
    ...(scorer && {
      scorer: {
        ...scorer,
        moves: scorer.moves.map((entry) => ({
          ...entry,
          considerations: entry.considerations.map(scaleConsideration),
          move:
            entry.move.kind === "chase"
              ? entry.move
              : entry.move.kind === "cut-off"
                ? { ...entry.move, maxLead: entry.move.maxLead * tile }
                : { ...entry.move, distance: entry.move.distance * tile },
        })),
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
        ...(plan.pursuit.pace && {
          pace: {
            ...plan.pursuit.pace,
            distance: plan.pursuit.pace.distance * tile,
            speed: plan.pursuit.pace.speed * tile,
          },
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
    const acquired: BehaviourState = {
      ...currentState,
      pursuit: {
        engagedSeconds: 0,
        phase:
          outsideEscape || (reachable === false && timedOut(unreachableSeconds))
            ? "escaped"
            : "engaged",
        settled: false,
        unreachableSeconds,
      },
      ...(currentState.scorer && { scorer: { ...currentState.scorer, chaseSeconds: 0 } }),
    };
    delete (acquired as { chasePause?: unknown }).chasePause;
    return acquired;
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
  const engagedSeconds = (prior.engagedSeconds ?? 0) + seconds;
  // Giving up: no movement path for the grace, a chase pause's roll, or the certain limit.
  const gaveUp =
    (reachable === false && timedOut(unreachableSeconds)) ||
    prior.giveUp === true ||
    (config.relief !== undefined && engagedSeconds >= config.relief.giveUp.certainSeconds - EDGE);
  const escaped = outsideEscape || gaveUp;
  const next: BehaviourState = {
    ...currentState,
    pursuit: {
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
  return next;
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

interface BehaviourRunContext {
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

// Starts a chase pause when its seeded chase time has passed, at least the clearance after the
// last tell or committed attack, with the boss on the ground (Pebble in a safe hover) and a movement path to Chibi.
// Past the give-up start, the pause's seeded roll may give up.
function startChasePause(
  context: BehaviourRunContext,
  relief: ChaseRelief,
  current: Point,
  state: BehaviourState,
  time: number,
): BehaviourState {
  const { object, perception, seconds } = context;
  const { world } = perception;
  const scorer = state.scorer ?? openingScorerState(object.behaviour!.scorer!);
  const { motion } = nodeOf(object, state.stateKey);
  if (
    state.chasePause ||
    state.pursuit?.phase !== "engaged" ||
    state.activeAttack ||
    state.hop ||
    state.mapPursuit?.route?.reachable === false ||
    (scorer.sinceAttackSeconds !== undefined &&
      scorer.sinceAttackSeconds < relief.pause.tellClearanceSeconds - EDGE) ||
    (motion.kind === "pursue" && motion.mode === "fly"
      ? !safeIntentHover(world, seconds - time, object, current)
      : state.traversal !== undefined && !state.traversal.physical.grounded)
  ) {
    return state;
  }
  if (!world.decisions) {
    throw new Error("Chase relief requires an object-local decision context");
  }
  const draw = chasePauseDraw(world.decisions(`relief:${scorer.pauses}`), relief);
  if (scorer.chaseSeconds < draw.afterSeconds) {
    return state;
  }
  const giveUp =
    (state.pursuit.engagedSeconds ?? 0) >= relief.giveUp.fromSeconds - EDGE &&
    draw.roll < relief.giveUp.chance;
  const next: BehaviourState = {
    ...state,
    chasePause: { remainingSeconds: draw.seconds },
    ...(giveUp && { pursuit: { ...state.pursuit, giveUp: true as const } }),
    scorer: { ...scorer, chaseSeconds: 0, pauses: scorer.pauses + 1 },
  };
  delete (next as { intent?: unknown }).intent;
  return next;
}

// Holds a chase pause for the rest of the step, facing Chibi in the idle pose. Its end restarts
// pressure and the tell clearance.
function chasePauseHold(
  context: BehaviourRunContext,
  current: Point,
  state: BehaviourState,
  time: number,
  actions: readonly BehaviourEvent[],
  segments: readonly BehaviourSegment[],
): BehaviourStep {
  const { escaped, object, perception, seconds } = context;
  const { target: bird, tuning } = perception;
  const remaining = seconds - time;
  const mine = current.x + object.width / 2;
  const theirs = bird.x + tuning.width / 2;
  const facing = theirs === mine ? state.facing : theirs < mine ? -1 : 1;
  const hold = [{ end: remaining, from: current, start: 0, to: current }];
  const animated = animateSegments(object, remaining, { ...state, facing }, hold, undefined, false);
  const left = state.chasePause!.remainingSeconds - remaining;
  let next = advanceAttackClock(remaining, animated.state);
  if (left > EDGE) {
    next = { ...next, chasePause: { remainingSeconds: left } };
  } else {
    delete (next as { chasePause?: unknown }).chasePause;
    next = syncAnimation(object, {
      ...next,
      scorer: { ...next.scorer!, pressureSeconds: 0, sincePauseSeconds: 0 },
    });
  }
  return {
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
  };
}

// After any ended chase, a settled ground boss walks at chase speed toward its encounter position,
// stopping at walls and support edges, then resumes its initial behaviour anchored there.
function homeWalk(
  context: BehaviourRunContext,
  current: Point,
  state: BehaviourState,
  time: number,
  actions: readonly BehaviourEvent[],
  segments: readonly BehaviourSegment[],
):
  | { readonly kind: "hold"; readonly step: BehaviourStep }
  | { readonly kind: "done"; readonly state: BehaviourState } {
  const { escaped, object, perception, seconds } = context;
  const { world } = perception;
  const motion = pursuitKinds(object.behaviour!).groundTraversalMotion;
  // Off support, ordinary gravity acts first.
  if (!supportContact(object, world, current)) {
    return { kind: "done", state };
  }
  const remaining = seconds - time;
  const gap = object.origin.x - current.x;
  const heading = gap < 0 ? -1 : 1;
  const x =
    motion?.kind !== "pursue" || !groundBoss(object)
      ? current.x
      : groundPursuitEnd(
          object,
          world,
          pursuitTrack(object),
          current,
          contactBox(object, current, heading, "x"),
          current.x + heading * Math.min(Math.abs(gap), motion.speed * remaining),
        );
  if (Math.abs(x - current.x) <= EDGE) {
    const pursuit = { ...state.pursuit! };
    delete (pursuit as { home?: true }).home;
    return { kind: "done", state: syncAnimation(object, { ...state, anchor: current, pursuit }) };
  }
  const to = { x, y: current.y };
  const walking = { ...state, facing: heading } as BehaviourState;
  const animated = animateSegments(object, remaining, walking, [
    { end: remaining, from: current, start: 0, to },
  ]);
  return {
    kind: "hold",
    step: {
      actions,
      at: to,
      segments: [
        ...segments,
        ...animated.segments.map((segment) => ({
          ...segment,
          end: segment.end + time,
          start: segment.start + time,
        })),
      ],
      state: advanceAttackClock(remaining, animated.state),
      ...(escaped && { escaped }),
    },
  };
}

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
  const graphHeld =
    traversalStep !== undefined ||
    next.traversal?.preparation !== undefined ||
    settling ||
    (node.motion.kind === "fly" &&
      node.motion.to === "support" &&
      !supported &&
      !selectionFallback) ||
    (node.motion.kind === "wait" && node.motion.support === "required" && !supported) ||
    (node.motion.kind === "pursue" && next.traversal && !next.traversal.physical.grounded);
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
    next = enterState(perception, object, current, transition.to, next);
    save();
    return { kind: "again" };
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
      (!next.traversal || next.traversal.physical.grounded);
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
      const counted = { ...prior, decision: prior.decision + 1 };
      if (choice.kind === "attack") {
        if (instant.has(next.stateKey)) {
          throw new Error(`Instant behaviour transition cycle for ${object.character}`);
        }
        instant.add(next.stateKey);
        next = enterState(perception, object, current, choice.transition.to, {
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
  return keptClear(perception, object, at, advanceUnclear(perception, object, seconds, at, state));
}

// After an ended chase, until its rearm cooldown ends, a boss whose pursuit keeps clear never
// moves toward Chibi: the step's horizontal movement toward his centre is cancelled, and for a
// flyer its vertical movement toward him too, its traversal dropped so it replans from there.
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
    enter: (point, key, current) => enterState(perception, object, point, key, current),
    object,
    perception,
    seconds,
  };
  const actions: BehaviourEvent[] = [];
  const segments: BehaviourSegment[] = [];
  const instant = new Set<string>();
  const current = at;
  let next = updatePursuit(perception, object, seconds, at, state);
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

export { contactBox } from "./behaviourTrack";
