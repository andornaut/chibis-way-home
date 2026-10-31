import { inkWidth, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { CARD_FONTS } from "../testing/cardFonts";
import { CARD_CONTENT } from "./contentCard";
import { type PressArea, pressedArea } from "./hitAreas";
import { CARD_TEXT_SCALE } from "./pauseCard";
import { stageSelectCard } from "./stageSelectCard";
const STAGE_SELECT_CARD = stageSelectCard(
  CARD_FONTS,
  TEXT.map.zones[ZONE_MAP.destinations[0]!.id]!,
  ZONE_MAP.destinations
    .flatMap(({ stages }) => stages.map((id) => TEXT.map.stages[id]!))
    .slice(0, 3),
);

describe("stage picker layout", () => {
  it.each(ZONE_MAP.destinations)("fits every $id stage label without shrinking", (destination) => {
    const labels = destination.stages.map((id) => TEXT.map.stages[id]!);
    const layout = stageSelectCard(CARD_FONTS, TEXT.map.zones[destination.id]!, labels);
    for (const card of layout.buttons) {
      for (const line of card.text.split("\n")) {
        expect(inkWidth(parseBitmapFont(fontBody), CARD_TEXT_SCALE, line)).toBeLessThanOrEqual(
          card.name.width,
        );
      }
      expect(card.text.split("\n").length).toBeLessThanOrEqual(2);
    }
  });
  it("keeps three image cards side by side within the safe view", () => {
    const { buttons, card, close } = STAGE_SELECT_CARD;
    expect(buttons).toHaveLength(3);
    for (const [index, stage] of buttons.entries()) {
      expect(stage.button.y).toBe(buttons[0]!.button.y);
      const previous = buttons[index - 1];
      if (previous) {
        expect(previous.button.x + previous.button.width).toBeLessThan(stage.button.x);
      }
    }
    expect(card.width).toBeGreaterThanOrEqual(SCREEN.width / 2);
    expect(card.x).toBeGreaterThanOrEqual(8);
    expect(card.x + card.width).toBeLessThanOrEqual(SCREEN.width - 8);
    expect(close.hit.width).toBeGreaterThanOrEqual(48);
    expect(close.hit.height).toBeGreaterThanOrEqual(48);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThanOrEqual(SCREEN.height);
    expect(card.x + card.width - close.art.x - close.art.width).toBe(CARD_CONTENT.closeInset);
    for (const stage of buttons) {
      expect(stage.hit.width).toBeGreaterThanOrEqual(48);
      expect(stage.hit.height).toBeGreaterThanOrEqual(48);
      expect(stage.preview.width / stage.preview.height).toBe(2);
      expect(stage.preview.y + stage.preview.height).toBeLessThanOrEqual(stage.name.y);
      expect(stage.name.y + stage.name.height).toBeLessThanOrEqual(
        stage.button.y + stage.button.height,
      );
    }
  });
  it("lays out any nonempty catalogue count that fits without changing face geometry", () => {
    const labels = STAGE_SELECT_CARD.buttons.map(({ text }) => text.replaceAll("\n", " "));
    const pair = stageSelectCard(CARD_FONTS, "", labels.slice(0, 2));
    expect(pair.buttons.map(({ button }) => button.width)).toEqual(
      STAGE_SELECT_CARD.buttons.slice(0, 2).map(({ button }) => button.width),
    );
  });
  it("keeps each stage card and close action independently pressable", () => {
    const areas: PressArea<string>[] = [
      ...STAGE_SELECT_CARD.buttons.map((row, index) => ({
        art: row.button,
        hit: row.hit,
        key: String(index),
      })),
      { art: STAGE_SELECT_CARD.close.art, hit: STAGE_SELECT_CARD.close.hit, key: "close" },
    ];
    for (const { art, key } of areas) {
      expect(pressedArea(areas, { x: art.x + art.width / 2, y: art.y + art.height / 2 })).toBe(key);
    }
  });
});
