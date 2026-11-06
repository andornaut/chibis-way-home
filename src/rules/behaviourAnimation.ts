import { contactFrameAt } from "../core";
import type { ObjectLayout, Point } from "../data/types";
import type { BehaviourSegment, BehaviourState } from "./behaviour";

export function syncAnimation(
  object: ObjectLayout,
  state: BehaviourState,
  timeSeconds?: number,
): BehaviourState {
  if (!object.contact) {
    return state;
  }
  // A walk home plays the engaged chase's pose; a chase or pace pause plays idle.
  const key = state.idleWatchdog?.recovery
    ? object.behaviour!.idleWatchdog!.resume
    : state.pursuit?.home && state.pursuit.settled && object.behaviour?.scorer
      ? object.behaviour.scorer.engaged
      : state.stateKey;
  const preparation = state.active && state.traversal?.preparation;
  const takeoff = preparation && object.behaviour?.takeoffAnimation;
  const resting = state.chasePause !== undefined || (state.mapPursuit?.paceHoldSeconds ?? 0) > 0;
  const tag = state.active
    ? (takeoff ??
      (resting ? object.animations.idle : undefined) ??
      object.behaviour?.states[key]?.animation ??
      state.animationTag ??
      object.animations.idle)
    : (object.behaviour?.inactiveAnimation ?? object.animations.idle);
  if (!tag || !object.contact.tags[tag]) {
    throw new Error(`Missing silhouette animation for ${object.art}`);
  }
  const seconds =
    takeoff && timeSeconds !== undefined
      ? Math.max(0, timeSeconds - preparation.startedAtSeconds)
      : undefined;
  if (state.animationTag === tag && state.animationSeconds !== undefined && seconds === undefined) {
    return state;
  }
  return {
    ...state,
    animationSeconds: seconds ?? (state.animationTag === tag ? (state.animationSeconds ?? 0) : 0),
    animationTag: tag,
  };
}

// Splits timed legs at animation frame boundaries, facing each leg's travel unless held.
export function animateSegments(
  object: ObjectLayout,
  seconds: number,
  state: BehaviourState,
  legs: readonly {
    readonly start: number;
    readonly end: number;
    readonly from: Point;
    readonly to: Point;
  }[],
  timeSeconds?: number,
  faceMovement = true,
): { readonly segments: readonly BehaviourSegment[]; readonly state: BehaviourState } {
  const segments: BehaviourSegment[] = [];
  let next = syncAnimation(object, { ...state, axis: "x" }, timeSeconds);
  for (const leg of legs) {
    let time = leg.start;
    const direction = leg.to.x - leg.from.x;
    if (faceMovement && direction !== 0) {
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
