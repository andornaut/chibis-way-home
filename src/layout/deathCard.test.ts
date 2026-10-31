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
  stats: ["Last attempt: 1:05", "Run total: 2:10", "Best: Not cleared", "Attempts: 2"],
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
    const { card } = deathCard(fonts, view, bird, words);
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
    expect(result.card.height).toBe(224);
    expect(result.card.width).toBeLessThan(SCREEN.width / 2);
    expect(result.home.button.width).toBe(114);
    expect(result.retry.button.width).toBe(114);
  });
  it("uses the compact top-centred City layout when the bird is below it", () => {
    const result = deathCard(fonts, view, { height: 40, width: 40, x: 340, y: 310 }, words);
    expect(result.card).toMatchObject({ height: 224, y: 16 });
    expect([
      result.title.y,
      result.stage.y,
      result.progress.y,
      ...result.stats.map(({ rect }) => rect.y),
    ]).toEqual([32, 52, 72, 92, 112, 132, 152]);
    expect(result.home.button).toEqual({ height: 48, width: 114, x: 242, y: 176 });
    expect(result.retry.button.x).toBe(364);
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
        expect(
          layout[name].button.width - inkWidth(fonts.body, CARD_TEXT_SCALE, labels[name]),
        ).toBeGreaterThanOrEqual(2 * TEXT_BUTTON.inset);
      }
    },
  );
});
