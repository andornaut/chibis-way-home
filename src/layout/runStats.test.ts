import { fillNames } from "@andornaut/game-kit/lines";
import { laidGlyphs, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";
import { formatRunStats } from "../save/runSummary";
import { deathLabels } from "../view/death";
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
const words = {
  aggregate: STATS_SCOPE_TEXT.aggregate,
  stage: "Stage 2: Country lanes",
  stats: RUN_STAT_KEYS.map((key) => ({ label: labels[key], value: values[key] })),
  totals: statsTotalRows(
    { ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal },
    { runSeconds: 599999, stageSeconds: run.runSeconds, zoneSeconds: 3400 },
  ),
};
const bounds = { height: 164, width: 688, x: 16, y: 112 };

describe("image-backed stage summaries", () => {
  it("separates current-stage results and scoped totals around the uncropped preview", () => {
    const result = stageSummaryLayout(fonts, bounds, words);
    expect(result.stage.panel).toEqual({ height: 124, width: 212, x: 16, y: 112 });
    expect(result.image).toEqual({ height: 116, width: 232, x: 244, y: 128 });
    expect(result.aggregate.panel).toEqual({ height: 124, width: 212, x: 492, y: 112 });
    expect(result.divider).toEqual({ height: 132, width: 2, x: 483, y: 112 });
    expect(result.divider.x).toBeGreaterThan(result.image.x + result.image.width);
    expect(result.divider.x + result.divider.width).toBeLessThan(result.aggregate.panel.x);
    expect(result).not.toHaveProperty("wholeRun");
    expect(result).not.toHaveProperty("zone");
    expect(result.stage.rows.map(({ value }) => value.text)).toEqual([
      values.attempts,
      values.lastAttempt,
      values.best,
    ]);
    expect(result.aggregate.rows.map(({ value }) => value.text)).toEqual([
      "20:34",
      "56:40",
      "9999:59",
    ]);
    expect(result.stage.title.x - result.stage.panel.x).toBe(16);
    expect(result.aggregate.title.x - result.aggregate.panel.x).toBe(16);
    expect(result.stage.rows.map(({ rect }) => rect.y)).toEqual(
      result.aggregate.rows.map(({ rect }) => rect.y),
    );
    expect(
      new Set([...result.stage.rows, ...result.aggregate.rows].map(({ value }) => value.rect.x))
        .size,
    ).toBe(2);
  });
  it("fits every catalogued stage name with full-size headings and footer clearance", () => {
    for (const destination of ZONE_MAP.destinations) {
      for (const stage of destination.stages) {
        const identity = deathLabels(ZONE_MAP, TEXT.map, stage, stage);
        const result = stageSummaryLayout(fonts, bounds, {
          ...words,
          stage: fillNames(TEXT.death.stage, {
            name: identity.stageLabel,
            number: identity.stageNumber,
          }),
        });
        expect(result.image.width / result.image.height).toBe(2);
        for (const block of [result.stage, result.aggregate]) {
          expect(block.title.x + block.title.width).toBeLessThanOrEqual(bounds.x + bounds.width);
          expect(block.rows.at(-1)!.rect.y + block.rows.at(-1)!.rect.height).toBeLessThanOrEqual(
            bounds.y + bounds.height,
          );
          expect(block.rows[0]!.rect.y - block.title.y).toBe(block.title.height + 4);
          for (const row of block.rows) {
            expect(row.value.rect.x - row.label.rect.x - row.label.rect.width).toBe(8);
          }
        }
      }
    }
  });
  it("reports oversized metric values rather than shrinking or clipping their font", () => {
    expect(() =>
      stageSummaryLayout(fonts, bounds, {
        ...words,
        totals: words.totals.map((row) => ({ ...row, value: "9".repeat(20) })),
      }),
    ).toThrow("Stage summary metric exceeds its column");
  });
  it("anchors visible text ink to the left edge rather than centring it inside the slot", () => {
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
