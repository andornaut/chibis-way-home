import { expect, it } from "vitest";

import ui from "./ui.css?raw";
import update from "./update.css?raw";

// The HTML UI's lengths are base pixels times --ui-unit, so nothing in its stylesheet is sized in
// CSS pixels or another absolute or font-relative unit: the one px in it is the 1px a calc()
// multiplies a base-px count by.
it.each([
  { css: ui, name: "ui.css" },
  { css: update, name: "update.css" },
])("sizes $name only in base pixels times --ui-unit", ({ css }) => {
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
