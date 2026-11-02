import type { GameObjects } from "phaser";
import { expect, it, vi } from "vitest";

import type { OpeningKeyframe, OpeningLayer } from "../data/types";
import { renderOpeningLayer } from "./openingLayer";

it.each([
  { anchor: { x: 128, y: 232 }, flipX: undefined, height: 256, width: 256 },
  { anchor: { x: 24, y: 42 }, flipX: undefined, height: 42, width: 48 },
  { anchor: { x: 24, y: 42 }, flipX: false, height: 42, width: 48 },
  { anchor: { x: 24, y: 48 }, flipX: true, height: 48, width: 48 },
])(
  "normalizes $width x $height frame anchors with horizontal flip=$flipX",
  ({ anchor, flipX, height, width }) => {
    const sprite = {
      frame: { realHeight: height, realWidth: width },
      play: vi.fn(),
      setAngle: vi.fn(),
      setFlipX: vi.fn(),
      setOrigin: vi.fn(),
      setPosition: vi.fn(),
      setScale: vi.fn(),
      setVisible: vi.fn(),
    };
    for (const method of [
      sprite.setPosition,
      sprite.setScale,
      sprite.setFlipX,
      sprite.setAngle,
      sprite.setVisible,
    ]) {
      method.mockReturnValue(sprite);
    }
    const pose: OpeningKeyframe = {
      angle: 0,
      pose: "idle",
      position: { x: 240, y: 240 },
      progress: 0,
      scale: 1,
      visible: true,
    };
    const layer: OpeningLayer = {
      anchor,
      art: "fixture",
      ...(flipX !== undefined && { flipX }),
      keyframes: [pose],
    };
    renderOpeningLayer(layer, pose, sprite as unknown as GameObjects.Sprite);
    expect(sprite.setOrigin).toHaveBeenCalledWith(anchor.x / width, anchor.y / height);
    expect(sprite.play).toHaveBeenCalledWith(`${layer.art}:${pose.pose}`, true);
    expect(sprite.setPosition).toHaveBeenCalledWith(pose.position.x, pose.position.y);
    expect(sprite.setScale).toHaveBeenCalledWith(1);
    expect(sprite.setFlipX).toHaveBeenCalledWith(flipX ?? false);
    expect(sprite.setVisible).toHaveBeenCalledWith(pose.visible);
  },
);
