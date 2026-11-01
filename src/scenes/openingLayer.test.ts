import type { GameObjects } from "phaser";
import { expect, it, vi } from "vitest";

import { OPENING } from "../data/opening";
import { renderOpeningLayer } from "./openingLayer";

it("normalizes the actual source-frame anchor and applies the selected static pose and transform", () => {
  const sprite = {
    frame: { realHeight: 256, realWidth: 256 },
    play: vi.fn(),
    setAngle: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setScale: vi.fn(),
    setVisible: vi.fn(),
  };
  for (const method of [sprite.setPosition, sprite.setScale, sprite.setAngle, sprite.setVisible]) {
    method.mockReturnValue(sprite);
  }
  const layer = OPENING[0]!.shots[0]!.layers[0]!;
  const pose = layer.keyframes[0]!;
  renderOpeningLayer(layer, pose, sprite as unknown as GameObjects.Sprite);
  expect(sprite.setOrigin).toHaveBeenCalledWith(128 / 256, 232 / 256);
  expect(sprite.play).toHaveBeenCalledWith(`${layer.art}:${pose.pose}`, true);
  expect(sprite.setPosition).toHaveBeenCalledWith(pose.position.x, pose.position.y);
  expect(sprite.setVisible).toHaveBeenCalledWith(pose.visible);
});
