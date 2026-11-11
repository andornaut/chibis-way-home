import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { bitmapMeasure, fittingText } from "@andornaut/game-kit/text/textFit";
import { describe, expect, it } from "vitest";

import * as behaviours from "../../data/behaviours";
import { CHARACTERS } from "../../data/characters";
import { DIALOGUES, SPEAKERS } from "../../data/dialogues";
import { SKILL_HUD, TEXT_BUTTON } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import { STAGE_BARKS } from "../../data/stageBarks";
import { TEXT } from "../../data/text";
import type { DialogueLine, Rect } from "../../data/types";
import { CARD_FONTS } from "../../testing/cardFonts";
import {
  dialogueLines,
  type DialogueParagraph,
  dialogueParagraphs,
} from "../dialogue/conversation";
import {
  departureDialogueButtons,
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueBodyLines,
  dialogueButtons,
  dialogueNameTab,
  dialoguePressAreas,
  dialogueSpeakerLayout,
  dialogueTextRows,
} from "./dialogueScreen";
import { pressedArea } from "./hitAreas";
import { textInkBounds } from "./textInk";

const font = CARD_FONTS.title;
const width = (name: string) => inkWidth(font, DIALOGUE_SCREEN.text.scale, name);
const { box } = DIALOGUE_SCREEN;
const BODY_INK = textInkBounds(
  CARD_FONTS.body,
  DIALOGUE_SCREEN.text.scale,
  DIALOGUE_SCREEN.text.pitch,
  [...CARD_FONTS.body.glyphs.keys()].join(""),
);

