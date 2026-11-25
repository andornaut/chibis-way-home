// @vitest-environment happy-dom
import { fillNames } from "@andornaut/game-kit/runtime/lines";
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { placeModalFrame } from "@andornaut/game-kit/runtime/ui/modalFrame";
import { expect, it } from "vitest";

import { CARD_CONTENT, CARD_SCREEN_MARGIN, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { STATS_SCOPE_TEXT, TEXT } from "../../data/text.ts";
import { DEATH_ACTIONS } from "../input/deathInput.ts";
import { actionRole } from "./actions.ts";
import { createDeathCard } from "./death.ts";

const SILENT = {
  actions: DEATH_ACTIONS.map((key) => ({
    key,
    label: key === "retry" ? TEXT.death.retry : TEXT.pause.home,
  })),
  label: fillNames(TEXT.death.label, { zone: TEXT.death.title }),
  progress: TEXT.death.progress,
  stage: TEXT.death.stage,
  stats: [{ label: TEXT.stats.attempts, value: "2" }],
  title: TEXT.death.title,
  totals: [{ label: STATS_SCOPE_TEXT.zoneTotal, value: "4:50" }],
};
const WORDS = { ...SILENT, statement: TEXT.death.retry };
const ROOM = CARD_WIDTH.large - 2 * CARD_CONTENT.padding;
const FACE = { height: TEXT_BUTTON.height, width: 160 };

const text = (ids: string | null, root: HTMLElement) =>
  (ids ?? "").split(" ").map((id) => root.querySelector(`#${id}`)?.textContent);

// The card's actions as the action group arranges them, each at a nominal face.
const arranged = (buttons: readonly HTMLButtonElement[]) =>
  arrangeActions(
    { width: ROOM },
    buttons.map((key) => ({ hidden: key.hidden === true, key, role: actionRole(key), size: FACE })),
  );

it("is an alert named by its label and described by its lines, with no close", () => {
  const card = createDeathCard(document, WORDS);
  expect(card.dialog.getAttribute("role")).toBe("alertdialog");
  expect(card.dialog.getAttribute("aria-label")).toBe(WORDS.label);
  expect(card.dialog.hasAttribute("aria-labelledby")).toBe(false);
  expect(text(card.dialog.getAttribute("aria-describedby"), card.dialog)).toEqual([
    WORDS.stage,
    WORDS.progress,
    WORDS.statement,
  ]);
  expect(card.dialog.querySelector("h2")?.textContent).toBe(WORDS.title);
  const plain = createDeathCard(document, SILENT).dialog;
  expect(text(plain.getAttribute("aria-describedby"), plain)).toEqual([
    WORDS.stage,
    WORDS.progress,
  ]);
});

it("moves the focus through Try again then Back to title, both enabled, and nothing else", () => {
  const card = createDeathCard(document, WORDS);
  const focusable = [...card.dialog.querySelectorAll("button")];
  expect(focusable).toEqual([card.buttons.retry, card.buttons.home]);
  expect(focusable.map(({ textContent }) => textContent)).toEqual([
    TEXT.death.retry,
    TEXT.pause.home,
  ]);
  expect(focusable.every((button) => !button.disabled && !button.hidden)).toBe(true);
});

it("shows Back to title left of Try again, the game's gap apart and centred as a pair", () => {
  const card = createDeathCard(document, WORDS);
  const { actions, axis } = arranged([card.buttons.retry, card.buttons.home]);
  const [retry, home] = actions.map((action) => {
    if (action.hidden) {
      throw new Error("Both actions show");
    }
    return action;
  });
  expect(axis).toBe("row");
  expect(retry!.face.x - (home!.face.x + home!.face.width)).toBe(TEXT_BUTTON.gap);
  expect(TEXT_BUTTON.gap).toBe(16);
  expect(home!.face.x).toBe(ROOM - (retry!.face.x + retry!.face.width));
  // Press areas meet midway between the faces and never overlap.
  expect(home!.outset.right).toBe(TEXT_BUTTON.gap / 2);
  expect(retry!.outset.left).toBe(TEXT_BUTTON.gap / 2);
});

it("centres a sole shown action", () => {
  const card = createDeathCard(document, WORDS);
  card.buttons.home.hidden = true;
  const [retry] = arranged([card.buttons.retry, card.buttons.home]).actions;
  expect(retry).toMatchObject({ face: { width: FACE.width, x: (ROOM - FACE.width) / 2 } });
});

it("places its frame on whole pixels at the large width, centred in the play view", () => {
  const { card } = placeModalFrame(
    {
      content: { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 },
      families: CARD_WIDTH,
      family: "large",
      gap: CARD_CONTENT.gap,
      margin: CARD_SCREEN_MARGIN,
      padding: CARD_CONTENT.padding,
    },
    { body: 181, title: { height: 17 } },
  );
  expect(card.width).toBe(CARD_WIDTH.large);
  expect(Object.values(card).every(Number.isInteger)).toBe(true);
  expect(card.x).toBe(Math.floor((SCREEN.width - card.width) / 2));
  expect(card.y).toBe(Math.floor((SCREEN.height - card.height) / 2));
});
