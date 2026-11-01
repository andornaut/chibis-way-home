import {
  CHUNK_COLS,
  encounterStart,
  PATROL_FINISH_GEOMETRY,
  withoutEncounters,
} from "./chunkTemplates";
import type { ChunkPlan } from "./types";

const COUNTRYSIDE_START: Omit<ChunkPlan, "theme"> = {
  backdrops: [
    { character: "depot-loading-bay", col: 4, role: "loading-bay", row: 40 },
    { character: "facade-one-storey", col: 0, cols: 12, role: "near-wall", row: 34 },
  ],
  cols: CHUNK_COLS,
  difficulty: 1,
  encounters: 0,
  entry: { row: 50 },
  exit: { row: 50 },
  objects: [],
  slots: [{ area: { col: 18, cols: 4, row: 46, rows: 4 }, id: "country-room", kind: "door" }],
  solids: [
    { col: 0, cols: 32, look: "ground", row: 50, rows: 10 },
    { col: 32, cols: 3, look: "raised", row: 47, rows: 13 },
    { col: 35, cols: 9, look: "ground", row: 50, rows: 10 },
    { col: 44, cols: 3, look: "raised", row: 44, rows: 16 },
    { col: 47, cols: CHUNK_COLS - 47, look: "ground", row: 50, rows: 10 },
  ],
};

const COUNTRYSIDE_FINISH: Omit<ChunkPlan, "theme"> = {
  ...PATROL_FINISH_GEOMETRY,
  backdrops: [{ character: "facade-one-storey", col: 6, cols: 8, role: "near-wall", row: 34 }],
  cols: CHUNK_COLS,
  difficulty: 4,
  entry: { row: 50 },
  exit: { row: 50 },
};

export const COUNTRYSIDE_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "country-lanes-finish": { ...withoutEncounters(COUNTRYSIDE_FINISH), theme: "country-lanes" },
  "country-lanes-start": { ...encounterStart(4, COUNTRYSIDE_FINISH), theme: "country-lanes" },
  "farmland-finish": { ...withoutEncounters(COUNTRYSIDE_FINISH), theme: "farmland" },
  "farmland-start": { ...COUNTRYSIDE_START, theme: "farmland" },
  "river-crossing-finish": { ...COUNTRYSIDE_FINISH, theme: "river-crossing" },
  "river-crossing-start": { ...COUNTRYSIDE_START, theme: "river-crossing" },
};
