import { expect, it } from "vitest";

import manifest from "../../../public/art/manifest.json" with { type: "json" };
import { CARD_CONTENT } from "../../data/layout.ts";
import { TEXT } from "../../data/text.ts";
import { CARD_FONTS } from "../../testing/cardFonts.ts";
import { CARD_TEXT_SCALE } from "./cardFrame.ts";
import { CARD_HEADING, type CardTitleLayout, cardTitleOrigin } from "./contentCard.ts";
import { SKILL_ROOM, skillDetails } from "./skillDetails.ts";
import { SKILL_BUTTON } from "./skillHud.ts";
import { textInkBounds } from "./textInk.ts";

// Visible ink tops and bottoms, measured as the scenes draw them.
const titleInk = (title: CardTitleLayout) => {
  const ink = textInkBounds(
    CARD_FONTS.title,
    CARD_HEADING.scale,
    CARD_HEADING.lineHeight,
    title.text,
  );
  const top = cardTitleOrigin(CARD_FONTS.title, title, title.text).y + ink.y;
  return { bottom: top + ink.height, top };
};
const textInkTop = (font: typeof CARD_FONTS.body, at: { readonly y: number }, text: string) =>
  at.y + textInkBounds(font, CARD_TEXT_SCALE, font.lineHeight * CARD_TEXT_SCALE, text).y;
const skillInkTop = (layout: ReturnType<typeof skillDetails>) => {
  const { description, icon } = layout.groups;
  return Math.min(
    icon.y + (SKILL_BUTTON.target - SKILL_BUTTON.disc) / 2,
    ...layout.description.placements.map((placement) =>
      placement.kind === "icon"
        ? description.y + placement.rect.y
        : textInkTop(
            CARD_FONTS[placement.font],
            { y: description.y + placement.at.y },
            placement.text,
          ),
    ),
  );
};
const skills = (["dash", "doubleJump", "speedy"] as const).map((skill) =>
  skillDetails(CARD_FONTS, SKILL_ROOM.bounds, TEXT.buttons, TEXT.skills[skill]),
);

it.each(
  skills.map((layout) => ({
    content: skillInkTop(layout),
    layout: { ...layout, title: layout.title! },
    name: "skill",
  })),
)(
  "balances the $name title: frame to title ink equals title ink to first content",
  ({ content, layout: { card, title } }) => {
    const ink = titleInk(title);
    const above = ink.top - (card.y + CARD_CONTENT.frameBorder);
    const below = content - ink.bottom;
    expect(Math.abs(below - above)).toBeLessThanOrEqual(1);
    expect(title.y - card.y).toBeGreaterThanOrEqual(CARD_CONTENT.padding);
  },
);

it("measures title balance inside the card frame's 9-slice top edge", () => {
  const frame = manifest.sprites.find(({ key }) => key === "ui-settings-card");
  expect(frame?.slice?.top).toBe(CARD_CONTENT.frameBorder);
});
