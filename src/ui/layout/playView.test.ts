import { MAX_RENDER_SCALE, renderFit, renderScale } from "@andornaut/game-kit/view/renderScale";
import { describe, expect, it } from "vitest";

import { CONTROL_BOTTOM, CONTROL_SIDE, HUD_EDGE } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { Point, Rect, Size } from "../../data/types";
import { SKILL_IDS } from "../../progress";
import { touchRoleAt } from "../input/intent";
import { PAUSE_BUTTON } from "./pauseCard";
import { canvasSize, playView, shifted, viewShift } from "./playView";
import { SKILL_BUTTON, skillButton, skillHud } from "./skillHud";
import { stageProgressRect } from "./stageProgress";
import { MOVE_HINT, TOUCH_CONTROLS } from "./touchControls";

const fitAt = (css: Size, devicePixelRatio: number) =>
  renderFit(SCREEN, renderScale(MAX_RENDER_SCALE, devicePixelRatio), css);

// Play areas, in CSS pixels, at their device pixel ratios: the game's own 2:1, phones wider than
// it (2.16:1 at 844x390 and 2.22:1 at 866x390), and areas taller than it (16:10 and 4:3).
const CASES: [string, Size, number][] = [
  ["2:1 at DPR 1", SCREEN, 1],
  ["2:1 desktop at DPR 1", { height: 640, width: 1280 }, 1],
  ["2.16:1 at DPR 2", { height: 390, width: 844 }, 2],
  ["2.16:1 at DPR 3", { height: 390, width: 844 }, 3],
  ["2.22:1 at DPR 2.625", { height: 390, width: 866 }, 2.625],
  ["16:10 at DPR 1.5", { height: 450, width: SCREEN.width }, 1.5],
  ["4:3 at DPR 2", { height: 768, width: 1024 }, 2],
];

// Positions in base pixels can be fractional; whole to a billionth is whole.
const near = (value: number) => Math.round(value * 1e9) / 1e9;

// The view in base pixels: SCREEN, moved with the controls.
const logicalView = (shift: Point): Rect => ({ ...SCREEN, ...shift });

describe("the render fit", () => {
  // Device pixels per CSS pixel are capped at MAX_RENDER_SCALE; the zoom is that times the fit.
  it.each([
    [1, { height: 640, width: 1280 }],
    [2, { height: 390, width: 844 }],
    [3, { height: 390, width: 844 }],
  ])("at DPR %d backs a %o area in device pixels and zooms the view to fit", (dpr, css) => {
    const r = Math.min(dpr, MAX_RENDER_SCALE);
    const fit = fitAt(css, dpr);
    const scale = Math.min(css.width / SCREEN.width, css.height / SCREEN.height);
    expect(fit).toEqual({
      backing: { height: Math.round(css.height * r), width: Math.round(css.width * r) },
      fit: scale,
      r,
      view: {
        height: Math.round(SCREEN.height * r * scale),
        width: Math.round(SCREEN.width * r * scale),
      },
      zoom: r * scale,
    });
  });
});

