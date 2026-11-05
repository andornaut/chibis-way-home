import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { ZONE_MAP } from "../../data/map";
import { SCREEN } from "../../data/screen";
import { TEXT } from "../../data/text";
import { CARD_FONTS } from "../../testing/cardFonts";
import { CARD_CONTENT, CARD_HEADING, cardTitleOrigin } from "./contentCard";
import { FONT_METRICS } from "./fontRoles";
import { type PressArea, pressedArea } from "./hitAreas";
import { CARD_TEXT_SCALE } from "./pauseCard";
import { stagePageOf, STAGES_PER_PAGE, stageSelectPages } from "./stageSelectCard";
import { textInkBounds } from "./textInk";
const STAGE_SELECT_CARD = stageSelectPages(
  CARD_FONTS,
  undefined,
  TEXT.map.zones[ZONE_MAP.destinations[0]!.id]!,
  ZONE_MAP.destinations
    .flatMap(({ stages }) => stages.map((id) => TEXT.map.stages[id]!))
    .slice(0, 3),
);

describe("stage picker layout", () => {
  it.each(ZONE_MAP.destinations)("fits every $id stage label without shrinking", (destination) => {
    const labels = destination.stages.map((id) => TEXT.map.stages[id]!);
    const layout = stageSelectPages(
      CARD_FONTS,
      TEXT.map.stagePages,
      TEXT.map.zones[destination.id]!,
      labels,
    );
    for (const card of layout.buttons) {
      for (const line of card.text.split("\n")) {
        expect(inkWidth(CARD_FONTS.title, CARD_TEXT_SCALE, line)).toBeLessThanOrEqual(
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
  it("balances previews and title vertically without reducing close-target clearance", () => {
    const { buttons, card, close, title } = STAGE_SELECT_CARD;
    expect(card.width).toBe(SCREEN.width - 2 * CARD_CONTENT.padding);
    expect(card.x).toBe(CARD_CONTENT.padding);
    expect(card.x + card.width / 2).toBe(SCREEN.width / 2);
    expect(card.y + card.height / 2).toBe(SCREEN.height / 2);
    // The noninteractive title line may share the stages' outer press margin; its ink may not.
    const heading = TEXT.map.zones[ZONE_MAP.destinations[0]!.id]!;
    const ink = textInkBounds(
      CARD_FONTS.title,
      CARD_HEADING.scale,
      CARD_HEADING.lineHeight,
      heading,
    );
    expect(cardTitleOrigin(CARD_FONTS.title, title, heading).y + ink.y + ink.height).toBeLessThan(
      buttons[0]!.hit.y,
    );
    expect(title.height).toBe(FONT_METRICS.mainHeading.lineHeight);
    expect(title.x + title.width / 2).toBe(card.x + card.width / 2);
    expect(close.art.y - card.y).toBe(CARD_CONTENT.closeInset);
    expect(close.hit.height).toBe(48);
    for (const stage of buttons) {
      expect(stage.button.width).toBe(208);
      expect(stage.preview).toMatchObject({ height: 84, width: 168 });
      expect(
        textInkBounds(
          CARD_FONTS.title,
          CARD_TEXT_SCALE,
          CARD_FONTS.title.lineHeight * CARD_TEXT_SCALE,
          stage.text,
        ).height,
      ).toBeLessThanOrEqual(stage.name.height);
      expect(stage.preview.y - stage.number.y - stage.number.height).toBe(CARD_CONTENT.rowGap);
      expect(stage.hit.y - close.hit.y - close.hit.height).toBe(CARD_CONTENT.gap);
    }
  });
  it("lays out any nonempty catalogue count that fits without changing face geometry", () => {
    const labels = STAGE_SELECT_CARD.buttons.map(({ text }) => text.replaceAll("\n", " "));
    const pair = stageSelectPages(CARD_FONTS, undefined, "", labels.slice(0, 2));
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

describe("paged stage-picker layout", () => {
  it("keeps six screenshot cards full size and reserves independent standard pager controls", () => {
    const labels = Array.from({ length: 6 }, (_, index) => `Floor ${index + 1}`);
    const layout = stageSelectPages(CARD_FONTS, TEXT.map.stagePages, "Apartment", labels);
    expect(layout.pages).toBe(Math.ceil(labels.length / STAGES_PER_PAGE));
    expect(stagePageOf(labels, labels[4]!)).toBe(1);
    for (const button of layout.buttons) {
      expect(button.preview).toMatchObject({
        height: STAGE_SELECT_CARD.buttons[0]!.preview.height,
        width: STAGE_SELECT_CARD.buttons[0]!.preview.width,
      });
      expect(button.button).toMatchObject({
        height: STAGE_SELECT_CARD.buttons[0]!.button.height,
        width: STAGE_SELECT_CARD.buttons[0]!.button.width,
      });
    }
    expect(layout.card.y).toBeGreaterThanOrEqual(0);
    expect(layout.card.y + layout.card.height).toBeLessThanOrEqual(SCREEN.height);
    expect(layout.card.x + layout.card.width - layout.close.art.x - layout.close.art.width).toBe(
      CARD_CONTENT.closeInset,
    );
    expect(layout.pager!.previous.hit.width).toBeGreaterThanOrEqual(48);
    expect(layout.pager!.previous.hit.height).toBeGreaterThanOrEqual(48);
    expect(layout.pager!.previous.hit.x + layout.pager!.previous.hit.width).toBeLessThan(
      layout.pager!.count.x,
    );
    expect(layout.pager!.count.x + layout.pager!.count.width).toBeLessThan(
      layout.pager!.next.hit.x,
    );
    const bottom = Math.max(...layout.buttons.map(({ hit }) => hit.y + hit.height));
    expect(bottom).toBeLessThanOrEqual(layout.pager!.previous.hit.y);
  });
});
