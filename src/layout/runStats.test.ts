import { fillNames } from "@andornaut/game-kit/lines";
import { laidGlyphs, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { TEXT } from "../data/text";
import { formatRunStats, formatZoneStats } from "../save/runSummary";
import { deathLabels } from "../view/death";
import { runStatLabels, stageSummaryLayout, summaryTextOrigin } from "./runStats";

const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
const run = { attemptSeconds: 180, attempts: 12, bestSeconds: undefined, runSeconds: 1234 };
const runWords = formatRunStats(TEXT.stats, run);

describe("image-backed stage summaries", () => {
  it.each([false, true])("fits full-size metrics with partial zone block %s", (partial) => {
    const bounds = { height: 184, width: 688, x: 16, y: 112 };
    const result = stageSummaryLayout(fonts, bounds, {
      labels: runStatLabels(TEXT.stats),
      run: runWords,
      stage: "Stage 3: Climb to the apartment",
      zone: "Apartment",
      ...(partial && {
        visit: formatZoneStats(TEXT.stats, { ...run, completed: 1, partial: true, total: 3 }),
      }),
    });
    expect(result.image).toMatchObject({ height: 84, width: 168 });
    expect(result.stage.title.y).toBe(result.image.y);
    if (result.zone) {
      expect(result.zone.title.y).toBe(result.image.y);
      expect(result.zone.rows.map(({ rect }) => rect.y)).toEqual(
        result.stage.rows.map(({ rect }) => rect.y),
      );
      expect(result.zone.subtitle?.text).toBeTruthy();
    }
    expect(new Set(result.stage.rows.map(({ value }) => value.rect.x)).size).toBe(1);
    const blocks = [result.stage, ...(result.zone ? [result.zone] : [])];
    expect(result.stage.rows.map((row) => row.text.replaceAll("\n", " "))).toEqual([
      runWords.lastAttempt,
      runWords.runTotal,
      runWords.best,
      runWords.attempts,
    ]);
    for (const block of blocks) {
      expect(block.title.y).toBeGreaterThanOrEqual(bounds.y);
      for (const row of block.rows) {
        expect(row.rect.height).toBeGreaterThanOrEqual(16);
        expect(row.rect.y + row.rect.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
    }
    expect(result.stage.title.x).toBeGreaterThanOrEqual(result.image.x + result.image.width + 16);
    if (result.zone) {
      expect(result.zone.title.x).toBeGreaterThanOrEqual(
        result.stage.title.x + result.stage.title.width + 16,
      );
    }
  });
  it("fits every catalogued stage name and partial zone at unchanged font sizes", () => {
    for (const destination of ZONE_MAP.destinations) {
      for (const stage of destination.stages) {
        const labels = deathLabels(ZONE_MAP, TEXT.map, stage, stage);
        const bounds = { height: 184, width: 688, x: 16, y: 112 };
        const result = stageSummaryLayout(fonts, bounds, {
          labels: runStatLabels(TEXT.stats),
          run: runWords,
          stage: fillNames(TEXT.death.stage, {
            name: labels.stageLabel,
            number: labels.stageNumber,
          }),
          visit: formatZoneStats(TEXT.stats, {
            ...run,
            completed: 1,
            partial: true,
            total: destination.stages.length,
          }),
          zone: labels.zoneLabel,
        });
        expect(result.image.x).toBeGreaterThanOrEqual(bounds.x);
        for (const block of [result.stage, result.zone!]) {
          expect(block.title.x + block.title.width).toBeLessThanOrEqual(bounds.x + bounds.width);
          expect(block.rows.at(-1)!.rect.y + block.rows.at(-1)!.rect.height).toBeLessThanOrEqual(
            bounds.y + bounds.height,
          );
          expect(block.rows[0]!.rect.y - block.title.y).toBeGreaterThanOrEqual(
            block.title.height + 8,
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
