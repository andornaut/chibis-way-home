import { EventEmitter } from "node:events";

import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import { MAX_RENDER_SCALE, renderFit, renderScale } from "@andornaut/game-kit/view/renderScale";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { SCREEN } from "../data/screen.ts";
import type { Size } from "../data/types/index.ts";
import { deviceScale } from "../testing/renderScale.ts";
import { PAUSE_BUTTON, playView, shifted, touchLayout, touchRoleAt } from "../ui/index.ts";

vi.mock("phaser", () => ({ Scale: { Events: { RESIZE: "resize" } } }));

import {
  canvasRect,
  fitCanvasCamera,
  fitPlayCamera,
  playPoint,
  sceneFit,
  sceneViewShift,
} from "./playCamera.ts";

// A camera that records its viewport, origin and zoom as Phaser's does.
function camera() {
  const self = {
    height: 0,
    originX: 0.5,
    originY: 0.5,
    setOrigin(x: number, y: number) {
      return Object.assign(self, { originX: x, originY: y });
    },
    setViewport(x: number, y: number, width: number, height: number) {
      return Object.assign(self, { height, width, x, y });
    },
    setZoom(zoom: number) {
      return Object.assign(self, { zoom });
    },
    width: 0,
    x: 0,
    y: 0,
    zoom: 1,
  };
  return self;
}

function sceneAt(css: Size, devicePixelRatio: number) {
  const scale = Object.assign(
    new EventEmitter(),
    deviceScale(css, renderScale(MAX_RENDER_SCALE, devicePixelRatio)),
  );
  const main = camera();
  return { cameras: { main }, events: new EventEmitter(), scale } as unknown as Scene & {
    cameras: { main: ReturnType<typeof camera> };
    scale: EventEmitter & ReturnType<typeof deviceScale>;
  };
}

const PHONE = { height: 390, width: 844 };
const DESKTOP = { height: 640, width: 1280 };

describe("the scene's fit", () => {
  it.each([
    ["a desktop at DPR 1", DESKTOP, 1],
    ["a phone at DPR 2", PHONE, 2],
    ["a phone at DPR 3", PHONE, 3],
  ])("on %s reads the kit's fit back from the scale manager", (_, css, dpr) => {
    const scene = sceneAt(css, dpr);
    const expected = renderFit(SCREEN, renderScale(MAX_RENDER_SCALE, dpr), css);
    const fit = sceneFit(scene);
    expect(fit.backing).toEqual(expected.backing);
    expect(fit.view).toEqual(expected.view);
    expect(fit.zoom).toBeCloseTo(expected.zoom, 12);
    expect(canvasRect(scene).height).toBeCloseTo(SCREEN.height, 9);
  });

  it("keeps the play and canvas cameras at the fit's zoom, origin top-left, across a refit", () => {
    const scene = sceneAt(PHONE, 1);
    const canvas = camera();
    fitPlayCamera(scene);
    fitCanvasCamera(scene, canvas as never);
    Object.assign(scene.scale, deviceScale(PHONE, 2));
    scene.scale.emit("resize");
    const fit = sceneFit(scene);
    expect(scene.cameras.main).toMatchObject({
      ...playView(fit),
      originX: 0,
      originY: 0,
      zoom: fit.zoom,
    });
    expect(canvas).toMatchObject({ ...fit.backing, originX: 0, originY: 0, x: 0, y: 0 });
    expect(canvas.zoom).toBe(fit.zoom);
  });
});

describe("pointer mapping at a fractional zoom", () => {
  // A phone at DPR 3: two device pixels per CSS pixel and 390 / 180 per base pixel.
  const scene = sceneAt(PHONE, 3);
  fitPlayCamera(scene);
  const fit = sceneFit(scene);
  const { buttons, pressAreas } = touchLayout(fit);

  it("round-trips a point in the view through the camera's device pixels", () => {
    const view = scene.cameras.main;
    for (const point of [PAUSE_BUTTON.at, buttons.jump.centre, { x: 719, y: 359 }]) {
      const pointer = { x: view.x + point.x * view.zoom, y: view.y + point.y * view.zoom };
      const back = playPoint(scene, pointer);
      expect(back.x).toBeCloseTo(point.x, 9);
      expect(back.y).toBeCloseTo(point.y, 9);
    }
  });

  // A page touch maps to the logical canvas (pageToGame over canvasRect), and back by the view's
  // shift reads the control drawn there.
  it("reads Use and Jump under a page touch where the controls camera draws them", () => {
    const shift = sceneViewShift(scene);
    const box = { ...PHONE, x: 30, y: 12 };
    const roles = (["jump", "use"] as const).map((control) => {
      const at = shifted(shift, buttons[control].centre);
      const client = { x: box.x + (at.x * fit.zoom) / fit.r, y: box.y + (at.y * fit.zoom) / fit.r };
      return touchRoleAt(
        pressAreas,
        shifted(shift, pageToGame(0, box, canvasRect(scene), client), -1),
      );
    });
    expect(roles).toEqual(["jump", "use"]);
  });
});
