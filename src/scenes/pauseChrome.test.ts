import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import { type Scene, Textures } from "phaser";
import { expect, it, vi } from "vitest";

import manifest from "../../public/art/manifest.json";
import palette from "../../public/art/palette.json";
import pause from "../../public/art/sprites/ui-pause.json";
import { chromeCanvasTexture } from "../testing/chromeTexture";
import { createPauseChrome, PAUSE_CHROME_KEY } from "./pauseChrome";

vi.mock("phaser", () => ({
  Core: { Events: { POST_STEP: "poststep" } },
  Textures: { FilterMode: { NEAREST: 0 } },
}));
vi.mock("./cardParts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    parseInt(palette.colours[name].slice(1), 16),
}));
it("caches one opaque35px Pause sprite and copies the authored rest, press and held timeline", () => {
  const textures: ReturnType<typeof chromeCanvasTexture>[] = [];
  const createCanvas = vi.fn((key: string, width: number, height: number) => {
    const texture = chromeCanvasTexture(key, width, height);
    textures.push(texture);
    Object.assign(stub.textures.list, { [key]: texture });
    return texture;
  });
  const sprite = vi.fn(() => ({
    setAlpha: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
  }));
  // Four screen pixels per base pixel.
  const stub = sceneStub(vi.fn, { add: { sprite }, scale: { displaySize: { width: 4096 } } });
  stub.cache.json.add("manifest", manifest).add("ui-pause", pause);
  Object.assign(stub.textures, { createCanvas });
  const scene = stub as unknown as Scene;
  createPauseChrome(scene);
  createPauseChrome(scene);
  expect(createCanvas).toHaveBeenCalledTimes(1);
  expect(textures[0]!.setFilter).toHaveBeenCalledExactlyOnceWith(Textures.FilterMode.NEAREST);
  expect(sprite.mock.results[0]!.value.setDisplaySize).toHaveBeenCalledExactlyOnceWith(35, 35);
  expect(sprite.mock.results[0]!.value.setAlpha).toHaveBeenCalledExactlyOnceWith(1);
  expect(textures[0]!.add.mock.calls.every((call) => call[4] === 140 && call[5] === 140)).toBe(
    true,
  );
  const tags = sheetTags(pause as AsepriteSheet);
  for (const [tag, frames] of tags) {
    expect(stub.anims.create).toHaveBeenCalledWith({
      frames: frames.map(({ duration, frame }) => ({ duration, frame, key: PAUSE_CHROME_KEY })),
      key: animationKey(PAUSE_CHROME_KEY, tag),
      repeat: tagRepeat(manifest.sprites.find((entry) => entry.key === "ui-pause")!.once, tag),
    });
  }
});
