import { describe, expect, it } from "vitest";

import { CONTROL_BOTTOM, CONTROL_EDGE, CONTROL_SIDE } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { Point } from "../../data/types";
import { touchRoleAt } from "../input/intent";
import { PAUSE_BUTTON } from "./pauseCard";
import { bottomShift, playView, shifted, topShift } from "./playView";
import { stageProgressRect } from "./stageProgress";
import { MOVE_HINT, TOUCH_CONTROLS } from "./touchControls";

// Canvases the play area makes at the game's scale: the game's own size, wider, and taller.
const CASES: [string, { height: number; width: number }][] = [
  ["the game's own size", SCREEN],
  ["a wider canvas", { height: SCREEN.height, width: SCREEN.width + 101 }],
  ["a taller canvas", { height: SCREEN.height + 40, width: SCREEN.width }],
];

describe("playView", () => {
  it.each(CASES)("in %s puts the view at the top, centred across", (_, canvas) => {
    const view = playView(canvas);
    const left = view.x;
    const right = canvas.width - (view.x + view.width);
    expect({
      centred: Math.abs(left - right) <= 1,
      size: { height: view.height, width: view.width },
      top: view.y,
    }).toEqual({ centred: true, size: SCREEN, top: 0 });
  });
});

// A frame's drawn rect: art draws each control 1px inside its frame.
const drawn = (frame: { height: number; width: number; x: number; y: number }, shift: Point) => ({
  bottom: frame.y + shift.y + frame.height - 2,
  left: frame.x + shift.x + 1,
  right: frame.x + shift.x + frame.width - 2,
  top: frame.y + shift.y + 1,
});

describe("the controls' edges", () => {
  // In each canvas: Jump's ring CONTROL_SIDE in from the view's right and the hint's from its
  // left, both CONTROL_BOTTOM above the canvas's bottom, and the pause disc CONTROL_EDGE in from
  // the view's top and left.
  it.each(CASES)("in %s sit their set distances from the view and the canvas", (_, canvas) => {
    const view = playView(canvas);
    const jump = drawn(TOUCH_CONTROLS.jump.art, bottomShift(canvas));
    const hint = drawn(MOVE_HINT.art, bottomShift(canvas));
    const pause = drawn(PAUSE_BUTTON.art, topShift(canvas));
    const bottom = Math.floor(canvas.height) - 1;
    expect({
      hintBottom: bottom - hint.bottom,
      hintLeft: hint.left - view.x,
      jumpBottom: bottom - jump.bottom,
      jumpRight: view.x + view.width - 1 - jump.right,
      pauseLeft: pause.left - view.x,
      pauseTop: pause.top - view.y,
    }).toEqual({
      hintBottom: CONTROL_BOTTOM,
      hintLeft: CONTROL_SIDE,
      jumpBottom: CONTROL_BOTTOM,
      jumpRight: CONTROL_SIDE,
      pauseLeft: CONTROL_EDGE,
      pauseTop: CONTROL_EDGE,
    });
  });

  it.each(CASES)("in %s take a press on Jump once moved back by the shift", (_, canvas) => {
    const shift = bottomShift(canvas);
    const jump = shifted(shift, TOUCH_CONTROLS.jump.centre);
    expect(touchRoleAt(shifted(shift, jump, -1))).toBe("jump");
  });
});

describe("the stage progress strip", () => {
  it.each(CASES)("in %s follows the canvas bottom without changing the game view", (_, canvas) => {
    const rect = stageProgressRect(canvas);
    const view = playView(canvas);
    expect(rect.width).toBe(view.width);
    expect(rect.x).toBe(view.x);
    expect(rect.y + rect.height).toBe(Math.floor(canvas.height));
    expect(rect.height).toBe(4);
  });
});
