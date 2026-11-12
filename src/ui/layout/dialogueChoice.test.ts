import { rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { CARD_CONTENT, DIALOGUE_CHOICE, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { CARD_FONTS } from "../../testing/cardFonts.ts";
import { cardTextSize } from "./contentCard.ts";
import { dialogueChoiceLayout } from "./dialogueChoice.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";

describe("required dialogue choice layout", () => {
  it.each([2, 3])("fits %i answers below a multiline prompt without a close control", (count) => {
    const layout = dialogueChoiceLayout(
      CARD_FONTS,
      "First paragraph\nSecond paragraph\nLast paragraph",
      Array.from({ length: count }, (_, index) => ({
        id: String(index),
        label: `Answer ${index}`,
      })),
    );
    expect(layout.card.y + layout.card.height).toBeLessThanOrEqual(SCREEN.height);
    expect(layout.buttons).toHaveLength(count);
    for (const { layout: button } of layout.buttons) {
      expect(button.button.height).toBe(TEXT_BUTTON.height);
      expect(button.button.y + button.button.height).toBeLessThan(
        layout.card.y + layout.card.height,
      );
    }
  });

  it("keeps the widest answers' press areas clear of Pause's", () => {
    // The widest answer whose button fits the widest card, on the tallest card: a full prompt
    // and three answers.
    const buttonWidth = (label: string) =>
      cardTextSize(CARD_FONTS.title, label).width + 2 * TEXT_BUTTON.inset;
    let label = "W";
    while (buttonWidth(`${label}W`) <= SCREEN.width - 2 * CARD_CONTENT.padding) {
      label += "W";
    }
    const layout = dialogueChoiceLayout(
      CARD_FONTS,
      Array.from({ length: DIALOGUE_CHOICE.promptLines }, (_, index) => `Line ${index}`).join("\n"),
      ["0", "1", "2"].map((id) => ({ id, label })),
    );
    const hits = layout.buttons.map(({ layout: button }) => button.hit);
    expect(layout.buttons[0]!.layout.button.width).toBe(buttonWidth(label));
    // The answers span Pause's columns, so only their height keeps them clear.
    expect(hits[0]!.x).toBeLessThan(PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width);
    expect(hits.filter((hit) => rectsOverlap(hit, PAUSE_BUTTON.hit))).toEqual([]);
  });
});
