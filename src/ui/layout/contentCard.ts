import { CARD_SCREEN_MARGIN, CARD_WIDTH } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";

// A modal card's width family. Every card declares one; its height follows its content up to the
// view's height less the screen margin above and below.
export type CardWidth = keyof typeof CARD_WIDTH;

// A card's width: its family's, or the view's width less the screen margin on each side where
// that is narrower.
export function cardWidth(family: CardWidth): number {
  return Math.min(CARD_WIDTH[family], SCREEN.width - 2 * CARD_SCREEN_MARGIN);
}
