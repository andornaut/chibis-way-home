import { expect, it } from "vitest";

const SHEETS = import.meta.glob<string>("./*.css", {
  eager: true,
  import: "default",
  query: "?raw",
});

// The HTML UI's lengths are base pixels times --ui-unit, so nothing in its stylesheet is sized in
// CSS pixels or another absolute or font-relative unit: the one px in it is the 1px a calc()
// multiplies a base-px count by.
it.each(Object.entries(SHEETS))("sizes %s only in base pixels times --ui-unit", (_, css) => {
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