describe("playView", () => {
  it.each(CASES)("in a %s area puts the view at the top, centred across", (_, css, dpr) => {
    const fit = fitAt(css, dpr);
    const view = playView(fit);
    const left = view.x;
    const right = fit.backing.width - (view.x + view.width);
    expect({
      centred: Math.abs(left - right) <= 1,
      size: { height: view.height, width: view.width },
      top: view.y,
      whole: [view.x, view.y, view.width, view.height].every(Number.isInteger),
    }).toEqual({ centred: true, size: fit.view, top: 0, whole: true });
  });

  it.each(CASES)("in a %s area fills the canvas along its short side", (_, css, dpr) => {
    const fit = fitAt(css, dpr);
    const view = playView(fit);
    const wide = css.width / css.height >= SCREEN.width / SCREEN.height;
    expect(wide ? view.height : view.width).toBe(wide ? fit.backing.height : fit.backing.width);
  });

  it.each(CASES)("in a %s area shifts the controls by whole device pixels", (_, css, dpr) => {
    const fit = fitAt(css, dpr);
    const shift = viewShift(fit);
    expect(near(shift.x * fit.zoom)).toBe(playView(fit).x);
    expect(near(canvasSize(fit).width * fit.zoom)).toBe(fit.backing.width);
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
  // the pause disc HUD_EDGE in from the top and left, and the skill HUD's discs from the top and
  // right.
  it.each(CASES)("in a %s area sit their set distances from the view's edges", (_, css, dpr) => {
    const shift = viewShift(fitAt(css, dpr));
    const view = logicalView(shift);
    const bottom = view.y + view.height - 1;
    const right = view.x + view.width - 1;
    const jump = drawn(TOUCH_CONTROLS.jump.art, shift);
    const hint = drawn(MOVE_HINT.art, shift);
    const pause = drawn(PAUSE_BUTTON.art, shift);
    const hud = [...skillHud(SKILL_IDS).values()].map((at) => skillButton(shifted(shift, at)).disc);
    const last = hud[hud.length - 1]!;
    expect({
      hintBottom: near(bottom - hint.bottom),
      hintLeft: near(hint.left - view.x),
      hudRight: near(right - (last.x + SKILL_BUTTON.disc - 1)),
      hudTop: near(Math.min(...hud.map((disc) => disc.y)) - view.y),
      jumpBottom: near(bottom - jump.bottom),
      jumpRight: near(right - jump.right),
      pauseLeft: near(pause.left - view.x),
      pauseTop: near(pause.top - view.y),
    }).toEqual({
      hintBottom: CONTROL_BOTTOM,
      hintLeft: CONTROL_SIDE,
      hudRight: HUD_EDGE,
      hudTop: HUD_EDGE,
      jumpBottom: CONTROL_BOTTOM,
      jumpRight: CONTROL_SIDE,
      pauseLeft: HUD_EDGE,
      pauseTop: HUD_EDGE,
    });
  });

  it.each(CASES)("in a %s area are all drawn inside the view", (_, css, dpr) => {
    const fit = fitAt(css, dpr);
    const view = playView(fit);
    const shift = viewShift(fit);
    const frames = [
      TOUCH_CONTROLS.jump.art,
      TOUCH_CONTROLS.use.art,
      MOVE_HINT.art,
      PAUSE_BUTTON.art,
      ...[...skillHud(SKILL_IDS).values()].map((at) => skillButton(at).hit),
    ];
    // Each frame's device-pixel rect, as the controls camera draws it at the fit's zoom.
    const outside = frames
      .map((frame) => ({ ...frame, ...shifted(shift, frame) }))
      .map((rect) => ({
        bottom: near((rect.y + rect.height) * fit.zoom),
        left: near(rect.x * fit.zoom),
        right: near((rect.x + rect.width) * fit.zoom),
        top: near(rect.y * fit.zoom),
      }))
      .filter(
        (rect) =>
          rect.left < view.x ||
          rect.top < view.y ||
          rect.right > view.x + view.width ||
          rect.bottom > view.y + view.height,
      );
    expect(outside).toEqual([]);
  });

  // A press on a control's drawn centre, as a device pixel on the canvas, maps back to base pixels
  // through the fit's zoom and the view's shift and reads that control.
  it.each(CASES)("in a %s area take a press on Use and Jump where drawn", (_, css, dpr) => {
    const fit = fitAt(css, dpr);
    const shift = viewShift(fit);
    const roles = (["jump", "use"] as const).map((control) => {
      const at = shifted(shift, TOUCH_CONTROLS[control].centre);
      const device = { x: Math.round(at.x * fit.zoom), y: Math.round(at.y * fit.zoom) };
      return touchRoleAt(shifted(shift, { x: device.x / fit.zoom, y: device.y / fit.zoom }, -1));
    });
    expect(roles).toEqual(["jump", "use"]);
  });
});

describe("the stage progress strip", () => {
  it.each(CASES)("in a %s area follows the canvas bottom under the view", (_, css, dpr) => {
    const fit = fitAt(css, dpr);
    const rect = stageProgressRect(fit);
    expect(rect.width).toBe(SCREEN.width);
    expect(rect.x).toBe(viewShift(fit).x);
    expect(near((rect.y + rect.height) * fit.zoom)).toBe(fit.backing.height);
    expect(rect.height).toBe(4);
  });
});
