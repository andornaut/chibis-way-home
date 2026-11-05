import { rectsOverlap } from "@andornaut/game-kit/rect";

import { collisionCandidates } from "../core";
import type { BehaviourPursuitIntent, BirdTuning, ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourWorld } from "./behaviourReach";
import { birdBox, type BirdState } from "./bird";

export interface PursuitIntentState {
  readonly target: Rect;
  readonly travelDirection: -1 | 1;
  readonly facing: -1 | 1;
  readonly offset: number;
  readonly remainingSeconds: number;
}
export function capturePursuitIntent(
  world: BehaviourWorld,
  config: BehaviourPursuitIntent,
  tuning: BirdTuning,
  bird: BirdState,
  decision: number,
  facing: -1 | 1,
  object: ObjectLayout,
  at: Point,
): PursuitIntentState {
  if (!world.decisions) {
    throw new Error("Sampled pursuit requires an object-local decision context");
  }
  const random = world.decisions(`pursuit-intent:${decision}`);
  const between = ({ max, min }: { readonly min: number; readonly max: number }) =>
    min + random() * (max - min);
  const remainingSeconds = between(config.decisionSeconds);
  const offset = between(config.offset);
  const target = { ...birdBox(tuning, bird), x: bird.x + offset };
  const dx = target.x + target.width / 2 - at.x - object.width / 2;
  return {
    facing: dx === 0 ? facing : dx < 0 ? -1 : 1,
    offset,
    remainingSeconds,
    target,
    travelDirection: bird.vx === 0 ? bird.facing : bird.vx < 0 ? -1 : 1,
  };
}
export function advancePursuitIntent(
  seconds: number,
  state: PursuitIntentState,
): PursuitIntentState {
  return {
    ...state,
    remainingSeconds: Math.max(0, state.remainingSeconds - seconds),
  };
}

export function safeIntentHover(
  world: BehaviourWorld,
  seconds: number,
  object: ObjectLayout,
  at: Point,
): boolean {
  const frame = world.traversalFrame,
    leash = object.behaviour!.pursuit!.distance;
  const body = { ...at, height: object.height, width: object.width };
  if (
    !frame ||
    at.x < Math.max(frame.bounds.x, object.origin.x - leash) ||
    at.x + object.width >
      Math.min(frame.bounds.x + frame.bounds.width, object.origin.x + leash + object.width) ||
    at.y < frame.bounds.y ||
    at.y + object.height > frame.bounds.y + frame.bounds.height ||
    collisionCandidates(world.solids, body).some((rect) => rectsOverlap(body, rect))
  ) {
    return false;
  }
  for (const platform of frame.platforms) {
    if (platform.owner === object) {
      continue;
    }
    for (const leg of platform.segments ?? [{ from: platform.before, to: platform.after }]) {
      const swept = {
        height: leg.from.height + Math.abs(leg.to.y - leg.from.y),
        width: leg.from.width + Math.abs(leg.to.x - leg.from.x),
        x: Math.min(leg.from.x, leg.to.x),
        y: Math.min(leg.from.y, leg.to.y),
      };
      if (rectsOverlap(body, swept)) {
        return false;
      }
    }
  }
  return !(world.hazards ?? []).some(({ boundsAt, owner, rect }) => {
    if (owner === object) {
      return false;
    }
    if (rectsOverlap(body, rect)) {
      return true;
    }
    const dynamic =
      owner.orbit !== undefined ||
      owner.behaviour !== undefined ||
      owner.motion.algorithm !== "static" ||
      owner.reaction.kind !== "none";
    const future = dynamic ? boundsAt?.(frame.timeSeconds + seconds) : rect;
    return !future || !Object.values(future).every(Number.isFinite) || rectsOverlap(body, future);
  });
}
