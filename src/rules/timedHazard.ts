import type { TraversalSafety } from "@andornaut/game-kit/terrain/traversal";

import { sweptContact } from "../core/index.ts";
import type { BirdTuning, ObjectLayout, Point, Rect } from "../data/types/index.ts";
import { advanceBehaviour, type BehaviourState } from "./behaviour.ts";
import { perceiveBehaviour } from "./behaviourPerception.ts";
import { startBird } from "./bird.ts";
import { effectiveHazardPhase, validateHazardPhases } from "./effectiveCollision.ts";

interface TimedHazardContact {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly rect: Rect;
}
export type TimedHazardSampler = (
  startSeconds: number,
  endSeconds: number,
) => readonly TimedHazardContact[] | undefined;

export function timedHazardRect(object: ObjectLayout, at: Point): Rect {
  return { height: object.height, width: object.width, x: at.x, y: at.y };
}

const MAX_TRANSITIONS = 4096;
const MAX_CHECKPOINTS = 64;
const TIMED_OBJECTS = new WeakMap<ObjectLayout, boolean>();

// Each sampler owns a bounded, immutable snapshot of one stationary elapsed-only graph.
// Undefined is unknown; an empty array certifies no active contact during the interval.
export function createTimedHazardSampler(
  tuning: BirdTuning,
  object: ObjectLayout,
  snapshot: {
    readonly at: Point;
    readonly state: BehaviourState | undefined;
    readonly timeSeconds: number;
  },
): TimedHazardSampler | undefined {
  const plan = object.behaviour;
  if (!plan) {
    return undefined;
  }
  let timed = TIMED_OBJECTS.get(object);
  if (timed === undefined) {
    timed = Object.values(plan.states).some((node) => node.hazardPhase !== undefined);
    if (timed) {
      validateHazardPhases(object);
    }
    TIMED_OBJECTS.set(object, timed);
  }
  if (!timed) {
    return undefined;
  }
  const { state, timeSeconds } = snapshot;
  const at = { ...snapshot.at };
  const rect = Object.freeze(timedHazardRect(object, at));
  if (
    !state ||
    !state.active ||
    !plan.states[state.stateKey] ||
    ![timeSeconds, at.x, at.y, state.elapsed, rect.width, rect.height].every(Number.isFinite) ||
    timeSeconds < 0 ||
    state.elapsed < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    (state.facing !== -1 && state.facing !== 1)
  ) {
    return () => undefined;
  }
  const minimumDuration = Math.min(
    ...Object.values(plan.states).map((node) => {
      const condition = node.transitions[0]!.when[0]!;
      return condition.kind === "elapsed" ? condition.seconds : Infinity;
    }),
  );
  const checkpoints = new Map<number, BehaviourState>([[0, { ...state }]]);
  const perception = perceiveBehaviour(tuning, [], startBird(tuning, at));
  let remaining = MAX_TRANSITIONS;
  const advance = (seconds: number, prior: BehaviourState) => {
    const cost = Math.ceil(seconds / minimumDuration) + 1;
    if (cost > remaining) {
      return undefined;
    }
    remaining -= cost;
    return advanceBehaviour(perception, object, seconds, at, prior);
  };
  const stateAt = (offset: number): BehaviourState | undefined => {
    const cached = checkpoints.get(offset);
    if (cached) {
      return cached;
    }
    let before = 0;
    let prior = checkpoints.get(0)!;
    for (const [time, candidate] of checkpoints) {
      if (time <= offset && time > before) {
        before = time;
        prior = candidate;
      }
    }
    const next = advance(offset - before, prior)?.state;
    if (next) {
      if (checkpoints.size >= MAX_CHECKPOINTS) {
        const oldest = [...checkpoints.keys()].find((time) => time !== 0);
        if (oldest !== undefined) {
          checkpoints.delete(oldest);
        }
      }
      checkpoints.set(offset, next);
    }
    return next;
  };
  return (startSeconds, endSeconds) => {
    if (
      ![startSeconds, endSeconds].every(Number.isFinite) ||
      startSeconds < timeSeconds ||
      endSeconds < startSeconds
    ) {
      return undefined;
    }
    const offset = startSeconds - timeSeconds;
    const initial = stateAt(offset);
    if (!initial) {
      return undefined;
    }
    if (startSeconds === endSeconds) {
      return effectiveHazardPhase(object, initial) === "active"
        ? [{ endSeconds, rect, startSeconds }]
        : [];
    }
    const result = advance(endSeconds - startSeconds, initial);
    if (!result) {
      return undefined;
    }
    const contacts = result.segments.flatMap((segment) => {
      const start = startSeconds + segment.start;
      const end = startSeconds + segment.end;
      // Absolute-clock conversion can collapse a rounding-sized slice to zero duration.
      return segment.hazardPhase === "active" && end > start
        ? [{ endSeconds: end, rect, startSeconds: start }]
        : [];
    });
    // A newly active endpoint is lethal even when its preceding interval was nonlethal.
    if (
      effectiveHazardPhase(object, result.state) === "active" &&
      !contacts.some((contact) => contact.endSeconds === endSeconds)
    ) {
      contacts.push({ endSeconds, rect, startSeconds: endSeconds });
    }
    return contacts;
  };
}

export function timedHazardSafe(sampler: TimedHazardSampler, request: TraversalSafety): boolean {
  const { endSeconds, from, startSeconds, to } = request;
  const contacts = sampler(startSeconds, endSeconds);
  if (contacts === undefined) {
    return false;
  }
  const at = (time: number): Rect => {
    const fraction =
      endSeconds === startSeconds ? 0 : (time - startSeconds) / (endSeconds - startSeconds);
    return {
      ...from,
      x: from.x + (to.x - from.x) * fraction,
      y: from.y + (to.y - from.y) * fraction,
    };
  };
  return contacts.every(
    (contact) =>
      !sweptContact(contact.rect, contact.rect, at(contact.startSeconds), at(contact.endSeconds)),
  );
}
