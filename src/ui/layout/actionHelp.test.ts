import { advanceWidth } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { ACTION_HELP_LAYOUT } from "../../data/layout.ts";
import { TEXT } from "../../data/text.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { CARD_FONTS } from "../../testing/cardFonts.ts";
import { actionHelpParts } from "../chrome/actionHelp.ts";
import { ACTION_HELP, type ActionHelpLayout, actionHelpLayout } from "./actionHelp.ts";
import { CARD_TEXT_SCALE } from "./cardFrame.ts";
import { SKILL_ROOM, skillDetails } from "./skillDetails.ts";

// Reference metrics read from the .fnt files: the declared baseline and line height.
const lineHeight = CARD_FONTS.body.lineHeight * CARD_TEXT_SCALE;
const fontBaseline = (font: keyof typeof CARD_FONTS) =>
  CARD_FONTS[font].baseline! * CARD_TEXT_SCALE;
const ACTION_TOKEN = /\{(?:jump|move|use)\}/u;

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

// Every player string with an action token, by its path in TEXT.
function tokenStrings(value: unknown, path: string): (readonly [string, string])[] {
  if (typeof value === "string") {
    return ACTION_TOKEN.test(value) ? [[path, value]] : [];
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => tokenStrings(entry, `${path}.${key}`));
  }
  return [];
}

const skillLayouts = SKILL_IDS.filter((skill) =>
  ACTION_TOKEN.test(TEXT.skills[skill].description),
).map(
  (skill) =>
    [
      skill,
      skillDetails(CARD_FONTS, SKILL_ROOM.bounds, TEXT.buttons, TEXT.skills[skill]).description,
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

it("draws card text with action icons only in skill descriptions", () => {
  // The home page's instructions are HTML lines, not card text.
  const cards = tokenStrings(TEXT, "TEXT").filter(([path]) => !path.startsWith("TEXT.homePage."));
  expect(cards.map(([path]) => path).sort()).toEqual(
    skillLayouts.map(([skill]) => `TEXT.skills.${skill}.description`).sort(),
  );
});

describe.each(skillLayouts)("the %s card description", (_skill, layout) => {
  it("wraps to at most two lines with every icon on the first", () => {
    expect(layout.baselines.length).toBeLessThanOrEqual(ACTION_HELP_LAYOUT.maxLines);
    for (const placement of layout.placements) {
      if (placement.kind === "icon") {
        expect(placement.line).toBe(0);
      }
    }
  });
  it("puts every word and label on a line on that line's one baseline", () => {
    const baselines = lineBaselines(layout);
    expect(baselines.length).toBe(layout.baselines.length);
    baselines.forEach((ys, line) => expect(ys).toEqual([layout.baselines[line]]));
  });
  it("draws each icon one line pitch square with its bottom on its line's baseline", () => {
    const icons = layout.placements.filter((placement) => placement.kind === "icon");
    expect(icons.length).toBeGreaterThan(0);
    for (const { line, rect } of icons) {
      expect(rect.width).toBe(lineHeight);
      expect(rect.height).toBe(lineHeight);
      expect(rect.y + rect.height).toBe(layout.baselines[line]);
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

it("spaces baselines by the line height and lifts them by the first-line icon's overhang", () => {
  const plain = actionHelpLayout(CARD_FONTS, TEXT.buttons, 400, "Press\nPress");
  const iconed = actionHelpLayout(CARD_FONTS, TEXT.buttons, 400, "Press {jump}\nPress");
  const overhang = lineHeight - fontBaseline("body");
  for (const layout of [plain, iconed]) {
    const drawn = lineBaselines(layout).map((ys) => ys[0]!);
    expect(drawn).toEqual(layout.baselines);
    expect(drawn).toHaveLength(2);
    expect(drawn[1]! - drawn[0]!).toBe(lineHeight);
  }
  expect(iconed.baselines).toEqual(plain.baselines.map((y) => y + overhang));
  expect(iconed.height).toBe(plain.height + overhang);
  const icon = iconed.placements.find((placement) => placement.kind === "icon");
  expect(icon?.kind === "icon" && icon.rect.y).toBe(0);
});

it("refuses icon text past two lines or with an icon below the first", () => {
  expect(() => actionHelpLayout(CARD_FONTS, TEXT.buttons, 400, "{jump}\nPress\nPress")).toThrow(
    "past two lines",
  );
  expect(() => actionHelpLayout(CARD_FONTS, TEXT.buttons, 400, "Press\n{jump}")).toThrow(
    "below the first line",
  );
  expect(
    actionHelpLayout(CARD_FONTS, TEXT.buttons, 400, "Press\nPress\nPress").baselines,
  ).toHaveLength(3);
});

it("wraps whole action units and refuses one wider than the text", () => {
  const text = "{move} then {jump} and {use}";
  const single = actionHelpLayout(CARD_FONTS, TEXT.buttons, 400, text);
  const width = single.width;
  const layout = actionHelpLayout(CARD_FONTS, TEXT.buttons, width, text);
  const icons = layout.placements.filter((placement) => placement.kind === "icon");
  expect(icons).toHaveLength(3);
  expect(layout.baselines).toHaveLength(1);
  expect(() => actionHelpLayout(CARD_FONTS, TEXT.buttons, width - 1, text)).toThrow(
    "below the first line",
  );
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
