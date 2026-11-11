import { containsPoint } from "@andornaut/game-kit/rect";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import portrait from "../../../public/art/sprites/portrait-bird.json";
import * as behaviours from "../../data/behaviours";
import { CHARACTERS } from "../../data/characters";
import { DIALOGUES, SPEAKERS } from "../../data/dialogues";
import { TEXT_BUTTON } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import { STAGE_BARKS } from "../../data/stageBarks";
import { TEXT } from "../../data/text";
import type { DialogueLine } from "../../data/types";
import { CARD_FONTS } from "../../testing/cardFonts";
import {
  dialogueLines,
  type DialogueParagraph,
  dialogueParagraphs,
} from "../dialogue/conversation";
import {
  departureDialogueButtons,
  DIALOGUE_SCREEN,
  dialogueButtons,
  dialogueNameTab,
  dialogueSpeakerLayout,
  dialogueTextRows,
} from "./dialogueScreen";
import { textInkBounds } from "./textInk";

const font = CARD_FONTS.title;
const width = (name: string) => inkWidth(font, DIALOGUE_SCREEN.text.scale, name);
const TAB_Y = dialogueTextRows(CARD_FONTS, "name-tab").tabY!;

describe("dialogue layout", () => {
  it.each(["left", "right"] as const)(
    "keeps the %s speaker's portrait and name inside the panel",
    (side) => {
      const layout = dialogueSpeakerLayout(side);
      const tab = dialogueNameTab(side, TAB_Y, width("Dog"));
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

  // Dialogue and barks use a name tab over three body lines; the achievement notice a bold
  // heading over two. Ink is measured over every glyph each font draws.
  it.each([
    ["left", "name-tab"],
    ["right", "name-tab"],
    ["left", "heading"],
    ["right", "heading"],
  ] as const)("pads the %s portrait and %s text column evenly", (side, header) => {
    const { box, padding, text } = DIALOGUE_SCREEN;
    const layout = dialogueSpeakerLayout(side);
    const rows = dialogueTextRows(CARD_FONTS, header);
    const frame = layout.portraitFrame;
    const column = { right: layout.textX + text.width, x: layout.textX };
    const ink = (which: keyof typeof CARD_FONTS) =>
      textInkBounds(
        CARD_FONTS[which],
        text.scale,
        text.pitch,
        [...CARD_FONTS[which].glyphs.keys()].join(""),
      );
    const top = header === "name-tab" ? rows.tabY! : rows.headingY! + ink("title").y;
    const bottom =
      rows.bodyY + (rows.bodyLines - 1) * text.pitch + ink("body").y + ink("body").height;
    const [near, far] =
      side === "left"
        ? [frame.x - box.x, box.x + box.width - column.right]
        : [box.x + box.width - frame.x - frame.width, column.x - box.x];
    const gap = side === "left" ? column.x - frame.x - frame.width : frame.x - column.right;
    expect({ far, gap, near }).toEqual({ far: padding, gap: padding, near: padding });
    expect(frame.y - box.y).toBe(box.y + box.height - frame.y - frame.height);
    expect(Math.abs(top - box.y - (box.y + box.height - bottom))).toBeLessThanOrEqual(1);
    expect(Math.min(top - box.y, box.y + box.height - bottom)).toBeGreaterThanOrEqual(padding);
    if (header === "name-tab") {
      expect([top - box.y, box.y + box.height - bottom]).toEqual([padding, padding]);
      expect(rows.bodyY + ink("body").y).toBeGreaterThanOrEqual(rows.tabY! + 20);
    }
  });

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
});

// Every bark the zone shows in the dialogue box: boss spotted and escaped lines, and the stage's
// journey statements, found as { line, speaker } pairs anywhere in their data.
function barkLines(...sources: readonly unknown[]): readonly DialogueLine[] {
  const found = new Map<string, DialogueLine>();
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) {
      return;
    }
    const { line, speaker } = value as Partial<DialogueLine>;
    if (typeof line === "string" && typeof speaker === "string") {
      found.set(`${speaker} ${line}`, { line, speaker });
    }
    Object.values(value).forEach(visit);
  };
  sources.forEach(visit);
  return [...found.values()];
}

function expectFits(paragraph: DialogueParagraph): void {
  const style = DIALOGUE_SCREEN.text;
  const rows = dialogueTextRows(CARD_FONTS, "name-tab");
  const lines = dialogueLines(CARD_FONTS.body, style, style.width, paragraph.text);
  expect(lines.length, paragraph.text).toBeLessThanOrEqual(style.lines);
  for (const [index, line] of lines.entries()) {
    const ink = textInkBounds(CARD_FONTS.body, style.scale, style.pitch, line);
    expect(ink.width, line).toBeLessThanOrEqual(style.width);
    expect(rows.bodyY + index * style.pitch + ink.y + ink.height, line).toBeLessThanOrEqual(
      DIALOGUE_SCREEN.box.y + DIALOGUE_SCREEN.box.height,
    );
  }
  const tab = dialogueNameTab(paragraph.side, TAB_Y, width(paragraph.name));
  expect(tab.x + tab.width, paragraph.name).toBeLessThanOrEqual(
    dialogueSpeakerLayout(paragraph.side).textX + style.width,
  );
}

it("fits actual authored dialogue paragraphs at native body size inside the existing panel", () => {
  for (const plan of Object.values(DIALOGUES)) {
    dialogueParagraphs(SPEAKERS, TEXT, plan).forEach(expectFits);
  }
});

it("fits every boss bark and journey statement at native body size inside the bark panel", () => {
  const lines = barkLines(behaviours, CHARACTERS, STAGE_BARKS);
  for (const kind of ["-escaped", "-spotted", "fert-journey-"]) {
    expect(
      lines.some(({ line }) => line.includes(kind)),
      kind,
    ).toBe(true);
  }
  for (const line of lines) {
    dialogueParagraphs(SPEAKERS, TEXT, { lines: [line] }).forEach(expectFits);
  }
});
