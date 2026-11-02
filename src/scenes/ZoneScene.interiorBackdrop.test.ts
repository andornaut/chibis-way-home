import { expect, it, vi } from "vitest";

import type { ObjectLayout } from "../data/types";

vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../input/frameTurn", () => ({ FRAME_TURN: {} }));
import { ZoneScene } from "./ZoneScene";

it("creates a native repeating two-axis clip behind props and keeps its world rectangle across camera changes", () => {
  const item = {
    setDepth: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setScrollFactor: vi.fn(),
    setTilePosition: vi.fn(),
  };
  for (const method of Object.values(item)) {
    method.mockReturnValue(item);
  }
  const object = {
    art: "wall",
    backdropPlane: "interior",
    backdropSpan: true,
    groundAnchor: "start",
    height: 216,
    origin: { x: 24, y: 48 },
    parallax: { x: 0.8, y: 0.25 },
    width: 120,
  } as ObjectLayout;
  const tileSprite = vi.fn(() => item);
  const camera = { scrollX: 0, scrollY: 0 };
  const scene = Object.assign(Object.create(ZoneScene.prototype), {
    add: { tileSprite },
    cameras: { main: camera },
    chunkBackdrops: [],
    layout: {
      areas: {
        main: {
          chunks: [],
          entries: { start: { x: 24, y: 600 } },
          height: 1080,
          solids: [{ height: 480, width: 1440, x: 0, y: 600 }],
          width: 1440,
        },
      },
    },
    manifest: { backdrops: [{ key: "wall", repeat: "x" }], sprites: [] },
    scenerySprites: [],
    zone: { area: "main" },
  }) as {
    drawObject(
      key: undefined,
      tileset: undefined,
      object: ObjectLayout,
      index: number,
    ): { offset: { x: number; y: number } };
    renderBackdrops(): void;
  };
  expect(scene.drawObject(undefined, undefined, object, 0).offset).toEqual({ x: 0, y: 0 });
  expect(tileSprite).toHaveBeenCalledWith(24, 48, 120, 216, "wall");
  expect(item.setScrollFactor).toHaveBeenCalledWith(1, 1);
  expect(item.setDepth).toHaveBeenCalledWith(-3.5);
  for (const y of [-10000, 0, 10000]) {
    camera.scrollY = y;
    scene.renderBackdrops();
    expect(item.setPosition).toHaveBeenLastCalledWith(24, 48);
  }
});
