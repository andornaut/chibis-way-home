import { describe, expect, it } from "vitest";

import { CARD_FRAME, cardRect } from "./cardFrame.ts";

describe("every card", () => {
  it("puts the close X inside the card's top-right corner, and the first row below the title", () => {
    const card = cardRect(100);
    const { art } = CARD_FRAME.close;
    expect({
      inCorner:
        art.x >= card.x + card.width / 2 &&
        art.x + art.width <= card.x + card.width &&
        art.y >= card.y,
      rowBelowTitle: CARD_FRAME.firstRowY > CARD_FRAME.titleY,
    }).toEqual({ inCorner: true, rowBelowTitle: true });
  });
});
