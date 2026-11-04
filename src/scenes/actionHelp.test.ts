import { advanceWidth } from "@andornaut/game-kit/text/bitmapFont";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { TEXT } from "../data/text";
import { CARD_FONTS } from "../testing/cardFonts";
import { ACTION_HELP, actionHelpLayout, CARD_TEXT_SCALE, cardTextOrigin } from "../ui";
import { drawActionHelp } from "./actionHelp";
import { addCardTextIn } from "./cardParts";
import { drawHelpChrome } from "./helpChrome";

vi.mock("./cardParts", () => ({
  ACTION_FONT: "font-title",
  BODY_FONT: "font-body",
  addCardTextIn: vi.fn(),
}));
vi.mock("./helpChrome", () => ({ drawHelpChrome: vi.fn() }));

it("draws separate filled icons after the actual label advance and gap without input targets", () => {
  const scene = {} as Scene;
  const font = CARD_FONTS.title;
  const at = { x: 20, y: 30 };
  const layout = actionHelpLayout(CARD_FONTS, TEXT.buttons, 180, "{move} {jump} {use}");
  drawActionHelp(scene, 0, at, TEXT.buttons, layout);
  expect(drawHelpChrome).toHaveBeenCalledTimes(3);
  expect(vi.mocked(addCardTextIn).mock.calls.every((args) => args[1] === "font-title")).toBe(true);
  for (const [index, action] of (["move", "jump", "use"] as const).entries()) {
    const call = vi.mocked(drawHelpChrome).mock.calls[index]!;
    expect(call[0]).toBe(scene);
    expect(call[2]).toBe(action);
    const rect = vi.mocked(addCardTextIn).mock.calls[index]![2];
    const origin = cardTextOrigin(font, rect, TEXT.buttons[action]);
    expect(
      origin.x + advanceWidth(font, CARD_TEXT_SCALE, TEXT.buttons[action]) + ACTION_HELP.gap,
    ).toBeLessThanOrEqual(call[1].x);
  }
});
