import { CARD_CONTENT, SKILL_DETAILS, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { ControlAction, Rect, SkillText } from "../../data/types/index.ts";
import { actionHelpInkTop, actionHelpLayout } from "./actionHelp.ts";
import { cardActions, cardActionsSize, type CardFonts, contentCardLayout } from "./contentCard.ts";
import { DIALOGUE_SCREEN } from "./dialogueScreen.ts";
import { hitAround } from "./hitAreas.ts";
import { SKILL_BUTTON } from "./skillHud.ts";

const DESCRIPTION_WIDTH = SKILL_DETAILS.descriptionWidth;
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

// The room gift's skill panel in bounds: its title over the skill's disc beside its description,
// with the inline control icons. The skill details card is HTML (src/ui/dom/skillDetails.ts).
export function skillDetails(
  fonts: CardFonts,
  bounds: Rect,
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
  const bodyHeight = Math.max(SKILL_BUTTON.target, description.height);
  const layout = contentCardLayout(
    bounds,
    [
      {
        height: bodyHeight,
        // The higher of the skill button's drawn disc and the description's ink.
        inkTop: Math.min(
          Math.round((bodyHeight - SKILL_BUTTON.target) / 2) +
            (SKILL_BUTTON.target - SKILL_BUTTON.disc) / 2,
          Math.round((bodyHeight - description.height) / 2) + actionHelpInkTop(fonts, description),
        ),
        key: "body",
        width: SKILL_BUTTON.target + CARD_CONTENT.gap + description.width,
      },
    ],
    { close: false, font: fonts.title, title: words.title },
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
