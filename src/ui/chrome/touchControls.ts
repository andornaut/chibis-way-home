import { type AnimationFrame, tagMs } from "@andornaut/game-kit/art/aseprite";

import type { Point, Size } from "../../data/types";
import type { HeldTouch } from "../input/intent";
import type { TouchControl } from "../layout/touchControls";

// Whether a touch holds the button.
export function buttonHeld(control: TouchControl, touches: readonly HeldTouch[]): boolean {
  return touches.some((touch) => touch.role === control);
}

// When a button's press began: kept while it is held, nowMs on the frame it is first held, and
// undefined once released.
export function trackPress(
  nowMs: number,
  held: boolean,
  sinceMs: number | undefined,
): number | undefined {
  if (!held) {
    return undefined;
  }
  return sinceMs ?? nowMs;
}

// The tag a button shows: rest, its press tag for as long as that plays, then held until
// release.
export function controlTag(
  tags: ReadonlyMap<string, readonly AnimationFrame[]>,
  nowMs: number,
  sinceMs: number | undefined,
): string {
  if (sinceMs === undefined) {
    return "rest";
  }
  return nowMs - sinceMs < tagMs(tags, "press") ? "press" : "held";
}

// The top-left of an odd-sized frame whose centre pixel sits on centre.
export function centredAt(centre: Point, frame: Size): Point {
  return { x: centre.x - (frame.width - 1) / 2, y: centre.y - (frame.height - 1) / 2 };
}
