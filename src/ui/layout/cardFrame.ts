import { CARD_CONTENT, CELEBRATION_LAYOUT } from "../../data/layout.ts";
import type { Point, Rect } from "../../data/types/index.ts";
import { FONT_SCALE } from "./fontRoles.ts";
import { hitAround } from "./hitAreas.ts";

export const CARD_TEXT_SCALE = FONT_SCALE;

// Fixed frame geometry for the celebration card.
const CARD_AT: Point = CELEBRATION_LAYOUT.at;
const CARD_WIDTH = CELEBRATION_LAYOUT.width;

const CLOSE_ART: Rect = {
  height: CARD_CONTENT.closeSize,
  width: CARD_CONTENT.closeSize,
  x: CARD_AT.x + CARD_WIDTH - CARD_CONTENT.closeInset - CARD_CONTENT.closeSize,
  y: CARD_AT.y + CARD_CONTENT.closeInset,
};

export const CARD_FRAME = {
  // The close X, drawn at the card's top right, and its press area.
  close: {
    art: CLOSE_ART,
    at: { x: CLOSE_ART.x, y: CLOSE_ART.y } satisfies Point,
    hit: hitAround(CLOSE_ART),
  },
  firstRowY: CARD_AT.y + CELEBRATION_LAYOUT.firstRowTop,
  padding: CARD_CONTENT.padding,
  titleY: CARD_AT.y + CELEBRATION_LAYOUT.titleTop,
} as const;

// A card as tall as height, at CARD_AT.
export function cardRect(height: number): Rect {
  return { height, width: CARD_WIDTH, ...CARD_AT };
}

// Centre title ink in the shared single-line title slot.
export function cardTitleAt(card: Rect, ink: Rect): Point {
  return {
    x: card.x + (card.width - ink.width) / 2 - ink.x,
    y: card.y + CARD_FRAME.titleY - CARD_AT.y + (CARD_CONTENT.lineHeight - ink.height) / 2 - ink.y,
  };
}
