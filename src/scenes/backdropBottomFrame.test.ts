import type { Textures } from "phaser";
import { expect, it, vi } from "vitest";

import { backdropBottomFrame } from "./backdropBottomFrame";

it("uses the exact last source row, preserves its atlas source and keeps the default frame", () => {
  const frames = new Set<string>();
  const texture = {
    add: vi.fn((name: string) => {
      frames.add(name);
      texture.firstFrame = name;
    }),
    firstFrame: "__BASE",
    get: () => ({ cutHeight: 600, cutWidth: 720, cutX: 17, cutY: 29, sourceIndex: 2 }),
    has: (key: string) => frames.has(key),
  };
  const frame = backdropBottomFrame(texture as unknown as Textures.Texture);
  expect(texture.add).toHaveBeenCalledExactlyOnceWith(frame, 2, 17, 628, 720, 1);
  expect(texture.firstFrame).toBe("__BASE");
  expect(backdropBottomFrame(texture as unknown as Textures.Texture)).toBe(frame);
  expect(texture.add).toHaveBeenCalledOnce();
});
