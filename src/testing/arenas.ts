// Arena checks: the static rules every arena obeys, the coverage of the encounter stages, and the
// layout and movement maps the proofs and the evade playtest read.
import { type MapMask, type MovementMap, pathTo } from "@andornaut/game-kit/terrain/movementMap";

import { BIRD_FRAME } from "../assets/index.ts";
import { ARENA_COUNTERS, ARENA_LOOP_TILES, ARENA_PENDING_STAGES } from "../data/arenas/index.ts";
import { TILE } from "../data/screen.ts";
import { SEAM_ROWS } from "../data/seams.ts";
import type {
  AntagonistKind,
  ArenaRoute,
  ChunkArena,
  ChunkPlan,
  StageRecipe,
  TilePoint,
  ZoneKey,
  ZoneLayout,
  ZoneRecipe,
} from "../data/types/index.ts";
import { RECIPES } from "../data/zones.ts";
import type { ChunkLibrary } from "../rules/assemble.ts";
import { chunkProblems } from "../rules/chunk.ts";
import { bindElement } from "../rules/elementBinding.ts";
import { ENCOUNTER_ROLES } from "../rules/modules.ts";
import { groundMask, type MapSupport } from "../rules/movementMaps.ts";
import { zoneLayout } from "../rules/tiles.ts";
import { arenaChunks, CHUNK_LIBRARY, zoneOfTheme } from "../rules/zonePlans.ts";
import { ALLOW, chibiMap, type Encounter, pathOutEncounter, standingAt } from "../sim/pathOut.ts";
import { ARENA_SAMPLES } from "./arenaSamples.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "./art.ts";
import { chunkThemePlan } from "./chunkWalkCases.ts";
import { ORDINARY } from "./encounterLayouts.ts";

const ARENA_ID = /^arena-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMPTY = { door: [], event: [] } as const;

// An arena in its stage: its chunk, the library that holds it, and its stage's recipe and zone.
export interface ArenaCase {
  readonly arena: ChunkArena;
  readonly chunk: ChunkPlan;
  readonly library: ChunkLibrary;
  readonly recipe: ZoneRecipe;
  readonly zone: ZoneKey;
}

export function arenaCase(library: ChunkLibrary, arena: ChunkArena): ArenaCase {
  const { chunks, stages } = arenaChunks([arena]);
  const recipe = RECIPES[arena.stage] as ZoneRecipe;
  return {
    arena,
    chunk: chunks[arena.id]!,
    library: {
      ...library,
      arenas: { ...library.arenas, ...stages },
      chunks: { ...library.chunks, ...chunks },
    },
    recipe,
    zone: zoneOfTheme(recipe.theme)!,
  };
}

// The arena alone in its stage's theme, spawning at column 2 on its entry row.
export function arenaPlan(
  fills: Parameters<typeof chunkThemePlan>[0]["fills"],
  { chunk, library, recipe }: ArenaCase,
) {
  return chunkThemePlan({ fills, theme: recipe.theme }, library, chunk);
}

export function arenaLayout(found: ArenaCase): ZoneLayout {
  return zoneLayout(
    TILE,
    BIRD_FRAME,
    CATALOGUE,
    HITBOXES,
    TILESETS,
    new Set(),
    arenaPlan(EMPTY, found),
  );
}

// The arena as the movement maps see it, and Chibi's skill-free map and mask on it.
export interface ArenaMaps {
  readonly chibi: MovementMap<MapSupport>;
  readonly encounter: Encounter;
  readonly mask: MapMask;
}

export function arenaMaps(found: ArenaCase, layout: ZoneLayout): ArenaMaps {
  const encounter = pathOutEncounter(found.chunk, layout);
  const chibi = chibiMap(ORDINARY, encounter.terrain);
  return {
    chibi,
    encounter,
    mask: groundMask({ allowed: ALLOW, climb: false, key: "all" }, chibi),
  };
}

// A surface point in pixels: the top of the surface under a tile point.
export const pixelOf = ({ col, row }: TilePoint) => ({ x: col * TILE, y: row * TILE });

// Tiles along a route's waypoints, in order.
export function routeTiles(route: ArenaRoute): number {
  return route.waypoints
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum +
        Math.hypot(
          point.col - route.waypoints[index]!.col,
          point.row - route.waypoints[index]!.row,
        ),
      0,
    );
}

export const isLoop = ({ waypoints }: ArenaRoute): boolean =>
  waypoints.length > 2 &&
  waypoints[0]!.col === waypoints.at(-1)!.col &&
  waypoints[0]!.row === waypoints.at(-1)!.row;

// The boss a stage's theme binds to its antagonist role.
export function stageBoss(library: ChunkLibrary, recipe: Pick<ZoneRecipe, "theme">): string {
  return library.themes[recipe.theme]?.bindings.antagonist?.character ?? "";
}

const inBand = (recipe: ZoneRecipe, grade: number) =>
  grade >= recipe.difficulty.min &&
  grade <= recipe.difficulty.max &&
  (recipe.difficultyWeights?.[grade as keyof NonNullable<ZoneRecipe["difficultyWeights"]>] ?? 1) >
    0;

