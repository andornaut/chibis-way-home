// @vitest-environment happy-dom
import { pagerState } from "@andornaut/game-kit/runtime/ui/pager";
import { afterEach, expect, it, vi } from "vitest";

import { TEXT } from "../../data/text.ts";
import {
  assertGameActions,
  bindGameActions,
  createGameFormRow,
  createGameHudDisc,
  createGamePager,
  type GameAction,
} from "../binding/actionBinding.ts";
import { createCard } from "../dom/card.ts";

// Every discrete control a view builds is a kit standard button the shared binding presses: a
// text button, a close X, a form row, a pager step or a HUD disc.

const stops: (() => void)[] = [];
const gate = { accepts: () => true, capture: () => () => true };
const pointer = (target: HTMLElement, type: string) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      cancelable: true,
      isPrimary: true,
      pointerId: 1,
    }),
  );
const tap = (target: HTMLElement) => {
  pointer(target, "pointerdown");
  pointer(target, "pointerup");
};

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  document.body.replaceChildren();
});

function bind(root: HTMLElement, actions: readonly GameAction[]): void {
  stops.push(
    bindGameActions(
      {
        guard: { gate },
        resolve: (target) =>
          actions.find(({ element }) => target instanceof Node && element.contains(target)) ?? null,
      },
      root,
    ),
  );
}

it("presses a card's buttons and close X once each through the shared binding", () => {
  const card = createCard(document, "restart-card", {
    actions: [
      { key: "cancel", label: TEXT.restart.cancel },
      { key: "restart", label: TEXT.restart.restart, primary: true },
    ],
    close: TEXT.update.close,
    title: TEXT.restart.title,
    width: "small",
  });
  document.body.append(card.root);
  const controls = [card.buttons.cancel, card.buttons.restart, card.close!];
  expect(() => assertGameActions(card.root)).toThrow();
  const presses = controls.map(() => vi.fn());
  bind(
    card.root,
    controls.map((element, index) => ({
      activate: presses[index]!,
      available: () => true,
      element,
    })),
  );
  expect(() => assertGameActions(card.root)).not.toThrow();
  controls.forEach(tap);
  expect(presses.map((press) => press.mock.calls.length)).toEqual([1, 1, 1]);
});

it("presses a switch row, a HUD disc and a pager's steps through the same binding", () => {
  const root = document.createElement("section");
  const row = createGameFormRow(document, {
    getState: () => ({ checked: false, value: TEXT.settings.state.off }),
    label: TEXT.settings.fps,
    switch: true,
  });
  const disc = createGameHudDisc(document, {
    name: TEXT.pause.button,
    size: "entry",
    sizes: { entry: { face: 35, icon: 35 } },
  });
  let page = 0;
  const pager = createGamePager(document, {
    countText: ({ page: at, pages }) => `${at + 1}/${pages}`,
    labels: { next: TEXT.achievements.pages.next, previous: TEXT.achievements.pages.previous },
    state: () => pagerState(page, 3),
    step: (direction) => {
      page += direction;
    },
  });
  root.append(row.element, disc.element, pager.view.element);
  document.body.append(root);
  const toggled = vi.fn();
  const opened = vi.fn();
  bind(root, [
    { activate: toggled, available: () => true, element: row.element },
    { activate: opened, available: () => true, element: disc.element },
    ...pager.actions,
  ]);
  expect(() => assertGameActions(root)).not.toThrow();
  expect(row.element.getAttribute("role")).toBe("switch");
  tap(row.element);
  tap(disc.element);
  tap(pager.view.next.element);
  expect([toggled.mock.calls.length, opened.mock.calls.length, page]).toEqual([1, 1, 1]);
  // The first page has no page before it.
  page = 0;
  pager.view.refresh();
  expect(pager.view.previous.element.disabled).toBe(true);
});
