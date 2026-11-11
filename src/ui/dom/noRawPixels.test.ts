import { readdirSync, readFileSync } from "node:fs";

import { expect, it } from "vitest";

// Vitest blanks CSS imports, so the stylesheets are read from disk.
const DIRECTORY = new URL(".", import.meta.url);
const SHEETS = readdirSync(DIRECTORY)
  .filter((name) => name.endsWith(".css"))
  .map((name) => [name, readFileSync(new URL(name, DIRECTORY), "utf8")] as const);

// The HTML UI's lengths are base pixels times --ui-unit, so nothing in its stylesheets is sized in
// CSS pixels or another absolute or font-relative unit: the one px in them is the 1px a calc()
// multiplies a base-px count by.
it.each(SHEETS)("sizes %s only in base pixels times --ui-unit", (_, css) => {
  expect(css).toContain("--ui-unit");
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const lengths = [
    ...rules.matchAll(
      /(?<![\w-])(\*\s*)?(\d*\.?\d+)(px|pt|pc|cm|mm|in|q|r?em|ex|ch|v[wh]|vmin|vmax|cq[wh])\b/gi,
    ),
  ];
  expect(
    lengths
      .filter(([, times, value, unit]) => !(times && value === "1" && unit === "px"))
      .map(([match]) => match),
  ).toEqual([]);
});
