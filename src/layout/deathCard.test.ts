import { inkWidth, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { deathLabels, deathSummary } from "../view/death";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_TEXT_SCALE } from "./cardFrame";
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
  it.each([
    { height: 40, width: 40, x: 340, y: 310 },
    { height: 40, width: 40, x: 340, y: 80 },
    { height: 40, width: 40, x: 340, y: 150 },
    { height: 40, width: 40, x: 0, y: 0 },
    { height: 40, width: 40, x: 680, y: 150 },
  ])("keeps the seated bird visible at ground and elevated positions: %j", (bird) => {
    const { card, title } = deathCard(fonts, view, bird, words);
    expect(title.x + title.width / 2).toBe(card.x + card.width / 2);
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(SCREEN.width);
    expect(card.y + card.height).toBeLessThanOrEqual(SCREEN.height);
    expect(
      card.x + card.width <= bird.x - 8 ||
        card.x >= bird.x + bird.width + 8 ||
        card.y + card.height <= bird.y - 8 ||
        card.y >= bird.y + bird.height + 8,
    ).toBe(true);
  });
  it("caps only the body-clear safe region when no full-width placement fits", () => {
    const body = { height: 40, width: 40, x: 340, y: 150 };
    const result = deathCard(fonts, view, body, words);
    expect(result.card.width).toBe(body.x - 8 - view.x);
    expect(result.card.height).toBeLessThanOrEqual(SCREEN.height);
    expect(result.card.width).toBeLessThan(SCREEN.width / 2);
    expect(result.home.button.width).toBe(114);
    expect(result.retry.button.width).toBe(114);
  });
  it("uses the compact top-centred City layout when the bird is below it", () => {
    const result = deathCard(fonts, view, { height: 40, width: 40, x: 340, y: 310 }, words);
    expect(result.card.y).toBe(16);
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
      const layout = deathCard(
        fonts,
        view,
        { height: 40, width: 40, x: 340, y: 310 },
        { ...labels, ...summary, stats: words.stats },
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
          layout[name].button.width - inkWidth(fonts.body, CARD_TEXT_SCALE, labels[name]),
        ).toBeGreaterThanOrEqual(2 * TEXT_BUTTON.inset);
      }
    },
  );
});
