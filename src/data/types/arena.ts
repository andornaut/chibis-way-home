// Boss arenas: one designed full chunk per encounter stage, holding the stage's one encounter.

import type { TilePoint } from "./geometry.ts";
import type { ModuleRouteTarget } from "./module.ts";
import type { ChunkSlot, Difficulty, Instance, NoCross, SeamRow, TerrainRect } from "./stage.ts";

// A boss by its character.
export type AntagonistKind =
  | "bear-antagonist"
  | "dog-antagonist"
  | "ferret-antagonist"
  | "goose-antagonist"
  | "pigeon-antagonist"
  | "raccoon-antagonist";

// A stage by its RECIPES key.
export type StageKey = string;

// What a refuge offers: cover overhead, ground the boss cannot reach, or a ceiling too low for it.
export type RefugeKind = "cover" | "high-ground" | "low-ceiling";

// A place Chibi may hold: the surface under `at`, `width` tiles from its column rightward.
export interface ArenaRefuge {
  readonly at: TilePoint;
  readonly kind: RefugeKind;
  readonly width: number;
}

// A path Chibi can take: surface points in order. A route whose last waypoint is its first
// closes a loop.
export interface ArenaRoute {
  readonly id: string;
  readonly waypoints: readonly TilePoint[];
}

// A full chunk, CHUNK_COLS wide and as tall as its stage, in its own tiles from its top-left.
// The assembler places it once in its stage. Its one antagonist object is the stage's boss.
export interface ChunkArena {
  // Kebab-case: "arena-<boss>-<name>".
  readonly id: string;
  readonly backdrops?: readonly Instance[];
  readonly boss: AntagonistKind;
  readonly difficulty: Difficulty;
  readonly entry: { readonly row: SeamRow };
  readonly exit: { readonly row: SeamRow };
  readonly noCross?: readonly NoCross[];
  readonly objects: readonly Instance[];
  // At least one of a kind that counters the boss (ARENA_COUNTERS).
  readonly refuges: readonly ArenaRefuge[];
  // Required-route targets beyond the encounter profile's raised refuges and exit landing.
  readonly route: { readonly targets?: readonly ModuleRouteTarget[] };
  // At least 2, one of them a loop of at least ARENA_RULES.loopTiles tiles.
  readonly routes: readonly ArenaRoute[];
  readonly scenery?: readonly Instance[];
  readonly slots?: readonly ChunkSlot[];
  readonly solids: readonly TerrainRect[];
  readonly stage: StageKey;
}

// One certified arena: hash covers its data, its evade trace hashes and the kit release.
export interface CertifiedArena {
  readonly hash: string;
  readonly id: string;
  readonly stage: StageKey;
}
