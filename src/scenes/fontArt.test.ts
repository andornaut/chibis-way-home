import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { filterFontArt, queueFontArt } from "./fontArt";

vi.mock("phaser", () => ({ Textures: { FilterMode: { LINEAR: 1 } } }));

it("loads dedicated font pairs and filters their sources without touching a shared sprite source", () => {
  const body = { setFilter: vi.fn() };
  const heading = { setFilter: vi.fn() };
  const sprite = { setFilter: vi.fn() };
  const stub = sceneStub(vi.fn);
  Object.assign(stub.textures.list, {
    "font-body": { source: [body] },
    "font-title": { source: [heading] },
    "sprite-atlas:0": { source: [sprite] },
  });
  const scene = stub as unknown as Scene;
  const manifest = {
    fonts: [
      { fnt: "fonts/font-body.fnt", key: "font-body", png: "fonts/font-body.png" },
      { fnt: "fonts/font-title.fnt", key: "font-title", png: "fonts/font-title.png" },
    ],
  };
  queueFontArt(scene, manifest);
  expect(vi.mocked(stub.load.bitmapFont).mock.calls).toEqual([
    ["font-body", "fonts/font-body.png", "fonts/font-body.fnt"],
    ["font-title", "fonts/font-title.png", "fonts/font-title.fnt"],
  ]);
  filterFontArt(scene, manifest);
  expect(body.setFilter).toHaveBeenCalledExactlyOnceWith(1);
  expect(heading.setFilter).toHaveBeenCalledExactlyOnceWith(1);
  expect(sprite.setFilter).not.toHaveBeenCalled();
});
