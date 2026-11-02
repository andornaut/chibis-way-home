import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { GameObjects } from "phaser";

import type { OpeningKeyframe, OpeningLayer } from "../data/types";

export function renderOpeningLayer(
  layer: OpeningLayer,
  pose: OpeningKeyframe,
  sprite: GameObjects.Sprite,
): void {
  sprite.play(animationKey(layer.art, pose.pose), true);
  sprite.setOrigin(
    layer.anchor.x / sprite.frame.realWidth,
    layer.anchor.y / sprite.frame.realHeight,
  );
  sprite
    .setPosition(pose.position.x, pose.position.y)
    .setScale(pose.scale)
    .setFlipX(layer.flipX ?? false)
    .setAngle(pose.angle)
    .setVisible(pose.visible);
}
