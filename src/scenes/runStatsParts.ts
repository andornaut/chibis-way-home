import { fillNames } from "@andornaut/game-kit/lines";
import type { Scene } from "phaser";

import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { stageSummaryLayout } from "../layout/runStats";
import { formatRunStats, formatZoneStats } from "../save/runSummary";
import type { RunStatsSummary, ZoneStatsSummary } from "../save/stats";
import { deathLabels } from "../view/death";
import { addCardTextIn, BODY_FONT, cardFonts, paletteColour, TITLE_FONT } from "./cardParts";

export function addStageSummary(
  scene: Scene,
  bounds: Rect,
  data: {
    readonly stage: string;
    readonly runStats: RunStatsSummary;
    readonly zoneStats?: ZoneStatsSummary;
  },
) {
  const labels = deathLabels(ZONE_MAP, TEXT.map, data.stage, data.stage);
  const words = {
    run: formatRunStats(TEXT.stats, data.runStats),
    stage: fillNames(TEXT.death.stage, { name: labels.stageLabel, number: labels.stageNumber }),
    zone: fillNames(TEXT.death.title, { zone: labels.zoneLabel }),
    ...(data.zoneStats && { visit: formatZoneStats(TEXT.stats, data.zoneStats) }),
  };
  const layout = stageSummaryLayout(cardFonts(scene), bounds, words);
  const key = STAGE_PREVIEWS[data.stage];
  if (!key || !scene.textures.exists(key)) {
    throw new Error(`Missing actual stage preview ${data.stage}`);
  }
  scene.add
    .image(layout.image.x, layout.image.y, key)
    .setOrigin(0)
    .setDisplaySize(layout.image.width, layout.image.height);
  for (const [block, font] of [
    [layout.stage, BODY_FONT],
    [layout.zone, TITLE_FONT],
  ] as const) {
    if (!block) {
      continue;
    }
    addCardTextIn(scene, font, block.title, block.text, paletteColour(scene, "cream"));
    for (const row of block.rows) {
      addCardTextIn(scene, BODY_FONT, row.rect, row.text, paletteColour(scene, "cream"));
    }
  }
  return layout;
}
