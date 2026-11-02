import { fillNames } from "@andornaut/game-kit/lines";
import type { Scene } from "phaser";

import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "../layout/cardFrame";
import { runStatLabels, stageSummaryLayout, summaryTextOrigin } from "../layout/runStats";
import {
  formatRunStats,
  formatWholeRunStats,
  formatZoneStats,
  type WholeRunDisplaySummary,
} from "../save/runSummary";
import type { RunStatsSummary, ZoneStatsSummary } from "../save/stats";
import { deathLabels } from "../view/death";
import { ZONE_THEMES_KEY, zoneTheme, type ZoneThemes } from "../view/zoneTheme";
import { addCardText, BODY_FONT, cardFonts, paletteColour, TITLE_FONT } from "./cardParts";

export function addStageSummary(
  scene: Scene,
  bounds: Rect,
  data: {
    readonly stage: string;
    readonly runStats: RunStatsSummary;
    readonly zoneStats: ZoneStatsSummary;
    readonly wholeRun: WholeRunDisplaySummary;
  },
) {
  const labels = deathLabels(ZONE_MAP, TEXT.map, data.stage, data.stage);
  const stageTemplates = { ...TEXT.stats, runTotal: STATS_SCOPE_TEXT.stageTotal };
  const zoneTemplates = { ...TEXT.stats, runTotal: STATS_SCOPE_TEXT.zoneTotal };
  const words = {
    labels: { stage: runStatLabels(stageTemplates), zone: runStatLabels(zoneTemplates) },
    run: formatRunStats(stageTemplates, data.runStats),
    stage: fillNames(TEXT.death.stage, { name: labels.stageLabel, number: labels.stageNumber }),
    wholeRun: formatWholeRunStats(STATS_SCOPE_TEXT.wholeRun, data.wholeRun),
    zone: labels.zoneLabel,
    ...(data.zoneStats && { visit: formatZoneStats(zoneTemplates, data.zoneStats) }),
  };
  const fonts = cardFonts(scene);
  const layout = stageSummaryLayout(fonts, bounds, words);
  const drawText = (font: string, rect: Rect, text: string, colour: string) => {
    const metrics = font === TITLE_FONT ? fonts.title : fonts.body;
    return addCardText(
      scene,
      font,
      summaryTextOrigin(metrics, rect, text),
      text,
      paletteColour(scene, colour),
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
    scene.add
      .rectangle(
        block.panel.x,
        block.panel.y,
        block.panel.width,
        block.panel.height,
        paletteColour(scene, "navy"),
      )
      .setOrigin(0);
    const colour =
      block === layout.zone
        ? zoneTheme(ZONE_MAP, scene.cache.json.get(ZONE_THEMES_KEY) as ZoneThemes, data.stage)
            .primary
        : "lgrey";
    scene.add
      .rectangle(block.panel.x, block.panel.y, block.panel.width, 2, paletteColour(scene, colour))
      .setOrigin(0);
    drawText(font, block.title, block.text, "cream");
    for (const row of block.rows) {
      drawText(BODY_FONT, row.label.rect, row.label.text, "lgrey");
      drawText(BODY_FONT, row.value.rect, row.value.text, "white");
    }
  }
  drawText(BODY_FONT, layout.wholeRun.rect, layout.wholeRun.text, "white");
  return layout;
}
