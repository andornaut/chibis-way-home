// @vitest-environment happy-dom
import { fillNames } from "@andornaut/game-kit/runtime/lines";
import { expect, it } from "vitest";

import { TEXT } from "../../data/text.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { createSkillDetailsCard } from "./skillDetails.ts";

const COLOURS = {
  cream: 0xffeecc,
  ink: 0x111111,
  navy: 0x222244,
  white: 0xffffff,
  yellow: 0xffcc00,
};

it.each(SKILL_IDS)(
  "is a dialog named by %s's title and described by its description, the close X its one control",
  (skill) => {
    const words = TEXT.skills[skill];
    const disc = fillNames(TEXT.skillDetails.disc, { skill: words.title });
    const card = createSkillDetailsCard(document, COLOURS, "skill-details-card", {
      actions: TEXT.buttons,
      close: TEXT.skillDetails.close,
      description: words.description,
      disc,
      icons: TEXT.actionIcons,
      title: words.title,
    });
    const referenced = (attribute: string) =>
      card.dialog.querySelector<HTMLElement>(`#${card.dialog.getAttribute(attribute)}`)!;
    expect(card.dialog.getAttribute("role")).toBe("dialog");
    expect(referenced("aria-labelledby").textContent).toBe(words.title);
    const description = referenced("aria-describedby");
    expect(description.tagName).toBe("P");
    // The disc is beside the description, named as one image.
    expect(description.previousElementSibling?.getAttribute("aria-label")).toBe(disc);
    expect(description.previousElementSibling?.contains(card.glyph)).toBe(true);
    const focusable = [...card.dialog.querySelectorAll("button")];
    expect(focusable).toEqual([card.close]);
    expect(card.close.getAttribute("aria-label")).toBe(TEXT.skillDetails.close);
    expect(card.close.disabled).toBe(false);
  },
);
