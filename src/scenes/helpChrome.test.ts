import { type Scene, Textures } from "phaser";
import { expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json";
import { drawHelpChrome } from "./helpChrome";

vi.mock("phaser", () => ({ Textures: { FilterMode: { LINEAR: 1 } } }));
vi.mock("./cardParts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    parseInt(palette.colours[name].slice(1), 16),
}));
it("keeps help textures separate and bounded while displaying their logical40px frame", () => {
  const cached = new Set<string>();
  const filters: ReturnType<typeof vi.fn>[] = [];
  const createCanvas = vi.fn((key: string) => {
    cached.add(key);
    const setFilter = vi.fn();
    filters.push(setFilter);
    return {
      add: vi.fn(),
      getContext: () => ({
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
        }),
        putImageData: vi.fn(),
      }),
      refresh: vi.fn(),
      setFilter,
    };
  });
  const setDisplaySize = vi.fn().mockReturnThis();
  const image = vi.fn((...args: unknown[]) => ({
    args,
    setDisplaySize,
    setOrigin: vi.fn().mockReturnThis(),
  }));
  const scene = {
    add: { image },
    textures: { createCanvas, exists: (key: string) => cached.has(key) },
  } as unknown as Scene;
  for (const action of ["move", "use", "jump"] as const) {
    drawHelpChrome(scene, { x: 3, y: 4 }, action);
    drawHelpChrome(scene, { x: 3, y: 4 }, action);
  }
  expect(createCanvas).toHaveBeenCalledTimes(3);
  expect(
    image.mock.calls.every(
      (call) => String(call[2]).startsWith("help-chrome-") && call[3] === "rest",
    ),
  ).toBe(true);
  expect(setDisplaySize).toHaveBeenCalledWith(40, 40);
  for (const filter of filters) {
    expect(filter).toHaveBeenCalledExactlyOnceWith(Textures.FilterMode.LINEAR);
  }
});
