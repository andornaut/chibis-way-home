import { describe, expect, it } from "vitest";

import { CONTROL_BOTTOM, CONTROL_EDGE, CONTROL_SIDE, SKILL_HUD } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { Point, Rect } from "../../data/types";
import { SKILL_IDS } from "../../progress";
import { touchRoleAt } from "../input/intent";
import { PAUSE_BUTTON } from "./pauseCard";
import { playView, shifted, viewShift } from "./playView";
import { skillButton, skillHud } from "./skillHud";
import { stageProgressRect } from "./stageProgress";
import { MOVE_HINT, TOUCH_CONTROLS } from "./touchControls";

// Canvases, in base pixels, that the play area makes at the game's scale (Scale.EXPAND): the
// game's own 2:1, wider (a 2.16:1 phone at 844x390 and a 2.22:1 one at 866x390), and taller
// (4:3 and 16:10).
const CASES: [string, { height: number; width: number }][] = [
  ["2:1", SCREEN],
  ["2.16:1", { height: SCREEN.height, width: 779 }],
  ["2.22:1", { height: SCREEN.height, width: 799 }],
  ["16:10", { height: 450, width: SCREEN.width }],
  ["4:3", { height: 540, width: SCREEN.width }],
];

describe("playView", () => {
  it.each(CASES)("in a %s canvas puts the view at the top, centred across", (_, canvas) => {
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
const drawn = (frame: Rect, shift: Point) => ({
  bottom: frame.y + shift.y + frame.height - 2,
  left: frame.x + shift.x + 1,
  right: frame.x + shift.x + frame.width - 2,
  top: frame.y + shift.y + 1,
});

describe("the controls' edges", () => {
  // In each canvas, measured from the view's edges, never the canvas's: Jump's ring CONTROL_SIDE
  // in from the right and the move hint's from the left, both CONTROL_BOTTOM above the bottom;
  // the pause disc CONTROL_EDGE in from the top and left, and the skill HUD's targets from the
  // top and right.
  it.each(CASES)("in a %s canvas sit their set distances from the view's edges", (_, canvas) => {
    const view = playView(canvas);
    const shift = viewShift(canvas);
    const bottom = view.y + view.height - 1;
    const right = view.x + view.width - 1;
    const jump = drawn(TOUCH_CONTROLS.jump.art, shift);
    const hint = drawn(MOVE_HINT.art, shift);
    const pause = drawn(PAUSE_BUTTON.art, shift);
    const hud = [...skillHud(SKILL_IDS).values()].map((at) => skillButton(shifted(shift, at)).hit);
    const last = hud[hud.length - 1]!;
    expect({
      hintBottom: bottom - hint.bottom,
      hintLeft: hint.left - view.x,
      hudRight: right - (last.x + last.width - 1),
      hudTop: Math.min(...hud.map((hit) => hit.y)) - view.y,
      jumpBottom: bottom - jump.bottom,
      jumpRight: right - jump.right,
      pauseLeft: pause.left - view.x,
      pauseTop: pause.top - view.y,
    }).toEqual({
      hintBottom: CONTROL_BOTTOM,
      hintLeft: CONTROL_SIDE,
      hudRight: SKILL_HUD.inset,
      hudTop: SKILL_HUD.inset,
      jumpBottom: CONTROL_BOTTOM,
      jumpRight: CONTROL_SIDE,
      pauseLeft: CONTROL_EDGE,
      pauseTop: CONTROL_EDGE,
    });
  });

  it.each(CASES)("in a %s canvas are all drawn inside the view", (_, canvas) => {
    const view = playView(canvas);
    const shift = viewShift(canvas);
    const frames = [
      TOUCH_CONTROLS.jump.art,
      TOUCH_CONTROLS.use.art,
      MOVE_HINT.art,
      PAUSE_BUTTON.art,
      ...[...skillHud(SKILL_IDS).values()].map((at) => skillButton(at).hit),
    ];
    const outside = frames
      .map((frame) => ({ ...frame, ...shifted(shift, frame) }))
      .filter(
        (rect) =>
          rect.x < view.x ||
          rect.y < view.y ||
          rect.x + rect.width > view.x + view.width ||
          rect.y + rect.height > view.y + view.height,
      );
    expect(outside).toEqual([]);
  });

  it.each(CASES)("in a %s canvas take a press on Use and Jump where drawn", (_, canvas) => {
    const shift = viewShift(canvas);
    const roles = (["jump", "use"] as const).map((control) =>
      touchRoleAt(shifted(shift, shifted(shift, TOUCH_CONTROLS[control].centre), -1)),
    );
    expect(roles).toEqual(["jump", "use"]);
  });
});

describe("the stage progress strip", () => {
  it.each(CASES)("in a %s canvas follows the canvas bottom under the view", (_, canvas) => {
    const rect = stageProgressRect(canvas);
    const view = playView(canvas);
    expect(rect.width).toBe(view.width);
    expect(rect.x).toBe(view.x);
    expect(rect.y + rect.height).toBe(Math.floor(canvas.height));
    expect(rect.height).toBe(4);
  });
});
