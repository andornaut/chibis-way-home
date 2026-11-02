import type { Point, Rect } from "../data/types";
import type { BehaviourState } from "../rules/behaviour";

export function bossWarning(
  clearance: number,
  state: Pick<BehaviourState, "active" | "activeAttack"> | undefined,
  frame: Rect,
): (Point & { readonly radius: number }) | undefined {
  if (!state?.active || state.activeAttack?.phase !== "tell") {
    return undefined;
  }
  return {
    radius: Math.ceil(Math.hypot(frame.width, frame.height) / 2) + clearance,
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
  };
}
