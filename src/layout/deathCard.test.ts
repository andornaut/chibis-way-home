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
  time: "Time: 1:05",
  title: "City",
};

describe("death card", () => {
  it.each([
    { height: 40, width: 40, x: 340, y: 310 },
    { height: 40, width: 40, x: 340, y: 80 },
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
  it("uses the compact top-centred City layout when the bird is below it", () => {
    const result = deathCard(fonts, view, { height: 40, width: 40, x: 340, y: 310 }, words);
    expect(result.card).toMatchObject({ height: 164, y: 16 });
    expect([result.title.y, result.stage.y, result.progress.y, result.time.y]).toEqual([
      32, 52, 72, 92,
    ]);
    expect(result.home.button).toEqual({ height: 48, width: 114, x: 242, y: 116 });
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
        { ...labels, ...summary },
      );
      for (const name of ["title", "stage", "progress", "time"] as const) {
        expect(
          inkWidth(name === "title" ? fonts.title : fonts.body, CARD_TEXT_SCALE, summary[name]),
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
