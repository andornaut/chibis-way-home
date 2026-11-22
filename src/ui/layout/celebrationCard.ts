import { CELEBRATION_LAYOUT } from "../../data/layout.ts";
import type { Point } from "../../data/types/index.ts";
import { CARD_FRAME, cardRect } from "./cardFrame.ts";

// PLACEHOLDER: the card's authored title, message and action row positions.
export const CELEBRATION = {
  actionsY: CARD_FRAME.firstRowY + CELEBRATION_LAYOUT.buttonsTop,
  card: cardRect(CELEBRATION_LAYOUT.height),
  message: {
    x: CELEBRATION_LAYOUT.message.x,
    y: CARD_FRAME.firstRowY + CELEBRATION_LAYOUT.message.top,
  } satisfies Point,
  room: CELEBRATION_LAYOUT.room,
} as const;
