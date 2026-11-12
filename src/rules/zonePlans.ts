import { ARENAS } from "../data/arenas/index.ts";
import { BACKGROUND_SECTIONS } from "../data/backgrounds.ts";
import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import { CHARACTERS } from "../data/characters.ts";
import { CHUNK_RULES, CHUNKS, THEMES } from "../data/chunks.ts";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "../data/modules/index.ts";
import { ZONE_ROWS } from "../data/screen.ts";
import { SEAM_ROWS } from "../data/seams.ts";
import type { ChunkArena, ChunkPlan, StageRecipe, ZoneKey, ZonePlan } from "../data/types/index.ts";
import { ZONE_FRAMES } from "../data/zoneFrames.ts";
import { RECIPES } from "../data/zones.ts";
import { arenaChunk } from "./arenas.ts";
import { assembleZoneAvoiding, type ChunkLibrary } from "./assemble.ts";
import { certifiedChunks } from "./modules.ts";

const CERTIFIED = certifiedChunks(
  { frames: ZONE_FRAMES, grades: PAIR_GRADES, modules: MODULES, rules: MODULE_RULES },
  CERTIFIED_LISTS,
);

// The zone whose frame draws a stage theme, if any.
export function zoneOfTheme(theme: string): ZoneKey | undefined {
  return (Object.keys(ZONE_FRAMES) as ZoneKey[]).find((zone) =>
    ZONE_FRAMES[zone].themes.includes(theme),
  );
}

// Each arena's chunk by id, in its stage's theme, height and zone frame, and each stage's arena
// chunk id. Throws on an arena whose stage is no flat zone stage, or a second arena for a stage.
export function arenaChunks(arenas: readonly ChunkArena[]): {
  readonly chunks: Readonly<Record<string, ChunkPlan>>;
  readonly stages: Readonly<Record<string, string>>;
} {
  const chunks: Record<string, ChunkPlan> = {};
  const stages: Record<string, string> = {};
  for (const arena of arenas) {
    const recipe = RECIPES[arena.stage];
    const zone = recipe && !("sections" in recipe) ? zoneOfTheme(recipe.theme) : undefined;
    if (!recipe || "sections" in recipe || !zone) {
      throw new Error(`Arena ${arena.id} names no zone stage ${arena.stage}`);
    }
    if (arena.stage in stages || arena.id in chunks) {
      throw new Error(`Arena ${arena.id} repeats a stage or id`);
    }
    chunks[arena.id] = arenaChunk(
      { frame: ZONE_FRAMES[zone], rows: recipe.rows ?? ZONE_ROWS, theme: recipe.theme },
      arena,
    );
    stages[arena.stage] = arena.id;
  }
  return { chunks, stages };
}

// The admitted arenas: those the certified lists name.
const ADMITTED = arenaChunks(
  ARENAS.filter(({ id }) =>
    CERTIFIED_LISTS.some((list) => (list.arenas ?? []).some((entry) => entry.id === id)),
  ),
);

// The game's chunks, certified pairs and admitted arenas included, and themes.
export const CHUNK_LIBRARY: ChunkLibrary = {
  arenas: ADMITTED.stages,
  backgrounds: BACKGROUND_SECTIONS,
  characters: CHARACTERS,
  chunks: { ...CHUNKS, ...CERTIFIED.chunks, ...ADMITTED.chunks },
  rows: ZONE_ROWS,
  rules: CHUNK_RULES,
  seams: SEAM_ROWS,
  themes: THEMES,
};

// A recipe with its zone's certified pairs after its authored pool.
function withCertifiedPairs(recipe: StageRecipe): StageRecipe {
  if ("sections" in recipe || recipe.chunks === undefined) {
    return recipe;
  }
  const zone = zoneOfTheme(recipe.theme);
  const pairs = (zone && CERTIFIED.pools[zone]?.filter((id) => id in CERTIFIED.chunks)) ?? [];
  return pairs.length === 0 ? recipe : { ...recipe, chunks: [...recipe.chunks, ...pairs] };
}

// Every stage recipe as the game assembles it, certified pairs included.
export const STAGE_RECIPES: Readonly<Record<string, StageRecipe>> = Object.fromEntries(
  Object.entries(RECIPES).map(([key, recipe]) => [key, withCertifiedPairs(recipe)]),
);

// The zone key names, assembled from its recipe in STAGE_RECIPES for seed, the same for the same
// seed.
export function zonePlanFor(seed: number, key: string): ZonePlan {
  return zonePlanAvoiding([], seed, key);
}

// zonePlanFor without the avoided middle chunks while an assembly fits without them
// (assembleZoneAvoiding), the same for the same seed and avoided chunks.
export function zonePlanAvoiding(avoid: readonly string[], seed: number, key: string): ZonePlan {
  const recipe = STAGE_RECIPES[key];
  if (!recipe) {
    throw new Error(`No recipe ${key}`);
  }
  return assembleZoneAvoiding(CHUNK_LIBRARY, avoid, seed, key, recipe);
}
