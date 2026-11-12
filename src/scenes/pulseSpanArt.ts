import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { GameObjects, Scene } from "phaser";

import type { Rect } from "../data/types/index.ts";
import { forceVisualSpan } from "../presentation/index.ts";

// The placeholder's opacity over the push volume while the visual has no sprite.
const PLACEHOLDER_ALPHA = 0.35;

// A force pulse's visual repeated across its push volume, at depth: its sprite's tag, mirrored
// when it blows left, once the sprite exists (art gives its key and frame size), else a flat
// translucent rectangle over the volume in colour.
export function createPulseSpanArt(
  depth: number,
  art: { readonly height: number; readonly key: string; readonly width: number } | undefined,
  colour: number,
  scene: Scene,
) {
  const sprites: GameObjects.Sprite[] = [];
  const placeholder = art
    ? undefined
    : scene.add
        .rectangle(0, 0, 0, 0, colour)
        .setOrigin(0)
        .setAlpha(PLACEHOLDER_ALPHA)
        .setDepth(depth);
  return {
    destroy() {
      placeholder?.destroy();
      for (const sprite of sprites) {
        sprite.destroy();
      }
    },
    draw(volume: Rect, facing: -1 | 1, animation: string) {
      if (placeholder) {
        placeholder
          .setPosition(Math.round(volume.x), Math.round(volume.y))
          .setSize(Math.round(volume.width), Math.round(volume.height));
        return;
      }
      const key = animationKey(art!.key, animation);
      forceVisualSpan(volume, art!, facing).forEach(({ x, y }, index) => {
        let sprite = sprites[index];
        if (!sprite) {
          sprite = scene.add.sprite(0, 0, art!.key).setOrigin(0).setDepth(depth);
          sprites.push(sprite);
        }
        if (sprite.anims.currentAnim?.key !== key) {
          sprite.play(key);
        }
        sprite
          .setFlipX(facing === -1)
          .setPosition(Math.round(x), Math.round(y))
          .setVisible(true);
      });
    },
    pause() {
      for (const sprite of sprites) {
        sprite.anims.pause();
      }
    },
  };
}
