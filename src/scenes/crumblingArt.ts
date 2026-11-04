import type { CrumblingPhase } from "@andornaut/game-kit/terrain/crumbling";

import type { CrumblingSupportId } from "../data/types";
import type { ZoneCrumblingWorld } from "../rules/zoneCrumbling";
import { crumblingAppearance, type CrumblingSkin } from "../view/crumblingPresentation";

interface Visible {
  setVisible(visible: boolean): unknown;
}

export interface CrumblingTarget {
  readonly skins: Readonly<Record<CrumblingSkin, readonly Visible[]>>;
  readonly supportId: CrumblingSupportId;
}

const INTACT: CrumblingPhase = { kind: "intact" };

// Shows each support's skin for its authoritative phase; absence hides both skins.
export function createCrumblingArt(targets: readonly CrumblingTarget[]) {
  return {
    draw(world: ZoneCrumblingWorld | undefined) {
      for (const { skins, supportId } of targets) {
        const phase =
          world?.supports.find((support) => support.supportId === supportId)?.phase ?? INTACT;
        const shown = crumblingAppearance(phase);
        for (const [skin, images] of Object.entries(skins)) {
          for (const image of images) {
            image.setVisible(skin === shown);
          }
        }
      }
    },
  };
}
