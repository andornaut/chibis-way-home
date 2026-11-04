import { advanceWidth } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { SCREEN } from "../../data/screen";
import { TEXT } from "../../data/text";
import { SKILL_IDS } from "../../progress";
import { CARD_FONTS } from "../../testing/cardFonts";
import { actionHelpParts } from "../chrome/actionHelp";
import { ACTION_HELP, type ActionHelpLayout, actionHelpLayout } from "./actionHelp";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { skillDetails } from "./skillDetails";

// Reference metrics read from the .fnt files: the declared baseline, line height and the
// capital H's height.
const lineHeight = CARD_FONTS.body.lineHeight * CARD_TEXT_SCALE;
const fontBaseline = (font: keyof typeof CARD_FONTS) =>
  CARD_FONTS[font].baseline! * CARD_TEXT_SCALE;
const capHeight = CARD_FONTS.body.glyphs.get("H")!.height * CARD_TEXT_SCALE;

function lineBaselines(layout: ActionHelpLayout) {
  const lines = new Map<number, Set<number>>();
  for (const placement of layout.placements) {
    if (placement.kind === "text") {
      const set = lines.get(placement.line) ?? new Set();
      set.add(placement.at.y + fontBaseline(placement.font));
      lines.set(placement.line, set);
    }
  }
  return [...lines.entries()].sort(([a], [b]) => a - b).map(([, set]) => [...set]);
}

const skillLayouts = SKILL_IDS.filter((skill) => TEXT.skills[skill].description.includes("{")).map(
  (skill) =>
    [
      skill,
      skillDetails(CARD_FONTS, { ...SCREEN, x: 0, y: 0 }, true, TEXT.buttons, TEXT.skills[skill])
        .description,
    ] as const,
);

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

describe.each(skillLayouts)("the %s card description", (_skill, layout) => {
  it("puts every word and label on a line on that line's one baseline", () => {
    const baselines = lineBaselines(layout);
    expect(baselines.length).toBe(layout.baselines.length);
    baselines.forEach((ys, line) => expect(ys).toEqual([layout.baselines[line]]));
  });
  it("centres each icon on its line's capitals at one line pitch", () => {
    const icons = layout.placements.filter((placement) => placement.kind === "icon");
    expect(icons.length).toBeGreaterThan(0);
    for (const { line, rect } of icons) {
      expect(rect.height).toBeLessThanOrEqual(lineHeight);
      expect(
        Math.abs(rect.y + rect.height / 2 - (layout.baselines[line]! - capHeight / 2)),
      ).toBeLessThanOrEqual(0.5);
    }
  });
  it("keeps every placement inside the measured box", () => {
    for (const placement of layout.placements) {
      const x = placement.kind === "text" ? placement.at.x : placement.rect.x;
      const right =
        placement.kind === "text"
          ? x + advanceWidth(CARD_FONTS[placement.font], CARD_TEXT_SCALE, placement.text)
          : x + placement.rect.width;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(layout.width);
      if (placement.kind === "icon") {
        expect(placement.rect.y).toBeGreaterThanOrEqual(0);
        expect(placement.rect.y + placement.rect.height).toBeLessThanOrEqual(layout.height);
      }
    }
  });
});

it("spaces baselines by the font's line height alone, with or without an icon", () => {
  const plain = actionHelpLayout(CARD_FONTS, TEXT.buttons, 400, "Press\nPress\nPress");
  const iconed = actionHelpLayout(CARD_FONTS, TEXT.buttons, 400, "Press\nPress {jump}\nPress");
  for (const layout of [plain, iconed]) {
    const drawn = lineBaselines(layout).map((ys) => ys[0]!);
    expect(drawn).toEqual(layout.baselines);
    expect(drawn).toHaveLength(3);
    drawn.slice(1).forEach((y, index) => expect(y - drawn[index]!).toBe(lineHeight));
  }
  expect(iconed.baselines).toEqual(plain.baselines);
  expect(iconed.height).toBe(plain.height);
});

it("wraps whole action units and refuses one wider than the text", () => {
  const width = 180;
  const layout = actionHelpLayout(CARD_FONTS, TEXT.buttons, width, "{move} then {jump} and {use}.");
  const icons = layout.placements.filter((placement) => placement.kind === "icon");
  expect(icons).toHaveLength(3);
  expect(new Set(icons.map(({ line }) => line)).size).toBeGreaterThan(1);
  for (const { action, line, rect } of icons) {
    const label = layout.placements.find(
      (placement) =>
        placement.kind === "text" &&
        placement.line === line &&
        placement.text === TEXT.buttons[action] &&
        placement.at.x < rect.x,
    );
    expect(label?.kind).toBe("text");
    if (label?.kind === "text") {
      expect(
        label.at.x + advanceWidth(CARD_FONTS.title, CARD_TEXT_SCALE, label.text) + ACTION_HELP.gap,
      ).toBe(rect.x);
    }
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);
  }
  expect(() => actionHelpLayout(CARD_FONTS, TEXT.buttons, 30, "{move}")).toThrow(
    "native text width",
  );
});
