import { type Scene, Textures } from "phaser";
import { expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json";
import { chromeCanvasTexture } from "../testing/chromeTexture";
import { drawHelpChrome } from "./helpChrome";

vi.mock("phaser", () => ({
  Core: { Events: { POST_STEP: "poststep" } },
  Textures: { FilterMode: { NEAREST: 0 } },
}));
vi.mock("./cardParts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    parseInt(palette.colours[name].slice(1), 16),
}));
it("keeps help textures separate and bounded while displaying their logical frame at the given size", () => {
  const cached = new Set<string>();
  const textures: ReturnType<typeof chromeCanvasTexture>[] = [];
  const createCanvas = vi.fn((key: string, width: number, height: number) => {
    cached.add(key);
    const texture = chromeCanvasTexture(key, width, height);
    textures.push(texture);
    return texture;
  });
  const setDisplaySize = vi.fn().mockReturnThis();
  const image = vi.fn((...args: unknown[]) => ({
    args,
    setDisplaySize,
    setOrigin: vi.fn().mockReturnThis(),
  }));
  const scene = {
    add: { image },
    game: { events: { on: vi.fn() } },
    scale: { displaySize: { width: 720 }, gameSize: { width: 720 } },
    textures: { createCanvas, exists: (key: string) => cached.has(key) },
  } as unknown as Scene;
  for (const action of ["move", "use", "jump"] as const) {
    drawHelpChrome(scene, { height: 20, width: 20, x: 3, y: 4 }, action);
    drawHelpChrome(scene, { height: 20, width: 20, x: 3, y: 4 }, action);
  }
  expect(createCanvas).toHaveBeenCalledTimes(3);
  expect(
    image.mock.calls.every(
      (call) => String(call[2]).startsWith("help-chrome-") && call[3] === "rest",
    ),
  ).toBe(true);
  expect(setDisplaySize).toHaveBeenCalledWith(20, 20);
  for (const texture of textures) {
    expect(texture.setFilter).toHaveBeenCalledExactlyOnceWith(Textures.FilterMode.NEAREST);
  }
});
