import { SCREEN } from "../data/screen";
import type { Rect, SkillText } from "../data/types";
import { dialogueLines } from "../dialogue/conversation";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "./cardFrame";
import {
  cardActions,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  contentCardLayout,
} from "./contentCard";
import { DIALOGUE_SCREEN } from "./dialogueScreen";
import { hitAround } from "./hitAreas";
import { SKILL_BUTTON } from "./skillHud";

const DESCRIPTION_WIDTH = 512;
const DESCRIPTION_LINES = 12;
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

export function skillRoomContinue(fonts: CardFonts, text: string) {
  const size = cardActionsSize(fonts.body, "row", [text]);
  if (size.width > footer.width) {
    throw new Error("Skill room action does not fit at the standard font size");
  }
  const action = cardActions(
    fonts.body,
    "row",
    {
      ...footer,
      x: footer.x + footer.width - size.width,
    },
    [text],
  )[0]!;
  return {
    art: action.button,
    hit: action.hit,
    labelY: action.labelY,
    pressedLabelY: action.pressedLabelY,
  };
}

export function skillDetails(fonts: CardFonts, bounds: Rect, close: boolean, words: SkillText) {
  const description = dialogueLines(
    fonts.body,
    { lines: DESCRIPTION_LINES, scale: CARD_TEXT_SCALE },
    Math.min(DESCRIPTION_WIDTH, bounds.width - 2 * CARD_CONTENT.padding),
    words.description,
  ).join("\n");
  const layout = contentCardLayout(
    bounds,
    [
      { height: SKILL_BUTTON.target, key: "icon", width: SKILL_BUTTON.target },
      { key: "description", ...cardTextSize(fonts.body, description) },
    ],
    { close, titleWidth: cardTextSize(fonts.title, words.title).width },
  );
  if (layout.card.height > bounds.height) {
    throw new Error("Skill details do not fit at the standard font size");
  }
  return { ...layout, description };
}
