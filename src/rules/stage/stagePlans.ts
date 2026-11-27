import type { RoomPlan, StageRecipe, ZoneMap, ZonePlan } from "../../data/types/index.ts";
import {
  assembleZoneAvoiding,
  type Avoidance,
  type AvoidEntries,
  type ChunkLibrary,
  type NothingFits,
} from "./assemble.ts";
import type { StageAssemblyContext } from "./assemblyContext.ts";

// What a stage plan is assembled from.
export interface StageContext {
  readonly library: ChunkLibrary;
  readonly map: ZoneMap;
  readonly recipes: Readonly<Record<string, StageRecipe>>;
  readonly rooms?: Readonly<Record<string, RoomPlan>>;
}

// The stage to plan: a map node, which plays its zone's recipe, or a recipe by its key.
export type StageTarget = { readonly node: string } | { readonly recipe: string };

// One stage to plan: the middle chunks to avoid, as the zone's recent stage entries newest first,
// the assembly seed and the target.
export interface StageRequest {
  // Undefined retains canonical recipe fills; null leaves its gift reservation empty.
  readonly giftRoom?: string | null;
  readonly avoid: AvoidEntries;
  readonly seed: number;
  readonly target: StageTarget;
}

// A planned stage: whether its request's avoided chunks were left out ("honoured") or the whole
// pools were used because nothing fitted without them ("fallback"), its recipe key, its plan and
// the plan's middle chunk ids.
export interface PlannedStage {
  readonly avoidance: Avoidance;
  readonly key: string;
  readonly middle: readonly string[];
  readonly outcome: "planned";
  readonly plan: ZonePlan;
}

// A stage request's outcome: its planned stage, or that nothing fits even with every pool whole.
export type StagePlan = NothingFits | PlannedStage;

// A planned outcome, or else the nothing-fits reason thrown, for a caller with nothing to degrade
// to, such as the scene starting a stage the certified lists prove feasible.
export function requirePlanned<Planned>(outcome: NothingFits | Planned): Planned {
  if ((outcome as NothingFits).outcome === "nothing-fits") {
    throw new Error((outcome as NothingFits).reason);
  }
  return outcome as Planned;
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

// The stage request asks for, assembled from its recipe without the avoided middle chunks it can
// do without while an assembly fits without them (assembleZoneAvoiding), or that nothing fits:
// the same for the same context and request. Throws on a target with no recipe.
export function planStage(context: StageContext, request: StageRequest): StagePlan {
  const key = recipeKey(context.map, request.target);
  const recipe = context.recipes[key];
  if (!recipe) {
    throw new Error(`No recipe ${key}`);
  }
  let library: StageAssemblyContext = context.library;
  if (request.giftRoom !== undefined) {
    const rooms = context.rooms;
    if (!rooms) {
      throw new Error("Gift binding requires a room catalogue");
    }
    if (request.giftRoom !== null && rooms[request.giftRoom]?.grant === undefined) {
      throw new Error("Selected gift room grants no skill");
    }
    const doors =
      "sections" in recipe ? recipe.sections.flatMap((section) => section.doors) : recipe.doors;
    const reservations = doors.filter(({ room }) => rooms[room]?.grant !== undefined);
    if (reservations.length !== 1 || reservations[0]!.count !== 1) {
      throw new Error("Stage requires exactly one nominated gift reservation");
    }
    library = {
      ...context.library,
      giftBinding: { reservedRoom: reservations[0]!.room, room: request.giftRoom },
    };
  }
  const assembly = assembleZoneAvoiding(library, request.avoid, request.seed, key, recipe);
  if (assembly.outcome === "nothing-fits") {
    return assembly;
  }
  const { avoidance, plan } = assembly;
  return { avoidance, key, middle: middleChunkIds(plan), outcome: "planned", plan };
}
