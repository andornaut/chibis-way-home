import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { TEXT } from "../data/text";
import { formatRunStats, formatZoneStats } from "../save/runSummary";
import { stageSummaryLayout } from "./runStats";

const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
const run = { attemptSeconds: 180, attempts: 12, bestSeconds: undefined, runSeconds: 1234 };
const runWords = formatRunStats(TEXT.stats, run);

describe("image-backed stage summaries", () => {
  it.each([false, true])("fits full-size metrics with partial zone block %s", (partial) => {
    const bounds = { height: 184, width: 688, x: 16, y: 112 };
    const result = stageSummaryLayout(fonts, bounds, {
      run: runWords,
      stage: "Stage 3: Climb to the apartment",
      zone: "Apartment",
      ...(partial && {
        visit: formatZoneStats(TEXT.stats, { ...run, completed: 1, partial: true, total: 3 }),
      }),
    });
    expect(result.image).toMatchObject({ height: 84, width: 168 });
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
});
