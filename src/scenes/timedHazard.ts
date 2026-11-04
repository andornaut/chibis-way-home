import type { Scene } from "phaser";

import { HAZARD_PHASE_STYLE } from "../data/hazardPhaseStyle";
import type { HazardPhase, Rect } from "../data/types";

export function createTimedHazardArt(
  depth: number,
  colour: (name: string) => number,
  scene: Scene,
) {
  const item = scene.add.graphics().setDepth(depth).setScrollFactor(1, 1);
  return {
    draw(phase: HazardPhase, rect: Rect) {
      item.clear().setPosition(rect.x, rect.y);
      item
        .fillStyle(
          colour(phase === "active" ? HAZARD_PHASE_STYLE.active : HAZARD_PHASE_STYLE.inactive),
          1,
        )
        .fillRect(0, 0, rect.width, rect.height);
      if (phase !== "warning") {
        return;
      }
      const width = Math.min(HAZARD_PHASE_STYLE.warningWidth, rect.width / 2, rect.height / 2);
      item.fillStyle(colour(HAZARD_PHASE_STYLE.warning), 1);
      item.fillRect(0, 0, rect.width, width);
      item.fillRect(0, rect.height - width, rect.width, width);
      item.fillRect(0, width, width, rect.height - 2 * width);
      item.fillRect(rect.width - width, width, width, rect.height - 2 * width);
    },
    item,
  };
}
