import { EDGE } from "../core/index.ts";
import type { ChaseRelief, DialogueLine, ObjectLayout, Point } from "../data/types/index.ts";
import type {
  BehaviourEvent,
  BehaviourSegment,
  BehaviourState,
  BehaviourStep,
  BehaviourWanderState,
} from "./behaviour.ts";
import { animateSegments, syncAnimation } from "./behaviourAnimation.ts";
import { advanceAttackClock } from "./behaviourAttack.ts";
import { safeIntentHover } from "./behaviourIntent.ts";
import type { BehaviourPerception } from "./behaviourPerception.ts";
import { pursuitKinds } from "./behaviourProfile.ts";
import { type BehaviourWorld, groundPursuitEnd } from "./behaviourReach.ts";
import { chasePauseDraw, openingScorerState } from "./behaviourScorer.ts";
import { insideScreen, screenBand, screenClamp } from "./behaviourScreen.ts";
import { contactBox, groundBoss, nodeOf, pursuitTrack } from "./behaviourTrack.ts";
import { supportContact } from "./flyLanding.ts";

export interface BehaviourInterludeContext {
  readonly escaped: DialogueLine | undefined;
  readonly object: ObjectLayout;
  readonly perception: BehaviourPerception;
  readonly pursuitReachable: boolean | undefined;
  readonly seconds: number;
}

type BehaviourTransition = (
  perception: BehaviourPerception,
  object: ObjectLayout,
  at: Point,
  key: string,
  state: BehaviourState,
) => BehaviourState;

// An engagement's seeded give-up time, from its own stream.
export function giveUpDraw(
  world: BehaviourWorld,
  relief: ChaseRelief,
  engagements: number,
): number {
  const { max, min } = relief.giveUp.seconds;
  if (!world.decisions) {
    throw new Error("Chase relief requires an object-local decision context");
  }
  return min + world.decisions(`give-up:${engagements}`)() * (max - min);
}

