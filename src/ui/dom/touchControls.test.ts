// @vitest-environment happy-dom
import { renderFit } from "@andornaut/game-kit/view/renderScale";
import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { SCREEN } from "../../data/screen.ts";
import { svgLayers } from "../../testing/chromeSvg.ts";
import {
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
  type TouchChromeKind,
  touchChromeLayers,
  type TouchChromePose,
} from "../chrome/touchChrome.ts";
import { canvasSize, shifted, viewShift } from "../layout/playView.ts";
import { createTouchControls, type TouchControlsState } from "./touchControls.ts";

const COLOURS = {
  cream: Number.parseInt(palette.colours.cream.slice(1), 16),
  ink: Number.parseInt(palette.colours.ink.slice(1), 16),
  white: Number.parseInt(palette.colours.white.slice(1), 16),
};

function state(): TouchControlsState {
  const rest = { centre: { x: 100, y: 100 }, expanded: false, pose: "rest", shown: true } as const;
  return {
    canvas: SCREEN,
    controls: { jump: rest, knob: rest, move: rest, use: rest },
    viewShift: { x: 0, y: 0 },
  };
}

it("is decorative, initially hidden and outside the native input and focus routes", () => {
  const view = createTouchControls(document, COLOURS);
  expect(view.root.getAttribute("aria-hidden")).toBe("true");
  expect(view.root.querySelector("button, input, [tabindex]")).toBeNull();
  expect(Object.values(view.parts).every((part) => part.hidden)).toBe(true);
  view.render(state());
  expect(view.root.style.getPropertyValue("--touch-control-opacity")).toBe("0.85");
  expect(view.parts.knob.style.getPropertyValue("--touch-control-size")).toBe(
    String(TOUCH_KNOB_FRAME),
  );
  expect(view.parts.jump.style.getPropertyValue("--touch-control-size")).toBe(
    String(TOUCH_CHROME_FRAME),
  );
});

it.each<[TouchChromeKind, TouchChromePose, boolean]>([
  ["jump", "rest", false],
  ["jump", "press", true],
  ["jump", "press", false],
  ["use", "held", false],
  ["move", "held-left", false],
  ["move", "held-right", false],
  ["knob", "held", false],
])(
  "draws %s %s expanded=%s with the existing chrome geometry and palette",
  (kind, pose, expanded) => {
    const view = createTouchControls(document, COLOURS);
    const initial = state();
    view.render(initial);
    const visual = { ...initial.controls[kind], expanded, pose };
    view.render({ ...initial, controls: { ...initial.controls, [kind]: visual } });
    const svg = view.parts[kind].querySelector("svg")!;
    expect(svgLayers(svg)).toEqual(touchChromeLayers(COLOURS, kind, pose, expanded));
    const size = kind === "knob" ? TOUCH_KNOB_FRAME : TOUCH_CHROME_FRAME;
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${size} ${size}`);
    // Position-only updates retain the current vector, without restarting its scene-owned clock.
    view.render({
      ...initial,
      controls: { ...initial.controls, [kind]: { ...visual, centre: { x: 120, y: 110 } } },
    });
    expect(view.parts[kind].querySelector("svg")).toBe(svg);
  },
);

it.each([
  { height: 413, width: 1079 },
  { height: 701, width: 900 },
])("keeps canvas coordinates and full letterbox bounds for %j", (size) => {
  const fit = renderFit(SCREEN, 1.3, size);
  const shift = viewShift(fit);
  const canvas = canvasSize(fit);
  const view = createTouchControls(document, COLOURS);
  const initial = state();
  const centre = shifted(shift, { x: 600, y: 280 });
  // A moving thumb may draw in a letterbox, beyond the fixed play view.
  const mover = { x: 5, y: canvas.height - 5 };
  view.render({
    canvas,
    controls: {
      ...initial.controls,
      jump: { ...initial.controls.jump, centre },
      knob: { ...initial.controls.knob, centre: mover, shown: false },
      move: { ...initial.controls.move, centre: mover },
    },
    viewShift: shift,
  });
  expect(Number(view.parts.jump.style.getPropertyValue("--touch-control-x"))).toBe(
    centre.x - (TOUCH_CHROME_FRAME - 1) / 2,
  );
  expect(Number(view.parts.move.style.getPropertyValue("--touch-control-y"))).toBe(
    mover.y - (TOUCH_CHROME_FRAME - 1) / 2,
  );
  expect(Number(view.root.style.getPropertyValue("--touch-view-shift-x"))).toBe(shift.x);
  expect(Number(view.root.style.getPropertyValue("--touch-view-shift-y"))).toBe(shift.y);
  expect(Number(view.root.style.getPropertyValue("--touch-canvas-width"))).toBe(canvas.width);
  expect(Number(view.root.style.getPropertyValue("--touch-canvas-height"))).toBe(canvas.height);
  expect(view.parts.knob.hidden).toBe(true);
});
