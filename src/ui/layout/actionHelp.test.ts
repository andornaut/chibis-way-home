import { advanceWidth } from "@andornaut/game-kit/text/bitmapFont";
import { expect, it } from "vitest";

import { TEXT } from "../../data/text";
import { CARD_FONTS } from "../../testing/cardFonts";
import { actionHelpParts } from "../chrome/actionHelp";
import { ACTION_HELP, actionHelpLayout } from "./actionHelp";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { cardTextOrigin } from "./contentCard";

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

it("reserves full bitmap advances before an icon and wraps without overlap", () => {
  const layout = actionHelpLayout(CARD_FONTS, TEXT.buttons, 180, "{move} then {jump} and {use}.");
  for (const { part, rect } of layout.parts) {
    if (part.kind !== "action") {
      continue;
    }
    const label = { ...rect, width: rect.width - ACTION_HELP.icon - ACTION_HELP.gap };
    const start = cardTextOrigin(CARD_FONTS.title, label, TEXT.buttons[part.action]);
    const advanceEnd =
      start.x + advanceWidth(CARD_FONTS.title, CARD_TEXT_SCALE, TEXT.buttons[part.action]);
    const iconLeft = rect.x + rect.width - ACTION_HELP.icon;
    expect(advanceEnd + ACTION_HELP.gap).toBeLessThanOrEqual(iconLeft);
  }
});
