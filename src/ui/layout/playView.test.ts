import { MAX_RENDER_SCALE, renderFit, renderScale } from "@andornaut/game-kit/view/renderScale";
import { describe, expect, it } from "vitest";

import {
  CONTROL_BOTTOM,
  CONTROL_SIDE,
  CONTROL_VIEW_MARGIN,
  HUD_EDGE,
  TOUCH_CIRCLE_RADIUS,
  TOUCH_LAYOUT,
} from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Point, Rect, Size } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { touchRoleAt } from "../input/intent.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";
import { canvasSize, playView, shifted, viewBars, viewShift } from "./playView.ts";
import { SKILL_BUTTON, skillButton, skillHud } from "./skillHud.ts";
import { stageProgressRect } from "./stageProgress.ts";
import { touchLayout } from "./touchControls.ts";

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
  // In each canvas, the pause disc HUD_EDGE in from the view's top and left, and the skill HUD's
  // discs from its top and right; the bars never move them.
  it.each(CASES)("in a %s area keep the HUD its set distances from the view", (_, css, dpr) => {
    const shift = viewShift(fitAt(css, dpr));
    const view = logicalView(shift);
    const right = view.x + view.width - 1;
    const pause = drawn(PAUSE_BUTTON.art, shift);
    const hud = [...skillHud(SKILL_IDS).values()].map((at) => skillButton(shifted(shift, at)).disc);
    const last = hud[hud.length - 1]!;
    expect({
      hudRight: near(right - (last.x + SKILL_BUTTON.disc - 1)),
      hudTop: near(Math.min(...hud.map((disc) => disc.y)) - view.y),
      pauseLeft: near(pause.left - view.x),
      pauseTop: near(pause.top - view.y),
    }).toEqual({ hudRight: HUD_EDGE, hudTop: HUD_EDGE, pauseLeft: HUD_EDGE, pauseTop: HUD_EDGE });
  });

  it.each(CASES)("in a %s area are all drawn inside the view", (_, css, dpr) => {
    const fit = fitAt(css, dpr);
    const view = playView(fit);
    const shift = viewShift(fit);
    const { buttons, moveHint } = touchLayout(fit);
    const frames = [
      buttons.jump.art,
      buttons.use.art,
      moveHint.art,
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
    const { buttons, pressAreas } = touchLayout(fit);
    const roles = (["jump", "use"] as const).map((control) => {
      const at = shifted(shift, buttons[control].centre);
      const device = { x: Math.round(at.x * fit.zoom), y: Math.round(at.y * fit.zoom) };
      const back = shifted(shift, { x: device.x / fit.zoom, y: device.y / fit.zoom }, -1);
      return touchRoleAt(pressAreas, back);
    });
    expect(roles).toEqual(["jump", "use"]);
  });
});