// Starts a chase pause when its seeded chase time has passed, at least the clearance after the
// last tell or committed attack, with the boss on the ground (Pebble in a safe hover) and a
// movement path to Chibi. A pause at or past the engagement's give-up time gives up.
export function startChasePause(
  context: BehaviourInterludeContext,
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
    context.pursuitReachable !== true ||
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
    state.pursuit.giveUpSeconds !== undefined &&
    (state.pursuit.engagedSeconds ?? 0) >= state.pursuit.giveUpSeconds - EDGE;
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
export function chasePauseHold(
  context: BehaviourInterludeContext,
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
// stopping at walls, support edges and the edge of Chibi's screen (or, outside it, where home lies
// farther from him), then resumes its initial behaviour anchored there.
export function homeWalk(
  context: BehaviourInterludeContext,
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
  // Toward the encounter position, but never out of Chibi's screen or farther from it.
  const home = screenClamp(
    screenBand(perception.tuning, perception.target, object),
    current.x,
    object.origin.x,
  );
  const gap = home - current.x;
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

// Holds the rest of the step in place, facing the given way, with the attack clock running.
function holdStep(
  context: BehaviourInterludeContext,
  current: Point,
  state: BehaviourState,
  time: number,
  actions: readonly BehaviourEvent[],
  segments: readonly BehaviourSegment[],
  to: Point = current,
): BehaviourStep {
  const { escaped, object, seconds } = context;
  const remaining = seconds - time;
  const legs = [{ end: remaining, from: current, start: 0, to }];
  const animated = animateSegments(object, remaining, state, legs, undefined, to.x !== current.x);
  return {
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
  };
}

// Where a wander walk from current toward x stops: at a wall or support edge, and never past the
// last position with ordinary support contact.
function wanderEnd(object: ObjectLayout, world: BehaviourWorld, current: Point, x: number): number {
  const heading = x < current.x ? -1 : 1;
  const end = groundPursuitEnd(
    object,
    world,
    pursuitTrack(object),
    current,
    contactBox(object, current, heading, "x"),
    x,
  );
  if (supportContact(object, world, { x: end, y: current.y })) {
    return end;
  }
  let low = current.x;
  let high = end;
  for (let step = 0; step < 12; step++) {
    const middle = (low + high) / 2;
    if (supportContact(object, world, { x: middle, y: current.y })) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}

// The plan's wander in a wander wait, outside any rearm cooldown. A move starts when the hold
// ends: a ground boss walks a seeded distance to a seeded side, the other side when that one
// leaves the range around its encounter position, its horizontal track or Chibi's screen, or
// ends within the shortest walk of here, stopping at walls and support edges; a walk that turns
// back is at least as long as the last walk. A flyer enters its hop state. The hold after a move
// lasts at least its seeded hold, and the rest of its seeded interval, facing the move's
// direction.
// Without an object-local decision context the boss holds.
export function wanderStep(
  transitionState: BehaviourTransition,
  context: BehaviourInterludeContext,
  current: Point,
  state: BehaviourState,
  time: number,
  actions: readonly BehaviourEvent[],
  segments: readonly BehaviourSegment[],
):
  | { readonly kind: "again"; readonly state: BehaviourState }
  | { readonly kind: "hold"; readonly step: BehaviourStep }
  | undefined {
  const { object, perception, seconds } = context;
  const { world } = perception;
  const plan = object.behaviour!;
  const wander = plan.wander;
  const node = nodeOf(object, state.stateKey);
  const pursuit = state.pursuit;
  const cooling =
    pursuit?.phase === "escaped" &&
    (!pursuit.settled ||
      pursuit.home === true ||
      (pursuit.endedSeconds ?? 0) < (plan.pursuit?.rearmSeconds ?? 0) - EDGE);
  if (
    !wander ||
    node.motion.kind !== "wait" ||
    !node.motion.wander ||
    cooling ||
    !world.decisions ||
    state.hop ||
    (wander.walk && !supportContact(object, world, current))
  ) {
    return undefined;
  }
  const remaining = seconds - time;
  const now = (world.traversalFrame?.timeSeconds ?? 0) + time;
  const between = (random: () => number, { max, min }: { max: number; min: number }) =>
    min + random() * (max - min);
  let record: BehaviourWanderState = state.wander ?? {
    holdSeconds: between(world.decisions("wander:0"), wander.everySeconds),
    moves: 0,
  };
  if (record.hop) {
    // Landed from a hop: hold the seeded hold, and the rest of the interval.
    const flown = now - record.hop.startedAt;
    record = {
      holdSeconds: Math.max(record.hop.hold, record.hop.every - flown),
      moves: record.moves,
    };
  }
  if (record.goal === undefined && record.holdSeconds <= EDGE) {
    const moves = record.moves + 1;
    const random = world.decisions(`wander:${moves}`);
    const every = between(random, wander.everySeconds);
    const hold = between(random, wander.holdSeconds);
    const side: -1 | 1 = random() < 0.5 ? -1 : 1;
    if (wander.hop !== undefined) {
      return {
        kind: "again",
        state: transitionState(perception, object, current, wander.hop, {
          ...state,
          wander: { holdSeconds: 0, hop: { every, hold, startedAt: now }, moves },
        }),
      };
    }
    const walk = wander.walk!;
    const distance = between(random, walk.distance);
    // Within the range and the wander state's horizontal track, so later track moves start
    // inside it.
    const track = node.track ?? plan;
    const extent = track.axis === "x" ? track.distance : 0;
    // Inside Chibi's screen the walk also stays inside it; outside, only the range bounds it.
    const band = screenBand(perception.tuning, perception.target, object);
    const screen = band && insideScreen(band, current.x) ? band : undefined;
    const low = Math.max(
      object.origin.x + Math.max(-wander.range, Math.min(0, extent)),
      screen?.low ?? -Infinity,
    );
    const high = Math.min(
      object.origin.x + Math.min(wander.range, Math.max(0, extent)),
      screen?.high ?? Infinity,
    );
    const reach = (heading: -1 | 1) =>
      wanderEnd(
        object,
        world,
        current,
        Math.min(high, Math.max(low, current.x + heading * distance)),
      );
    // A walk covers at least the shortest walk. It keeps the last walk's heading when that walk
    // allows, and a walk that turns back is at least as long as the last walk, so consecutive
    // walks never cancel out.
    const previous = record.from;
    const last = previous === undefined ? 0 : Math.abs(current.x - previous);
    const turns = (heading: -1 | 1) =>
      previous !== undefined && Math.sign(current.x - previous) === -heading;
    const walks =
      low > high + EDGE
        ? []
        : ([side, -side as -1 | 1] as const).map((heading) => ({
            goal: turns(heading)
              ? wanderEnd(
                  object,
                  world,
                  current,
                  Math.min(high, Math.max(low, current.x + heading * Math.max(distance, last))),
                )
              : reach(heading),
            heading,
          }));
    const chosen = walks.find(({ goal }) => Math.abs(goal - current.x) >= walk.distance.min - EDGE);
    record = chosen
      ? {
          ...chosen,
          from: current.x,
          holdSeconds: Math.max(hold, every - Math.abs(chosen.goal - current.x) / walk.speed),
          moves,
        }
      : { ...(previous !== undefined && { from: previous }), holdSeconds: every, moves };
  }
  if (record.goal === undefined) {
    const held: BehaviourState = {
      ...state,
      facing: record.heading ?? state.facing,
      wander: { ...record, holdSeconds: record.holdSeconds - remaining },
    };
    return {
      kind: "hold",
      step: holdStep(context, current, syncAnimation(object, held), time, actions, segments),
    };
  }
  const walk = wander.walk!;
  const heading = record.heading!;
  const gap = record.goal - current.x;
  const x = wanderEnd(
    object,
    world,
    current,
    current.x + Math.sign(gap) * Math.min(Math.abs(gap), walk.speed * remaining),
  );
  const arrived = Math.abs(record.goal - x) <= EDGE || Math.abs(x - current.x) <= EDGE;
  const walked: BehaviourState = {
    ...state,
    facing: heading,
    wander: arrived
      ? { from: record.from!, heading, holdSeconds: record.holdSeconds, moves: record.moves }
      : record,
  };
  return {
    kind: "hold",
    step: holdStep(context, current, syncAnimation(object, walked), time, actions, segments, {
      x,
      y: current.y,
    }),
  };
}
