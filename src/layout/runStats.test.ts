import { laidGlyphs, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";
import { formatRunStats } from "../save/runSummary";
import { deathLabels, deathSummary } from "../view/death";
import { statsStatement } from "../view/statsStatement";
import { CUTSCENE_CONTINUE, STAGE_SUMMARY_BOUNDS } from "./cutscene";
import {
  RUN_STAT_KEYS,
  runStatLabels,
  stageSummaryLayout,
  statsTotalRows,
  summaryTextOrigin,
} from "./runStats";

const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
const run = { attemptSeconds: 180, attempts: 12, bestSeconds: undefined, runSeconds: 1234 };
const values = formatRunStats(
  { ...TEXT.stats, attempts: "{count}", best: "{time}", lastAttempt: "{time}" },
  run,
);
const labels = runStatLabels(TEXT.stats);
const sampleStage = ZONE_MAP.destinations.find((zone) => zone.id === "industrial")!.stages[1]!;
function wordsFor(stage: string) {
  const identity = deathSummary(TEXT.death, {
    ...deathLabels(ZONE_MAP, TEXT.map, stage, stage),
    activeSeconds: run.attemptSeconds,
    percent: 1,
  });
  return {
    progress: identity.progress,
    stage: identity.stage,
    statement: statsStatement("clear", stage),
    stats: RUN_STAT_KEYS.map((key) => ({ label: labels[key], value: values[key] })),
    totals: statsTotalRows(
      { ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal },
      {
        runSeconds: 599999,
        stageSeconds: run.runSeconds,
        zoneSeconds: 3400,
      },
    ),
    zone: identity.title,
  };
}
const words = wordsFor(sampleStage);

describe("preview-first stage summaries", () => {
  it("centres the preview and joint statistics block below zone, stage and actual progress", () => {
    const result = stageSummaryLayout(fonts, STAGE_SUMMARY_BOUNDS, words);
    expect([result.zone.rect.y, result.stage.rect.y, result.progress.rect.y]).toEqual([16, 38, 38]);
    expect(result.image).toEqual({ height: 120, width: 240, x: 240, y: 57 });
    expect(result.stats.map((row) => row.label.rect.y)).toEqual([181, 201, 221]);
    expect(result.totals.map((row) => row.label.rect.y)).toEqual([181, 201, 221]);
    expect(result.stats.map((row) => row.label.rect.x)).toEqual([192, 192, 192]);
    expect(result.totals.map((row) => row.label.rect.x)).toEqual([376, 376, 376]);
    expect(result.stats.map((row) => row.value.rect.x + row.value.rect.width)).toEqual([
      344, 344, 344,
    ]);
    expect(result.totals.map((row) => row.value.rect.x + row.value.rect.width)).toEqual([
      528, 528, 528,
    ]);
    expect(result.stats.map((row) => row.value.text)).toEqual([
      values.lastAttempt,
      values.best,
      values.attempts,
    ]);
    expect(result.totals.map((row) => row.value.text)).toEqual(["20:34", "56:40", "9999:59"]);
    expect(result.statement!.rect.y).toBe(244);
    expect(result.statement!.rect.y + result.statement!.rect.height).toBe(259);
    expect(result).not.toHaveProperty("divider");
    expect(result).not.toHaveProperty("wholeRun");
    expect(result).not.toHaveProperty("aggregate");
  });
  it("fits all actual stage names and clear statements at native font size before the footer", () => {
    for (const destination of ZONE_MAP.destinations) {
      for (const stage of destination.stages) {
        const result = stageSummaryLayout(fonts, STAGE_SUMMARY_BOUNDS, wordsFor(stage));
        for (const heading of [result.zone, result.stage, result.progress]) {
          expect(heading.rect.x).toBeGreaterThanOrEqual(STAGE_SUMMARY_BOUNDS.x);
          expect(heading.rect.x + heading.rect.width).toBeLessThanOrEqual(704);
        }
        expect(result.zone.rect.x + result.zone.rect.width / 2).toBe(360);
        expect(
          (result.stage.rect.x + result.progress.rect.x + result.progress.rect.width) / 2,
        ).toBe(360);
        expect(result.progress.rect.x - result.stage.rect.x - result.stage.rect.width).toBe(16);
        expect(result.stage.rect.y).toBe(result.progress.rect.y);
        expect(result.zone.scale).toBe(1.5);
        expect(result.stage.scale).toBe(1);
        expect(result.progress.scale).toBe(1);
        expect(result.image.width).toBe(240);
        expect(result.image.height).toBe(120);
        const origin = summaryTextOrigin(
          fonts.title,
          result.zone.rect,
          result.zone.text,
          result.zone.scale,
        );
        const glyphs = laidGlyphs(fonts.title, result.zone.scale, result.zone.text).flatMap(
          ({ ink }) => (ink ? [ink] : []),
        );
        expect(origin.x + Math.min(...glyphs.map((ink) => ink.left))).toBe(result.zone.rect.x);
        expect(result.image.width / result.image.height).toBe(2);
        expect(result.statement!.rect.x).toBeGreaterThanOrEqual(16);
        expect(result.statement!.rect.x + result.statement!.rect.width).toBeLessThanOrEqual(704);
        expect(result.statement!.rect.y + result.statement!.rect.height).toBeLessThanOrEqual(
          CUTSCENE_CONTINUE.hit.y - 8,
        );
        expect(
          CUTSCENE_CONTINUE.hit.y - result.statement!.rect.y - result.statement!.rect.height,
        ).toBeGreaterThanOrEqual(8);
        for (const row of [...result.stats, ...result.totals]) {
          expect(row.value.rect.x - row.label.rect.x - row.label.rect.width).toBeGreaterThanOrEqual(
            8,
          );
        }
      }
    }
  });
  it("reports values that exceed the measured columns without shrinking or clipping", () => {
    expect(() =>
      stageSummaryLayout(fonts, STAGE_SUMMARY_BOUNDS, {
        ...words,
        totals: words.totals.map((row) => ({ ...row, value: "9".repeat(20) })),
      }),
    ).toThrow("Stage summary metric exceeds its column");
  });
  it("omits the statement and its hit rectangle when there is no actual clear statement", () => {
    const result = stageSummaryLayout(fonts, STAGE_SUMMARY_BOUNDS, {
      ...words,
      statement: undefined,
    });
    expect(result.statement).toBeUndefined();
  });
  it("anchors visible glyph ink at the supplied top-left point", () => {
    const text = values.best;
    const rect = { height: 16, width: 300, x: 40, y: 70 };
    const origin = summaryTextOrigin(fonts.body, rect, text);
    const left = Math.min(
      ...laidGlyphs(fonts.body, 2, text).flatMap(({ ink }) => (ink ? [ink.left] : [])),
    );
    expect(origin.x + left).toBe(rect.x);
  });
});

it("formats each total from its own read-only active-time snapshot", () => {
  const totals = { runSeconds: 610.8, stageSeconds: 130.9, zoneSeconds: 290.2 };
  expect(statsTotalRows({ ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal }, totals)).toEqual([
    { label: STATS_SCOPE_TEXT.stageTotal.replace("{time}", "").trimEnd(), value: "2:10" },
    { label: STATS_SCOPE_TEXT.zoneTotal.replace("{time}", "").trimEnd(), value: "4:50" },
    { label: TEXT.stats.runTotal.replace("{time}", "").trimEnd(), value: "10:10" },
  ]);
  expect(totals).toEqual({ runSeconds: 610.8, stageSeconds: 130.9, zoneSeconds: 290.2 });
});
