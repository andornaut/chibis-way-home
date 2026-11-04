import { containsPoint } from "@andornaut/game-kit/rect";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import portrait from "../../../public/art/sprites/portrait-bird.json";
import { DIALOGUES, SPEAKERS } from "../../data/dialogues";
import { SCREEN } from "../../data/screen";
import { TEXT } from "../../data/text";
import { CARD_FONTS } from "../../testing/cardFonts";
import { dialogueLines, dialogueParagraphs } from "../dialogue/conversation";
import { TEXT_BUTTON } from "./buttonLabel";
import {
  departureDialogueButtons,
  DIALOGUE_SCREEN,
  dialogueButtons,
  dialogueNameTab,
  dialogueSpeakerLayout,
  liveDialogueContains,
} from "./dialogueScreen";
import { textInkBounds } from "./textInk";

const font = CARD_FONTS.title;
const width = (name: string) => inkWidth(font, DIALOGUE_SCREEN.text.scale, name);

describe("dialogue layout", () => {
  it.each(["left", "right"] as const)(
    "keeps the %s speaker's portrait and name inside the panel",
    (side) => {
      const layout = dialogueSpeakerLayout(side);
      const tab = dialogueNameTab(side, width("Dog"));
      const box = DIALOGUE_SCREEN.box;
      const frame = Object.values(portrait.frames)[0]!.frame;
      expect(containsPoint(box, tab.x, tab.y)).toBe(true);
      expect(containsPoint(box, tab.x + tab.width - 1, tab.y + tab.height - 1)).toBe(true);
      expect(containsPoint(box, layout.portrait.x, layout.portrait.y)).toBe(true);
      expect(
        containsPoint(box, layout.portrait.x + frame.w - 1, layout.portrait.y + frame.h - 1),
      ).toBe(true);
      expect(layout.portrait.x - layout.portraitFrame.x).toBe(
        layout.portrait.y - layout.portraitFrame.y,
      );
    },
  );

  it.each(["left", "right"] as const)(
    "positions %s portrait beside its text regardless of paragraph number",
    (side) => {
      const layout = dialogueSpeakerLayout(side);
      if (side === "left") {
        expect(layout.portraitFrame.x).toBeLessThan(layout.textX);
      } else {
        expect(layout.portraitFrame.x).toBeGreaterThan(layout.textX + DIALOGUE_SCREEN.text.width);
      }
      expect(Array.from({ length: 3 }, () => dialogueSpeakerLayout(side))).toEqual(
        Array.from({ length: 3 }, () => layout),
      );
    },
  );

  it("places equal-height Skip left and Continue right below the panel", () => {
    const buttons = dialogueButtons({ continue: width("Continue"), skip: width("Skip") });
    const { box } = DIALOGUE_SCREEN;
    expect(buttons.continue.button.height).toBe(TEXT_BUTTON.height);
    expect(buttons.skip.button.width).toBe(buttons.continue.button.width);
    expect(buttons.skip.button.x + buttons.skip.button.width + TEXT_BUTTON.gap).toBe(
      buttons.continue.button.x,
    );
    expect(buttons.continue.button.x + buttons.continue.button.width).toBe(box.x + box.width);
    expect(buttons.continue.button.y).toBeGreaterThan(box.y + box.height);
    expect(buttons.continue.button.y + buttons.continue.button.height).toBeLessThanOrEqual(
      SCREEN.height,
    );
  });
  it("places departure Continue at the bottom right with visible Skip beside it", () => {
    const buttons = departureDialogueButtons({ continue: width("Continue"), skip: width("Skip") });
    expect(buttons.continue.button.x + buttons.continue.button.width).toBe(SCREEN.width - 16);
    expect(buttons.continue.button.y + buttons.continue.button.height).toBe(SCREEN.height - 16);
    expect(buttons.skip.button.x + buttons.skip.button.width + TEXT_BUTTON.gap).toBe(
      buttons.continue.button.x,
    );
    expect(buttons.skip.button.height).toBe(TEXT_BUTTON.height);
  });

  it("captures only live dialogue panel and footer hits, leaving world touch controls active", () => {
    const buttons = dialogueButtons({ continue: width("Continue"), skip: width("Skip") });
    const areas = (["continue", "skip"] as const).map((key) => ({
      art: buttons[key].button,
      hit: buttons[key].hit,
      key,
    }));
    expect(
      liveDialogueContains(areas, { x: DIALOGUE_SCREEN.box.x + 1, y: DIALOGUE_SCREEN.box.y + 1 }),
    ).toBe(true);
    expect(
      liveDialogueContains(areas, {
        x: buttons.continue.button.x + 1,
        y: buttons.continue.button.y + 1,
      }),
    ).toBe(true);
    expect(liveDialogueContains(areas, { x: SCREEN.width - 20, y: SCREEN.height - 20 })).toBe(
      false,
    );
  });
});

it("fits actual authored dialogue paragraphs at native body size inside the existing panel", () => {
  const style = DIALOGUE_SCREEN.text;
  for (const plan of Object.values(DIALOGUES)) {
    for (const paragraph of dialogueParagraphs(SPEAKERS, TEXT, plan)) {
      const lines = dialogueLines(CARD_FONTS.body, style, style.width, paragraph.text);
      expect(lines.length, paragraph.text).toBeLessThanOrEqual(style.lines);
      for (const [index, line] of lines.entries()) {
        const ink = textInkBounds(CARD_FONTS.body, style.scale, style.pitch, line);
        expect(ink.width).toBeLessThanOrEqual(style.width);
        expect(style.y + index * style.pitch + ink.y + ink.height).toBeLessThanOrEqual(
          DIALOGUE_SCREEN.box.y + DIALOGUE_SCREEN.box.height,
        );
      }
      const tab = dialogueNameTab(paragraph.side, width(paragraph.name));
      expect(tab.x + tab.width).toBeLessThanOrEqual(
        dialogueSpeakerLayout(paragraph.side).textX + style.width,
      );
    }
  }
});
