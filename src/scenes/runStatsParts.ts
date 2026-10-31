import { fillNames } from "@andornaut/game-kit/lines";
import type { Scene } from "phaser";

import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "../layout/cardFrame";
import { runStatLabels, stageSummaryLayout, summaryTextOrigin } from "../layout/runStats";
import { formatRunStats, formatZoneStats } from "../save/runSummary";
import type { RunStatsSummary, ZoneStatsSummary } from "../save/stats";
import { deathLabels } from "../view/death";
import { addCardText, BODY_FONT, cardFonts, paletteColour, TITLE_FONT } from "./cardParts";

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
    labels: runStatLabels(TEXT.stats),
    run: formatRunStats(TEXT.stats, data.runStats),
    stage: fillNames(TEXT.death.stage, { name: labels.stageLabel, number: labels.stageNumber }),
    zone: fillNames(TEXT.death.title, { zone: labels.zoneLabel }),
    ...(data.zoneStats && { visit: formatZoneStats(TEXT.stats, data.zoneStats) }),
  };
  const fonts = cardFonts(scene);
  const layout = stageSummaryLayout(fonts, bounds, words);
  const drawText = (font: string, rect: Rect, text: string) => {
    const metrics = font === TITLE_FONT ? fonts.title : fonts.body;
    return addCardText(
      scene,
      font,
      summaryTextOrigin(metrics, rect, text),
      text,
      paletteColour(scene, "cream"),
    )
      .setLeftAlign()
      .setLineSpacing(CARD_CONTENT.lineHeight / CARD_TEXT_SCALE - metrics.lineHeight);
  };
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
    drawText(font, block.title, block.text);
    if (block.subtitle) {
      drawText(BODY_FONT, block.subtitle.rect, block.subtitle.text);
    }
    for (const row of block.rows) {
      drawText(BODY_FONT, row.label.rect, row.label.text);
      drawText(BODY_FONT, row.value.rect, row.value.text);
    }
  }
  return layout;
}
