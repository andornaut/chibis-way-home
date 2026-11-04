import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";

import type { Point, Rect } from "../../data/types";
import { FONT_SCALE } from "./fontRoles";
import { hitAround } from "./hitAreas";

export const CARD_TEXT_SCALE = FONT_SCALE;

export const CARD_CONTENT = {
  closeInset: 6,
  closeSize: 24,
  gap: 8,
  lineHeight: 16,
  padding: MODAL_CONTENT.padding,
  rowGap: 4,
} as const;

// Fixed frame geometry for the placeholder celebration. Ordinary modal cards measure their
// contents through contentCardLayout.
export const CARD_AT: Point = { x: 176, y: 88 };
export const CARD_WIDTH = 368;

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
  firstRowY: CARD_AT.y + 48,
  padding: MODAL_CONTENT.padding,
  titleY: CARD_AT.y + 8,
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
