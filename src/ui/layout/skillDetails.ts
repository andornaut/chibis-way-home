import { SCREEN } from "../../data/screen";
import type { ControlAction, Rect, SkillText } from "../../data/types";
import { actionHelpLayout } from "./actionHelp";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_CONTENT } from "./cardFrame";
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
  const size = cardActionsSize(fonts.title, "row", [text]);
  if (size.width > footer.width) {
    throw new Error("Skill room action does not fit at the standard font size");
  }
  const action = cardActions(
    fonts.title,
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
  };
}

export function skillDetails(
  fonts: CardFonts,
  bounds: Rect,
  close: boolean,
  actions: Readonly<Record<ControlAction, string>>,
  words: SkillText,
) {
  const description = actionHelpLayout(
    fonts,
    actions,
    Math.min(
      DESCRIPTION_WIDTH,
      bounds.width - 2 * CARD_CONTENT.padding - SKILL_BUTTON.target - CARD_CONTENT.gap,
    ),
    words.description,
  );
  const layout = contentCardLayout(
    bounds,
    [
      {
        height: Math.max(SKILL_BUTTON.target, description.height),
        key: "body",
        width: SKILL_BUTTON.target + CARD_CONTENT.gap + description.width,
      },
    ],
    { close, titleWidth: cardTextSize(fonts.title, words.title).width },
  );
  if (layout.card.height > bounds.height) {
    throw new Error("Skill details do not fit at the standard font size");
  }
  const body = layout.groups.body!;
  return {
    ...layout,
    description,
    groups: {
      description: {
        height: description.height,
        width: description.width,
        x: body.x + SKILL_BUTTON.target + CARD_CONTENT.gap,
        y: body.y + Math.round((body.height - description.height) / 2),
      },
      icon: {
        height: SKILL_BUTTON.target,
        width: SKILL_BUTTON.target,
        x: body.x,
        y: body.y + Math.round((body.height - SKILL_BUTTON.target) / 2),
      },
    },
  };
}
