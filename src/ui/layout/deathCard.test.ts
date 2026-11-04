import { inkWidth, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../../data/map";
import { SCREEN } from "../../data/screen";
import { STATS_SCOPE_TEXT, TEXT } from "../../data/text";
import { deathLabels, deathSummary } from "../../presentation";
import { formatRunStats } from "../../save/runSummary";
import { statsStatement } from "../dialogue/statsStatement";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { CARD_CONTENT } from "./contentCard";
import { deathCard } from "./deathCard";
import { RUN_STAT_KEYS, runStatLabels, statsTotalRows } from "./runStats";

const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
const view = { ...SCREEN, x: 0, y: 0 };
const labels = { home: TEXT.pause.home, retry: TEXT.death.retry };
const words = {
  ...labels,
  progress: "Progress: 25%",
  stage: "Stage 1",
  stats: RUN_STAT_KEYS.map((key) => ({
    label: runStatLabels(TEXT.stats)[key],
    value: formatRunStats(
      { ...TEXT.stats, attempts: "{count}", best: "{time}", lastAttempt: "{time}" },
      {
        attemptSeconds: 65,
        attempts: 2,
        bestSeconds: 45,
        runSeconds: 130,
      },
    )[key],
  })),
  title: "City",
  totals: statsTotalRows(
    { ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal },
    {
      runSeconds: 610,
      stageSeconds: 130,
      zoneSeconds: 290,
    },
  ),
};

describe("death card", () => {
  it("centres the measured card and preserves full-size grouped statistics", () => {
    const result = deathCard(fonts, view, words);
    expect(result.card.x + result.card.width / 2).toBe(SCREEN.width / 2);
    expect(result.card.y + result.card.height / 2).toBe(SCREEN.height / 2);
    expect(result.card.width).toBeGreaterThanOrEqual(SCREEN.width / 2);
    expect(result.stage.y).toBeGreaterThan(result.title.y);
    expect(result.progress.y).toBeGreaterThan(result.stage.y);
    expect(result.stats[0]!.rect.y - result.progress.y - result.progress.height).toBe(16);
    expect(result.divider.x + result.divider.width / 2).toBe(SCREEN.width / 2);
    expect(result.stats[0]!.rect.y).toBe(result.stats[3]!.rect.y);
    for (const [index, row] of result.stats.entries()) {
      expect(row.label.text).toBe(
        [words.stats[1], words.stats[2], words.stats[0], ...words.totals][index]?.label,
      );
      expect(row.value.text).toBe(
        [words.stats[1], words.stats[2], words.stats[0], ...words.totals][index]?.value,
      );
      const first = result.stats[index < words.stats.length ? 0 : words.stats.length]!;
      expect(row.label.rect.x).toBe(first.rect.x);
      expect(row.value.rect.x + row.value.rect.width).toBe(first.rect.x + first.rect.width);
      if (index < words.stats.length) {
        expect(result.divider.x - row.rect.x - row.rect.width).toBe(2 * CARD_CONTENT.gap);
      } else {
        expect(row.rect.x - result.divider.x - result.divider.width).toBe(2 * CARD_CONTENT.gap);
      }
      expect(row.value.rect.x - row.label.rect.x - row.label.rect.width).toBeGreaterThanOrEqual(8);
    }
    expect(result.stats[0]!.rect.x - result.card.x).toBeGreaterThanOrEqual(24);
    expect(
      result.card.x + result.card.width - result.stats[5]!.rect.x - result.stats[5]!.rect.width,
    ).toBeGreaterThanOrEqual(24);
    expect(result.home.button.y - result.divider.y - result.divider.height).toBe(16);
    expect(result.home.button.height).toBe(TEXT_BUTTON.height);
    expect(result.home.button.x + result.home.button.width).toBeLessThan(result.retry.button.x);
    expect(result.title.x - result.card.x).toBe(50);
    expect(result.card.x + result.card.width - result.title.x - result.title.width).toBe(50);
  });
  it("right-aligns a missing best with the other times without crowding the divider", () => {
    const result = deathCard(fonts, view, {
      ...words,
      stats: words.stats.map((row, index) =>
        index === RUN_STAT_KEYS.indexOf("best") ? { ...row, value: TEXT.stats.notCleared } : row,
      ),
    });
    expect(result.stats[1]!.value.text).toBe(TEXT.stats.notCleared);
    const right = (index: number) =>
      result.stats[index]!.value.rect.x + result.stats[index]!.value.rect.width;
    expect(right(1)).toBe(right(0));
    expect(result.stats[1]!.value.rect.width).toBe(
      inkWidth(fonts.body, CARD_TEXT_SCALE, TEXT.stats.notCleared),
    );
    expect(result.stats[0]!.rect.width).toBe(result.stats[3]!.rect.width);
    expect(result.divider.x + result.divider.width / 2).toBe(SCREEN.width / 2);
    expect(result.card.x).toBeGreaterThanOrEqual(CARD_CONTENT.padding);
    expect(result.card.x + result.card.width).toBeLessThanOrEqual(
      SCREEN.width - CARD_CONTENT.padding,
    );
    for (const row of result.stats) {
      expect(row.value.rect.x - row.label.rect.x - row.label.rect.width).toBeGreaterThanOrEqual(
        CARD_CONTENT.gap,
      );
    }
  });
  it.each(ZONE_MAP.destinations.flatMap(({ stages }) => stages))(
    "measures the actual %s text without shrinking fonts",
    (stageId) => {
      const summary = deathSummary(TEXT.death, {
        activeSeconds: 65,
        ...deathLabels(ZONE_MAP, TEXT.map, "1", stageId),
        percent: 0.5,
      });
      const layout = deathCard(fonts, view, {
        ...labels,
        ...summary,
        stats: words.stats,
        totals: words.totals,
      });
      expect(layout.card.x + layout.card.width / 2).toBe(SCREEN.width / 2);
      expect(layout.card.y + layout.card.height / 2).toBe(SCREEN.height / 2);
      expect(layout.card.y).toBeGreaterThanOrEqual(CARD_CONTENT.padding);
      expect(layout.card.y + layout.card.height).toBeLessThanOrEqual(
        SCREEN.height - CARD_CONTENT.padding,
      );
      for (const name of ["title", "stage", "progress"] as const) {
        expect(
          Math.max(
            ...(name === "title"
              ? layout.titleText
              : name === "stage"
                ? layout.stageText
                : summary[name]
            )
              .split("\n")
              .map((line) =>
                inkWidth(name === "title" ? fonts.title : fonts.body, CARD_TEXT_SCALE, line),
              ),
          ),
        ).toBeLessThanOrEqual(layout[name].width);
      }
      for (const name of ["home", "retry"] as const) {
        expect(layout[name].button.height).toBe(TEXT_BUTTON.height);
        expect(layout[name].hit.width).toBeGreaterThanOrEqual(48);
        expect(layout[name].hit.height).toBeGreaterThanOrEqual(48);
        expect(
          layout[name].button.width - inkWidth(fonts.title, CARD_TEXT_SCALE, labels[name]),
        ).toBeGreaterThanOrEqual(2 * TEXT_BUTTON.inset);
      }
    },
  );
});

it("fits all six actual retry statements and grouped totals within the centred safe viewport", () => {
  for (const zone of ZONE_MAP.destinations) {
    for (const stageId of zone.stages) {
      const statement = statsStatement("retry", stageId)!.text;
      const summary = deathSummary(TEXT.death, {
        activeSeconds: 65,
        ...deathLabels(ZONE_MAP, TEXT.map, "1", stageId),
        percent: 0.5,
      });
      const result = deathCard(fonts, view, {
        ...labels,
        ...summary,
        statement,
        stats: words.stats.map((row, index) =>
          index === RUN_STAT_KEYS.indexOf("best") ? { ...row, value: TEXT.stats.notCleared } : row,
        ),
        totals: words.totals,
      });
      expect(result.card.x + result.card.width / 2).toBe(SCREEN.width / 2);
      expect(result.card.y + result.card.height / 2).toBe(SCREEN.height / 2);
      expect(result.card.y).toBeGreaterThanOrEqual(CARD_CONTENT.padding);
      expect(result.card.y + result.card.height).toBeLessThanOrEqual(
        SCREEN.height - CARD_CONTENT.padding,
      );
      expect(result.divider.x + result.divider.width / 2).toBe(SCREEN.width / 2);
      expect(result.divider.y).toBe(result.stats[0]!.rect.y);
      expect(result.stats[3]!.rect.y).toBe(result.stats[0]!.rect.y);
      for (const last of [result.stats[2]!, result.stats[5]!]) {
        expect(last.rect.y + last.rect.height).toBeLessThanOrEqual(
          result.divider.y + result.divider.height,
        );
      }
      expect(result.statement!.text).toBe(statement);
      expect(result.statement!.rect.height).toBe(CARD_CONTENT.lineHeight);
      expect(inkWidth(fonts.body, CARD_TEXT_SCALE, statement)).toBeLessThanOrEqual(
        result.card.width - 2 * CARD_CONTENT.padding,
      );
      expect(result.statement!.rect.y - result.progress.y - result.progress.height).toBe(
        CARD_CONTENT.gap,
      );
      expect(
        result.stats[0]!.rect.y - result.statement!.rect.y - result.statement!.rect.height,
      ).toBe(2 * CARD_CONTENT.gap);
      expect(result.home.button.y - result.divider.y - result.divider.height).toBe(
        2 * CARD_CONTENT.gap,
      );
      expect(result.card.height).toBe(248);
      expect(result.home.button.height).toBe(TEXT_BUTTON.height);
      expect(result.retry.button.height).toBe(TEXT_BUTTON.height);
      expect(result.title.x - result.card.x).toBe(50);
    }
  }
});
