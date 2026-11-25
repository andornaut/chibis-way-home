import type { StageRecipe, ZoneMap, ZonePlan } from "../data/types/index.ts";
import { assembleZoneAvoiding, type ChunkLibrary } from "./assemble.ts";

// What a stage plan is assembled from.
export interface StageContext {
  readonly library: ChunkLibrary;
  readonly map: ZoneMap;
  readonly recipes: Readonly<Record<string, StageRecipe>>;
}

// The stage to plan: a map node, which plays its zone's recipe, or a recipe by its key.
export type StageTarget = { readonly node: string } | { readonly recipe: string };

// One stage to plan: the middle chunks to avoid, the assembly seed and the target.
export interface StageRequest {
  readonly avoid: readonly string[];
  readonly seed: number;
  readonly target: StageTarget;
}

// A planned stage: its recipe key, its plan and the plan's middle chunk ids.
export interface PlannedStage {
  readonly key: string;
  readonly middle: readonly string[];
  readonly plan: ZonePlan;
}

// The ids of plan's middle chunks: each area's placed chunks but its first and last, which are
// the stage's start and finish caps or a section's, in area order, each once.
export function middleChunkIds(plan: ZonePlan): readonly string[] {
  const order = plan.areaOrder ?? Object.keys(plan.areas);
  return [
    ...new Set(
      order.flatMap((area) =>
        (plan.areas[area]?.chunks ?? []).slice(1, -1).map(({ chunk }) => chunk),
      ),
    ),
  ];
}

// The target a stage name asks for: the map's zone node of that id, or else the recipe of that
// key.
export function stageTarget(map: ZoneMap, name: string): StageTarget {
  return map.nodes.some((node) => node.id === name && node.kind === "zone")
    ? { node: name }
    : { recipe: name };
}

// The recipe key target plays. Throws on a node the map lacks or one with no zone to play.
export function recipeKey(map: ZoneMap, target: StageTarget): string {
  if ("recipe" in target) {
    return target.recipe;
  }
  const node = map.nodes.find((each) => each.id === target.node);
  if (!node) {
    throw new Error(`No map node ${target.node}`);
  }
  if (node.zone === undefined) {
    throw new Error(`Map node ${target.node} has no zone to play`);
  }
  return node.zone;
}

// The stage request asks for, assembled from its recipe without the avoided middle chunks while
// an assembly fits without them (assembleZoneAvoiding): the same for the same context and
// request. Throws on a target with no recipe.
export function planStage(context: StageContext, request: StageRequest): PlannedStage {
  const key = recipeKey(context.map, request.target);
  const recipe = context.recipes[key];
  if (!recipe) {
    throw new Error(`No recipe ${key}`);
  }
  const plan = assembleZoneAvoiding(context.library, request.avoid, request.seed, key, recipe);
  return { key, middle: middleChunkIds(plan), plan };
}
