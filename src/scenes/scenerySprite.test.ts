import { expect, it, vi } from "vitest";

import type { ObjectLayout } from "../data/types";

vi.mock("phaser", () => ({ Scene: class {}, Scenes: { Events: { PRE_RENDER: "prerender" } } }));
vi.mock("../ui/input/frameTurn", () => ({ FRAME_TURN: {} }));

import { ZoneScene } from "./ZoneScene";

it("places animated scenery behind actors, crops it before rendering and ignores camera movement for facing", () => {
  const sprite = {
    anims: {},
    frame: { height: 48, width: 96 },
    height: 48,
    play: vi.fn().mockReturnThis(),
    setCrop: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setFlipX: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    setScrollFactor: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    texture: { key: "ambient" },
    width: 96,
    x: 0,
    y: 0,
  };
  sprite.play.mockImplementation(() => {
    sprite.frame = { height: 24, width: 32 };
    sprite.height = 24;
    sprite.width = 32;
    return sprite;
  });
  const object = {
    animations: { idle: "idle" },
    art: "ambient",
    collision: "none",
    height: 24,
    interaction: { kind: "none" },
    motion: { algorithm: "static" },
    origin: { x: 7210, y: 180 },
    parallax: { x: 0.4, y: 0.15 },
    quirks: [],
    reaction: { kind: "none" },
    width: 32,
  } as unknown as ObjectLayout;
  const scene = {
    add: { sprite: () => sprite },
    animate: vi.fn(),
    cameras: { main: { scrollX: 7160, scrollY: 0 } },
    chunkBackdrops: [],
    drawPulses: vi.fn(),
    drawTransients: vi.fn(),
    layout: {
      areas: { main: { chunks: [{ width: 720, x: 7200 }], objects: [object], width: 8640 } },
    },
    manifest: { backdrops: [], sprites: [{ key: "ambient" }] },
    objectArt: [] as unknown[],
    scenerySprites: [],
    zone: {
      area: "main",
      attempt: 0,
      behaviours: [],
      bird: { x: 0, y: 0 },
      objects: [object.origin],
      seed: 1,
    },
  };
  const methods = ZoneScene.prototype as unknown as {
    drawObject(key: undefined, tileset: undefined, object: ObjectLayout, index: number): unknown;
    drawObjects(): void;
    renderBackdrops(): void;
  };
  scene.objectArt = [methods.drawObject.call(scene, undefined, undefined, object, 0)];
  expect(sprite.setDepth).toHaveBeenLastCalledWith(-3);
  expect(sprite.play).toHaveBeenCalledWith("ambient:idle");
  methods.renderBackdrops.call(scene);
  expect(sprite.setCrop).toHaveBeenLastCalledWith(14, 0, 18, 24);
  methods.drawObjects.call(scene);
  expect(sprite.setFlipX).not.toHaveBeenCalled();
  expect(scene.animate.mock.lastCall?.[2]).toBe("idle");
});
