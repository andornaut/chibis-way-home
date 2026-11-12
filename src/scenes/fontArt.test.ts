import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { queueFontArt } from "./fontArt.ts";

it("loads dedicated font pairs", () => {
  const stub = sceneStub(vi.fn);
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
});
