// @vitest-environment happy-dom
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { expect, it } from "vitest";

import { DIALOGUE_LAYOUT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { DIALOGUE_SCREEN } from "../layout/dialogueScreen.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import { createDialogueView, createStatusPanel, DIALOGUE_FOOTER_LAYOUT } from "./dialogue.ts";

const HIT = hitMargin({ height: TEXT_BUTTON.height, width: TEXT_BUTTON.height, x: 0, y: 0 });
const face = (width: number) => ({ height: TEXT_BUTTON.height, width });

it.each([false, true])(
  "names a conversation and its two actions, Continue first in the focus order (departure %s)",
  (departure) => {
    const view = createDialogueView(document, departure, "dialogue", TEXT.dialogue);
    const buttons = [...view.dialog.querySelectorAll("button")];
    expect({
      controls: buttons.map(({ dataset }) => dataset.control),
      disabled: buttons.map(({ disabled }) => disabled),
      footer:
        view.footer.contains(view.buttons.continue) && view.footer.contains(view.buttons.skip),
      hidden: buttons.map(({ hidden }) => hidden),
      label: view.dialog.getAttribute("aria-label"),
      names: buttons.map(({ textContent }) => textContent),
      preview: view.preview.hidden,
      role: view.dialog.getAttribute("role"),
    }).toEqual({
      controls: ["continue", "skip"],
      disabled: [false, false],
      footer: true,
      hidden: [false, false],
      label: TEXT.dialogue.label,
      names: [TEXT.dialogue.continue, TEXT.dialogue.skip],
      preview: !departure,
      role: "dialog",
    });
  },
);

it("holds a bark's panel hidden in a status region without controls", () => {
  const { panel, root } = createStatusPanel(document, "bark");
  expect(root.querySelector("[role=status]")?.contains(panel.element)).toBe(true);
  expect(panel.element.hidden).toBe(true);
  expect(root.querySelectorAll("button")).toHaveLength(0);
});

it("starts the footer below the panel on its right edge, and a departure's in from the corner", () => {
  const { box } = DIALOGUE_SCREEN;
  const footer = DIALOGUE_FOOTER_LAYOUT as Readonly<Record<string, number>>;
  expect(footer).toEqual({
    "--dialogue-departure-inset": 16,
    "--dialogue-footer-right": 120,
    "--dialogue-footer-top": 140,
  });
  expect(SCREEN.width - footer["--dialogue-footer-right"]!).toBe(box.x + box.width);
  expect(footer["--dialogue-footer-top"]).toBe(box.y + box.height + DIALOGUE_LAYOUT.footer.gap);
});

// The row is as wide as its faces and the gap, so its right edge is Continue's.
it("puts Skip left of Continue 16 apart, their press areas meeting half way", () => {
  const [skip, next] = [face(70), face(106)];
  const row = arrangeActions({ axis: "row", width: skip.width + TEXT_BUTTON.gap + next.width }, [
    { key: "continue", role: "primary", size: next },
    { key: "skip", role: "secondary", size: skip },
  ]);
  const placed = Object.fromEntries(
    row.actions.flatMap((action) => (action.hidden ? [] : [[action.key, action]])),
  );
  expect(row.group).toEqual({ height: 48, width: 192, x: 0, y: 0 });
  expect(placed.skip!.face).toEqual({ ...skip, x: 0, y: 0 });
  expect(placed.continue!.face).toEqual({ ...next, x: 86, y: 0 });
  expect(placed.skip!.outset).toEqual({ bottom: HIT, left: HIT, right: 8, top: HIT });
  expect(placed.continue!.outset).toEqual({ bottom: HIT, left: 8, right: HIT, top: HIT });
});

it("gives a sole shown action the whole row and the full press margin", () => {
  const next = face(106);
  const row = arrangeActions({ axis: "row", width: next.width }, [
    { key: "continue", role: "primary", size: next },
    { hidden: true, key: "skip", role: "secondary", size: face(70) },
  ]);
  expect(row.group.width).toBe(next.width);
  expect(row.actions[0]).toMatchObject({
    face: { ...next, x: 0, y: 0 },
    outset: { bottom: HIT, left: HIT, right: HIT, top: HIT },
  });
  expect(row.actions[1]).toMatchObject({ hidden: true });
});
