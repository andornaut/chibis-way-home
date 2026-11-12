import { EventEmitter } from "node:events";

import { MAX_RENDER_SCALE, renderScale } from "@andornaut/game-kit/view/renderScale";
import type { Scene, Tilemaps } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { SCREEN, TILE } from "../data/screen.ts";
import type { Size } from "../data/types/index.ts";
import { deviceScale } from "../testing/renderScale.ts";

const runCull = vi.hoisted(() => vi.fn((_data: unknown, bounds: unknown) => [bounds]));
vi.mock("phaser", () => ({
  Scale: { Events: { RESIZE: "resize" } },
  Tilemaps: { Components: { RunCull: runCull } },
}));

import { fitPlayCamera } from "./playCamera.ts";
import { cullToView, type TileCull, viewTileBounds } from "./terrainCull.ts";

// The play camera fitPlayCamera keeps at css and devicePixelRatio, scrolled to scroll.
function playCamera(css: Size, devicePixelRatio: number, scroll: { x: number; y: number }) {
  const self = {
    height: 0,
    scrollX: scroll.x,
    scrollY: scroll.y,
    setOrigin: () => self,
    setViewport(x: number, y: number, width: number, height: number) {
      return Object.assign(self, { height, width, x, y });
    },
    setZoom(zoom: number) {
      return Object.assign(self, { zoom, zoomX: zoom, zoomY: zoom });
    },
    width: 0,
    zoomX: 1,
    zoomY: 1,
  };
  const scale = Object.assign(
    new EventEmitter(),
    deviceScale(css, renderScale(MAX_RENDER_SCALE, devicePixelRatio)),
  );
  fitPlayCamera({ cameras: { main: self }, events: new EventEmitter(), scale } as unknown as Scene);
  return self;
}

const PHONE = { height: 390, width: 844 };
const DESKTOP = { height: 640, width: 1280 };
const SCROLL = { x: 1000.4, y: 37 };

describe("terrain culling at a fractional zoom about the top-left", () => {
  it.each([
    ["a phone at DPR 3", PHONE, 3],
    ["a desktop at DPR 1", DESKTOP, 1],
  ])("on %s keeps every column and row the view shows, from its left and top", (_, css, dpr) => {
    const camera = playCamera(css, dpr, SCROLL);
    expect(camera.zoomX).toBeGreaterThan(1);
    const bounds = viewTileBounds(TILE, { x: 1, y: 1 }, { x: 0, y: 0 }, camera);
    expect(bounds).toEqual({
      bottom: Math.ceil((SCROLL.y + SCREEN.height) / TILE) + 1,
      left: Math.floor(SCROLL.x / TILE) - 1,
      right: Math.ceil((SCROLL.x + SCREEN.width) / TILE) + 1,
      top: Math.floor(SCROLL.y / TILE) - 1,
    });
  });

  it("replaces the layer's cull with one over the camera's view and its padding", () => {
    const layer = {
      cullCallback: (() => []) as TileCull,
      cullPaddingX: 2,
      cullPaddingY: 3,
      x: 0,
      y: 0,
    };
    cullToView(TILE, layer);
    const camera = playCamera(PHONE, 3, SCROLL);
    const output = [{} as Tilemaps.Tile];
    const data = {} as Tilemaps.LayerData;
    expect(layer.cullCallback(data, camera, output, 0)).toEqual([
      viewTileBounds(TILE, { x: 2, y: 3 }, layer, camera),
    ]);
    expect(runCull).toHaveBeenCalledWith(data, expect.anything(), 0, output);
    expect(output).toHaveLength(0);
  });
});
