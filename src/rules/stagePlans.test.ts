import { describe, expect, it } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import type { ZoneMap, ZonePlan, ZoneRecipe } from "../data/types/index.ts";
import { requiredChunks } from "./assemble.ts";
import { middleChunkIds, planStage, recipeKey, stageTarget } from "./stagePlans.ts";
import { CHUNK_LIBRARY, STAGE_CONTEXT, zoneOfTheme, zonePlanAvoiding } from "./zonePlans.ts";

const STAGE = ZONE_MAP.nodes.find((node) => node.kind === "zone" && node.zone !== undefined)!;
const { at } = STAGE;
// The game's map with a fork and a zone node that has no zone yet.
const MAP: ZoneMap = {
  ...ZONE_MAP,
  nodes: [
    ...ZONE_MAP.nodes,
    { at, id: "a-fork", kind: "fork" },
    { at, id: "unbuilt", kind: "zone" },
  ],
};
const CONTEXT = { ...STAGE_CONTEXT, map: MAP };
const SEED = 3;

describe("a plan's middle chunks", () => {
  it("takes each area's chunks but its first and last as the middle", () => {
    const placed = (ids: string[]) => ids.map((chunk, col) => ({ chunk, col, cols: 1 }));
    const plan = {
      areaOrder: ["lower", "upper"],
      areas: {
        lower: { chunks: placed(["start", "a", "b", "finish"]) },
        upper: { chunks: placed(["cap", "b", "c", "cap"]) },
      },
    } as unknown as ZonePlan;
    expect(middleChunkIds(plan)).toEqual(["a", "b", "c"]);
  });
});

describe("the stage a request plans", () => {
  it("plans a map node as its zone's recipe, with the recipe key and the plan's middle", () => {
    const byNode = planStage(CONTEXT, { avoid: [], seed: SEED, target: { node: STAGE.id } });
    expect(byNode).toEqual(
      planStage(CONTEXT, { avoid: [], seed: SEED, target: { recipe: STAGE.zone! } }),
    );
    expect(byNode).toEqual({
      avoidance: "honoured",
      key: STAGE.zone,
      middle: middleChunkIds(byNode.plan),
      plan: zonePlanAvoiding([], SEED, STAGE.zone!),
    });
  });

  it("passes the avoided chunks to the assembly", () => {
    const whole = (key: string) =>
      planStage(CONTEXT, { avoid: [], seed: 0, target: { recipe: key } });
    const avoiding = (key: string) =>
      planStage(CONTEXT, { avoid: whole(key).middle, seed: 0, target: { recipe: key } });
    // A recipe that still assembles without its own middle chunks.
    const key = Object.keys(STAGE_CONTEXT.recipes).find(
      (each) => avoiding(each).middle.join() !== whole(each).middle.join(),
    )!;
    expect(avoiding(key).plan).toEqual(zonePlanAvoiding(whole(key).middle, 0, key));
  }, 60_000);

  it.each([
    ["a node the map lacks", { node: "nowhere" }, "No map node nowhere"],
    ["a fork", { node: "a-fork" }, "Map node a-fork has no zone to play"],
    ["a zone node with no zone yet", { node: "unbuilt" }, "Map node unbuilt has no zone to play"],
    ["a key with no recipe", { recipe: "nowhere" }, "No recipe nowhere"],
  ])("refuses %s", (_, target, message) => {
    expect(() => planStage(CONTEXT, { avoid: [], seed: SEED, target })).toThrow(message);
  });

  it("names a zone node as a node and any other name as a recipe key", () => {
    expect({
      fork: stageTarget(MAP, "a-fork"),
      recipe: stageTarget(MAP, "nowhere"),
      stage: stageTarget(MAP, STAGE.id),
      unbuilt: stageTarget(MAP, "unbuilt"),
    }).toEqual({
      fork: { recipe: "a-fork" },
      recipe: { recipe: "nowhere" },
      stage: { node: STAGE.id },
      unbuilt: { node: "unbuilt" },
    });
    expect(recipeKey(MAP, stageTarget(MAP, STAGE.id))).toBe(STAGE.zone);
  });
});

// Every outdoor recipe: the flat recipes of each zone but the apartment.
const OUTDOOR = Object.entries(STAGE_CONTEXT.recipes).flatMap(([key, recipe]) => {
  const zone = "sections" in recipe ? undefined : zoneOfTheme(recipe.theme);
  return zone === undefined || zone === "apartment" || "sections" in recipe
    ? []
    : [[key, recipe] as const];
});
const AVOID_SEEDS = Array.from({ length: 8 }, (_, seed) => seed);

describe("a stage entered again", () => {
  it.each(OUTDOOR)(
    "plans %s without the earlier plan's middle chunks, but those every plan needs",
    (key, recipe: ZoneRecipe) => {
      const required = requiredChunks(CHUNK_LIBRARY, key, recipe);
      expect(required.size).toBeGreaterThan(0);
      for (const seed of AVOID_SEEDS) {
        const earlier = planStage(STAGE_CONTEXT, { avoid: [], seed, target: { recipe: key } });
        const again = planStage(STAGE_CONTEXT, {
          avoid: earlier.middle,
          seed: seed + 1,
          target: { recipe: key },
        });
        expect(earlier.middle).toEqual(expect.arrayContaining([...required]));
        expect(again.avoidance).toBe("honoured");
        const arena = CHUNK_LIBRARY.arenas?.[key];
        expect(
          again.middle.filter(
            (id) => id !== arena && earlier.middle.includes(id) && !required.has(id),
          ),
        ).toEqual([]);
        const approach = recipe.arenaApproach?.predecessors ?? [];
        if (approach.length > 0) {
          const placed = again.plan.areas.main!.chunks!.map(({ chunk }) => chunk);
          expect(approach).toContain(placed[placed.indexOf(arena!) - 1]);
          expect([...required]).toEqual(expect.arrayContaining([...approach]));
        }
      }
    },
    120_000,
  );

  it("has an outdoor recipe with a certified arena approach", () => {
    expect(OUTDOOR.some(([, recipe]) => recipe.arenaApproach !== undefined)).toBe(true);
  });
});
