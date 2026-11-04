import { rectsOverlap } from "@andornaut/game-kit/rect";

import { BOSS_REMOVAL_SECONDS } from "../data/behaviours";
import type { AreaLayout, ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourState, BehaviourStep } from "./behaviour";
import { contactBox } from "./behaviourTrack";

// A boss: a pursuing hazard. It dies as Chibi does, on a red hazard or below the level.
export function isBoss(object: ObjectLayout): boolean {
  return object.collision === "hazard" && object.behaviour?.pursuit !== undefined;
}

// How a live boss at a point dies, if it does: below the level, or touching a red hazard.
export function bossDeath(
  area: AreaLayout,
  hazards: readonly Rect[],
  object: ObjectLayout,
  at: Point,
  state: BehaviourState,
): "fall" | "hazard" | undefined {
  if (!isBoss(object) || state.defeat) {
    return undefined;
  }
  const box = contactBox(object, at, state.facing, state.axis);
  return box.y > area.height
    ? "fall"
    : hazards.some((rect) => rectsOverlap(box, rect))
      ? "hazard"
      : undefined;
}

// A dead boss: its pursuit ends without an escape and its removal starts.
export function defeatBoss(state: BehaviourState, seconds = 0): BehaviourState {
  const next: BehaviourState = { ...state, defeat: { seconds } };
  delete (next as { pursuit?: BehaviourState["pursuit"] }).pursuit;
  delete (next as { activeAttack?: BehaviourState["activeAttack"] }).activeAttack;
  return next;
}

// A boss that died earlier in the attempt, met again through an area link, already removed.
export const removedBoss = (state: BehaviourState): BehaviourState =>
  defeatBoss(state, BOSS_REMOVAL_SECONDS);

// A dead boss holds still while its removal plays, then stays removed.
export function holdDefeated(seconds: number, at: Point, state: BehaviourState): BehaviourStep {
  return {
    actions: [],
    at,
    segments: [{ end: seconds, facing: state.facing, from: at, start: 0, to: at }],
    state: {
      ...state,
      defeat: { seconds: Math.min(BOSS_REMOVAL_SECONDS, state.defeat!.seconds + seconds) },
    },
  };
}

// The removal's progress from 0 to 1; 1 once the boss is gone.
export function removalProgress(state: BehaviourState | undefined): number | undefined {
  return state?.defeat ? Math.min(1, state.defeat.seconds / BOSS_REMOVAL_SECONDS) : undefined;
}
