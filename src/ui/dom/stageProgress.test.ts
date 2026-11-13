// @vitest-environment happy-dom
import { progressBarLayout } from "@andornaut/game-kit/progress";
import { MAX_RENDER_SCALE, renderFit, renderScale } from "@andornaut/game-kit/view/renderScale";
import { expect, it } from "vitest";

import { SCREEN } from "../../data/screen.ts";
import { STAGE_PROGRESS } from "../../data/stageProgress.ts";
import { STAGE_PROGRESS_STYLE } from "../../presentation/index.ts";
import { canvasSize, viewShift } from "../layout/playView.ts";
import { stageProgressRect } from "../layout/stageProgress.ts";
import { createUiLayer } from "./layer.ts";
import { createStageProgress } from "./stageProgress.ts";

it("keeps progress determinate through backward movement and refit while naming the strip", () => {
  const view = createStageProgress(document, STAGE_PROGRESS_STYLE, "Stage distance");
  const frame = { height: 4, width: 720, x: 0, y: 356 };
  expect(view.root.hidden).toBe(true);
  view.update(0.8);
  view.place(frame);
  const first = view.element!;
  expect(first.getAttribute("role")).toBe("progressbar");
  expect(first.getAttribute("aria-label")).toBe("Stage distance");
  expect(first.getAttribute("aria-valuenow")).toBe("0.8");
  view.setVisible(true);
  view.update(0.3);
  expect(view.root.hidden).toBe(false);
  expect(first.dataset.state).toBe("determinate");
  expect(first.getAttribute("aria-valuenow")).toBe("0.3");
  const expected = progressBarLayout(STAGE_PROGRESS_STYLE, frame, 0.3);
  expect((first.children[1] as HTMLElement).style.width).toBe(`${expected.fills[0]!.width}px`);
  view.place({ ...frame });
  expect(view.element).toBe(first);
  view.place({ ...frame, y: 400 });
  expect(view.element).not.toBe(first);
  expect(view.element!.getAttribute("aria-valuenow")).toBe("0.3");
  view.update(1);
  expect(view.element!.dataset.state).toBe("determinate");
  expect(view.element!.getAttribute("style")).not.toContain("progress-bar-full");
  view.setVisible(false);
  expect(view.root.hidden).toBe(true);
});

it("binds every native bar colour to the inherited modal palette", () => {
  const view = createStageProgress(document, STAGE_PROGRESS_STYLE, "Stage distance");
  view.place({ height: 4, width: 720, x: 0, y: 356 });
  const element = view.element!;
  expect(element.style.backgroundColor).toBe(`var(--colour-${STAGE_PROGRESS.colours.frame})`);
  const [track, ...bands] = [...element.children] as HTMLElement[];
  expect(track!.style.backgroundColor).toBe(`var(--colour-${STAGE_PROGRESS.colours.track})`);
  expect(
    bands.map((band) => (band.firstElementChild as HTMLElement).style.backgroundColor),
  ).toEqual(STAGE_PROGRESS.colours.fill.map((colour) => `var(--colour-${colour})`));
});

it("uses the supplied canvas-bottom rect across wide and tall refits without adding a view shift", () => {
  const view = createStageProgress(document, STAGE_PROGRESS_STYLE, "Stage distance");
  const layer = createUiLayer([], document);
  const unmount = layer.mount(0, view.root);
  for (const size of [
    { height: 390, width: 1000 },
    { height: 640, width: 1000 },
  ]) {
    const fit = renderFit(SCREEN, renderScale(MAX_RENDER_SCALE, 1), size);
    layer.fit({ x: 17, y: 29 }, fit);
    const frame = stageProgressRect(fit);
    const shift = viewShift(fit);
    const canvas = canvasSize(fit);
    view.placeCanvas(shift, canvas);
    view.place(frame);
    expect(parseFloat(view.element!.style.left)).toBeCloseTo(frame.x, 5);
    expect(parseFloat(view.element!.style.top)).toBeCloseTo(frame.y, 5);
    expect(parseFloat(view.element!.style.height)).toBeCloseTo(frame.height, 5);
    expect(frame.height).toBe(4);
    const unit = Number(layer.element.style.getPropertyValue("--ui-unit"));
    const canvasTop =
      parseFloat(layer.element.style.getPropertyValue("--ui-view-top")) - shift.y * unit;
    const canvasLeft =
      parseFloat(layer.element.style.getPropertyValue("--ui-view-left")) - shift.x * unit;
    expect(canvasLeft).toBeCloseTo(17);
    expect(canvasTop).toBeCloseTo(29);
    expect(canvasTop + (frame.y + frame.height) * unit).toBeCloseTo(
      29 + fit.backing.height / fit.r,
    );
    expect(view.root.style.getPropertyValue("--stage-progress-shift-x")).toBe(String(shift.x));
    expect(view.root.style.getPropertyValue("--stage-progress-canvas-height")).toBe(
      String(canvas.height),
    );
    expect(view.root.querySelector(".ui-view")).toBeNull();
    expect(view.root.querySelector(".stage-progress-plane")!.parentElement).toBe(
      view.root.querySelector(".stage-progress-canvas"),
    );
  }
  view.placeCanvas({ x: 23.5, y: 31.25 }, { height: 450, width: 900 });
  expect(view.root.style.getPropertyValue("--stage-progress-shift-y")).toBe("31.25");
  expect(view.root.style.getPropertyValue("--stage-progress-canvas-width")).toBe("900");
  unmount();
  layer.dispose();
});
