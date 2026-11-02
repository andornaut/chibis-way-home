import { fillNames } from "@andornaut/game-kit/lines";
import type { Scene } from "phaser";

import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "../layout/cardFrame";
import {
  RUN_STAT_KEYS,
  runStatLabels,
  stageSummaryLayout,
  statsTotalRows,
  summaryTextOrigin,
} from "../layout/runStats";
import { formatRunStats, type WholeRunDisplaySummary } from "../save/runSummary";
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
  const metricLabels = runStatLabels(TEXT.stats);
  const values = formatRunStats(
    { ...TEXT.stats, attempts: "{count}", best: "{time}", lastAttempt: "{time}" },
    data.runStats,
  );
  const words = {
    aggregate: STATS_SCOPE_TEXT.aggregate,
    stage: fillNames(TEXT.death.stage, { name: labels.stageLabel, number: labels.stageNumber }),
    stats: RUN_STAT_KEYS.map((key) => ({ label: metricLabels[key], value: values[key] })),
    totals: statsTotalRows(
      { ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal },
      {
        runSeconds: data.wholeRun.activeSeconds,
        stageSeconds: data.runStats.runSeconds,
        zoneSeconds: data.zoneStats.runSeconds,
      },
    ),
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
  for (const block of [layout.stage, layout.aggregate]) {
    const colour =
      block === layout.stage
        ? zoneTheme(ZONE_MAP, scene.cache.json.get(ZONE_THEMES_KEY) as ZoneThemes, data.stage)
            .primary
        : "lgrey";
    scene.add
      .rectangle(block.panel.x, block.panel.y, block.panel.width, 2, paletteColour(scene, colour))
      .setOrigin(0);
    drawText(BODY_FONT, block.title, block.text, "cream");
    for (const row of block.rows) {
      drawText(BODY_FONT, row.label.rect, row.label.text, "lgrey");
      drawText(BODY_FONT, row.value.rect, row.value.text, "white");
    }
  }
  scene.add
    .rectangle(
      layout.divider.x,
      layout.divider.y,
      layout.divider.width,
      layout.divider.height,
      paletteColour(scene, "lgrey"),
    )
    .setOrigin(0);
  return layout;
}
