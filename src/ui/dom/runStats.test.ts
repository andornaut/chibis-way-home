// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { createRunStats } from "./runStats.ts";

const columns = [
  [
    { label: "Last time:", value: "1:05" },
    { label: "Attempts:", value: "2" },
  ],
  [{ label: "Run total:", value: "10:10" }],
];

const read = (stats: HTMLElement) =>
  [...stats.children].map((child) =>
    child.matches("dl")
      ? [...child.children].map((row) => [...row.children].map((cell) => cell.textContent))
      : child.getAttribute("aria-hidden"),
  );

it("lists each column's metrics as label and value pairs, a hidden divider between columns", () => {
  const stats = createRunStats(document, { columnGap: 16, divider: 2 }, columns);
  expect(read(stats)).toEqual([
    [
      ["Last time:", "1:05"],
      ["Attempts:", "2"],
    ],
    "true",
    [["Run total:", "10:10"]],
  ]);
  expect(stats.style.getPropertyValue("--run-stats-divider")).toBe("var(--ui-slice-2)");
});

it("leaves the divider out where the layout has none", () => {
  const stats = createRunStats(document, { columnGap: 32 }, columns);
  expect(read(stats).map((child) => Array.isArray(child))).toEqual([true, true]);
  expect(stats.style.getPropertyValue("--run-stats-column-gap")).toBe("32");
});
