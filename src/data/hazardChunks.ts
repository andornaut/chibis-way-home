import { CITY_GROUND_HAZARD_BEHAVIOUR } from "./behaviours";
import { CHUNK_COLS, redCeiling } from "./chunkTemplates";
import { ZONE_ROWS } from "./screen";
import type { ChunkPlan, TerrainRect } from "./types";

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: row === 50 ? "ground" : "raised",
  row,
  rows: ZONE_ROWS - row,
});

export function createHazardChunks(theme: ChunkPlan["theme"]): Readonly<Record<string, ChunkPlan>> {
  return {
    "guarded-valley": {
      cols: CHUNK_COLS,
      difficulty: 3,
      encounters: 0,
      entry: { row: 40 },
      exit: { row: 40 },
      objects: [
        { character: "red-edge-right", col: 18, role: "edge-right", row: 47, rows: 3 },
        { character: "red-edge-left", col: 41, role: "edge-left", row: 47, rows: 3 },
        { character: "platform-ledge", col: 28, cols: 6, role: "ledge", row: 45 },
        { character: "red-edge-top", col: 18, cols: 24, role: "edge-top", row: 49 },
      ],
      solids: [
        floor(0, 12, 40),
        floor(12, 6, 45),
        floor(18, 24, 50),
        floor(42, 6, 45),
        floor(48, CHUNK_COLS - 48, 40),
      ],
      theme,
    },
    "overjump-low-roof": {
      cols: CHUNK_COLS,
      difficulty: 3,
      encounters: 0,
      entry: { row: 50 },
      exit: { row: 50 },
      objects: redCeiling(14, 18, 42),
      solids: [floor(0, 20, 50), floor(20, 6, 49), floor(26, CHUNK_COLS - 26, 50)],
      theme,
    },
    "vertical-red-gate": {
      cols: CHUNK_COLS,
      difficulty: 4,
      encounters: 0,
      entry: { row: 50 },
      exit: { row: 50 },
      objects: [
        {
          behaviour: { ...CITY_GROUND_HAZARD_BEHAVIOUR, axis: "y", distance: -10, initial: "back" },
          character: "red-edge-left",
          col: 30,
          role: "edge-left",
          row: 44,
          rows: 6,
        },
      ],
      solids: [floor(0, CHUNK_COLS, 50)],
      theme,
    },
  };
}
