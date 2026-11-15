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
  expect(stats.classList.contains("ui-layout-columns")).toBe(false);
  expect(stats.hasAttribute("data-ui-layout-sizing")).toBe(false);
});

it("uses canonical equal columns only when bounded sizing is requested, preserving metric semantics", () => {
  const stats = createRunStats(document, { columnGap: 32, sizing: { mode: "equal" } }, columns);
  expect(stats.classList.contains("ui-layout-columns")).toBe(true);
  expect(stats.dataset.uiLayoutSizing).toBe("equal");
  expect(stats.style.getPropertyValue("--ui-layout-tracks")).toBe("repeat(2, minmax(0, 1fr))");
  expect(stats.style.getPropertyValue("--ui-layout-gap")).toBe("32");
  expect(stats.style.getPropertyValue("--ui-layout-padding")).toBe("0");
  expect(read(stats)).toEqual([
    [
      ["Last time:", "1:05"],
      ["Attempts:", "2"],
    ],
    [["Run total:", "10:10"]],
  ]);
  expect(stats.querySelectorAll("dl dt")).toHaveLength(3);
  expect(stats.querySelectorAll("dl dd")).toHaveLength(3);
});

it("leaves the divider out where the layout has none", () => {
  const stats = createRunStats(document, { columnGap: 32 }, columns);
  expect(read(stats).map((child) => Array.isArray(child))).toEqual([true, true]);
  expect(stats.style.getPropertyValue("--run-stats-column-gap")).toBe("32");
});
