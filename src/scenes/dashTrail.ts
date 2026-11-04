import type { Scene } from "phaser";

import type { DashTrailTuning, Rect } from "../data/types";
import { dashTrail } from "../presentation";
import type { BirdDashState } from "../rules/bird";

export function mountDashTrail(
  tuning: DashTrailTuning,
  depth: number,
  colour: (name: string) => number,
  scene: Scene,
) {
  const graphics = scene.add.graphics().setDepth(depth);
  let live = true;
  const clear = () => {
    if (live) {
      graphics.clear();
    }
  };
  const dispose = () => {
    if (!live) {
      return;
    }
    live = false;
    scene.events.off("pause", clear);
    scene.events.off("shutdown", dispose);
    scene.events.off("destroy", dispose);
    graphics.destroy();
  };
  scene.events.on("pause", clear);
  scene.events.once("shutdown", dispose);
  scene.events.once("destroy", dispose);
  return {
    clear,
    draw(durationSeconds: number, frame: Rect, dash: BirdDashState | undefined) {
      clear();
      if (!live || !scene.sys.isActive()) {
        return;
      }
      for (const pixel of dashTrail(tuning, durationSeconds, frame, dash)) {
        if (pixel.alpha > 0) {
          graphics
            .fillStyle(colour(pixel.colour), pixel.alpha / 255)
            .fillRect(pixel.x, pixel.y, pixel.width, pixel.height);
        }
      }
    },
  };
}
