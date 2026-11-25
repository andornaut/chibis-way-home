import { expect, it } from "vitest";

import type {
  ArenaApproach,
  ArenaApproachPolicy,
  ChunkPlan,
  ZoneRecipe,
} from "../data/types/index.ts";
import { FIXTURE_LIBRARY, FIXTURE_RECIPE } from "../testing/chunks.ts";
import { arenaApproachPolicyProblems, arenaApproachRelations } from "./arenaApproaches.ts";
import { assembleZone, assembleZoneAvoiding, type ChunkLibrary } from "./assemble.ts";

const policy: ArenaApproachPolicy = { predecessors: ["qualified"], profile: "cold-encounter-v1" };
const relation: ArenaApproach = { ...policy, arena: "arena", stage: "test-stage" };
const flat = FIXTURE_LIBRARY.chunks["test-finish"]!;
const chunk: ChunkPlan = { ...flat, maxPerZone: 1 };
const chunks = Object.fromEntries([
  ...Array.from({ length: 33 }, (_, i) => [`other-${i}`, chunk] as const),
  ["qualified", chunk],
  ["arena", { ...flat, encounters: 1 }],
]);
const lib: ChunkLibrary = {
  ...FIXTURE_LIBRARY,
  approaches: { "test-stage": relation },
  arenas: { "test-stage": "arena" },
  chunks: { ...FIXTURE_LIBRARY.chunks, ...chunks },
};
const recipe: ZoneRecipe = {
  ...FIXTURE_RECIPE,
  arenaApproach: policy,
  chunks: Object.keys(chunks).filter((id) => id !== "arena"),
  doors: [],
  events: [],
  length: { max: 360, min: 360 },
};

it("keeps a qualified predecessor available through fallback class and limited-use histograms", () => {
  // More than 32 limited candidates forces the approximate search; geometry alone is equivalent.
  const ids = assembleZone(lib, 7, "test-stage", recipe).areas.main!.chunks!.map(
    ({ chunk }) => chunk,
  );
  expect(ids[ids.indexOf("arena") - 1]).toBe("qualified");
  expect(ids.filter((id) => id === "qualified")).toHaveLength(1);
  expect(ids.filter((id) => id === "arena")).toHaveLength(1);
});

it("refuses missing or mismatched qualification without falling back to the ordinary pool", () => {
  expect(() => assembleZone({ ...lib, approaches: {} }, 7, "test-stage", recipe)).toThrow(
    "no matching qualified relation",
  );
  expect(() =>
    assembleZone(
      { ...lib, approaches: { "test-stage": { ...relation, arena: "wrong" } } },
      7,
      "test-stage",
      recipe,
    ),
  ).toThrow("no matching qualified relation");
  expect(() =>
    assembleZone(lib, 7, "test-stage", {
      ...recipe,
      chunks: recipe.chunks!.filter((id) => id !== "qualified"),
    }),
  ).toThrow("not eligible");
});

it("does not apply approach metadata to a recipe which has not opted in", () => {
  const { arenaApproach, ...ordinary } = recipe;
  expect(arenaApproach).toBe(policy);
  expect(assembleZone(lib, 7, "test-stage", ordinary)).toEqual(
    assembleZone({ ...lib, approaches: {} }, 7, "test-stage", ordinary),
  );
});

it("rejects unknown profiles, unmeasured multi-predecessor policies and duplicate stage relations", () => {
  expect(
    arenaApproachPolicyProblems({ ...policy, profile: "unknown" as typeof policy.profile }),
  ).toContain("Unknown arena approach profile unknown");
  expect(
    arenaApproachPolicyProblems({ ...policy, predecessors: ["qualified", "other-0"] }),
  ).toContain("Arena approach profile requires exactly one qualified predecessor");
  expect(() => arenaApproachRelations([{ approaches: [relation, relation] }])).toThrow(
    "Repeated arena approach stage test-stage",
  );
});

it("retains the required approach while excluding other recently used chunks", () => {
  const ids = assembleZoneAvoiding(
    lib,
    ["qualified", "other-0"],
    7,
    "test-stage",
    recipe,
  ).plan.areas.main!.chunks!.map(({ chunk }) => chunk);
  expect(ids[ids.indexOf("arena") - 1]).toBe("qualified");
  expect(ids).not.toContain("other-0");
});
