import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { TEXT } from "../data/text";
import { actionHelpLayout } from "../layout/actionHelp";
import { CARD_FONTS } from "../testing/cardFonts";
import { ACTION_HELP_ICONS, ACTION_HELP_KNOB } from "../view/actionHelp";
import { drawActionHelp } from "./actionHelp";
import { addCardTextIn } from "./cardParts";

vi.mock("./cardParts", () => ({
  ACTION_FONT: "font-title",
  BODY_FONT: "font-body",
  addCardTextIn: vi.fn(),
}));

it("mounts the existing rest frames and centres the existing move knob without a hit target", () => {
  const image = vi.fn(() => ({
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
  }));
  const scene = { add: { image } } as unknown as Scene;
  const layout = actionHelpLayout(CARD_FONTS, TEXT.buttons, 512, "{move} {jump}");
  drawActionHelp(scene, 0, { x: 20, y: 30 }, TEXT.buttons, layout);
  expect(image.mock.calls.map((args) => args.slice(2))).toEqual([
    [ACTION_HELP_ICONS.move.key, ACTION_HELP_ICONS.move.frame],
    [ACTION_HELP_KNOB.key, ACTION_HELP_KNOB.frame],
    [ACTION_HELP_ICONS.jump.key, ACTION_HELP_ICONS.jump.frame],
  ]);
  expect(addCardTextIn).toHaveBeenCalledTimes(2);
  expect(vi.mocked(addCardTextIn).mock.calls.every((args) => args[1] === "font-title")).toBe(true);
  expect(image.mock.results[1]!.value.setScale).toHaveBeenCalledWith(
    40 / ACTION_HELP_ICONS.move.width,
  );
});
