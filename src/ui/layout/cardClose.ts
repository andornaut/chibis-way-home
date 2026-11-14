import { CARD_CONTENT } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";
import { hitAround } from "./hitAreas.ts";

// Local offsets from a card's top and right edges, before placing the close control.
const art: Rect = {
  height: CARD_CONTENT.closeSize,
  width: CARD_CONTENT.closeSize,
  x: CARD_CONTENT.closeInset,
  y: CARD_CONTENT.closeInset,
};

export const CARD_CLOSE = { art, hit: hitAround(art) } as const;
