import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };

const colours: Readonly<Record<string, string>> = palette.colours;

// WCAG relative luminance of a #rrggbb colour.
function luminance(colour: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(colour.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

// Each rule's selector and body in a stylesheet, without comments. Vitest blanks CSS imports, so
// the stylesheet is read from disk, from the project root.
function rules(path: string): (readonly [string, string])[] {
  const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(
    ([, selector, body]) => [selector!.trim(), body!] as const,
  );
}

// Each rule's selector and the palette colour its color declaration reads.
function textColours(path: string): (readonly [string, string])[] {
  return rules(path).flatMap(([selector, body]) =>
    [...body.matchAll(/(?<![\w-])color:\s*var\(--colour-([\w-]+)\)/g)].map(
      ([, name]) => [selector, name!] as const,
    ),
  );
}

const achievements = textColours("src/ui/dom/achievements.css");

const LOCKED_STAGE = '.stage-select-stage[data-look="locked"]';
const lockedStageRules = rules("src/ui/dom/stageSelect.css").filter(([selector]) =>
  selector.includes(LOCKED_STAGE),
);
const lockedStageLabels = textColours("src/ui/dom/stageSelect.css").filter(
  ([selector]) => selector === `${LOCKED_STAGE} [data-ui-refusal-label]`,
);

it("sets a locked entry's text colour", () => {
  expect(achievements.map(([selector]) => selector)).toContain(".achievements-entry");
});

// Text holds 4.5:1 on the card's lgrey face, locked entries' titles, descriptions and counts
// included.
it.each(achievements)("%s text holds 4.5:1 on the card's lgrey", (_, name) => {
  expect(contrast(colours[name]!, colours.lgrey!)).toBeGreaterThanOrEqual(4.5);
});

it("sets a locked stage's label colour", () => {
  expect(lockedStageLabels).toHaveLength(1);
});

// A locked stage's name and number hold 4.5:1 on the flat disabled face's lgrey, at full opacity.
it.each(lockedStageLabels)("%s text holds 4.5:1 on the disabled face's lgrey", (_, name) => {
  expect(contrast(colours[name]!, colours.lgrey!)).toBeGreaterThanOrEqual(4.5);
});

it("draws a locked stage's name and number at full opacity", () => {
  const faded = lockedStageRules.filter(
    ([selector, body]) =>
      /stage-select-(name|number)|data-ui-refusal-label/.test(selector) &&
      /(?<![\w-])opacity:/.test(body),
  );
  expect(faded).toEqual([]);
});
