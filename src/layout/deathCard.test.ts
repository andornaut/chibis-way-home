import { inkWidth, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { BIRD_FRAME } from "../view/bird";
import { deathLabels, deathSummary } from "../view/death";
import { statsStatement } from "../view/statsStatement";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { CARD_CONTENT } from "./contentCard";
import { deathCard } from "./deathCard";

const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
const view = { ...SCREEN, x: 0, y: 0 };
const labels = { home: TEXT.pause.home, retry: TEXT.death.retry };
const words = {
  ...labels,
  progress: "Progress: 25%",
  stage: "Stage 1",
  stats: [
    { label: "Last attempt:", value: "1:05" },
    { label: "Run total:", value: "2:10" },
    { label: "Best:", value: "Not cleared" },
    { label: "Attempts:", value: "2" },
  ],
  title: "City",
};

describe("death card", () => {
  it("centres the measured card and preserves full-size grouped statistics", () => {
    const result = deathCard(fonts, view, words);
    expect(result.card.x + result.card.width / 2).toBe(SCREEN.width / 2);
    expect(result.card.y + result.card.height / 2).toBe(SCREEN.height / 2);
    expect(result.card.width).toBeGreaterThanOrEqual(SCREEN.width / 2);
    expect(result.stage.y).toBeGreaterThan(result.title.y);
    expect(result.progress.y).toBeGreaterThan(result.stage.y);
    expect(result.stats[0]!.rect.y - result.progress.y - result.progress.height).toBe(8);
    const left = result.stats[0]!.label.rect.x;
    const right = result.stats[0]!.value.rect.x + result.stats[0]!.value.rect.width;
    for (const [index, row] of result.stats.entries()) {
      expect(row.label.text).toBe(words.stats[index]?.label);
      expect(row.value.text).toBe(words.stats[index]?.value);
      expect(row.label.rect.x).toBe(left);
      expect(row.value.rect.x + row.value.rect.width).toBe(right);
      expect(row.value.rect.x - row.label.rect.x - row.label.rect.width).toBeGreaterThanOrEqual(8);
    }
    expect(result.home.button.height).toBe(TEXT_BUTTON.height);
    expect(result.home.button.x + result.home.button.width).toBeLessThan(result.retry.button.x);
    expect(result.title.x - result.card.x).toBe(50);
    expect(result.card.x + result.card.width - result.title.x - result.title.width).toBe(50);
  });
  it.each(ZONE_MAP.destinations.flatMap(({ stages }) => stages))(
    "measures the actual %s text without shrinking fonts",
    (stageId) => {
      const summary = deathSummary(TEXT.death, {
        activeSeconds: 65,
        ...deathLabels(ZONE_MAP, TEXT.map, "1", stageId),
        percent: 0.5,
      });
      const layout = deathCard(fonts, view, { ...labels, ...summary, stats: words.stats });
      expect(layout.card.x + layout.card.width / 2).toBe(SCREEN.width / 2);
      expect(layout.card.y + layout.card.height / 2).toBe(SCREEN.height / 2);
      expect(
        layout.card.y + layout.card.height + CARD_CONTENT.gap + BIRD_FRAME.height,
      ).toBeLessThanOrEqual(SCREEN.height);
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
          layout[name].button.width - inkWidth(fonts.body, CARD_TEXT_SCALE, labels[name]),
        ).toBeGreaterThanOrEqual(2 * TEXT_BUTTON.inset);
      }
    },
  );
});

it("fits all six actual retry statements at full size while preserving seated-frame clearance", () => {
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
        stats: words.stats,
      });
      expect(result.card.x + result.card.width / 2).toBe(SCREEN.width / 2);
      expect(result.card.y + result.card.height / 2).toBe(SCREEN.height / 2);
      expect(
        result.card.y + result.card.height + CARD_CONTENT.gap + BIRD_FRAME.height,
      ).toBeLessThanOrEqual(SCREEN.height);
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
      ).toBe(CARD_CONTENT.gap);
      expect(result.home.button.height).toBe(TEXT_BUTTON.height);
      expect(result.retry.button.height).toBe(TEXT_BUTTON.height);
      expect(result.title.x - result.card.x).toBe(50);
    }
  }
});
