import type { CrumblingPhase } from "@andornaut/game-kit/terrain/crumbling";
import type { Scene } from "phaser";

import type { CrumblingSupportId, Rect } from "../data/types";
import type { ZoneCrumblingWorld } from "../rules/zoneCrumbling";
import { crumblingAppearance } from "../view/crumblingPresentation";

export interface CrumblingTarget {
  // The skin's opaque body face; undefined while its tileset has not loaded.
  readonly face: Rect | undefined;
  readonly item: { setVisible(visible: boolean): unknown };
  readonly supportId: CrumblingSupportId;
}

const INTACT: CrumblingPhase = { kind: "intact" };

// Warning cracks over each unchanged skin from the authoritative phase; absence hides it whole.
export function createCrumblingArt(
  depth: number,
  crack: number,
  scene: Scene,
  targets: readonly CrumblingTarget[],
) {
  const item = scene.add.graphics().setDepth(depth).setScrollFactor(1, 1);
  return {
    draw(world: ZoneCrumblingWorld | undefined) {
      item.clear().fillStyle(crack, 1);
      for (const { face, item: skin, supportId } of targets) {
        const phase =
          world?.supports.find((support) => support.supportId === supportId)?.phase ?? INTACT;
        const appearance = crumblingAppearance(phase, face ?? { height: 0, width: 0, x: 0, y: 0 });
        skin.setVisible(appearance.visible);
        for (const { height, width, x, y } of appearance.cracks) {
          item.fillRect(x, y, width, height);
        }
      }
    },
    item,
  };
}
