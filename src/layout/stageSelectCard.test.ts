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
  ZONE_MAP.destinations[0]!.stages.map((id) => TEXT.map.stages[id]!),
);

describe("stage picker layout", () => {
  it.each(ZONE_MAP.destinations)("fits both $id stage labels without shrinking", (destination) => {
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
  it("keeps two image cards side by side with fixed geometry inside the view", () => {
    const { buttons, card, close } = STAGE_SELECT_CARD;
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.button.y).toBe(buttons[1]!.button.y);
    expect(buttons[0]!.button.x + buttons[0]!.button.width).toBeLessThan(buttons[1]!.button.x);
    expect(card.width).toBeGreaterThanOrEqual(SCREEN.width / 2);
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
