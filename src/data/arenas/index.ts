import type { AntagonistKind, ChunkArena, RefugeKind, StageKey } from "../types/index.ts";
import { ARCHIE_ARENAS } from "./archie.ts";
import { BINI_ARENAS } from "./bini.ts";
import { FERT_ARENAS } from "./fert.ts";
import { KIWI_ARENAS } from "./kiwi.ts";
import { PEBBLE_ARENAS } from "./pebble.ts";
import { TRIXI_ARENAS } from "./trixi.ts";

// Every admitted arena, one per encounter stage. Bosses add theirs here as they land.
export const ARENAS: readonly ChunkArena[] = [
  ...ARCHIE_ARENAS,
  ...BINI_ARENAS,
  ...FERT_ARENAS,
  ...KIWI_ARENAS,
  ...PEBBLE_ARENAS,
  ...TRIXI_ARENAS,
];

// Encounter stages still without an arena: the coverage check reports them without failing.
// Remove each stage as its arena lands; the check fails once the list is empty and any encounter
// stage lacks exactly one arena.
export const ARENA_PENDING_STAGES: readonly StageKey[] = [];

// The refuge kinds that counter each boss: high ground against charges, cover against Fert's
// parcels and Pebble's droppings, a low ceiling against Kiwi.
export const ARENA_COUNTERS: Readonly<Record<AntagonistKind, readonly RefugeKind[]>> = {
  "bear-antagonist": ["high-ground"],
  "dog-antagonist": ["high-ground"],
  "ferret-antagonist": ["cover"],
  "goose-antagonist": ["high-ground"],
  "pigeon-antagonist": ["cover"],
  "raccoon-antagonist": ["low-ceiling"],
};

// The smallest loop, in tiles of waypoint-to-waypoint distance.
export const ARENA_LOOP_TILES = 20;
