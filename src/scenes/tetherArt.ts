import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { GameObjects, Scene } from "phaser";

import { spokeSegments, type TetherLine, tetherSegments } from "../presentation/index.ts";

// The placeholder line's width in pixels while the tether has no sprite.
const PLACEHOLDER_WIDTH = 2;
// The hook draws over the cable it overlaps, still behind the object at depth + 1.
const HOOK_DEPTH = 0.5;

// A tether along its line, at depth (one behind its object): its sprite's segments, size square,
// once the sprite exists (cable and hook tags down from a rail, the idle tag along a spoke), else
// a flat line in colour.
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
    draw(tether: TetherLine) {
      const { anchor } = tether;
      if (line) {
        if (tether.kind === "rail") {
          const height = Math.max(0, Math.round(anchor.y - tether.railY));
          line
            .setPosition(Math.round(anchor.x - PLACEHOLDER_WIDTH / 2), Math.round(tether.railY))
            .setSize(PLACEHOLDER_WIDTH, height)
            .setVisible(height > 0);
          return;
        }
        // Along the spoke from the pivot, PLACEHOLDER_WIDTH thick about the line.
        const { pivot } = tether;
        const length = Math.round(Math.hypot(anchor.x - pivot.x, anchor.y - pivot.y));
        line
          .setOrigin(0, 0.5)
          .setPosition(Math.round(pivot.x), Math.round(pivot.y))
          .setRotation(Math.atan2(anchor.y - pivot.y, anchor.x - pivot.x))
          .setSize(length, PLACEHOLDER_WIDTH)
          .setVisible(length > 0);
        return;
      }
      const segments =
        tether.kind === "rail"
          ? tetherSegments(art!.size, tether.railY, anchor)
          : spokeSegments(art!.size, tether.pivot, anchor);
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
