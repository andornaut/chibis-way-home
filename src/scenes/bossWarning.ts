import type { GameObjects, Scene } from "phaser";

import type { BOSS_WARNING } from "../data/bossWarning";
import type { BehaviourState } from "../rules/behaviour";
import { bossWarning } from "../view/bossWarning";

export function mountBossWarning(
  tuning: typeof BOSS_WARNING,
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
    draw(state: BehaviourState | undefined, sprite: GameObjects.Sprite) {
      if (!live || !sprite.visible) {
        return;
      }
      const width = sprite.frame.realWidth * sprite.scaleX;
      const height = sprite.frame.realHeight * sprite.scaleY;
      const left = sprite.x - sprite.originX * width;
      const top = sprite.y - sprite.originY * height;
      const circle = bossWarning(tuning.clearance, state, {
        height: Math.abs(height),
        width: Math.abs(width),
        x: Math.min(left, left + width),
        y: Math.min(top, top + height),
      });
      if (circle) {
        graphics
          .lineStyle(tuning.inkWidth, colour(tuning.inkColour))
          .strokeCircle(circle.x, circle.y, circle.radius)
          .lineStyle(tuning.strokeWidth, colour(tuning.colour))
          .strokeCircle(circle.x, circle.y, circle.radius);
      }
    },
  };
}
