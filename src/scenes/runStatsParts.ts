import type { Scene } from "phaser";

import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { deathLabels, deathSummary } from "../presentation";
import {
  formatRunStats,
  type RunStatsSummary,
  type WholeRunDisplaySummary,
  type ZoneStatsSummary,
} from "../progress";
import {
  type DialogueParagraph,
  FONT_SCALE,
  RUN_STAT_KEYS,
  runStatLabels,
  stageSummaryLayout,
  statsTotalRows,
  summaryTextOrigin,
} from "../ui";
import { addCardText, BODY_FONT, cardFonts, paletteColour, TITLE_FONT } from "./cardParts";

export function addStageSummary(
  scene: Scene,
  bounds: Rect,
  data: {
    readonly percent: number;
    readonly stage: string;
    readonly statement?: DialogueParagraph | undefined;
    readonly runStats: RunStatsSummary;
    readonly zoneStats: ZoneStatsSummary;
    readonly wholeRun: WholeRunDisplaySummary;
  },
) {
  const labels = deathLabels(ZONE_MAP, TEXT.map, data.stage, data.stage);
  const identity = deathSummary(TEXT.death, {
    ...labels,
    activeSeconds: data.runStats.attemptSeconds,
    percent: data.percent,
  });
  const metricLabels = runStatLabels(TEXT.stats);
  const values = formatRunStats(
    { ...TEXT.stats, attempts: "{count}", best: "{time}", lastAttempt: "{time}" },
    data.runStats,
  );
  const words = {
    progress: identity.progress,
    stage: identity.stage,
    ...(data.statement && { statement: data.statement }),
    stats: RUN_STAT_KEYS.map((key) => ({ label: metricLabels[key], value: values[key] })),
    totals: statsTotalRows(
      { ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal },
      {
        runSeconds: data.wholeRun.activeSeconds,
        stageSeconds: data.runStats.cumulativeSeconds ?? data.runStats.runSeconds,
        zoneSeconds: data.zoneStats.cumulativeSeconds ?? data.zoneStats.runSeconds,
      },
    ),
    zone: identity.title,
  };
  const fonts = cardFonts(scene);
  const layout = stageSummaryLayout(fonts, bounds, words);
  const drawText = (
    font: string,
    rect: Rect,
    text: string,
    colour: string,
    scale = FONT_SCALE,
    lineHeight?: number,
  ) => {
    const metrics = font === TITLE_FONT ? fonts.title : fonts.body;
    return addCardText(
      scene,
      font,
      summaryTextOrigin(metrics, rect, text, scale),
      text,
      paletteColour(scene, colour),
    )
      .setScale(scale)
      .setLineSpacing((lineHeight ?? metrics.lineHeight * scale) / scale - metrics.lineHeight)
      .setLeftAlign();
  };
  const key = STAGE_PREVIEWS[data.stage];
  if (!key || !scene.textures.exists(key)) {
    throw new Error(`Missing actual stage preview ${data.stage}`);
  }
  scene.add
    .image(layout.image.x, layout.image.y, key)
    .setOrigin(0)
    .setDisplaySize(layout.image.width, layout.image.height);
  drawText(
    TITLE_FONT,
    layout.zone.rect,
    layout.zone.text,
    "lgrey",
    layout.zone.scale,
    layout.zone.lineHeight,
  );
  drawText(BODY_FONT, layout.stage.rect, layout.stage.text, "cream");
  drawText(BODY_FONT, layout.progress.rect, layout.progress.text, "lgrey");
  for (const row of [...layout.stats, ...layout.totals]) {
    drawText(BODY_FONT, row.label.rect, row.label.text, "lgrey");
    drawText(BODY_FONT, row.value.rect, row.value.text, "white");
  }
  if (layout.statement) {
    drawText(
      BODY_FONT,
      layout.statement.name.rect,
      layout.statement.name.text,
      layout.statement.colour,
    );
    drawText(BODY_FONT, layout.statement.text.rect, layout.statement.text.text, "cream");
  }
  return layout;
}
