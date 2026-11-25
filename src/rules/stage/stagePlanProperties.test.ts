import { describe, expect, it } from "vitest";

import { CHUNK_RULES } from "../../data/chunks.ts";
import type { ChunkPlan, StageRecipe, ZonePlan } from "../../data/types/index.ts";
import { requiredSteps, runLoops } from "./assemble.ts";
import { planStage } from "./stagePlans.ts";
import { CHUNK_LIBRARY, STAGE_CONTEXT, STAGE_RECIPES } from "./zonePlans.ts";

// The rules every assembled plan of every stage recipe keeps, over a fixed seed set, planned
// afresh and again avoiding the first plan's middle chunks.
const SEEDS = Array.from({ length: 16 }, (_, seed) => seed);
const RECIPES = Object.entries(STAGE_RECIPES).sort(([a], [b]) => (a < b ? -1 : 1));

const chunkOf = (id: string): ChunkPlan => {
  const chunk = CHUNK_LIBRARY.chunks[id];
  if (!chunk) {
    throw new Error(`Unknown placed chunk ${id}`);
  }
  return chunk;
};

const plan = (key: string, seed: number, avoid: readonly (readonly string[])[] = []) =>
  planStage(STAGE_CONTEXT, { avoid, seed, target: { recipe: key } });

// Each area's placed chunks with its difficulty band: a flat stage's one area, or each section.
function areasOf(recipe: StageRecipe, zone: ZonePlan) {
  const order = zone.areaOrder ?? Object.keys(zone.areas);
  return order.map((area, index) => ({
    band: "sections" in recipe ? recipe.sections[index]!.difficulty : recipe.difficulty,
    chunks: zone.areas[area]!.chunks!,
  }));
}

// Why a plan breaks the assembly rules, if it does.
function planProblems(key: string, recipe: StageRecipe, zone: ZonePlan): string[] {
  const problems: string[] = [];
  const uses = new Map<string, number>();
  for (const { band, chunks } of areasOf(recipe, zone)) {
    chunks.forEach((placed, index) => {
      const chunk = chunkOf(placed.chunk);
      if (placed.cols !== CHUNK_RULES.cols.max || chunk.cols !== CHUNK_RULES.cols.max) {
        problems.push(`${placed.chunk} is ${placed.cols} columns, not one screen`);
      }
      const previous = chunks[index - 1];
      if (previous) {
        if (placed.col !== previous.col + previous.cols) {
          problems.push(`${placed.chunk} leaves a gap after ${previous.chunk}`);
        }
        if (chunkOf(previous.chunk).exit.row !== chunk.entry.row) {
          problems.push(`${previous.chunk} to ${placed.chunk} seams differ`);
        }
      }
      if (index === 0 || index === chunks.length - 1) {
        return;
      }
      uses.set(placed.chunk, (uses.get(placed.chunk) ?? 0) + 1);
      if (chunk.difficulty < band.min || chunk.difficulty > band.max) {
        problems.push(
          `${placed.chunk} grade ${chunk.difficulty} is outside ${band.min} to ${band.max}`,
        );
      }
      if (index > 1 && previous!.chunk === placed.chunk) {
        problems.push(`${placed.chunk} twice in a row`);
      }
    });
  }
  for (const [id, count] of uses) {
    if (count > (chunkOf(id).maxPerZone ?? Infinity)) {
      problems.push(`${id} placed ${count} times, over its maxPerZone`);
    }
  }
  if (!("sections" in recipe) && recipe.loopCap !== undefined) {
    const run = zone.areas.main!.chunks!.slice(1, -1).map(({ chunk }) => chunk);
    const loops = runLoops(CHUNK_LIBRARY, recipe.start, run);
    if (loops > recipe.loopCap) {
      problems.push(`${key} holds ${loops} loops, over its cap of ${recipe.loopCap}`);
    }
  }
  return problems;
}

describe.each(RECIPES)(
  "stage %s",
  (key, recipe) => {
    it("plans the same stage for the same seed", () => {
      for (const seed of SEEDS.slice(0, 2)) {
        expect(plan(key, seed)).toEqual(plan(key, seed));
      }
    });

    it("joins one-screen chunks at matching seams, within band, limits and loop cap", () => {
      for (const seed of SEEDS) {
        expect(planProblems(key, recipe, plan(key, seed).plan), `seed ${seed}`).toEqual([]);
      }
    });

    it("leaves out the avoided chunks it honours, but the arena and required step sources", () => {
      const avoided = plan(key, 0).middle;
      const kept = new Set<string>(
        "sections" in recipe
          ? []
          : [
              ...requiredSteps(CHUNK_LIBRARY, key, recipe).flat(),
              CHUNK_LIBRARY.arenas?.[key] ?? "",
            ],
      );
      for (const seed of SEEDS) {
        const again = plan(key, seed, [avoided]);
        expect(planProblems(key, recipe, again.plan), `seed ${seed}`).toEqual([]);
        if (again.avoidance === "honoured") {
          expect(
            again.middle.filter((id) => avoided.includes(id) && !kept.has(id)),
            `seed ${seed}`,
          ).toEqual([]);
        }
      }
    });
  },
  120_000,
);
