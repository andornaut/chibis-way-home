import type { Point, TouchTuning } from "../../data/types";
import { pressedArea } from "../layout/hitAreas";
import { TOUCH_PRESS_AREAS, type TouchControl } from "../layout/touchControls";
import { MOUSE_KEYS } from "./mouseMovement";

// What the player is asking for, from the keyboard and the touch controls together.
export interface Intent {
  readonly jump: boolean;
  readonly move: -1 | 0 | 1;
  readonly use: boolean;
}

const LEFT_KEYS = ["ArrowLeft", "KeyA", MOUSE_KEYS.left];
const RIGHT_KEYS = ["ArrowRight", "KeyD", MOUSE_KEYS.right];
const JUMP_KEYS = ["ArrowUp", "KeyW", "Space"];
const USE_KEYS = ["Enter", "KeyE", "KeyF"];

// KeyboardEvent codes and eligible mouse-button controls held. Left and right together cancel.
export function keyIntent(held: ReadonlySet<string>): Intent {
  const left = LEFT_KEYS.some((key) => held.has(key));
  const right = RIGHT_KEYS.some((key) => held.has(key));
  return {
    jump: JUMP_KEYS.some((key) => held.has(key)),
    move: left === right ? 0 : left ? -1 : 1,
    use: USE_KEYS.some((key) => held.has(key)),
  };
}

// What a touch does: hold the button it starts on, or else move her.
export type TouchRole = TouchControl | "move";

// The role a touch starting at point takes. It keeps that role until it lifts.
export function touchRoleAt(point: Point): TouchRole {
  return pressedArea(TOUCH_PRESS_AREAS, point) ?? "move";
}

// A move touch's direction from its x offset to where it started.
export function moveFromOffset(tuning: TouchTuning, dx: number): -1 | 0 | 1 {
  if (dx > tuning.moveDeadZone) {
    return 1;
  }
  return dx < -tuning.moveDeadZone ? -1 : 0;
}

// Each held touch, in the order they started: its role, the point it started at (where the move
// hint centres on a drag) and its x now.
export interface HeldTouch {
  readonly role: TouchRole;
  readonly startX: number;
  readonly startY: number;
  readonly x: number;
}

// Of two move touches, the later one moves her.
export function touchIntent(tuning: TouchTuning, touches: readonly HeldTouch[]): Intent {
  const mover = touches.filter((touch) => touch.role === "move").at(-1);
  return {
    jump: touches.some((touch) => touch.role === "jump"),
    move: mover ? moveFromOffset(tuning, mover.x - mover.startX) : 0,
    use: touches.some((touch) => touch.role === "use"),
  };
}

// Either source asking counts. Opposite moves cancel.
export function combineIntents(a: Intent, b: Intent): Intent {
  const sum = a.move + b.move;
  return {
    jump: a.jump || b.jump,
    move: sum > 0 ? 1 : sum < 0 ? -1 : 0,
    use: a.use || b.use,
  };
}
