import { BIRD_FRAME } from "../assets";
import { BIRD } from "../data/bird";
import { OUTDOOR_LIFT_ASCENT_TRANSIT } from "../data/forcedTransit";
import { TILE } from "../data/screen";
import type { BirdTuning, Instance, ZoneLayout } from "../data/types";
import { type ChunkLibrary, themesOf, zonePlanOf } from "../rules/assemble";
import { startBird } from "../rules/bird";
import { zoneLayout } from "../rules/tiles";
import type { ZoneInput, ZoneState } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "./art";

// Chibi without skills.
export const ORDINARY: BirdTuning = (() => {
  const tuning: BirdTuning = { ...BIRD, doubleJump: false };
  delete (tuning as { dash?: unknown }).dash;
  return tuning;
})();

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };

export type EncounterScript = (tick: number) => ZoneInput;
export const ENCOUNTER_SCRIPTS: Readonly<Record<string, EncounterScript>> = {
  // Runs right with a periodic held jump, so pursuers chase, attack and cross.
  forward: (tick) => ({ jumpHeld: tick % 90 < 24, move: 1, useHeld: false }),
  // Paces out and back with a periodic held jump, exposing Chibi on both sides of the entry.
  pace: (tick) => ({
    jumpHeld: tick % 120 < 24,
    move: Math.floor(tick / 240) % 2 === 0 ? 1 : -1,
    useHeld: false,
  }),
  // Stands at the entry, so pursuers approach, attack and recover.
  still: () => STILL,
};
export const ENCOUNTER_TICKS = 1500;

// Chunks in order in one theme, between the theme's caps.
export function chunksLayout(
  theme: string,
  ids: readonly string[],
  library: ChunkLibrary = CHUNK_LIBRARY,
): ZoneLayout {
  for (const id of ids) {
    const chunk = library.chunks[id];
    if (!chunk || !themesOf(chunk).includes(theme)) {
      throw new Error(`Unknown chunk or theme ${id} ${theme}`);
    }
  }
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, theme, 2, ids);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

export function chunkLayout(theme: string, id: string, library?: ChunkLibrary): ZoneLayout {
  return chunksLayout(theme, [id], library);
}

// The library with extra instances appended after a chunk's own, so existing indices and motion
// seeds stay fixed.
export function withInstances(
  id: string,
  extra: readonly Instance[],
  library: ChunkLibrary = CHUNK_LIBRARY,
): ChunkLibrary {
  const chunk = library.chunks[id]!;
  return {
    ...library,
    chunks: { ...library.chunks, [id]: { ...chunk, objects: [...chunk.objects, ...extra] } },
  };
}

// The certified lift contract on its own base chunk, as its forced-transit test builds it, with
// any extra instances.
export function liftLayout(extra: readonly Instance[] = []): ZoneLayout {
  const chunk = CHUNK_LIBRARY.chunks["outdoor-lift-ascent"]!;
  const library: ChunkLibrary = {
    ...CHUNK_LIBRARY,
    chunks: {
      ...CHUNK_LIBRARY.chunks,
      "outdoor-lift-ascent": {
        ...chunk,
        objects: chunk.objects.map((instance) =>
          instance.character === "city-lift"
            ? { ...instance, forcedTransit: OUTDOOR_LIFT_ASCENT_TRANSIT }
            : instance,
        ),
      },
    },
  };
  return chunkLayout(
    themesOf(chunk)[0]!,
    "outdoor-lift-ascent",
    withInstances("outdoor-lift-ascent", extra, library),
  );
}

// Starts Chibi on the lift's lower dock instead of the area entry.
export function liftLowerDockStart(layout: ZoneLayout): (zone: ZoneState) => ZoneState {
  const lift = layout.areas.main!.objects.find(({ forcedTransit }) => forcedTransit)!;
  const lower = lift.forcedTransit!.banks.find(({ id }) => id === "lower")!;
  return (zone) => ({ ...zone, bird: startBird(ORDINARY, { x: lower.x + 24, y: lower.y }) });
}
