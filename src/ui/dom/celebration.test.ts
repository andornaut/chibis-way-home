// @vitest-environment happy-dom
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { expect, it } from "vitest";

import { CARD_CONTENT, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { TEXT } from "../../data/text.ts";
import { actionRole } from "./actions.ts";
import { createCelebrationView } from "./celebration.ts";

const text = (id: string | null, root: HTMLElement) => root.querySelector(`#${id}`)?.textContent;

it("is a region named by its title and described by its message, with no close", () => {
  const view = createCelebrationView(document, TEXT.celebration);
  expect(view.dialog.getAttribute("role")).toBe("region");
  expect(text(view.dialog.getAttribute("aria-labelledby"), view.dialog)).toBe(
    TEXT.celebration.title,
  );
  expect(text(view.dialog.getAttribute("aria-describedby"), view.dialog)).toBe(
    TEXT.celebration.message,
  );
  expect(view.close).toBeUndefined();
});

it("moves the focus through Continue then Restart, both enabled and named from data", () => {
  const view = createCelebrationView(document, TEXT.celebration);
  const focusable = [...view.dialog.querySelectorAll("button")];
  expect(focusable).toEqual([view.buttons.continue, view.buttons.restart]);
  expect(focusable.map(({ textContent }) => textContent)).toEqual([
    TEXT.celebration.continue,
    TEXT.celebration.restart,
  ]);
  expect(focusable.every((button) => !button.disabled && !button.hidden)).toBe(true);
});

it("shows Restart left of primary Continue, the game's gap apart", () => {
  const view = createCelebrationView(document, TEXT.celebration);
  const { actions } = arrangeActions(
    { width: CARD_WIDTH.small - 2 * CARD_CONTENT.padding },
    [view.buttons.continue, view.buttons.restart].map((key) => ({
      key,
      role: actionRole(key),
      size: { height: TEXT_BUTTON.height, width: 120 },
    })),
  );
  const [proceed, restart] = actions.map((action) => {
    if (action.hidden) {
      throw new Error("Both actions show");
    }
    return action.face;
  });
  expect(proceed!.x - (restart!.x + restart!.width)).toBe(TEXT_BUTTON.gap);
});

it("keeps the decorative play mark in Continue alone, out of its name, a source per view", () => {
  const live = createCelebrationView(document, TEXT.celebration);
  live.mark.style.setProperty("--celebration-mark-image", 'url("blob:runtime-mark")');
  const fresh = createCelebrationView(document, TEXT.celebration);
  expect(fresh.mark.style.getPropertyValue("--celebration-mark-image")).toBe("");
  expect(fresh.buttons.continue.contains(fresh.mark)).toBe(true);
  expect(fresh.buttons.restart.contains(fresh.mark)).toBe(false);
  expect(fresh.mark.getAttribute("aria-hidden")).toBe("true");
  expect(fresh.mark.textContent).toBe("");
});
