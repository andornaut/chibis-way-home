import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { placeModalFrame } from "@andornaut/game-kit/runtime/ui/modalFrame";
import { arrangePager, pagerSize } from "@andornaut/game-kit/runtime/ui/pager";
import { expect, it } from "vitest";

import {
  ACHIEVEMENTS_CARD,
  CARD_CONTENT,
  CARD_SCREEN_MARGIN,
  CARD_WIDTH,
  TEXT_BUTTON,
} from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { ACHIEVEMENT_IDS } from "../../progress/index.ts";
import {
  ACHIEVEMENTS_FOOTER_HEIGHT,
  achievementsListHeight,
  achievementsPerPage,
  achievementsRows,
} from "./achievementsCard.ts";
import { cardWidth } from "./contentCard.ts";
import { FONT_METRICS } from "./fontRoles.ts";

// The pager's parts as the page measures them: two text buttons and a body line of count.
const PAGER = {
  count: { height: FONT_METRICS.body.lineHeight, width: 86 },
  next: { height: TEXT_BUTTON.height, width: 68 },
  previous: { height: TEXT_BUTTON.height, width: 102 },
};
const BACK = { height: TEXT_BUTTON.height, width: 70 };
const ROOM = cardWidth("large") - 2 * CARD_CONTENT.padding;

// The card's frame with rows rows of entries, as the card frame places a closeable, titled card.
function frame(rows: number) {
  const { closeInset, closeSize, frameBorder, gap, padding } = CARD_CONTENT;
  return placeModalFrame(
    {
      close: { face: { height: closeSize, width: closeSize, x: closeInset, y: closeInset } },
      content: { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 },
      families: CARD_WIDTH,
      family: "large",
      gap,
      margin: CARD_SCREEN_MARGIN,
      padding,
    },
    {
      body: achievementsListHeight(rows),
      bodyOutset: 0,
      footer: ACHIEVEMENTS_FOOTER_HEIGHT,
      title: {
        height: FONT_METRICS.mainHeading.lineHeight,
        inset: padding - frameBorder / 2,
      },
    },
  );
}

it("keeps the page count the card gap from Previous's and Next's faces", () => {
  const { count, next, previous } = arrangePager({ width: pagerSize(PAGER).width }, PAGER);
  expect({
    afterCount: next.face.x - (count.x + count.width),
    beforeCount: count.x - (previous.face.x + previous.face.width),
    // Each button's press area stops halfway to the count.
    nextPress: next.outset.left,
    previousPress: previous.outset.right,
  }).toEqual({
    afterCount: CARD_CONTENT.gap,
    beforeCount: CARD_CONTENT.gap,
    nextPress: CARD_CONTENT.gap / 2,
    previousPress: CARD_CONTENT.gap / 2,
  });
});

it("stacks the centred pager above a centred Back in the footer", () => {
  const pager = pagerSize(PAGER);
  const footer = arrangeActions({ axis: "stack", middle: pager, variant: "footer", width: ROOM }, [
    { key: "back", role: "primary", size: BACK },
  ]);
  const [back] = footer.actions;
  if (back === undefined || back.hidden || footer.middle === undefined) {
    throw new Error("The footer places the pager and Back");
  }
  const centre = (rect: { readonly width: number; readonly x: number }) => rect.x + rect.width / 2;
  expect({
    back: centre(back.face),
    gap: back.face.y - (footer.middle.y + footer.middle.height),
    height: footer.group.height,
    pager: centre(footer.middle),
  }).toEqual({
    back: ROOM / 2,
    gap: CARD_CONTENT.gap,
    height: ACHIEVEMENTS_FOOTER_HEIGHT,
    pager: ROOM / 2,
  });
});

it("shows as many rows as fit the view less the screen margin, without scrolling", () => {
  const rows = achievementsRows(ACHIEVEMENT_IDS.length);
  const most = SCREEN.height - 2 * CARD_SCREEN_MARGIN;
  expect({
    fits: frame(rows).card.height <= most,
    perPage: achievementsPerPage(),
    scrolls: frame(rows).scrolls,
    tallerScrolls: frame(rows + 1).scrolls,
  }).toEqual({
    fits: true,
    perPage: rows * ACHIEVEMENTS_CARD.columns,
    scrolls: false,
    tallerScrolls: true,
  });
});

it("keeps a short card's rows to its entries", () => {
  expect(achievementsRows(1)).toBe(1);
});