describe("dialogue layout", () => {
  it("draws the 480x60 panel, 408 text column and compact footer below the skill HUD", () => {
    const hudBottom = SKILL_HUD.inset + SKILL_HUD.target;
    const buttons = dialogueButtons({ continue: width("Continue"), skip: width("Skip") });
    expect(hudBottom).toBe(56);
    expect(box).toEqual({ height: 60, width: 480, x: 120, y: hudBottom + 20 });
    expect(box.y).toBe(76);
    expect(DIALOGUE_SCREEN.text).toMatchObject({ lines: 2, pitch: 20, width: 408 });
    expect(buttons.skip.button).toEqual({ height: 36, width: 192, x: 208, y: 140 });
    expect(buttons.continue.button).toEqual({ height: 36, width: 192, x: 408, y: 140 });
  });

  it.each([
    ["left", { frameX: 124, slotX: 126, textX: 184 }],
    ["right", { frameX: 544, slotX: 546, textX: 128 }],
  ] as const)("places the %s speaker's 52 frame, 48 slot and text column", (side, at) => {
    const layout = dialogueSpeakerLayout(side);
    const frameY = box.y + 4;
    expect(layout.portraitFrame).toEqual({ height: 52, width: 52, x: at.frameX, y: frameY });
    expect(layout.portrait).toEqual({ x: at.slotX, y: frameY + 2 });
    expect(DIALOGUE_PORTRAIT_SIZE).toBe(48);
    expect(layout.textX).toBe(at.textX);
    const [near, far] =
      side === "left"
        ? [layout.textX - layout.portraitFrame.x - 52, box.x + box.width - layout.textX - 408]
        : [layout.portraitFrame.x - layout.textX - 408, layout.textX - box.x];
    expect({ far, near }).toEqual({ far: 8, near: 8 });
  });

  it.each([
    ["left", "right end", (tab: Rect) => tab.x + tab.width, 592],
    ["right", "left end", (tab: Rect) => tab.x, 128],
  ] as const)("puts the %s speaker's name tab at the panel's %s", (side, _end, edge, at) => {
    const tab = dialogueNameTab(side, width("Chibi"));
    expect(edge(tab)).toBe(at);
    expect(tab).toMatchObject({ height: 20, width: width("Chibi") + 12, y: 66 });
    expect(box.y - tab.y).toBe(10);
    const frame = dialogueSpeakerLayout(side).portraitFrame;
    expect(tab.x >= frame.x + frame.width || tab.x + tab.width <= frame.x).toBe(true);
    expect(() => dialogueNameTab(side, 480)).toThrow("reaches over the portrait");
  });

  it.each([
    [1, [96]],
    [2, [86, 106]],
  ] as const)("centres %i body line by ink below the name tab", (count, pens) => {
    const rows = dialogueTextRows(CARD_FONTS, "name-tab", count);
    const pitch = DIALOGUE_SCREEN.text.pitch;
    expect(Array.from({ length: count }, (_, index) => rows.bodyY + index * pitch)).toEqual(pens);
    const above = rows.bodyY + BODY_INK.y - box.y;
    const below =
      box.y + box.height - (rows.bodyY + (count - 1) * pitch + BODY_INK.y + BODY_INK.height);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
    expect(rows.bodyY + BODY_INK.y).toBeGreaterThanOrEqual(dialogueNameTab("left", 0).y + 20);
  });

  it("centres a bold heading and one body line by ink", () => {
    const rows = dialogueTextRows(CARD_FONTS, "heading", 1);
    const title = textInkBounds(
      CARD_FONTS.title,
      DIALOGUE_SCREEN.text.scale,
      DIALOGUE_SCREEN.text.pitch,
      [...CARD_FONTS.title.glyphs.keys()].join(""),
    );
    expect(rows.bodyY - rows.headingY!).toBe(DIALOGUE_SCREEN.text.pitch);
    const above = rows.headingY! + title.y - box.y;
    const below = box.y + box.height - (rows.bodyY + BODY_INK.y + BODY_INK.height);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
    expect(dialogueBodyLines("heading")).toBe(1);
    expect(() => dialogueTextRows(CARD_FONTS, "heading", 2)).toThrow();
  });

  it.each(["left", "right"] as const)(
    "takes the %s speaker's panel and name tab as one press area",
    (side) => {
      const tab = dialogueNameTab(side, width("Chibi"));
      const areas = dialoguePressAreas(tab);
      const at = (x: number, y: number) => pressedArea(areas, { x, y });
      expect(at(box.x, box.y)).toBe("continue");
      expect(at(box.x + box.width - 1, box.y + box.height - 1)).toBe("continue");
      expect(at(tab.x, tab.y)).toBe("continue");
      expect(at(tab.x + tab.width - 1, tab.y)).toBe("continue");
      expect(at(tab.x - 1, tab.y)).toBeUndefined();
      expect(at(tab.x + tab.width, tab.y)).toBeUndefined();
      expect(at(box.x, box.y + box.height)).toBeUndefined();
      expect(dialoguePressAreas(undefined).map(({ hit }) => hit)).toEqual([box]);
    },
  );

  it("places compact equal Skip left and Continue right below the panel", () => {
    const buttons = dialogueButtons({ continue: width("Continue"), skip: width("Skip") });
    expect(buttons.continue.button.height).toBe(36);
    expect(buttons.skip.button.width).toBe(buttons.continue.button.width);
    expect(buttons.skip.button.x + buttons.skip.button.width + TEXT_BUTTON.gap).toBe(
      buttons.continue.button.x,
    );
    expect(buttons.continue.button.x + buttons.continue.button.width).toBe(box.x + box.width);
  });

  it("places departure Continue at the bottom right with visible Skip beside it", () => {
    const buttons = departureDialogueButtons({ continue: width("Continue"), skip: width("Skip") });
    expect(buttons.continue.button.x + buttons.continue.button.width).toBe(SCREEN.width - 16);
    expect(buttons.continue.button.y + buttons.continue.button.height).toBe(SCREEN.height - 16);
    expect(buttons.skip.button.x + buttons.skip.button.width + TEXT_BUTTON.gap).toBe(
      buttons.continue.button.x,
    );
    expect(buttons.skip.button.height).toBe(36);
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

// Every paragraph wraps to at most two lines of the 408 column at the native body size, with its
// ink inside the panel and its name tab clear of the portrait.
function expectFits(id: string, paragraph: DialogueParagraph): void {
  const style = DIALOGUE_SCREEN.text;
  // Wrapped without a line cap, so a failure names how many lines the paragraph needs.
  const fitted = fittingText(
    { ...style, lines: 9 },
    bitmapMeasure(CARD_FONTS.body),
    style.width,
    paragraph.text,
  );
  expect(fitted.lines.length, `${id}: ${paragraph.text}`).toBeLessThanOrEqual(style.lines);
  const lines = dialogueLines(CARD_FONTS.body, style, style.width, paragraph.text);
  const rows = dialogueTextRows(CARD_FONTS, "name-tab", lines.length);
  for (const [index, line] of lines.entries()) {
    const ink = textInkBounds(CARD_FONTS.body, style.scale, style.pitch, line);
    expect(ink.width, `${id}: ${line}`).toBeLessThanOrEqual(style.width);
    expect(rows.bodyY + index * style.pitch + ink.y + ink.height, id).toBeLessThanOrEqual(
      box.y + box.height,
    );
  }
  expect(() => dialogueNameTab(paragraph.side, width(paragraph.name)), id).not.toThrow();
}

it("fits every authored dialogue paragraph in two lines at native body size", () => {
  for (const [scene, plan] of Object.entries(DIALOGUES)) {
    const paragraphs = dialogueParagraphs(SPEAKERS, TEXT, plan);
    paragraphs.forEach((paragraph, index) =>
      expectFits(`${scene} ${plan.lines[index]!.line}`, paragraph),
    );
  }
});

it("fits every boss bark and journey statement in two lines at native body size", () => {
  const lines = barkLines(behaviours, CHARACTERS, STAGE_BARKS);
  for (const kind of ["-escaped", "-spotted", "fert-journey-"]) {
    expect(
      lines.some(({ line }) => line.includes(kind)),
      kind,
    ).toBe(true);
  }
  for (const line of lines) {
    expectFits(line.line, dialogueParagraphs(SPEAKERS, TEXT, { lines: [line] })[0]!);
  }
});
