// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { STATS_SCOPE_TEXT, TEXT } from "../../data/text.ts";
import { createRunStats } from "./runStats.ts";

const columns = [
  [
    { label: TEXT.stats.lastAttempt, value: "1:05" },
    { label: TEXT.stats.attempts, value: "2" },
  ],
  [{ label: STATS_SCOPE_TEXT.zoneTotal, value: "10:10" }],
];
const pairs = columns.map((rows) => rows.map(({ label, value }) => [label, value]));

// Each child as a screen reader meets it: a list's term and detail pairs, or a hidden divider.
const read = (stats: HTMLElement) =>
  [...stats.children].map((child) =>
    child.matches("dl")
      ? [...child.children].map((row) => [
          row.querySelector("dt")?.textContent,
          row.querySelector("dd")?.textContent,
        ])
      : child.getAttribute("aria-hidden"),
  );

it("lists each column's metrics as label and value pairs, a hidden divider between columns", () => {
  const stats = createRunStats(document, { columnGap: 16, divider: 2 }, columns);
  expect(read(stats)).toEqual([pairs[0], "true", pairs[1]]);
});

it("leaves the divider out where the layout has none", () => {
  expect(read(createRunStats(document, { columnGap: 32 }, columns))).toEqual(pairs);
});

it("keeps the same lists, and the divider, in equal bounded columns", () => {
  const sizing = { mode: "equal" } as const;
  expect(read(createRunStats(document, { columnGap: 32, sizing }, columns))).toEqual(pairs);
  expect(read(createRunStats(document, { columnGap: 32, divider: 2, sizing }, columns))).toEqual([
    pairs[0],
    "true",
    pairs[1],
  ]);
});
