import { EventEmitter } from "node:events";

import { expect, it, vi } from "vitest";

import type { ObjectLayout } from "../data/types";

vi.mock("phaser", () => ({
  Scene: class {},
  Scenes: { Events: { PRE_RENDER: "prerender" } },
}));

vi.mock("../input/frameTurn", () => ({ FRAME_TURN: {} }));

import { ZoneScene } from "./ZoneScene";

it("updates paused preview backdrops after camera changes and removes the render hook on shutdown", () => {
  const item = { setPosition: vi.fn().mockReturnThis(), setTilePosition: vi.fn().mockReturnThis() };
  const methods = ZoneScene.prototype as unknown as { renderBackdrops(): void };
  const scene = {
    cameras: { main: { scrollX: 7200, scrollY: 0 } },
    chunkBackdrops: [
      {
        bounds: { height: 600, width: 720, x: 7200, y: 120 },
        item,
        parallax: { x: 0.4, y: 0.15 },
      },
    ],
    createReady: vi.fn(),
    events: new EventEmitter(),
    preview: {},
    renderBackdrops: methods.renderBackdrops,
  };
  ZoneScene.prototype.create.call(scene as unknown as ZoneScene);
  scene.events.emit("prerender");
  expect(item.setPosition).toHaveBeenLastCalledWith(7200, 120);
  expect(item.setTilePosition.mock.lastCall?.[0]).toBeCloseTo(0);
  expect(item.setTilePosition.mock.lastCall?.[1]).toBe(0);
  scene.cameras.main.scrollX = 7300;
  scene.cameras.main.scrollY = 300;
  scene.events.emit("prerender");
  expect(item.setPosition).toHaveBeenLastCalledWith(7200, 375);
  expect(item.setTilePosition).toHaveBeenLastCalledWith(-60, 0);
  scene.events.emit("shutdown");
  expect(scene.events.listenerCount("prerender")).toBe(0);
  item.setPosition.mockClear();
  scene.events.emit("prerender");
  expect(item.setPosition).not.toHaveBeenCalled();
});

it("bottom-aligns a taller apartment skin before applying chunk-local parallax", () => {
  const item = {
    setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
  };
  const scene = {
    add: { tileSprite: vi.fn(() => item) },
    chunkBackdrops: [] as { bounds: { height: number; width: number; x: number; y: number } }[],
    layout: { areas: { exterior: { chunks: [{ width: 720, x: 7200 }], width: 8640 } } },
    manifest: { backdrops: [{ key: "apartment-far", repeat: "x" }] },
    textures: { getFrame: () => ({ height: 720 }) },
    zone: { area: "exterior" },
  };
  const object = {
    art: "apartment-far",
    height: 600,
    origin: { x: 7200, y: 120 },
    parallax: { x: 0.4, y: 0.15 },
    width: 720,
  } as ObjectLayout;
  const methods = ZoneScene.prototype as unknown as {
    drawObject(key: undefined, tileset: undefined, object: ObjectLayout, index: number): unknown;
  };
  methods.drawObject.call(scene, undefined, undefined, object, 0);
  expect(scene.add.tileSprite).toHaveBeenCalledWith(0, 0, 720, 720, "apartment-far");
  expect(item.setScrollFactor).toHaveBeenCalledWith(1, 1);
  expect(scene.chunkBackdrops[0]?.bounds).toEqual({ height: 720, width: 720, x: 7200, y: 0 });
});
