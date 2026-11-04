import { describe, expect, it } from "vitest";

import { TOUCH } from "../../data/touch";
import { TOUCH_CIRCLE_RADIUS } from "../layout/hitAreas";
import { MOVE_HINT, TOUCH_CONTROLS } from "../layout/touchControls";
import {
  combineIntents,
  type HeldTouch,
  type Intent,
  keyIntent,
  moveFromOffset,
  touchIntent,
  touchRoleAt,
} from "./intent";

const NONE: Intent = { jump: false, move: 0, use: false };

describe("keyIntent", () => {
  it.each([
    [[], NONE],
    [["ArrowLeft"], { ...NONE, move: -1 }],
    [["KeyA"], { ...NONE, move: -1 }],
    [["ArrowRight"], { ...NONE, move: 1 }],
    [["KeyD"], { ...NONE, move: 1 }],
    [["KeyA", "KeyD"], NONE],
    [["Space"], { ...NONE, jump: true }],
    [["ArrowUp"], { ...NONE, jump: true }],
    [["KeyW"], { ...NONE, jump: true }],
    [["KeyE"], { ...NONE, use: true }],
    [["KeyF"], { ...NONE, use: true }],
    [["Enter"], { ...NONE, use: true }],
    [["MouseLeft"], { ...NONE, move: -1 }],
    [["MouseRight"], { ...NONE, move: 1 }],
    [["MouseLeft", "MouseRight"], NONE],
    [["KeyA", "MouseRight"], NONE],
    [["KeyD", "MouseLeft"], NONE],
    [["ArrowRight", "Space"], { ...NONE, jump: true, move: 1 }],
  ])("maps %j", (keys, intent) => {
    expect(keyIntent(new Set(keys))).toEqual(intent);
  });
});

describe("touchRoleAt", () => {
  const { jump, use } = TOUCH_CONTROLS;
  // A point at distance from centre, toward the left.
  const left = (centre: { x: number; y: number }, distance: number) => ({
    x: centre.x - distance,
    y: centre.y,
  });
  // A button's press radius: its clear circle and the move hint's radius beyond it.
  const reach = TOUCH_CIRCLE_RADIUS + (MOVE_HINT.art.width - 1) / 2;
  it.each<[string, { x: number; y: number }, string]>([
    ["Use's centre", use.centre, "use"],
    ["inside Use's area", left(use.centre, reach - 0.1), "use"],
    ["outside Use's area", left(use.centre, reach + 0.1), "move"],
    ["Jump's centre", jump.centre, "jump"],
    ["inside Jump's area", left(jump.centre, reach - 0.1), "jump"],
    ["outside Jump's area", left(jump.centre, reach + 0.1), "move"],
    [
      "just on Use's side of the midway line",
      { x: (use.centre.x + jump.centre.x) / 2 - 0.1, y: (use.centre.y + jump.centre.y) / 2 },
      "use",
    ],
    [
      "just on Jump's side of the midway line",
      { x: (use.centre.x + jump.centre.x) / 2 + 0.1, y: (use.centre.y + jump.centre.y) / 2 },
      "jump",
    ],
    ["the screen's bottom-right corner", { x: 719, y: 359 }, "jump"],
    ["the open middle", { x: 320, y: 180 }, "move"],
  ])("takes %s as %s", (_, point, role) => {
    expect(touchRoleAt(point)).toBe(role);
  });
});

describe("moveFromOffset", () => {
  const dead = TOUCH.moveDeadZone;
  it.each([
    [0, 0],
    [dead, 0],
    [-dead, 0],
    [dead + 1, 1],
    [-dead - 1, -1],
  ])("moves %i as %i", (dx, move) => {
    expect(moveFromOffset(TOUCH, dx)).toBe(move);
  });
});

describe("touchIntent", () => {
  const beyond = TOUCH.moveDeadZone + 1;
  const move = (startX: number, x: number): HeldTouch => ({
    role: "move",
    startX,
    startY: 200,
    x,
  });
  const JUMP: HeldTouch = { role: "jump", startX: 600, startY: 200, x: 600 };
  it.each([
    ["nothing", [], NONE],
    ["a drag right", [move(300, 300 + beyond)], { ...NONE, move: 1 }],
    ["a drag left", [move(100, 100 - beyond)], { ...NONE, move: -1 }],
    ["a drag back to its start", [move(300, 300)], NONE],
    ["a drag left with Jump", [move(300, 300 - beyond), JUMP], { ...NONE, jump: true, move: -1 }],
    [
      "the later of two moves",
      [move(100, 100 - beyond), move(400, 400 + beyond)],
      { ...NONE, move: 1 },
    ],
    ["the later move, still", [move(100, 100 - beyond), move(400, 400)], NONE],
    ["Use", [{ role: "use", startX: 528, startY: 200, x: 528 }], { ...NONE, use: true }],
  ] as const)("reads %s", (_, touches, intent) => {
    expect(touchIntent(TOUCH, touches)).toEqual(intent);
  });
});

describe("combineIntents", () => {
  it.each([
    [{ ...NONE, move: 1 }, NONE, { ...NONE, move: 1 }],
    [{ ...NONE, move: 1 }, { ...NONE, move: -1 }, NONE],
    [
      { ...NONE, move: -1 },
      { ...NONE, jump: true, move: -1 },
      { ...NONE, jump: true, move: -1 },
    ],
    [{ ...NONE, use: true }, NONE, { ...NONE, use: true }],
  ] as const)("combines %j and %j", (a, b, intent) => {
    expect(combineIntents(a, b)).toEqual(intent);
  });
});
