import { expect, it } from "vitest";

import { CARD_CONTENT } from "../../data/layout.ts";
import { cardHeaderLayout, cardTitleReserve } from "./contentCard.ts";
import { hitAround } from "./hitAreas.ts";

const close = hitAround({
  height: CARD_CONTENT.closeSize,
  width: CARD_CONTENT.closeSize,
  x: CARD_CONTENT.closeInset,
  y: CARD_CONTENT.closeInset,
});

it("reserves the full close target plus its gap on both sides of a native heading", () => {
  expect(cardTitleReserve(false)).toBe(CARD_CONTENT.padding);
  expect(cardTitleReserve(true)).toBeGreaterThanOrEqual(close.x + close.width + CARD_CONTENT.gap);
});

it("balances the native heading's visible gaps while clearing the close target", () => {
  const title = { height: 28, text: "Title", width: 0 };
  const first = { hitOutset: 16, inkTop: -2 };
  const layout = cardHeaderLayout(true, first, title);
  const above = layout.titleTop - CARD_CONTENT.frameBorder;
  const below = layout.bodyTop + first.inkTop - layout.titleTop - title.height;
  expect(above).toBe(below);
  expect(layout.bodyTop - first.hitOutset).toBeGreaterThanOrEqual(
    close.y + close.height + CARD_CONTENT.gap,
  );
  expect(Number.isInteger(layout.bodyTop)).toBe(true);
});

it("retains ordinary top padding when a card has no heading or close control", () => {
  expect(cardHeaderLayout(false, undefined, undefined)).toEqual({
    bodyTop: CARD_CONTENT.padding,
    titleTop: CARD_CONTENT.padding,
  });
});
