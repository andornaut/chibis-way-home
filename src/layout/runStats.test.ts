import { fillNames } from "@andornaut/game-kit/lines";
import { laidGlyphs, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";
import { formatRunStats, formatWholeRunStats, formatZoneStats } from "../save/runSummary";
import { deathLabels } from "../view/death";
import { runStatLabels, stageSummaryLayout, summaryTextOrigin } from "./runStats";

const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
const run = { attemptSeconds: 180, attempts: 12, bestSeconds: undefined, runSeconds: 1234 };
const stageTemplates = { ...TEXT.stats, runTotal: STATS_SCOPE_TEXT.stageTotal };
const zoneTemplates = { ...TEXT.stats, runTotal: STATS_SCOPE_TEXT.zoneTotal };
const runWords = formatRunStats(stageTemplates, run);
const metricLabels = { stage: runStatLabels(stageTemplates), zone: runStatLabels(zoneTemplates) };
const wholeRun = formatWholeRunStats(STATS_SCOPE_TEXT.wholeRun, {
  activeSeconds: 599999,
  completed: 21,
  deaths: 9999,
  total: 21,
});

describe("image-backed stage summaries", () => {
  it("aligns full-size columns, page bounds and uncropped preview with the footer", () => {
    const bounds = { height: 164, width: 688, x: 16, y: 112 };
    const result = stageSummaryLayout(fonts, bounds, {
      labels: metricLabels,
      run: runWords,
      stage: "Stage 2: Country lanes",
      visit: formatZoneStats(zoneTemplates, { ...run, completed: 1, partial: true, total: 3 }),
      wholeRun,
      zone: "Countryside",
    });
    expect(result.zone!.panel).toEqual({ height: 144, width: 212, x: 16, y: 112 });
    expect(result.image).toEqual({ height: 116, width: 232, x: 244, y: 128 });
    expect(result.stage.panel).toEqual({ height: 144, width: 212, x: 492, y: 112 });
    expect(result.wholeRun.rect).toEqual({ height: 16, width: 688, x: 16, y: 260 });
    expect(result.wholeRun.rect.y + result.wholeRun.rect.height + 8).toBe(284);
    expect(result.zone!.rows[1]!.label.text).toBe(metricLabels.zone.runTotal);
    expect(result.stage.rows[1]!.label.text).toBe(metricLabels.stage.runTotal);
    expect(result.zone!.title.x - result.zone!.panel.x).toBe(16);
    expect(result.stage.title.x - result.stage.panel.x).toBe(16);
    expect(result.zone!.rows.map(({ rect }) => rect.y)).toEqual(
      result.stage.rows.map(({ rect }) => rect.y),
    );
    expect(result.stage.rows.map(({ text }) => text)).toEqual([
      runWords.lastAttempt,
      runWords.runTotal,
      runWords.best,
      runWords.attempts,
    ]);
    expect(new Set(result.stage.rows.map(({ value }) => value.rect.x)).size).toBe(1);
  });
  it("fits every catalogued stage name and partial zone at unchanged font sizes", () => {
    for (const destination of ZONE_MAP.destinations) {
      for (const stage of destination.stages) {
        const labels = deathLabels(ZONE_MAP, TEXT.map, stage, stage);
        const bounds = { height: 164, width: 688, x: 16, y: 112 };
        const result = stageSummaryLayout(fonts, bounds, {
          labels: metricLabels,
          run: runWords,
          stage: fillNames(TEXT.death.stage, {
            name: labels.stageLabel,
            number: labels.stageNumber,
          }),
          visit: formatZoneStats(zoneTemplates, {
            ...run,
            completed: 1,
            partial: true,
            total: destination.stages.length,
          }),
          wholeRun,
          zone: labels.zoneLabel,
        });
        expect(result.image.x).toBeGreaterThanOrEqual(bounds.x);
        expect(result.image.width / result.image.height).toBe(2);
        for (const block of [result.stage, result.zone!]) {
          expect(block.title.x + block.title.width).toBeLessThanOrEqual(bounds.x + bounds.width);
          expect(block.rows.at(-1)!.rect.y + block.rows.at(-1)!.rect.height).toBeLessThanOrEqual(
            bounds.y + bounds.height,
          );
          expect(block.rows[0]!.rect.y - block.title.y).toBeGreaterThanOrEqual(
            block.title.height + 4,
          );
        }
      }
    }
  });
  it("anchors visible text ink to the left edge rather than centring it inside the slot", () => {
    const text = runWords.best;
    const rect = { height: 16, width: 300, x: 40, y: 70 };
    const origin = summaryTextOrigin(fonts.body, rect, text);
    const left = Math.min(
      ...laidGlyphs(fonts.body, 2, text).flatMap(({ ink }) => (ink ? [ink.left] : [])),
    );
    expect(origin.x + left).toBe(rect.x);
  });
});