describe("the touch controls", () => {
  it.each([
    ["2:1 at DPR 1", SCREEN, 1],
    ["2:1 desktop at DPR 1", { height: 640, width: 1280 }, 1],
  ])("in a %s area, with no bars, sit where the view's edges place them", (_, css, dpr) => {
    const { buttons, moveHint } = touchLayout(fitAt(css, dpr));
    expect({
      hint: moveHint.centre,
      jump: buttons.jump.centre,
      use: buttons.use.centre,
    }).toEqual({ hint: { x: 76, y: 283 }, jump: { x: 643, y: 283 }, use: { x: 566, y: 183 } });
  });

  // Each side's drawn edge sits CONTROL_SIDE (or CONTROL_BOTTOM) from the canvas's edge, unless
  // that would leave it nearer the view's edge than CONTROL_VIEW_MARGIN, when it sits that far
  // inside the view. Which sides clamp: the 2.16:1 phone's 29.5px side bars leave 10.5px inside
  // the view, the 2.22:1 phone's 39.7px bars would leave 0.3px, and the taller areas' bands below
  // the view are 90px and 180px.
  it.each<[string, Size, number, { bottom: boolean; sides: boolean }]>([
    ["2:1 at DPR 1", SCREEN, 1, { bottom: false, sides: false }],
    ["2.16:1 at DPR 3", { height: 390, width: 844 }, 3, { bottom: false, sides: false }],
    ["2.22:1 at DPR 2.625", { height: 390, width: 866 }, 2.625, { bottom: false, sides: true }],
    ["16:10 at DPR 1.5", { height: 450, width: SCREEN.width }, 1.5, { bottom: true, sides: false }],
    ["4:3 at DPR 2", { height: 768, width: 1024 }, 2, { bottom: true, sides: false }],
  ])("in a %s area sit their distances from the canvas, clamped inside the view", (...test) => {
    const [, css, dpr, clamped] = test;
    const fit = fitAt(css, dpr);
    const bars = viewBars(fit);
    const { buttons, moveHint } = touchLayout(fit);
    const jump = drawn(buttons.jump.art, { x: 0, y: 0 });
    const hint = drawn(moveHint.art, { x: 0, y: 0 });
    // Each drawn edge's distance in from the view's edge.
    const fromView = {
      hintBottom: SCREEN.height - 1 - hint.bottom,
      hintLeft: hint.left,
      jumpBottom: SCREEN.height - 1 - jump.bottom,
      jumpRight: SCREEN.width - 1 - jump.right,
    };
    const side = clamped.sides ? CONTROL_VIEW_MARGIN : CONTROL_SIDE - bars.left;
    const bottom = clamped.bottom ? CONTROL_VIEW_MARGIN : CONTROL_BOTTOM - bars.bottom;
    expect({
      hintBottom: near(fromView.hintBottom),
      hintLeft: near(fromView.hintLeft),
      jumpBottom: near(fromView.jumpBottom),
      jumpRight: near(fromView.jumpRight),
    }).toEqual({
      hintBottom: near(bottom),
      hintLeft: near(side),
      jumpBottom: near(bottom),
      jumpRight: near(clamped.sides ? CONTROL_VIEW_MARGIN : CONTROL_SIDE - bars.right),
    });
    expect(Math.min(...Object.values(fromView))).toBeGreaterThanOrEqual(CONTROL_VIEW_MARGIN);
    // Use keeps its offset from Jump and is drawn inside the view.
    expect(buttons.use.centre).toEqual({
      x: buttons.jump.centre.x + TOUCH_LAYOUT.useFromJump.x,
      y: buttons.jump.centre.y + TOUCH_LAYOUT.useFromJump.y,
    });
  });

  // Where the bars clamp the controls, the press areas move with the drawn buttons: each
  // button's circle about its own centre, cut at the line midway between them, and Jump's
  // reach into the view's bottom-right corner.
  it("in a 2.22:1 area press where the moved buttons are drawn", () => {
    const fit = fitAt({ height: 390, width: 866 }, 2.625);
    const { buttons, moveHint, pressAreas } = touchLayout(fit);
    const { jump, use } = buttons;
    const reach = TOUCH_CIRCLE_RADIUS + (moveHint.art.width - 1) / 2;
    const left = (centre: Point, distance: number) => ({ x: centre.x - distance, y: centre.y });
    const midway = { x: (use.centre.x + jump.centre.x) / 2, y: (use.centre.y + jump.centre.y) / 2 };
    const roles = [
      jump.centre,
      left(jump.centre, reach - 0.1),
      left(jump.centre, reach + 0.1),
      use.centre,
      left(use.centre, reach - 0.1),
      left(use.centre, reach + 0.1),
      { ...midway, x: midway.x - 0.1 },
      { ...midway, x: midway.x + 0.1 },
      { x: SCREEN.width - 1, y: SCREEN.height - 1 },
    ].map((point) => touchRoleAt(pressAreas, point));
    expect(jump.centre.x).toBeGreaterThan(643);
    expect(roles).toEqual(["jump", "jump", "move", "use", "use", "move", "use", "jump", "jump"]);
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
