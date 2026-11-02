import type { TraversalSafety } from "@andornaut/game-kit/terrain/traversal";

import type {
  BehaviourAction,
  BehaviourCondition,
  BehaviourNode,
  BehaviourPlan,
  BirdTuning,
  DialogueLine,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types";
import {
  advanceAttackClock,
  attackProtected,
  attackReady,
  type BehaviourAttackState,
  canEnterAttack,
  enterAttack,
} from "./behaviourAttack";
import {
  advanceIdleRecovery,
  type BehaviourIdleState,
  observeIdle,
  planIdleRecovery,
} from "./behaviourIdle";
import {
  type BehaviourGeometry,
  type BehaviourTrack,
  type BehaviourWorld,
  behaviourWorld,
  flightAxis,
  groundPursuitEnd,
  targetReachable,
} from "./behaviourReach";
import {
  advanceTraversal,
  type BehaviourRearmState,
  type BehaviourTraversalState,
  probeRearm,
} from "./behaviourTraversal";
import { birdBox, type BirdState, EDGE } from "./bird";
import { contactFrameAt } from "./bodyContact";
import { collisionCandidates } from "./collisionIndex";
import { flyLandingRoute, supportedLanding } from "./flyLanding";
import { hopLift } from "./motion";
import { targetInSameChunk, targetVisible } from "./perception";

export interface BehaviourState extends BehaviourAttackState {
  readonly idleWatchdog?: BehaviourIdleState;
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
  readonly flightTarget?: Point;
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
  const states = Object.fromEntries(
    Object.entries(plan.states).map(([key, node]) => {
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
      if (
        node.motion.kind === "fly" &&
        (!valid(node.motion.speed) ||
          node.motion.speed === 0 ||
          (typeof node.motion.to === "string"
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
        (!valid(node.motion.leadSeconds) || !valid(node.motion.maxLead))
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
            condition.kind === "boundary" ||
            condition.kind === "visible" ||
            condition.kind === "line-of-sight" ||
            condition.kind === "alignment-blocked" ||
            condition.kind === "pursuit-ended"
          ) {
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
                      },
                    }),
                  ...(node.motion.kind === "fly"
                    ? typeof node.motion.to === "string"
                      ? {
                          ...(node.motion.to === "target-x" && {
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

function nodeOf(object: ObjectLayout, key: string): BehaviourNode {
  const node = object.behaviour?.states[key];
  if (!node) {
    throw new Error(`No behaviour state ${key} for ${object.character}`);
  }
  return node;
}

function enterState(
  tuning: BirdTuning,
  object: ObjectLayout,
  bird: BirdState,
  at: Point,
  key: string,
  state: BehaviourState,
): BehaviourState {
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
  if (leavingPursuit || (state.stateKey !== key && next.traversal?.preparation)) {
    delete (next as { traversal?: BehaviourTraversalState }).traversal;
  }
  const animation = syncAnimation(object, next);
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

function syncAnimation(object: ObjectLayout, state: BehaviourState): BehaviourState {
  if (!object.contact) {
    return state;
  }
  const key = state.idleWatchdog?.recovery
    ? object.behaviour!.idleWatchdog!.resume
    : state.stateKey;
  const tag = state.active
    ? (object.behaviour?.states[key]?.animation ?? state.animationTag ?? object.animations.idle)
    : (object.behaviour?.inactiveAnimation ?? object.animations.idle);
  if (!tag || !object.contact.tags[tag]) {
    throw new Error(`Missing silhouette animation for ${object.art}`);
  }
  if (state.animationTag === tag && state.animationSeconds !== undefined) {
    return state;
  }
  return {
    ...state,
    animationSeconds: state.animationTag === tag ? (state.animationSeconds ?? 0) : 0,
    animationTag: tag,
  };
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
  return enterState(tuning, object, bird, object.origin, plan.initial, {
    active: object.scene === undefined,
    elapsed: 0,
    facing: plan.distance < 0 ? -1 : 1,
    stateKey: plan.initial,
  });
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

function heading(node: BehaviourNode, state: BehaviourState): -1 | 1 {
  return node.motion.kind !== "wait" &&
    node.motion.kind !== "fly" &&
    node.motion.kind !== "pursue" &&
    typeof node.motion.direction === "number"
    ? node.motion.direction
    : state.facing;
}

function endpoint(object: ObjectLayout, direction: -1 | 1, state: BehaviourState): number {
  const plan = nodeOf(object, state.stateKey).track ?? object.behaviour;
  if (!plan) {
    throw new Error(`No behaviour for ${object.character}`);
  }
  const origin = (state.anchor ?? object.origin)[plan.axis];
  return direction === 1
    ? Math.max(origin, origin + plan.distance)
    : Math.min(origin, origin + plan.distance);
}

function flightDestination(
  tuning: BirdTuning,
  object: ObjectLayout,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
): Point | undefined {
  const motion = nodeOf(object, state.stateKey).motion;
  if (motion.kind !== "fly") {
    return undefined;
  }
  if (motion.to === "target") {
    return state.flightTarget;
  }
  if (motion.to === "target-x") {
    if (!state.flightTarget) {
      return undefined;
    }
    const contact = contactBox(object, at, state.facing, state.axis);
    const target = birdBox(tuning, bird);
    const lead = Math.max(-motion.maxLead, Math.min(motion.maxLead, bird.vx * motion.leadSeconds));
    return {
      x: target.x + target.width / 2 - contact.width / 2 - (contact.x - at.x) + lead,
      y: state.flightTarget.y,
    };
  }
  return {
    x: (state.anchor ?? object.origin).x + motion.to.x,
    y: (state.anchor ?? object.origin).y + motion.to.y,
  };
}
function alignmentBlocked(
  tuning: BirdTuning,
  object: ObjectLayout,
  world: BehaviourWorld,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
): boolean {
  const motion = nodeOf(object, state.stateKey).motion;
  if (motion.kind !== "fly" || motion.to !== "target-x") {
    return false;
  }
  const target = flightDestination(tuning, object, bird, at, state);
  if (!target) {
    return true;
  }
  const origin = state.anchor ?? object.origin;
  return (
    target.x < origin.x + motion.bounds.x - EDGE ||
    target.x > origin.x + motion.bounds.x + motion.bounds.width + EDGE ||
    target.y < origin.y + motion.bounds.y - EDGE ||
    target.y > origin.y + motion.bounds.y + motion.bounds.height + EDGE ||
    Math.abs(flightAxis(object, world, at, "x", target.x) - target.x) > EDGE
  );
}

function matches(
  tuning: BirdTuning,
  object: ObjectLayout,
  world: BehaviourWorld,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
  condition: BehaviourCondition,
): boolean {
  if (condition.kind === "attack-ready") {
    return attackReady(state);
  }
  if (condition.kind === "pursuit-ended") {
    return (
      object.behaviour?.pursuit !== undefined &&
      state.pursuit?.phase === "escaped" &&
      !state.pursuit.settled
    );
  }
  if (condition.kind === "alignment-blocked") {
    return alignmentBlocked(tuning, object, world, bird, at, state);
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
    return state.elapsed >= condition.seconds;
  }
  if (condition.kind === "arrived") {
    const motion = nodeOf(object, state.stateKey).motion;
    if (motion.kind !== "fly") {
      return false;
    }
    if (motion.to === "target-x" && alignmentBlocked(tuning, object, world, bird, at, state)) {
      return false;
    }
    const target = flightDestination(tuning, object, bird, at, state);
    return (
      target !== undefined && Math.hypot(at.x - target.x, at.y - target.y) <= condition.tolerance
    );
  }
  if (condition.kind === "boundary") {
    const axis = state.axis ?? object.behaviour?.axis ?? "x";
    return at[axis] === endpoint(object, heading(nodeOf(object, state.stateKey), state), state);
  }
  if (condition.kind === "reachable" || condition.kind === "lost-target") {
    const reachable =
      state.pursuit?.phase === "engaged"
        ? pursuitReachable(tuning, object, world, at, state, bird)
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

function reachable(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  state: BehaviourState,
  direction: -1 | 1,
  desired: number,
): number {
  const axis = state.axis ?? object.behaviour?.axis ?? "x";
  const edge = endpoint(object, direction, state);
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

function pursuitTrack(object: ObjectLayout): BehaviourTrack {
  const distance = object.behaviour!.pursuit!.distance;
  return {
    axis: "x",
    distance: distance * 2,
    origin: { x: object.origin.x - distance, y: object.origin.y },
  };
}

function pursuitReachable(
  tuning: BirdTuning,
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  state: BehaviourState,
  bird: BirdState,
): boolean | undefined {
  const traversal = Object.values(object.behaviour!.states).some(
    ({ motion }) => motion.kind === "pursue" && motion.mode === "ground" && motion.traversal,
  );
  if (traversal) {
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
  const flight = Object.values(object.behaviour!.states).some(
    (node) => node.motion.kind === "pursue" && node.motion.mode === "fly",
  );
  if (flight) {
    const hers = birdBox(tuning, bird);
    const contact = contactBox(object, at, state.facing, state.axis);
    const x = hers.x + hers.width / 2 - contact.width / 2 - (contact.x - at.x);
    const y = hers.y + hers.height / 2 - contact.height / 2 - (contact.y - at.y);
    const endX = flightAxis(object, world, at, "x", x);
    const endY = flightAxis(object, world, { ...at, x: endX }, "y", y);
    return Math.abs(endX - x) <= EDGE && Math.abs(endY - y) <= EDGE;
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
  tuning: BirdTuning,
  object: ObjectLayout,
  world: BehaviourWorld,
  seconds: number,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
): BehaviourState {
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
  let reachable = pursuitReachable(tuning, object, world, at, currentState, bird);
  const prior = currentState.pursuit;
  const aware = targetInSameChunk(
    world,
    { ...at, height: object.height, width: object.width },
    { height: tuning.height, width: tuning.width, x: bird.x, y: bird.y },
  );
  if (prior?.phase === "escaped" && prior.settled && inside && reachable !== true) {
    const motion = Object.values(object.behaviour!.states)
      .map(({ motion }) => motion)
      .find((motion) => motion.kind === "pursue" && motion.mode === "ground" && motion.traversal);
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

// Generic state graphs choose the motion, animation and transition order. The executor knows
// only bounded move/wait/hop primitives and conditions; it has no character-specific cycle.
function idleSegments(
  object: ObjectLayout,
  seconds: number,
  state: BehaviourState,
  legs: readonly {
    readonly start: number;
    readonly end: number;
    readonly from: Point;
    readonly to: Point;
  }[],
): { readonly segments: readonly BehaviourSegment[]; readonly state: BehaviourState } {
  const segments: BehaviourSegment[] = [];
  let next = syncAnimation(object, { ...state, axis: "x" });
  for (const leg of legs) {
    let time = leg.start;
    const direction = leg.to.x - leg.from.x;
    if (direction !== 0) {
      next = { ...next, facing: direction < 0 ? -1 : 1 };
    }
    const point = (at: number) => {
      const fraction = (at - leg.start) / (leg.end - leg.start);
      return {
        x: leg.from.x + (leg.to.x - leg.from.x) * fraction,
        y: leg.from.y + (leg.to.y - leg.from.y) * fraction,
      };
    };
    while (time < leg.end) {
      const frame = object.contact
        ? contactFrameAt(object.contact, next.animationTag as string, next.animationSeconds ?? 0)
        : undefined;
      const end = Math.min(leg.end, time + (frame?.remaining ?? Infinity));
      segments.push({
        axis: "x",
        end,
        facing: next.facing,
        from: point(time),
        start: time,
        to: point(end),
        ...(frame && { frame: frame.frame }),
      });
      if (object.contact) {
        next = { ...next, animationSeconds: (next.animationSeconds ?? 0) + end - time };
      }
      time = end;
    }
  }
  const duration = legs.reduce((sum, leg) => sum + leg.end - leg.start, 0);
  if (object.contact && duration < seconds) {
    next = { ...next, animationSeconds: (next.animationSeconds ?? 0) + seconds - duration };
  }
  return { segments, state: next };
}

function idleReady(
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
  const flyingHover =
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
    (supportedLanding(object, world, at) || flyingHover) &&
    idle.seconds >= watchdog.seconds &&
    (idle.attemptedAt === undefined || idle.seconds - idle.attemptedAt >= watchdog.seconds)
  );
}

function idleRecoveryStep(
  tuning: BirdTuning,
  object: ObjectLayout,
  world: BehaviourWorld,
  seconds: number,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
): { readonly state: BehaviourState; readonly step?: BehaviourStep } {
  const watchdog = object.behaviour!.idleWatchdog,
    idle = state.idleWatchdog;
  if (!watchdog || !idle) {
    return { state };
  }
  const motion = nodeOf(object, watchdog.resume).motion;
  if (motion.kind !== "pursue") {
    throw new Error("Idle recovery requires a pursuit profile");
  }
  const prepared = idleReady(object, world, at, state)
    ? planIdleRecovery(world, object, motion, seconds, state.facing, idle, at)
    : idle;
  const active = { ...state, idleWatchdog: prepared };
  if (!prepared.recovery) {
    return { state: active };
  }
  delete (active as { traversal?: BehaviourTraversalState }).traversal;
  const advanced = advanceIdleRecovery(world, object, motion, seconds, prepared, at);
  const animated = idleSegments(object, seconds, active, advanced.segments);
  let next = {
    ...animated.state,
    idleWatchdog: observeIdle(watchdog, seconds, advanced.segments, advanced.idle),
    ...(advanced.idle.recovery?.kind === "ground" && {
      traversal: advanced.idle.recovery.traversal,
    }),
  };
  if (advanced.finished) {
    next = {
      ...enterState(tuning, object, bird, advanced.at, watchdog.resume, next),
      idleWatchdog: next.idleWatchdog,
      pendingEntry: false,
    };
  }
  return {
    state: next,
    step: { actions: [], at: advanced.at, segments: animated.segments, state: next },
  };
}

export function stepBehaviour(
  tuning: BirdTuning,
  object: ObjectLayout,
  geometry: BehaviourGeometry,
  seconds: number,
  bird: BirdState,
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
  const world = behaviourWorld(geometry);
  const actions: BehaviourEvent[] = [];
  const segments: BehaviourSegment[] = [];
  const instant = new Set<string>();
  let current = at;
  let next = updatePursuit(tuning, object, world, seconds, bird, at, state);
  const escaped =
    state.pursuit?.phase !== "escaped" && next.pursuit?.phase === "escaped"
      ? plan.pursuit?.escaped
      : undefined;
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
    const initialRecovery = idleRecoveryStep(tuning, object, world, seconds, bird, at, next);
    next = initialRecovery.state;
    if (initialRecovery.step) {
      return {
        ...initialRecovery.step,
        state: advanceAttackClock(seconds, initialRecovery.step.state),
        ...(escaped && { escaped }),
      };
    }
  }
  const flyGateway = Object.entries(plan.states).find(
    ([, node]) => node.motion.kind === "pursue" && node.motion.mode === "fly",
  )?.[0];
  let time = 0;
  let traversalStep: ReturnType<typeof advanceTraversal> | undefined;
  while (true) {
    let node = nodeOf(object, next.stateKey);
    if (
      next.pursuit?.phase === "escaped" &&
      !next.pursuit.settled &&
      !attackProtected(node, next) &&
      next.stateKey === plan.initial &&
      node.motion.kind === "wait" &&
      flyGateway &&
      !next.hop &&
      !supportedLanding(object, world, current)
    ) {
      next = enterState(tuning, object, bird, current, flyGateway, next);
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
        supportedLanding(object, world, current))
    ) {
      next = enterState(tuning, object, bird, current, plan.initial, {
        ...next,
        anchor: current,
        pursuit: { ...next.pursuit, settled: true },
      });
      node = nodeOf(object, next.stateKey);
    }
    if (watchdog && idleReady(object, world, current, next)) {
      // Keep the safe graph phase until the next complete physics step can prove its route.
      const remaining = seconds - time;
      const hold = [{ end: remaining, from: current, start: 0, to: current }];
      const animated = idleSegments(object, remaining, next, hold);
      next = advanceAttackClock(remaining, {
        ...animated.state,
        idleWatchdog: observeIdle(watchdog, remaining, hold, next.idleWatchdog!),
      });
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
    const settling =
      next.pursuit?.phase === "escaped" &&
      !next.pursuit.settled &&
      !attackProtected(node, next) &&
      node.motion.kind === "pursue" &&
      node.motion.mode === "fly";
    const track = node.motion.kind === "pursue" ? pursuitTrack(object) : (node.track ?? plan);
    if (next.pendingEntry) {
      next = enterAttack(
        plan,
        node,
        enterState(tuning, object, bird, current, next.stateKey, next),
      );
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
    const transition =
      traversalStep !== undefined ||
      next.traversal?.preparation !== undefined ||
      settling ||
      (node.motion.kind === "pursue" && next.traversal && !next.traversal.physical.grounded)
        ? undefined
        : node.transitions.find(
            ({ to, when }) =>
              canEnterAttack(nodeOf(object, to), next) &&
              when.every((condition) =>
                matches(tuning, object, world, bird, current, next, condition),
              ),
          );
    if (transition) {
      if (instant.has(next.stateKey)) {
        throw new Error(`Instant behaviour transition cycle for ${object.character}`);
      }
      instant.add(next.stateKey);
      next = enterState(tuning, object, bird, current, transition.to, next);
      continue;
    }
    if (time >= seconds) {
      break;
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
            condition.kind === "elapsed" ||
            matches(tuning, object, world, bird, current, next, condition),
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
    let traversalSegments: readonly TraversalSafety[] | undefined;
    if (settling && node.motion.kind === "pursue") {
      const target = flyLandingRoute(object, world, current)?.[0];
      if (target) {
        const distance = Math.hypot(target.x - current.x, target.y - current.y);
        slice = Math.min(slice, distance / node.motion.speed);
        const fraction = Math.min(1, (node.motion.speed * slice) / distance);
        to.x = flightAxis(
          object,
          world,
          current,
          "x",
          current.x + (target.x - current.x) * fraction,
        );
        to.y = flightAxis(
          object,
          world,
          { ...current, x: to.x },
          "y",
          current.y + (target.y - current.y) * fraction,
        );
      }
    }
    if (
      node.motion.kind === "pursue" &&
      (next.pursuit?.phase === "engaged" || (next.traversal && !next.traversal.physical.grounded))
    ) {
      const hers = birdBox(tuning, bird);
      const contact = contactBox(object, current, next.facing, next.axis);
      const targetX = Math.max(
        object.origin.x - plan.pursuit!.distance,
        Math.min(
          object.origin.x + plan.pursuit!.distance,
          hers.x + hers.width / 2 - contact.width / 2 - (contact.x - current.x),
        ),
      );
      const targetY = hers.y + hers.height / 2 - contact.height / 2 - (contact.y - current.y);
      const travel = node.motion.speed * slice;
      const dx = targetX - current.x;
      next = {
        ...next,
        facing: next.traversal?.preparation
          ? next.facing
          : dx === 0
            ? next.facing
            : dx < 0
              ? -1
              : 1,
      };
      if (node.motion.mode === "ground" && node.motion.traversal) {
        const advanced = (traversalStep ??= advanceTraversal(
          {
            ...world,
            ...(world.traversalFrame && {
              traversalFrame: {
                ...world.traversalFrame,
                timeSeconds: world.traversalFrame.timeSeconds + time,
              },
            }),
          },
          object,
          node.motion,
          seconds - time,
          next.traversal,
          current,
          hers,
        ));
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
        to.x = endPoint.x;
        to.y = endPoint.y;
        traversalSegments = advanced.segments
          ?.filter((leg) => leg.endSeconds > startSeconds && leg.startSeconds < endSeconds)
          .map((leg) => ({
            ...leg,
            endSeconds: Math.min(endSeconds, leg.endSeconds),
            from: { ...leg.from, ...pointAt(Math.max(startSeconds, leg.startSeconds)) },
            startSeconds: Math.max(startSeconds, leg.startSeconds),
            to: { ...leg.to, ...pointAt(Math.min(endSeconds, leg.endSeconds)) },
          }));
        next = { ...next, ...(advanced.traversal && { traversal: advanced.traversal }) };
      } else if (node.motion.mode === "ground") {
        const desired = current.x + Math.max(-travel, Math.min(travel, dx));
        to.x = groundPursuitEnd(
          object,
          world,
          pursuitTrack(object),
          current,
          contactBox(object, current, next.facing, "x"),
          desired,
        );
      } else {
        const dy = targetY - current.y;
        const fraction = Math.min(1, travel / (Math.hypot(dx, dy) || 1));
        to.x = flightAxis(object, world, current, "x", current.x + dx * fraction);
        to.y = flightAxis(object, world, { ...current, x: to.x }, "y", current.y + dy * fraction);
      }
    }
    if (node.motion.kind === "fly") {
      const target =
        node.motion.to === "target-x" &&
        alignmentBlocked(tuning, object, world, bird, current, next)
          ? current
          : flightDestination(tuning, object, bird, current, next);
      if (!target) {
        throw new Error("Target flight must capture its destination on entry");
      }
      const distance = Math.hypot(target.x - current.x, target.y - current.y);
      if (distance > EDGE) {
        slice = Math.min(slice, distance / node.motion.speed);
        const fraction = Math.min(1, (node.motion.speed * slice) / distance);
        to.x = flightAxis(
          object,
          world,
          current,
          "x",
          current.x + (target.x - current.x) * fraction,
        );
        to.y = flightAxis(
          object,
          world,
          { ...current, x: to.x },
          "y",
          current.y + (target.y - current.y) * fraction,
        );
        if (to.x !== current.x) {
          next = { ...next, facing: to.x < current.x ? -1 : 1 };
        }
      }
    }
    if (
      node.motion.kind !== "wait" &&
      node.motion.kind !== "fly" &&
      node.motion.kind !== "pursue" &&
      node.motion.speed > 0
    ) {
      const direction = heading(node, next);
      let desired = current[track.axis] + direction * node.motion.speed * slice;
      if (node.motion.direction === "target") {
        const target =
          bird[track.axis] +
          (track.axis === "x" ? tuning.width - object.width : tuning.height - object.height) / 2;
        desired = direction === 1 ? Math.min(desired, target) : Math.max(desired, target);
      }
      const end = reachable(object, world, current, next, direction, desired);
      const moving = Math.abs(end - current[track.axis]) / node.motion.speed;
      if (moving > 0) {
        slice = Math.min(slice, moving);
        to[track.axis] = end;
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
    if (traversalSegments?.some((leg) => leg.endSeconds > leg.startSeconds)) {
      for (const leg of traversalSegments) {
        if (leg.endSeconds <= leg.startSeconds) {
          continue;
        }
        segments.push({
          axis: track.axis,
          end: leg.endSeconds - world.traversalFrame!.timeSeconds,
          facing: next.facing,
          from: { x: leg.from.x, y: leg.from.y },
          start: leg.startSeconds - world.traversalFrame!.timeSeconds,
          to: { x: leg.to.x, y: leg.to.y },
          ...(frame && { frame: frame.frame }),
        });
      }
    } else {
      segments.push({
        axis: track.axis,
        end,
        facing: next.facing,
        from: current,
        start: time,
        to,
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
      elapsed: next.elapsed + slice,
      ...(object.contact && { animationSeconds: (next.animationSeconds ?? 0) + slice }),
    };
    time = end > time ? end : seconds;
    instant.clear();
  }
  return { actions, at: current, segments, state: next, ...(escaped && { escaped }) };
}

export { sweptContact } from "./sweptContact";