// Why an arena breaks the arena rules, if it does: its id; the chunk rules; one antagonist object,
// bound to the stage's boss; at least 2 routes with distinct waypoints, at least one a loop of
// ARENA_LOOP_TILES or more; every waypoint and refuge a spot Chibi stands on and reaches from the
// entry, and each route's legs walkable in order on his skill-free map; a refuge that counters
// the boss; seam-row entry and exit; a grade the stage draws.
export function arenaProblems(found: ArenaCase, layout: ZoneLayout): string[] {
  const { arena, chunk, library, recipe } = found;
  const problems: string[] = [];
  if (!ARENA_ID.test(arena.id)) {
    problems.push(`id ${arena.id} is not "arena-" and kebab-case`);
  }
  problems.push(...chunkProblems(library, CATALOGUE, chunk));
  const bindings = library.themes[recipe.theme]!.bindings;
  const antagonists = chunk.objects.filter(
    ({ role }) => role !== undefined && ENCOUNTER_ROLES.has(role),
  );
  const boss = stageBoss(library, recipe);
  if (arena.boss !== boss) {
    problems.push(`boss ${arena.boss} is not ${arena.stage}'s boss ${boss}`);
  }
  if (
    antagonists.length !== 1 ||
    antagonists[0]!.role !== "antagonist" ||
    bindElement(bindings, antagonists[0]!).character !== arena.boss
  ) {
    problems.push(`needs exactly one antagonist object of kind ${arena.boss}`);
  }
  const ids = arena.routes.map(({ id }) => id);
  const shapes = arena.routes.map(({ waypoints }) => JSON.stringify(waypoints));
  if (
    arena.routes.length < 2 ||
    new Set(ids).size !== ids.length ||
    new Set(shapes).size !== shapes.length
  ) {
    problems.push("needs at least 2 routes with distinct ids and waypoints");
  }
  if (!arena.routes.some((route) => isLoop(route) && routeTiles(route) >= ARENA_LOOP_TILES)) {
    problems.push(`no route closes a loop of ${ARENA_LOOP_TILES} or more tiles`);
  }
  if (!arena.refuges.some(({ kind }) => ARENA_COUNTERS[arena.boss]?.includes(kind))) {
    problems.push(`no refuge counters ${arena.boss}`);
  }
  for (const side of ["entry", "exit"] as const) {
    if (!(SEAM_ROWS as readonly number[]).includes(arena[side].row)) {
      problems.push(`${side} row ${arena[side].row} is not a seam row`);
    }
  }
  if (!inBand(recipe, arena.difficulty)) {
    problems.push(`${arena.stage} draws no grade ${arena.difficulty}`);
  }
  const { chibi, encounter, mask } = arenaMaps(found, layout);
  const entry = chibi.nodes.find(({ supportId }) => supportId === encounter.terrain.pads[0]);
  const spot = (point: TilePoint) => standingAt(chibi, pixelOf(point));
  const reached = (point: TilePoint) => {
    const at = spot(point);
    return entry && at && pathTo(chibi, mask, { node: entry.id, x: entry.left }, at);
  };
  for (const refuge of arena.refuges) {
    if (!reached(refuge.at) || refuge.width < 2) {
      problems.push(`refuge at ${refuge.at.col},${refuge.at.row} is no spot Chibi reaches`);
    }
  }
  for (const route of arena.routes) {
    route.waypoints.forEach((point, index) => {
      if (!reached(point)) {
        problems.push(
          `route ${route.id} waypoint ${point.col},${point.row} is no spot Chibi reaches`,
        );
        return;
      }
      const next = route.waypoints[index + 1];
      const from = spot(point);
      if (next && from && !pathTo(chibi, mask, from, { point: pixelOf(next), radius: TILE })) {
        problems.push(`route ${route.id} has no walk from ${point.col},${point.row}`);
      }
    });
  }
  return [...new Set(problems)];
}

// The stages that hold an encounter: every flat recipe with a positive encounter count.
export function encounterStages(recipes: Readonly<Record<string, StageRecipe>>): string[] {
  return Object.entries(recipes)
    .flatMap(([key, recipe]) =>
      !("sections" in recipe) && (recipe.encounters ?? 0) > 0 ? [key] : [],
    )
    .sort();
}

// Coverage: every encounter stage has exactly one arena, every arena's stage is an encounter
// stage, and an arena stage's recipe holds exactly one encounter. Problems of pending stages are
// reported apart, so they never fail the check.
export function arenaCoverage(
  context: {
    readonly pending: readonly string[];
    readonly recipes: Readonly<Record<string, StageRecipe>>;
  },
  arenas: readonly ChunkArena[],
): { readonly pending: readonly string[]; readonly problems: readonly string[] } {
  const stages = encounterStages(context.recipes);
  const problems: { stage: string; text: string }[] = [];
  for (const stage of new Set([...stages, ...arenas.map((arena) => arena.stage)])) {
    const count = arenas.filter((arena) => arena.stage === stage).length;
    const recipe = context.recipes[stage];
    if (!stages.includes(stage)) {
      problems.push({ stage, text: `${stage} holds an arena but is no encounter stage` });
    } else if (count !== 1) {
      problems.push({ stage, text: `${stage} has ${count} arenas, not 1` });
    } else if (recipe && !("sections" in recipe) && recipe.encounters !== 1) {
      problems.push({ stage, text: `${stage} has ${recipe.encounters} encounters, not 1` });
    }
  }
  for (const stage of context.pending) {
    if (!stages.includes(stage)) {
      problems.push({ stage, text: `${stage} is pending but is no encounter stage yet` });
    }
  }
  const pending = new Set(context.pending);
  return {
    pending: problems.filter(({ stage }) => pending.has(stage)).map(({ text }) => text),
    problems: problems.filter(({ stage }) => !pending.has(stage)).map(({ text }) => text),
  };
}

export const GAME_ARENA_COVERAGE = { pending: ARENA_PENDING_STAGES, recipes: RECIPES };
export const gameArenaCase = (arena: ChunkArena) => arenaCase(CHUNK_LIBRARY, arena);

// A boss's sample arena in the game's library.
export const sampleArenaCase = (boss: AntagonistKind) =>
  gameArenaCase(ARENA_SAMPLES.find((arena) => arena.boss === boss)!);
