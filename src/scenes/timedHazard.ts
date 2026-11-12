import type { GameObjects, Scene } from "phaser";

import { HAZARD_PHASE_STYLE } from "../data/hazardPhaseStyle.ts";
import { TILE } from "../data/screen.ts";
import type { HazardPhase, Rect } from "../data/types/index.ts";
import type { PlacedTile } from "../presentation/index.ts";

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

// A timed hazard drawn from its phase tiles in a loaded tileset: one image layer per phase, the
// current phase's shown.
export function createPhaseTileArt(
  depth: number,
  key: string,
  tiles: Readonly<Record<HazardPhase, readonly PlacedTile[]>>,
  scene: Scene,
) {
  const layers = Object.fromEntries(
    (Object.keys(tiles) as HazardPhase[]).map((phase) => [
      phase,
      tiles[phase].map(({ col, index, row }) =>
        scene.add
          .image(col * TILE, row * TILE, key, index)
          .setOrigin(0)
          .setVisible(false),
      ),
    ]),
  ) as Record<HazardPhase, GameObjects.Image[]>;
  const item = scene.add
    .container(0, 0, Object.values(layers).flat())
    .setDepth(depth)
    .setScrollFactor(1, 1);
  return {
    draw(phase: HazardPhase, rect: Rect) {
      item.setPosition(rect.x, rect.y);
      for (const [shown, images] of Object.entries(layers)) {
        for (const image of images) {
          image.setVisible(shown === phase);
        }
      }
    },
    item,
  };
}
