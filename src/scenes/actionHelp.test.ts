import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { TEXT } from "../data/text";
import { CARD_FONTS } from "../testing/cardFonts";
import { actionHelpLayout } from "../ui";
import { drawActionHelp } from "./actionHelp";
import { addCardText } from "./cardParts";
import { drawHelpChrome } from "./helpChrome";

vi.mock("./cardParts", () => ({
  ACTION_FONT: "font-title",
  BODY_FONT: "font-body",
  addCardText: vi.fn(),
}));
vi.mock("./helpChrome", () => ({ drawHelpChrome: vi.fn() }));

it("draws each word at its laid-out pen and each icon in its laid-out square, offset together", () => {
  const scene = {} as Scene;
  const at = { x: 20, y: 30 };
  const layout = actionHelpLayout(CARD_FONTS, TEXT.buttons, 180, "Press {move} {jump} {use}");
  drawActionHelp(scene, 0, at, layout);
  const texts = layout.placements.filter((placement) => placement.kind === "text");
  const icons = layout.placements.filter((placement) => placement.kind === "icon");
  expect(vi.mocked(addCardText).mock.calls.map((call) => call.slice(1, 4))).toEqual(
    texts.map((text) => [
      text.font === "body" ? "font-body" : "font-title",
      { x: at.x + text.at.x, y: at.y + text.at.y },
      text.text,
    ]),
  );
  expect(vi.mocked(drawHelpChrome).mock.calls.map((call) => call.slice(1))).toEqual(
    icons.map((icon) => [
      { ...icon.rect, x: at.x + icon.rect.x, y: at.y + icon.rect.y },
      icon.action,
    ]),
  );
});
