import { type AsepriteSheet, sheetTags, tagMs } from "@andornaut/game-kit/art/aseprite";

import birdSheet from "../../public/art/sprites/bird.json";
import { EDGE } from "../core";
import type { BirdTuning, Point, Size } from "../data/types";
import { birdFrameRect, type BirdState } from "../rules/bird";
import { airJumpStarted } from "./airJumpCue";

type BirdTag = "dash" | "double-jump" | "flutter" | "idle" | "jump" | "land" | "walk";

// The tag he shows, and how long he has shown it as of this step.
export interface BirdPose {
  readonly airJumpRemainingMs?: number;
  readonly ms: number;
  readonly tag: BirdTag;
}

export const startPose: BirdPose = { ms: 0, tag: "flutter" };

// His pose after one step of stepMs from before to after. An active dash takes priority.
// Rising, he jumps; falling, he
// flutters; on the step he lands, land starts and plays for landMs; on the ground he walks
// while moving and idles while still.
export function stepPose(
  landMs: number,
  stepMs: number,
  before: BirdState,
  after: BirdState,
  pose: BirdPose,
): BirdPose {
  const started = airJumpStarted(before, after);
  const duration = started ? tagMs(sheetTags(birdSheet as AsepriteSheet), "double-jump") : 0;
  if (started && duration <= 0) {
    throw new Error("Missing bird double-jump animation");
  }
  const remaining = after.grounded
    ? 0
    : started
      ? duration
      : Math.max(0, (pose.airJumpRemainingMs ?? 0) - stepMs);
  const ms = pose.ms + stepMs;
  let tag: BirdTag;
  if ((after.dash?.remainingSeconds ?? 0) > EDGE) {
    tag = "dash";
  } else if (remaining > 0) {
    tag = "double-jump";
  } else if (!after.grounded) {
    tag = after.vy < 0 ? "jump" : "flutter";
  } else if (!before.grounded) {
    tag = "land";
  } else if (pose.tag === "land" && ms < landMs) {
    tag = "land";
  } else {
    tag = after.vx === 0 ? "idle" : "walk";
  }
  return {
    ...(remaining > 0 && { airJumpRemainingMs: remaining }),
    ms: tag === pose.tag && !(started && tag === "double-jump") ? ms : 0,
    tag,
  };
}

// The whole-pixel top-left of his frame (birdFrameRect).
export function birdFrameAt(tuning: BirdTuning, frame: Size, bird: BirdState): Point {
  const { x, y } = birdFrameRect(tuning, frame, bird);
  return { x, y };
}

export function clearAirJumpPose(bird: BirdState, pose: BirdPose): BirdPose {
  return pose.airJumpRemainingMs === undefined
    ? pose
    : stepPose(0, 0, bird, bird, { ms: pose.ms, tag: pose.tag });
}
