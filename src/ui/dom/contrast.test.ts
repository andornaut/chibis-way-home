import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json";

// Vitest blanks CSS imports, so the stylesheet is read from disk, from the project root.
const css = readFileSync("src/ui/dom/achievements.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

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

// Each rule's selector and the palette colour its color declaration reads.
const textColours = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap(([, selector, body]) =>
  [...body!.matchAll(/(?<![\w-])color:\s*var\(--colour-([\w-]+)\)/g)].map(
    ([, name]) => [selector!.trim(), name!] as const,
  ),
);

it("sets a locked entry's text colour", () => {
  expect(textColours.map(([selector]) => selector)).toContain(".achievements-entry");
});

// Text holds 4.5:1 on the card's lgrey face, locked entries' titles, descriptions and counts
// included.
it.each(textColours)("%s text holds 4.5:1 on the card's lgrey", (_, name) => {
  expect(contrast(colours[name]!, colours.lgrey!)).toBeGreaterThanOrEqual(4.5);
});
