import { SCREEN } from "../data/screen";
import type { Rect, SkillText } from "../data/types";
import { dialogueLines } from "../dialogue/conversation";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "./cardFrame";
import { type CardFonts, cardTextSize, contentCardLayout } from "./contentCard";
import { DIALOGUE_SCREEN } from "./dialogueScreen";
import { hitAround } from "./hitAreas";
import { ROOM_SCREEN } from "./roomScreen";
import { SKILL_BUTTON } from "./skillHud";

const DESCRIPTION_WIDTH = 512;
const DESCRIPTION_LINES = 12;
const ROOM_LEAVE_BOTTOM = 10;
const leaveArt = {
  ...ROOM_SCREEN.leave.art,
  y: SCREEN.height - ROOM_LEAVE_BOTTOM - ROOM_SCREEN.leave.art.height,
};
export const SKILL_ROOM = {
  bounds: {
    height:
      hitAround(leaveArt).y -
      CARD_CONTENT.gap -
      (DIALOGUE_SCREEN.box.y + DIALOGUE_SCREEN.box.height + CARD_CONTENT.gap),
    width: SCREEN.width,
    x: 0,
    y: DIALOGUE_SCREEN.box.y + DIALOGUE_SCREEN.box.height + CARD_CONTENT.gap,
  } satisfies Rect,
  leave: {
    ...ROOM_SCREEN.leave,
    art: leaveArt,
    hit: hitAround(leaveArt),
    labelY: leaveArt.y + ROOM_SCREEN.leave.labelY - ROOM_SCREEN.leave.art.y,
    pressedLabelY: leaveArt.y + ROOM_SCREEN.leave.pressedLabelY - ROOM_SCREEN.leave.art.y,
  },
};

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
