import { MAX_RENDER_SCALE, renderScale } from "@andornaut/game-kit/view/renderScale";
import { expect, it, vi } from "vitest";

import { deviceScale } from "../testing/renderScale";

vi.mock("phaser", () => ({ Scale: { Events: { RESIZE: "resize" } } }));

import { sceneFit } from "./playCamera";
import { chromeDensity } from "./touchChrome";
import { uiOverlayFit } from "./uiOverlayFit";

const PHONE = { height: 390, width: 844 };

// The WebGL canvas as followFrameTurn's deviceResolution leaves it: its backing at r, its CSS
// size the play area's.
function world(css: { height: number; width: number }, r: number) {
  const { gameSize } = deviceScale(css, r);
  return {
    clientHeight: css.height,
    clientWidth: css.width,
    height: gameSize.height,
    style: { height: `${css.height}px`, width: `${css.width}px` },
    width: gameSize.width,
  };
}

it.each([1, 2, 3])(
  "at DPR %d captures the device-pixel backing and projects it at the full ratio",
  (dpr) => {
    const r = renderScale(MAX_RENDER_SCALE, dpr);
    const { cssSize, projection } = uiOverlayFit(dpr, world(PHONE, r));
    expect(cssSize).toEqual(PHONE);
    expect(projection.captureSize).toEqual(deviceScale(PHONE, r).gameSize);
    expect(projection.backingSize).toEqual({
      height: Math.ceil(PHONE.height * dpr),
      width: Math.ceil(PHONE.width * dpr),
    });
    expect(projection.scaleX).toBeCloseTo(dpr / r, 12);
    expect(projection.scaleY).toBeCloseTo(dpr / r, 12);
  },
);

// The chrome sheets paint one texel per overlay pixel: the overlay's pixels per base pixel, its
// projection times the cameras' zoom, are the chrome's density.
it("projects base pixels at the chrome's density above the backing's cap", () => {
  vi.stubGlobal("devicePixelRatio", 3);
  const r = renderScale(MAX_RENDER_SCALE, 3);
  const scene = { scale: deviceScale(PHONE, r) } as never;
  const { projection } = uiOverlayFit(3, world(PHONE, r));
  expect(projection.scaleX * sceneFit(scene).zoom).toBeCloseTo(chromeDensity(scene), 12);
  vi.unstubAllGlobals();
});
