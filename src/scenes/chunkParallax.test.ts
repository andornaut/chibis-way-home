import { EventEmitter } from "node:events";

import { expect, it, vi } from "vitest";

import manifest from "../../public/art/manifest.json";
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
    scenerySprites: [],
  };
  ZoneScene.prototype.create.call(scene as unknown as ZoneScene);
  scene.events.emit("prerender");
  expect(item.setPosition).toHaveBeenLastCalledWith(7200, 120);
  expect(item.setTilePosition.mock.lastCall?.[0]).toBeCloseTo(2880);
  expect(item.setTilePosition.mock.lastCall?.[1]).toBe(0);
  scene.cameras.main.scrollX = 7300;
  scene.cameras.main.scrollY = 300;
  scene.events.emit("prerender");
  expect(item.setPosition).toHaveBeenLastCalledWith(7200, 375);
  expect(item.setTilePosition).toHaveBeenLastCalledWith(2820, 0);
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

it("derives the interior texture origin from the manifest without moving its authored quad", () => {
  const item = {
    setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setTilePosition: vi.fn().mockReturnThis(),
  };
  const scene = {
    add: { tileSprite: vi.fn(() => item) },
    cameras: { main: { scrollX: 0, scrollY: 480 } },
    chunkBackdrops: [],
    layout: {
      areas: {
        main: {
          chunks: [],
          entries: { start: { x: 0, y: 600 } },
          height: 1440,
          solids: [{ height: 840, width: 720, x: 0, y: 600 }],
          width: 720,
        },
      },
    },
    manifest,
    scenerySprites: [],
    zone: { area: "main" },
  };
  const object = {
    art: "warehouse-wall",
    backdropPlane: "interior",
    groundAnchor: "start",
    height: 240,
    origin: { x: 0, y: 600 },
    parallax: { x: 0.8, y: 1 },
    width: 720,
  } as ObjectLayout;
  const methods = ZoneScene.prototype as unknown as {
    drawObject(key: undefined, tileset: undefined, object: ObjectLayout, index: number): unknown;
    renderBackdrops(): void;
  };
  methods.drawObject.call(scene, undefined, undefined, object, 0);
  methods.renderBackdrops.call(scene);
  expect(scene.add.tileSprite).toHaveBeenCalledWith(0, 600, 720, 240, "warehouse-wall");
  expect(item.setScrollFactor).toHaveBeenCalledWith(1, 1);
  expect(item.setDepth).toHaveBeenCalledWith(-3.5);
  expect(item.setPosition).toHaveBeenCalledWith(0, 600);
  expect(item.setTilePosition).toHaveBeenCalledWith(0, 240);
});

it("extends opted-in outdoor pixels below the quad at the same phase and cleans up with it", () => {
  const make = () => ({
    destroy: vi.fn(),
    once: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setTilePosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  });
  const base = make();
  const extension = make();
  const texture = {
    add: vi.fn(),
    firstFrame: "__BASE",
    get: () => ({ cutHeight: 600, cutWidth: 720, cutX: 0, cutY: 0, sourceIndex: 0 }),
    has: () => false,
  };
  const scene = {
    add: { tileSprite: vi.fn().mockReturnValueOnce(base).mockReturnValueOnce(extension) },
    cameras: { main: { height: 360, scrollX: 360, scrollY: 240, zoomY: 1 } },
    chunkBackdrops: [],
    layout: {
      areas: {
        main: {
          chunks: [{ width: 720, x: 0 }],
          entries: { start: { x: 0, y: 600 } },
          height: 1440,
          solids: [{ height: 840, width: 720, x: 0, y: 600 }],
          width: 720,
        },
      },
    },
    manifest,
    scenerySprites: [],
    textures: { get: () => texture, getFrame: () => ({ height: 600 }) },
    zone: { area: "main" },
  };
  const object = {
    art: "warehouse-mid",
    backdropExtendBottom: true,
    backdropSpan: true,
    groundAnchor: "start",
    height: 600,
    origin: { x: 0, y: 0 },
    parallax: { x: 0.4, y: 0.15 },
    width: 720,
  } as ObjectLayout;
  const methods = ZoneScene.prototype as unknown as {
    drawObject(key: undefined, tileset: undefined, object: ObjectLayout, index: number): unknown;
    renderBackdrops(): void;
  };
  methods.drawObject.call(scene, undefined, undefined, object, 0);
  methods.renderBackdrops.call(scene);
  expect(base.setPosition).toHaveBeenLastCalledWith(0, -102);
  expect(extension.setPosition).toHaveBeenLastCalledWith(0, 498);
  expect(extension.setSize).toHaveBeenLastCalledWith(720, 102);
  expect(extension.setTilePosition).toHaveBeenLastCalledWith(-216, 0);
  expect(extension.setDepth.mock.lastCall).toEqual(base.setDepth.mock.lastCall);
  scene.cameras.main.scrollY = 360;
  methods.renderBackdrops.call(scene);
  expect(extension.setPosition).toHaveBeenLastCalledWith(0, 600);
  expect(extension.setSize).toHaveBeenLastCalledWith(720, 120);
  const destroy = base.once.mock.calls.find(([event]) => event === "destroy")![1] as () => void;
  destroy();
  expect(extension.destroy).toHaveBeenCalledOnce();
});
