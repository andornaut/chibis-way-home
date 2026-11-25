import { expect, it } from "vitest";

import { ACHIEVEMENTS_CARD, CARD_CONTENT, CARD_SCREEN_MARGIN } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { cardWidth } from "./contentCard.ts";

it("sizes the width families small to large, each inside the view's screen margins", () => {
  const widths = (["small", "medium", "large"] as const).map(cardWidth);
  expect({
    ascending: widths.every((width, index) => index === 0 || width > widths[index - 1]!),
    inside: widths.every((width) => width <= SCREEN.width - 2 * CARD_SCREEN_MARGIN),
  }).toEqual({ ascending: true, inside: true });
});

it("fits the Achievements card's entry columns inside the large width family's padding", () => {
  const { columnWidth, columns } = ACHIEVEMENTS_CARD;
  expect(columns * columnWidth + (columns - 1) * CARD_CONTENT.padding).toBeLessThanOrEqual(
    cardWidth("large") - 2 * CARD_CONTENT.padding,
  );
});
