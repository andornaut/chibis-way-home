import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { type Scene, Textures } from "phaser";
import { expect, it, vi } from "vitest";

import manifest from "../../public/art/manifest.json";
import palette from "../../public/art/palette.json";
import pause from "../../public/art/sprites/ui-pause.json";
import { createPauseChrome, PAUSE_CHROME_KEY } from "./pauseChrome";

vi.mock("phaser", () => ({ Textures: { FilterMode: { LINEAR: 1 } } }));
vi.mock("./cardParts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    parseInt(palette.colours[name].slice(1), 16),
}));
it("caches one opaque35px Pause sprite and copies the authored rest, press and held timeline", () => {
  const cached = new Set<string>();
  const setFilter = vi.fn();
  const add = vi.fn();
  const createCanvas = vi.fn((key: string) => {
    cached.add(key);
    return {
      add,
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
  const sprite = vi.fn(() => ({
    setAlpha: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
  }));
  const animations = vi.fn();
  const data: Record<string, unknown> = { manifest, "ui-pause": pause };
  const scene = {
    add: { sprite },
    anims: { create: animations },
    cache: { json: { get: (key: string) => data[key] } },
    textures: { createCanvas, exists: (key: string) => cached.has(key) },
  } as unknown as Scene;
  createPauseChrome(scene);
  createPauseChrome(scene);
  expect(createCanvas).toHaveBeenCalledTimes(1);
  expect(setFilter).toHaveBeenCalledExactlyOnceWith(Textures.FilterMode.LINEAR);
  expect(sprite.mock.results[0]!.value.setDisplaySize).toHaveBeenCalledExactlyOnceWith(35, 35);
  expect(sprite.mock.results[0]!.value.setAlpha).toHaveBeenCalledExactlyOnceWith(1);
  expect(add.mock.calls.every((call) => call[4] === 140 && call[5] === 140)).toBe(true);
  const tags = sheetTags(pause as AsepriteSheet);
  for (const [tag, frames] of tags) {
    expect(animations).toHaveBeenCalledWith({
      frames: frames.map(({ duration, frame }) => ({ duration, frame, key: PAUSE_CHROME_KEY })),
      key: animationKey(PAUSE_CHROME_KEY, tag),
      repeat: tagRepeat(manifest.sprites.find((entry) => entry.key === "ui-pause")!.once, tag),
    });
  }
});
