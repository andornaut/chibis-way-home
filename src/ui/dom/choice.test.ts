// @vitest-environment happy-dom
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { STACK_BUTTON_GAP } from "@andornaut/game-kit/runtime/ui/spacing";
import { expect, it } from "vitest";

import { CARD_CONTENT, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { TEXT } from "../../data/text.ts";
import { actionRole } from "./actions.ts";
import { createChoiceCard } from "./choice.ts";

const WORDS = {
  options: [
    { id: "continue", label: TEXT.dialogue.continue },
    { id: "skip", label: TEXT.dialogue.skip },
  ],
  prompt: TEXT.dialogue.label,
};
const ROOM = CARD_WIDTH.small - 2 * CARD_CONTENT.padding;

it("is an alert named by its prompt, with no title text or close", () => {
  const { dialog } = createChoiceCard(document, "choice", WORDS);
  expect(dialog.getAttribute("role")).toBe("alertdialog");
  const named = dialog.querySelector(`#${dialog.getAttribute("aria-labelledby")}`);
  expect(named?.textContent).toBe(WORDS.prompt);
  expect(dialog.querySelector("h2")).toMatchObject({ hidden: true, textContent: "" });
});

it("moves the focus through its answers in their order, each enabled, by its id", () => {
  const card = createChoiceCard(document, "choice", WORDS);
  expect([...card.dialog.querySelectorAll("button")]).toEqual([...card.buttons.values()]);
  expect(
    [...card.buttons].map(([id, button]) => ({
      enabled: !button.disabled && !button.hidden,
      id,
      label: button.textContent,
    })),
  ).toEqual(WORDS.options.map(({ id, label }) => ({ enabled: true, id, label })));
});

it("stacks its answers at the card's content width, the stack gap apart, in their order", () => {
  const card = createChoiceCard(document, "choice", WORDS);
  const { actions, axis } = arrangeActions(
    { axis: "stack", stackWidth: "fill", width: ROOM },
    [...card.buttons.values()].map((key) => ({
      key,
      role: actionRole(key),
      size: { height: TEXT_BUTTON.height, width: 120 },
    })),
  );
  const faces = actions.map((action) => {
    if (action.hidden) {
      throw new Error("Every answer shows");
    }
    return action.face;
  });
  expect(axis).toBe("stack");
  expect(faces.map(({ width, x }) => ({ width, x }))).toEqual(
    faces.map(() => ({ width: ROOM, x: 0 })),
  );
  expect(faces[1]!.y - (faces[0]!.y + faces[0]!.height)).toBe(STACK_BUTTON_GAP);
  expect(STACK_BUTTON_GAP).toBe(8);
});
