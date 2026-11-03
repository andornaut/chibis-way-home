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
import move from "../../public/art/sprites/ui-move-hint.json";
import knob from "../../public/art/sprites/ui-move-knob.json";
import jump from "../../public/art/sprites/ui-touch-jump.json";
import use from "../../public/art/sprites/ui-touch-use.json";
import { createTouchChrome } from "./touchChrome";

vi.mock("phaser", () => ({ Textures: { FilterMode: { LINEAR: 1 } } }));
vi.mock("./cardParts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    parseInt(palette.colours[name].slice(1), 16),
}));

it("caches four isolated filtered sheets and retains authored frame order, durations and repeat flags", () => {
  const data: Record<string, unknown> = {
    manifest,
    "ui-move-hint": move,
    "ui-move-knob": knob,
    "ui-touch-jump": jump,
    "ui-touch-use": use,
  };
  const cached = new Map<string, unknown>();
  const filters: ReturnType<typeof vi.fn>[] = [];
  const add = vi.fn();
  const createCanvas = vi.fn((key: string) => {
    const setFilter = vi.fn();
    filters.push(setFilter);
    const texture = {
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
    cached.set(key, texture);
    return texture;
  });
  const sprite = vi.fn(() => ({
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
  }));
  const animations = vi.fn();
  const scene = {
    add: { sprite },
    anims: { create: animations },
    cache: { json: { get: (key: string) => data[key] } },
    textures: { createCanvas, exists: (key: string) => cached.has(key) },
  } as unknown as Scene;
  for (const kind of ["jump", "use", "move", "knob"] as const) {
    const source =
      kind === "move" ? "ui-move-hint" : kind === "knob" ? "ui-move-knob" : `ui-touch-${kind}`;
    createTouchChrome(scene, kind);
    createTouchChrome(scene, kind);
    expect(sprite.mock.results.at(-1)!.value.setDisplaySize).toHaveBeenCalledWith(
      kind === "knob" ? 11 : 75,
      kind === "knob" ? 11 : 75,
    );
    for (const [tag, frames] of sheetTags(data[source] as AsepriteSheet)) {
      expect(animations).toHaveBeenCalledWith({
        frames: frames.map(({ duration, frame }) => ({
          duration,
          frame,
          key: `touch-chrome-${kind}`,
        })),
        key: animationKey(`touch-chrome-${kind}`, tag),
        repeat: tagRepeat(manifest.sprites.find((entry) => entry.key === source)!.once, tag),
      });
    }
  }
  expect(createCanvas).toHaveBeenCalledTimes(4);
  for (const filter of filters) {
    expect(filter).toHaveBeenCalledExactlyOnceWith(Textures.FilterMode.LINEAR);
  }
  expect(add.mock.calls.every((call) => call[4] === call[5] && [300, 44].includes(call[4]))).toBe(
    true,
  );
});
