import { describe, expect, it } from "vitest";

import { CERTIFIED_LISTS } from "../data/certified";
import { MODULE_RULES } from "../data/modules";
import type { CertifiedChunks, Difficulty, ZoneKey, ZoneRecipe } from "../data/types";
import { ZONE_FRAMES } from "../data/zoneFrames";
import { recipeChunkPool } from "../rules/assemble";
import { certifiedChunks } from "../rules/modules";
import { CHUNK_LIBRARY, STAGE_RECIPES, zoneOfTheme } from "../rules/zonePlans";
import { FIXTURE_MODULES } from "./modules";
import {
  distinctLayouts,
  GAME_CONTEXT,
  POOL_TARGET,
  poolTargets,
  verifyStructure,
  zoneRecipes,
  ZONES,
} from "./pairCertify";

const listOf = (zone: ZoneKey): CertifiedChunks => {
  const list = CERTIFIED_LISTS.find((candidate) => candidate.zone === zone);
  if (!list) {
    throw new Error(`No certified list for ${zone}`);
  }
  return list;
};

describe("certified lists", () => {
  it("cover every zone once", () => {
    expect(CERTIFIED_LISTS.map(({ zone }) => zone).sort()).toEqual([...ZONES]);
  });

  it.each(ZONES)(
    "%s is fresh and every entry passes its structural steps",
    (zone) => {
      expect(verifyStructure(GAME_CONTEXT, listOf(zone))).toEqual([]);
    },
    60_000,
  );

  it("reports a stale data hash and a changed layout", () => {
    const list = listOf("blue");
    const [first, ...rest] = list.entries;
    const problems = verifyStructure(GAME_CONTEXT, {
      ...list,
      entries: [{ ...first!, layout: "0" }, ...rest],
      inputs: { ...list.inputs, data: "stale" },
    });
    expect(problems).toContain("blue: data hash is stale; rerun certify");
    expect(problems.some((problem) => problem.startsWith(`${first!.id}: recorded facts`))).toBe(
      true,
    );
  }, 60_000);

  // Every middle chunk a stage draws is certified for its zone, and nothing else is drawn.
  it.each(
    Object.entries(STAGE_RECIPES).flatMap(([key, recipe]) => {
      const zone = "sections" in recipe ? undefined : zoneOfTheme(recipe.theme);
      return zone ? [[key, zone, recipe as ZoneRecipe] as const] : [];
    }),
  )("%s draws exactly its zone's certified middles", (_, zone, recipe) => {
    const { connectors } = ZONE_FRAMES[zone];
    const drawn = recipeChunkPool(CHUNK_LIBRARY, recipe).filter((id) => {
      const grade = CHUNK_LIBRARY.chunks[id]!.difficulty;
      return (
        !connectors.includes(id) &&
        grade >= recipe.difficulty.min &&
        grade <= recipe.difficulty.max &&
        (recipe.difficultyWeights?.[grade] ?? 1) > 0
      );
    });
    expect(drawn.sort()).toEqual(listOf(zone).entries.map(({ id }) => id));
  });
});

describe("certifiedChunks", () => {
  const entry = (left: string, right: string) => ({
    encounters: 0 as const,
    grade: 4 as const,
    id: `blue-${left}--${right}`,
    kind: "pair" as const,
    layout: "",
    modules: [left, right] as const,
    route: "",
    slots: { door: 1, event: 0 },
    trace: "",
    work: 0,
  });
  const context = {
    frames: ZONE_FRAMES,
    grades: {},
    modules: FIXTURE_MODULES,
    rules: MODULE_RULES,
  };

  it("composes only listed pairs, so an unlisted pair is never drawn", () => {
    const { chunks, pools } = certifiedChunks(context, [
      {
        entries: [entry("fixture-step", "fixture-red-strip")],
        inputs: { data: "", proofs: "" },
        version: 1,
        zone: "blue",
      },
    ]);
    expect(Object.keys(chunks)).toEqual(["blue-fixture-step--fixture-red-strip"]);
    expect(pools).toEqual({ blue: ["blue-fixture-step--fixture-red-strip"] });
  });

  it("refuses a listed pair whose modules are missing", () => {
    expect(() =>
      certifiedChunks(context, [
        {
          entries: [entry("fixture-step", "fixture-gone")],
          inputs: { data: "", proofs: "" },
          version: 1,
          zone: "blue",
        },
      ]),
    ).toThrow("names a missing module");
  });
});

// CLEANUP (added 2026-11-04): each zone's floor rises to "target" (POOL_TARGET distinct layouts,
// split by grade shares) in the commit that adds its modules; remove this table once every zone
// is at its target.
const FLOORS: Readonly<
  Record<
    ZoneKey,
    "target" | { readonly grades: Partial<Record<Difficulty, number>>; total: number }
  >
> = {
  apartment: { grades: { 4: 18, 5: 6 }, total: 24 },
  blue: { grades: { 3: 11, 4: 22 }, total: 33 },
  countryside: { grades: { 3: 10, 4: 22, 5: 3 }, total: 35 },
  home: { grades: { 4: 19, 5: 5 }, total: 24 },
  industrial: { grades: { 3: 11, 4: 18, 5: 6 }, total: 35 },
  woodland: { grades: { 4: 20, 5: 4 }, total: 24 },
};

describe("pool size", () => {
  it.each([
    ["blue", 125, { 3: 63, 4: 63 }],
    ["industrial", 125, { 3: 42, 4: 42, 5: 42 }],
    ["countryside", 125, { 3: 32, 4: 32, 5: 63 }],
    ["woodland", 125, { 4: 32, 5: 94 }],
    ["home", 125, { 4: 21, 5: 105 }],
    ["apartment", 125, { 4: 14, 5: 112 }],
  ] as const)("%s targets %i layouts split by grade share", (zone, total, grades) => {
    const [[, recipe]] = zoneRecipes(zone) as [[string, ZoneRecipe]];
    const target = poolTargets(POOL_TARGET, recipe);
    expect(target.total).toBe(total);
    expect(Object.fromEntries(target.grades)).toEqual(grades);
  });

  it.each(ZONES)("%s certifies at least its floor of distinct layouts", (zone) => {
    const floor = FLOORS[zone];
    const [[, recipe]] = zoneRecipes(zone) as [[string, ZoneRecipe]];
    const { grades, total } =
      floor === "target"
        ? poolTargets(POOL_TARGET, recipe)
        : { grades: new Map(Object.entries(floor.grades)), total: floor.total };
    const actual = distinctLayouts(listOf(zone));
    expect(actual.total).toBeGreaterThanOrEqual(total);
    for (const [grade, minimum] of grades) {
      expect(actual.grades.get(Number(grade) as Difficulty) ?? 0).toBeGreaterThanOrEqual(minimum);
    }
  });
});
