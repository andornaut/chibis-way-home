import type { GameObjects, Scene } from "phaser";

import type { SpriteContact } from "../data/types";
import type { BehaviourState } from "../rules/behaviour";
import { bossWarning, type BossWarningTuning } from "../view/bossWarning";

export function mountBossWarning(
  tuning: BossWarningTuning,
  depth: number,
  colour: (name: string) => number,
  scene: Scene,
) {
  const graphics = scene.add.graphics().setDepth(depth).setScrollFactor(1);
  let live = true;
  const dispose = () => {
    if (!live) {
      return;
    }
    live = false;
    scene.events.off("shutdown", dispose);
    scene.events.off("destroy", dispose);
    graphics.destroy();
  };
  scene.events.once("shutdown", dispose);
  scene.events.once("destroy", dispose);
  return {
    clear() {
      if (live) {
        graphics.clear();
      }
    },
    draw(
      state: BehaviourState | undefined,
      sprite: GameObjects.Sprite,
      contact: SpriteContact | undefined,
    ) {
      if (!live || !sprite.visible) {
        return;
      }
      const bands = bossWarning(tuning, state, contact, String(sprite.frame.name));
      if (!bands) {
        return;
      }
      const width = sprite.frame.realWidth;
      const height = sprite.frame.realHeight;
      for (const [runs, name] of [
        [bands.ink, tuning.inkColour],
        [bands.red, tuning.colour],
      ] as const) {
        graphics.fillStyle(colour(name));
        for (const [y, left, right] of runs) {
          const x0 = sprite.flipX ? width - right : left;
          const y0 = sprite.flipY ? height - y - 1 : y;
          const x = sprite.x + (x0 - sprite.originX * width) * sprite.scaleX;
          const top = sprite.y + (y0 - sprite.originY * height) * sprite.scaleY;
          const runWidth = (right - left) * sprite.scaleX;
          const runHeight = sprite.scaleY;
          graphics.fillRect(
            Math.min(x, x + runWidth),
            Math.min(top, top + runHeight),
            Math.abs(runWidth),
            Math.abs(runHeight),
          );
        }
      }
    },
  };
}
