import { CARD_CONTENT, MAP_LAYOUT } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";

const reserve = PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width + CARD_CONTENT.gap;

export const PAGE_TITLE = {
  width: SCREEN.width - 2 * reserve,
  x: SCREEN.width / 2,
  y: MAP_LAYOUT.title.y,
} as const;
