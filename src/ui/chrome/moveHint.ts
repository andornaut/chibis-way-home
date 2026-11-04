import type { Point, TouchTuning } from "../../data/types";
import { type HeldTouch, moveFromOffset } from "../input/intent";

// How the move hint shows: the ring's centre and tag, and the knob's centre and tag.
export interface MoveHintView {
  readonly centre: Point;
  readonly knob: Point;
  readonly knobTag: "held" | "rest";
  readonly ringTag: "held-left" | "held-right" | "rest";
}

// The knob's offset from the ring's centre for a drag dx across: the drag's way, left or right
// only as she moves, at most reach pixels, in whole pixels.
export function knobOffset(reach: number, dx: number): number {
  return Math.round(Math.max(-reach, Math.min(reach, dx)));
}

// The move hint for the held touches. At rest it sits on rest. While a touch moves her (the
// latest move touch, as touchIntent reads), its ring is centred on where that drag began, held
// left or right the way she moves, and its knob is offset left or right the way the drag goes
// (knobOffset).
export function moveHintView(
  tuning: TouchTuning,
  reach: number,
  rest: Point,
  touches: readonly HeldTouch[],
): MoveHintView {
  const mover = touches.filter((touch) => touch.role === "move").at(-1);
  if (mover === undefined) {
    return { centre: rest, knob: rest, knobTag: "rest", ringTag: "rest" };
  }
  const centre = { x: Math.round(mover.startX), y: Math.round(mover.startY) };
  const dx = mover.x - mover.startX;
  const direction = moveFromOffset(tuning, dx);
  return {
    centre,
    knob: { x: centre.x + knobOffset(reach, dx), y: centre.y },
    knobTag: "held",
    ringTag: direction < 0 ? "held-left" : direction > 0 ? "held-right" : "rest",
  };
}
