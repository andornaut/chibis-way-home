import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { GameObjects, Scene } from "phaser";

import type { Point } from "../data/types";
import { tetherSegments } from "../presentation";

// The placeholder line's width in pixels while the tether has no sprite.
const PLACEHOLDER_WIDTH = 2;
// The hook draws over the cable it overlaps, still behind the object at depth + 1.
const HOOK_DEPTH = 0.5;

// A tether from its rail down to its anchor, at depth (one behind its object): its sprite's cable
// and hook tags, size square, once the sprite exists, else a flat line in colour.
export function createTetherArt(
  depth: number,
  art: { readonly key: string; readonly size: number } | undefined,
  colour: number,
  scene: Scene,
) {
  const sprites: GameObjects.Sprite[] = [];
  const line = art
    ? undefined
    : scene.add.rectangle(0, 0, PLACEHOLDER_WIDTH, 0, colour).setOrigin(0).setDepth(depth);
  return {
    destroy() {
      line?.destroy();
      for (const sprite of sprites) {
        sprite.destroy();
      }
    },
    draw(railY: number, anchor: Point) {
      if (line) {
        const height = Math.max(0, Math.round(anchor.y - railY));
        line
          .setPosition(Math.round(anchor.x - PLACEHOLDER_WIDTH / 2), Math.round(railY))
          .setSize(PLACEHOLDER_WIDTH, height)
          .setVisible(height > 0);
        return;
      }
      const segments = tetherSegments(art!.size, railY, anchor);
      segments.forEach(({ tag, x, y }, index) => {
        let sprite = sprites[index];
        if (!sprite) {
          sprite = scene.add.sprite(0, 0, art!.key).setOrigin(0);
          sprites.push(sprite);
        }
        const key = animationKey(art!.key, tag);
        if (sprite.anims.currentAnim?.key !== key) {
          sprite.play(key);
        }
        sprite
          .setDepth(tag === "hook" ? depth + HOOK_DEPTH : depth)
          .setPosition(Math.round(x), Math.round(y))
          .setVisible(true);
      });
      for (const sprite of sprites.slice(segments.length)) {
        sprite.setVisible(false);
      }
    },
  };
}
