import {
  CHUNK_COLS,
  encounterStart,
  PATROL_ENCOUNTER,
  PATROL_FINISH_GEOMETRY,
  withoutEncounters,
} from "./chunkTemplates";
import type { ChunkPlan } from "./types";

const UPPER_FLOOR_OFFSET = 20;

const APARTMENT_BOUNDARIES: Readonly<Record<string, ChunkPlan>> = {
  "apartment-finish": {
    cols: CHUNK_COLS,
    difficulty: 4,
    encounters: PATROL_FINISH_GEOMETRY.encounters,
    entry: { row: 30 },
    exit: { row: 30 },
    objects: [
      ...PATROL_FINISH_GEOMETRY.objects.map((object) => ({
        ...object,
        row: object.row - UPPER_FLOOR_OFFSET,
      })),
      { character: "apartment-stairwell", col: 54, role: "final-goal", row: 24 },
    ],
    solids: PATROL_FINISH_GEOMETRY.solids.map((solid) => ({
      ...solid,
      row: solid.row - UPPER_FLOOR_OFFSET,
      rows: solid.rows + UPPER_FLOOR_OFFSET,
    })),
    theme: ["apartment-lobby", "apartment-residential"],
  },
  "apartment-start": {
    cols: CHUNK_COLS,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    slots: [{ area: { col: 18, cols: 4, row: 44, rows: 6 }, id: "apartment-room", kind: "door" }],
    solids: [
      { col: 0, cols: 32, look: "ground", row: 50, rows: 10 },
      { col: 32, cols: 3, look: "raised", row: 47, rows: 13 },
      { col: 35, cols: 9, look: "ground", row: 50, rows: 10 },
      { col: 44, cols: 3, look: "raised", row: 44, rows: 16 },
      { col: 47, cols: CHUNK_COLS - 47, look: "ground", row: 50, rows: 10 },
    ],
    theme: ["apartment-entrance", "apartment-exterior"],
  },
};

export const APARTMENT_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...APARTMENT_BOUNDARIES,
  "apartment-intro-start": {
    ...encounterStart(6, PATROL_ENCOUNTER),
    theme: "apartment-restaurant",
  },
  "apartment-quiet-finish": {
    ...withoutEncounters(APARTMENT_BOUNDARIES["apartment-finish"]!),
    theme: "apartment-lobby",
  },
  "apartment-shared-finish": {
    ...withoutEncounters(APARTMENT_BOUNDARIES["apartment-finish"]!),
    theme: "apartment-pool",
  },
};
