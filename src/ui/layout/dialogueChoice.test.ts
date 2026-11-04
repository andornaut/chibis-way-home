import { describe, expect, it } from "vitest";

import { SCREEN } from "../../data/screen";
import { CARD_FONTS } from "../../testing/cardFonts";
import { TEXT_BUTTON } from "./buttonLabel";
import { dialogueChoiceLayout } from "./dialogueChoice";

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
});
