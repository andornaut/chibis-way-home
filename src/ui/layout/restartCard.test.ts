import { containsPoint, rectsOverlap } from "@andornaut/game-kit/rect";
import { inkWidth, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../../public/art/fonts/font-body.fnt?raw";
import buttonSheet from "../../../public/art/sprites/ui-button.json";
import resumeSheet from "../../../public/art/sprites/ui-resume.json";
import { HIT_RULE, PLAY_MARK } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import { TEXT } from "../../data/text";
import type { Rect } from "../../data/types";
import { CARD_FONTS } from "../../testing/cardFonts";
import { centredLabel } from "./buttonLabel";
import { pressedArea } from "./hitAreas";
import { CARD_TEXT_SCALE } from "./pauseCard";
import { CELEBRATION, type LabelledButton, restartCard } from "./restartCard";
const RESTART_CARD = restartCard(CARD_FONTS, TEXT.restart);

const FONT = parseBitmapFont(fontBody);
const SCREEN_RECT: Rect = { ...SCREEN, x: 0, y: 0 };
const ink = (text: string) => inkWidth(FONT, CARD_TEXT_SCALE, text);
const actionInk = (text: string) => inkWidth(CARD_FONTS.title, CARD_TEXT_SCALE, text);
const frameOf = (sheet: { frames: Record<string, { frame: { h: number; w: number } }> }) => {
  const { h: height, w: width } = Object.values(sheet.frames)[0]?.frame ?? { h: 0, w: 0 };
  return { height, width };
};

function inside(outer: Rect, inner: Rect): boolean {
  return (
    containsPoint(outer, inner.x, inner.y) &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

// Each card's buttons, with their labels and whether the play mark leads one.
const CARDS: [string, Rect, [string, LabelledButton, string, boolean][]][] = [
  [
    "restart card",
    RESTART_CARD.card,
    [
      ["cancel", RESTART_CARD.cancel, TEXT.restart.cancel, false],
      ["restart", RESTART_CARD.restart, TEXT.restart.restart, false],
    ],
  ],
  [
    "celebration",
    CELEBRATION.card,
    [
      ["restart", CELEBRATION.restart, TEXT.celebration.restart, false],
      ["continue", CELEBRATION.continue, TEXT.celebration.continue, true],
    ],
  ],
];

describe.each(CARDS)("the %s", (_, card, buttons) => {
  const areas = buttons.map(([key, { button, hit }]) => ({ art: button, hit, key }));

  it("holds its buttons on the screen, none overlapping, each a touch target", () => {
    const [first, second] = buttons.map(([, { button }]) => button);
    expect({
      apart: first !== undefined && second !== undefined && !rectsOverlap(first, second),
      inside: buttons.every(([, { button }]) => inside(card, button)),
      onScreen: inside(SCREEN_RECT, card),
      targets: buttons.every(
        ([, { hit }]) => Math.min(hit.width, hit.height) >= HIT_RULE.minTarget,
      ),
    }).toEqual({ apart: true, inside: true, onScreen: true, targets: true });
  });

  it.each(areas)("takes every press on $key's drawn button as $key", ({ art, key }) => {
    const corners = [
      { x: art.x, y: art.y },
      { x: art.x + art.width - 1, y: art.y + art.height - 1 },
    ];
    expect(corners.map((point) => pressedArea(areas, point))).toEqual([key, key]);
  });

  it.each(buttons)("fits %s's label, %s, on its button", (__, { button }, text, marked) => {
    const { labelX, markX } = centredLabel(button, actionInk(text), marked ? PLAY_MARK : undefined);
    const margins = [
      (markX ?? labelX) - button.x,
      button.x + button.width - (labelX + actionInk(text)),
    ];
    expect(Math.min(...margins)).toBeGreaterThan(0);
  });
});

describe("restart and celebration words", () => {
  it.each([
    ["the question", RESTART_CARD.question.x, TEXT.restart.question, RESTART_CARD.room],
    ["the message", CELEBRATION.message.x, TEXT.celebration.message, CELEBRATION.room],
  ])("fits %s in its room", (_, __, text, room) => {
    expect(ink(text)).toBeLessThanOrEqual(room);
  });

  it("draws Continue at ui-resume's size, and the stretched buttons no smaller than ui-button", () => {
    const resume = frameOf(resumeSheet);
    const button = frameOf(buttonSheet);
    const stretched = [RESTART_CARD.cancel, RESTART_CARD.restart, CELEBRATION.restart].map(
      ({ button: rect }) => rect,
    );
    expect({
      continue: {
        height: CELEBRATION.continue.button.height,
        width: CELEBRATION.continue.button.width,
      },
      large: stretched.every((rect) => rect.width >= button.width && rect.height >= button.height),
    }).toEqual({ continue: resume, large: true });
  });
});
