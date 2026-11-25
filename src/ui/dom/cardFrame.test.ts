// @vitest-environment happy-dom
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { modalFrameRooms, placeModalFrame } from "@andornaut/game-kit/runtime/ui/modalFrame";
import { expect, it } from "vitest";

import { CARD_CONTENT, CARD_SCREEN_MARGIN, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { createCard, createMessageCard } from "./card.ts";
import { cardFramePlacement, createCardFrame } from "./cardFrame.ts";

// A title's box: one heading line trimmed to its cap height, rounded up to a whole pixel.
const TITLE = 17;

function place(card: Parameters<typeof cardFramePlacement>[0], body: number, footer?: number) {
  const { bodyOutset, context, title } = cardFramePlacement(card);
  return placeModalFrame(context, {
    body,
    ...(bodyOutset === undefined ? {} : { bodyOutset }),
    ...(footer === undefined ? {} : { footer }),
    title: { ...title, height: card.titled ? TITLE : 0 },
  });
}

it("centres every width family in the view on whole pixels inside the screen margin", () => {
  for (const family of ["large", "medium", "small"] as const) {
    const { card } = place({ close: true, family, titled: true }, 101);
    expect(card.width).toBe(CARD_WIDTH[family]);
    expect(card.x).toBe((SCREEN.width - card.width) / 2);
    expect(card.y).toBe(Math.floor((SCREEN.height - card.height) / 2));
    expect(card.x).toBeGreaterThanOrEqual(CARD_SCREEN_MARGIN);
  }
});

it("draws the close face 6 px from the card's top and right with a centred minimum target", () => {
  const { card, close } = place({ close: true, family: "medium", titled: true }, 100);
  expect(close!.face).toEqual({
    height: CARD_CONTENT.closeSize,
    width: CARD_CONTENT.closeSize,
    x: card.x + card.width - CARD_CONTENT.closeInset - CARD_CONTENT.closeSize,
    y: card.y + CARD_CONTENT.closeInset,
  });
  expect([close!.press.width, close!.press.height]).toEqual([
    HIT_RULE.minTarget,
    HIT_RULE.minTarget,
  ]);
  expect(close!.press.x + close!.press.width / 2).toBe(close!.face.x + close!.face.width / 2);
  expect(close!.press.y + close!.press.height / 2).toBe(close!.face.y + close!.face.height / 2);
});

it("starts a closeable card's body where a press area above it clears the close target", () => {
  const { body, card, close, title } = place({ close: true, family: "medium", titled: true }, 100);
  const outset = Math.ceil(HIT_RULE.marginShare * TEXT_BUTTON.height);
  expect(body.y - outset - (close!.press.y + close!.press.height)).toBe(CARD_CONTENT.gap);
  // A body of text or rows starts at the gap below the close target; either way the title's ink
  // sits midway between the frame's inner edge and the body, to the nearest pixel.
  const rows = place({ bodyOutset: 0, close: true, family: "medium", titled: true }, 100);
  expect(rows.body.y - (rows.close!.press.y + rows.close!.press.height)).toBe(CARD_CONTENT.gap);
  for (const placed of [rows, { body, card, title }]) {
    const above = placed.title.y - (placed.card.y + CARD_CONTENT.frameBorder);
    const below = placed.body.y - (placed.title.y + TITLE);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
  }
  // The title is centred across the whole card, clear of the close target on both sides.
  expect(title.x - card.x).toBe(card.x + card.width - (title.x + title.width));
  expect(title.x + title.width).toBeLessThanOrEqual(close!.press.x - CARD_CONTENT.gap);
});

it("balances a title without a close X between the frame and the content", () => {
  const { body, card, title } = place({ close: false, family: "large", titled: true }, 100);
  const above = title.y - (card.y + CARD_CONTENT.frameBorder);
  const below = body.y - (title.y + TITLE);
  expect(above).toBe(below);
  expect(title.y - card.y).toBe(CARD_CONTENT.padding);
});

it("starts an untitled card's content at the padding and keeps the padding below it", () => {
  const { body, card } = place({ close: false, family: "small", titled: false }, 40);
  expect(body.y - card.y).toBe(CARD_CONTENT.padding);
  expect(card.height).toBe(2 * CARD_CONTENT.padding + 40);
});

it("pins a footer the gap below the body and the padding above the card's bottom", () => {
  const { body, card, footer } = place({ close: true, family: "large", titled: true }, 120, 48);
  expect(footer!.y - (body.y + body.height)).toBe(CARD_CONTENT.gap);
  expect(card.y + card.height - (footer!.y + footer!.height)).toBe(CARD_CONTENT.padding);
  const rooms = modalFrameRooms(
    cardFramePlacement({ close: true, family: "large", titled: true }).context,
  );
  // A sole footer action is centred in the footer's room.
  const [back] = arrangeActions({ variant: "footer", width: rooms.footer }, [
    { key: "back", role: "primary", size: { height: TEXT_BUTTON.height, width: 70 } },
  ]).actions;
  expect(back).toMatchObject({ face: { x: (rooms.footer - 70) / 2 } });
});

it("scrolls a body taller than the view less the screen margins", () => {
  const { card, scrolls } = place({ close: true, family: "large", titled: true }, 400);
  expect(scrolls).toBe(true);
  expect(card.height).toBe(SCREEN.height - 2 * CARD_SCREEN_MARGIN);
});

it("names a card by its title, describes it by its text and puts the close X last", () => {
  const card = createCard(document, "restart-card", {
    actions: [
      { key: "cancel", label: TEXT.restart.cancel },
      { key: "confirm", label: TEXT.restart.restart, primary: true },
    ],
    close: TEXT.update.close,
    text: TEXT.restart.question,
    title: TEXT.restart.title,
    width: "small",
  });
  const { dialog } = card;
  expect(dialog.getAttribute("role")).toBe("dialog");
  expect(dialog.querySelector(`#${dialog.getAttribute("aria-labelledby")}`)?.textContent).toBe(
    TEXT.restart.title,
  );
  expect(dialog.querySelector(`#${dialog.getAttribute("aria-describedby")}`)?.textContent).toBe(
    TEXT.restart.question,
  );
  const controls = [...dialog.querySelectorAll("button")];
  expect(controls.map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual(
    [TEXT.restart.cancel, TEXT.restart.restart, TEXT.update.close],
  );
  expect(controls.at(-1)).toBe(card.close);
});

it("leaves an untitled card unnamed by a title and a status message without controls", () => {
  const frame = createCardFrame(document, { alert: true, id: "choice", width: "small" });
  expect(frame.dialog.getAttribute("role")).toBe("alertdialog");
  expect(frame.dialog.hasAttribute("aria-labelledby")).toBe(false);
  const message = createMessageCard(document, "connect-card", TEXT.update.connect);
  const status = message.querySelector("[role=status]")!;
  expect(status.textContent).toBe(TEXT.update.connect);
  expect(message.querySelectorAll("button")).toHaveLength(0);
});
