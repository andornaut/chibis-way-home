import { CHUNK_COLS, encounterStart, PATROL_ENCOUNTER, withoutEncounters } from "./chunkTemplates";
import type { ChunkPlan } from "./types";

// The street's fixed boundary sections surround a newly assembled middle on every entry.
export const STREET_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "city-streets-finish": { ...withoutEncounters(PATROL_ENCOUNTER), theme: "city-streets" },
  "city-streets-start": {
    ...encounterStart(4, PATROL_ENCOUNTER),
    backdrops: [
      { character: "facade-one-storey", col: 0, cols: 12, role: "near-wall", row: 34 },
      { character: "storefront-noodle-bar", col: 4, role: "storefront", row: 40 },
    ],
    theme: "city-streets",
  },
  "street-finish": {
    backdrops: [
      { character: "facade-one-storey", col: 0, cols: 40, role: "near-wall", row: 34 },
      {
        character: "facade-brownstone",
        col: 40,
        cols: CHUNK_COLS - 40,
        role: "tall-wall",
        row: 24,
      },
      {
        character: "roofline-brownstone",
        col: 40,
        cols: CHUNK_COLS - 40,
        role: "roofline",
        row: 20,
      },
      { character: "storefront-noodle-bar", col: 2, role: "storefront", row: 40 },
    ],
    cols: CHUNK_COLS,
    difficulty: 3,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [
      { character: "red-edge-bottom", col: 16, cols: 18, role: "edge-bottom", row: 41 },
      { character: "red-edge-left", col: 15, role: "edge-left", row: 39, rows: 2 },
      { character: "red-edge-right", col: 34, role: "edge-right", row: 39, rows: 2 },
      { character: "red-edge-top", col: 16, cols: 18, role: "edge-top", row: 38 },
      { character: "red-edge-support", col: 16, cols: 18, role: "support", row: 39, rows: 2 },
      { character: "red-edge-top", col: 44, cols: 4, role: "edge-top", row: 49 },
      { character: "red-edge-support", col: 44, cols: 4, role: "support", row: 50, rows: 10 },
      { character: "canopy", col: 48, cols: 6, role: "canopy", row: 44 },
    ],
    solids: [
      { col: 0, cols: 24, look: "ground", row: 50, rows: 10 },
      { col: 24, cols: 6, look: "raised", row: 49, rows: 11 },
      { col: 30, cols: 14, look: "ground", row: 50, rows: 10 },
      { col: 48, cols: CHUNK_COLS - 48, look: "ground", row: 50, rows: 10 },
    ],
    theme: "street",
  },
  // The parcel, short blocks and marked gap occupy the fixed opening screen.
  "street-start": {
    backdrops: [
      { character: "depot-wall", col: 0, cols: CHUNK_COLS, role: "depot-wall", row: 35 },
      { character: "depot-loading-bay", col: 30, role: "loading-bay", row: 40 },
      { character: "parcel-open", col: 2, role: "parcel", row: 47 },
      { character: "walk-signal", col: 52, role: "signal", row: 43 },
    ],
    cols: CHUNK_COLS,
    difficulty: 3,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [
      { character: "red-edge-top", col: 46, cols: 4, role: "edge-top", row: 54 },
      { character: "red-edge-support", col: 46, cols: 4, role: "support", row: 55, rows: 5 },
    ],
    slots: [{ area: { col: 10, cols: 4, row: 46, rows: 4 }, id: "depot-room", kind: "door" }],
    solids: [
      { col: 0, cols: 16, look: "ground", row: 50, rows: 10 },
      { col: 16, cols: 4, look: "raised", row: 47, rows: 13 },
      { col: 20, cols: 12, look: "ground", row: 50, rows: 10 },
      { col: 32, cols: 4, look: "raised", row: 44, rows: 16 },
      { col: 36, cols: 10, look: "ground", row: 50, rows: 10 },
      { col: 50, cols: CHUNK_COLS - 50, look: "ground", row: 50, rows: 10 },
    ],
    theme: "street",
  },
};
