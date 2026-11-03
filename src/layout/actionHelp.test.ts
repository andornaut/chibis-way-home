import { expect, it } from "vitest";

import { TEXT } from "../data/text";
import { CARD_FONTS } from "../testing/cardFonts";
import { actionHelpParts } from "../view/actionHelp";
import { ACTION_HELP, actionHelpLayout } from "./actionHelp";

it("expands only explicit action tokens and refuses unsupported tokens", () => {
  expect(actionHelpParts("Move with {move}; use {use}.")).toEqual([
    { kind: "text", text: "Move with " },
    { action: "move", kind: "action" },
    { kind: "text", text: "; use " },
    { action: "use", kind: "action" },
    { kind: "text", text: "." },
  ]);
  expect(() => actionHelpParts("Press {dash}.")).toThrow("Unknown action help token dash");
});

it("wraps full action units without shrinking the label or icon", () => {
  const width = 180;
  const layout = actionHelpLayout(CARD_FONTS, TEXT.buttons, width, "{move} then {jump} and {use}.");
  const actions = layout.parts.filter(({ part }) => part.kind === "action");
  expect(actions).toHaveLength(3);
  expect(new Set(actions.map(({ rect }) => rect.y)).size).toBeGreaterThan(1);
  for (const { rect } of layout.parts) {
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(layout.height);
  }
  expect(actions.every(({ rect }) => rect.height === ACTION_HELP.lineHeight)).toBe(true);
  expect(() => actionHelpLayout(CARD_FONTS, TEXT.buttons, ACTION_HELP.icon, "{move}")).toThrow(
    "native text width",
  );
});
