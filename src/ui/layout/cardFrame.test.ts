import { describe, expect, it } from "vitest";

import { CARD_FRAME, cardRect, cardTitleAt } from "./cardFrame.ts";

describe("cardTitleAt", () => {
  it.each([
    { height: 12, width: 38, x: 2, y: 3 },
    { height: 15, width: 39, x: -1, y: 1 },
  ])("centres title ink with its own bearings: %j", (ink) => {
    const card = cardRect(100);
    const origin = cardTitleAt(card, ink);
    expect(origin.x + ink.x + ink.width / 2).toBe(card.x + card.width / 2);
    expect(origin.y + ink.y + ink.height / 2).toBe(CARD_FRAME.titleY + 8);
  });
});

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
