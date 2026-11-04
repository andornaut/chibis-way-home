import { expect, it } from "vitest";

import { RECIPES } from "../data/zones";
import { TUNING_GROUPS, tuningRows } from "./catalogue";

it("shows sorted actual nested values without changing their source", () => {
  const path = Object.freeze([2, 4]);
  const source = Object.freeze(
    Object.fromEntries([
      ["Zebra", Object.freeze({ speed: 12.5 })],
      [
        "Alpha",
        Object.freeze({ enabled: false, mode: "steady", optional: null, path, unused: undefined }),
      ],
    ]),
  );
  expect(tuningRows(source)).toEqual([
    { group: "Alpha", path: "enabled", value: "false" },
    { group: "Alpha", path: "mode", value: "steady" },
    { group: "Alpha", path: "optional", value: "null" },
    { group: "Alpha", path: "path.0", value: "2" },
    { group: "Alpha", path: "path.1", value: "4" },
    { group: "Zebra", path: "speed", value: "12.5" },
  ]);
  expect(path).toEqual([2, 4]);
});

it("shows difficulty only as each banded recipe's own band", () => {
  const rows = tuningRows(TUNING_GROUPS);
  expect(rows.some(({ group }) => group === "Difficulty")).toBe(false);
  const banded = Object.entries(RECIPES).flatMap(([key, recipe]) =>
    "difficulty" in recipe ? [[key, recipe] as const] : [],
  );
  expect(banded.length).toBeGreaterThan(0);
  for (const [key, recipe] of banded) {
    expect(rows).toContainEqual({
      group: "Stage recipes",
      path: `${key}.difficulty.min`,
      value: String(recipe.difficulty.min),
    });
  }
});
