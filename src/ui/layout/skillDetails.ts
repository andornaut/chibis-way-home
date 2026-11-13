import { CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { DIALOGUE_SCREEN } from "./dialogueScreen.ts";
import { hitAround } from "./hitAreas.ts";

const footer = {
  height: TEXT_BUTTON.height,
  width: SCREEN.width - 2 * CARD_CONTENT.padding,
  x: CARD_CONTENT.padding,
  y: SCREEN.height - CARD_CONTENT.padding - TEXT_BUTTON.height,
};
export const SKILL_ROOM = {
  bounds: {
    height:
      hitAround(footer).y -
      CARD_CONTENT.gap -
      (DIALOGUE_SCREEN.box.y + DIALOGUE_SCREEN.box.height + CARD_CONTENT.gap),
    width: SCREEN.width,
    x: 0,
    y: DIALOGUE_SCREEN.box.y + DIALOGUE_SCREEN.box.height + CARD_CONTENT.gap,
  } satisfies Rect,
  footer,
};
