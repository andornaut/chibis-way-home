import { CHUNK_COLS } from "../data/chunkTemplates";
import type { ChunkArena, ChunkPlan, ZoneFrame } from "../data/types";

// An arena as the chunk its stage draws: CHUNK_COLS wide and `rows` tall, its one encounter, at
// most once per stage, in the stage's theme with its zone's frame.
export function arenaChunk(
  context: { readonly frame: ZoneFrame; readonly rows: number; readonly theme: string },
  arena: ChunkArena,
): ChunkPlan {
  return context.frame.frame({
    ...(arena.backdrops && { backdrops: arena.backdrops }),
    cols: CHUNK_COLS,
    difficulty: arena.difficulty,
    encounters: 1,
    entry: arena.entry,
    exit: arena.exit,
    maxPerZone: 1,
    ...(arena.noCross && { noCross: arena.noCross }),
    objects: arena.objects,
    rows: context.rows,
    ...(arena.scenery && { scenery: arena.scenery }),
    ...(arena.slots && { slots: arena.slots }),
    solids: arena.solids,
    theme: context.theme,
  });
}
