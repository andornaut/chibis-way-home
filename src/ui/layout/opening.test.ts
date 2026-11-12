import { expect, it } from "vitest";

import { CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import { OPENING } from "../../data/opening.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { CARD_FONTS } from "../../testing/cardFonts.ts";
import { cardTextSize } from "./contentCard.ts";
import { openingLayout } from "./opening.ts";

it("fits every actual caption at full shared font beside full-size controls in the quiet footer", () => {
  for (const beat of OPENING) {
    const text = TEXT.lines[beat.text]!;
    const layout = openingLayout(CARD_FONTS, TEXT.dialogue, text);
    expect(layout.footerY).toBe(SCREEN.height - 80);
    expect(layout.caption).toMatchObject(cardTextSize(CARD_FONTS.body, text));
    expect(layout.caption.x + layout.caption.width + CARD_CONTENT.gap).toBeLessThanOrEqual(
      layout.skip.hit.x,
    );
    for (const button of [layout.skip, layout.continue]) {
      expect(button.button.height).toBe(TEXT_BUTTON.height);
      expect(button.hit.y).toBeGreaterThanOrEqual(layout.footerY);
      expect(button.hit.y + button.hit.height).toBeLessThanOrEqual(SCREEN.height);
    }
  }
});
