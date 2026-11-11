import { EDGE } from "../core";
import type { BirdTuning, ObjectLayout } from "../data/types";
import type { BirdState } from "./bird";

// The body left x range that keeps an object inside Chibi's screen: its pursuit's screen width
// about his current centre, inset by its margin.
export interface ScreenBand {
  readonly high: number;
  readonly low: number;
}

// Chibi's screen for this object, or undefined when its plan names none.
export function screenBand(
  tuning: BirdTuning,
  target: Pick<BirdState, "x">,
  object: ObjectLayout,
): ScreenBand | undefined {
  const screen = object.behaviour?.pursuit?.screen;
  if (!screen) {
    return undefined;
  }
  const centre = target.x + tuning.width / 2;
  const half = screen.width / 2 - screen.margin;
  return { high: centre + half - object.width, low: centre - half };
}

export function insideScreen(band: ScreenBand, x: number): boolean {
  return x >= band.low - EDGE && x <= band.high + EDGE;
}

// The body left x range a move from `from` may end in: the screen, or from a body already
// outside it, anywhere no farther out.
export function screenReach(band: ScreenBand | undefined, from: number): ScreenBand | undefined {
  return band && { high: Math.max(band.high, from), low: Math.min(band.low, from) };
}

// The nearest x to `to` that a move from `from` may end at.
export function screenClamp(band: ScreenBand | undefined, from: number, to: number): number {
  const reach = screenReach(band, from);
  return reach ? Math.min(reach.high, Math.max(reach.low, to)) : to;
}
