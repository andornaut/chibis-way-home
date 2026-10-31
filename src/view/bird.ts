import birdSheet from "../../public/art/sprites/bird.json";
import type { BirdTuning, Point, Size } from "../data/types";
import { birdFrameRect, type BirdState } from "../rules/bird";
import { sheetFrameSize } from "./aseprite";

// Her drawn frame's size, from art's bird sheet: every frame is this big.
export const BIRD_FRAME: Size = sheetFrameSize(birdSheet);

export type BirdTag = "flutter" | "idle" | "jump" | "land" | "walk";

// The tag she shows, and how long she has shown it as of this step.
export interface BirdPose {
  readonly ms: number;
  readonly tag: BirdTag;
}

export const startPose: BirdPose = { ms: 0, tag: "flutter" };

// Her pose after one step of stepMs from before to after. Rising, she jumps; falling, she
// flutters; on the step she lands, land starts and plays for landMs; on the ground she walks
// while moving and idles while still.
export function stepPose(
  landMs: number,
  stepMs: number,
  before: BirdState,
  after: BirdState,
  pose: BirdPose,
): BirdPose {
  const ms = pose.ms + stepMs;
  let tag: BirdTag;
  if (!after.grounded) {
    tag = after.vy < 0 ? "jump" : "flutter";
  } else if (!before.grounded) {
    tag = "land";
  } else if (pose.tag === "land" && ms < landMs) {
    tag = "land";
  } else {
    tag = after.vx === 0 ? "idle" : "walk";
  }
  return tag === pose.tag ? { ms, tag } : { ms: 0, tag };
}

// The whole-pixel top-left of her frame (birdFrameRect).
export function birdFrameAt(tuning: BirdTuning, frame: Size, bird: BirdState): Point {
  const { x, y } = birdFrameRect(tuning, frame, bird);
  return { x, y };
}
