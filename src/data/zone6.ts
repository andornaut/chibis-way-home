import { PATROL_FINISH_GEOMETRY } from "./chunkTemplates";
import type { ChunkPlan } from "./types";

const UPPER_FLOOR_OFFSET = 20;

export const APARTMENT_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "apartment-finish": {
    cols: 60,
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
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    slots: [{ area: { col: 18, cols: 4, row: 44, rows: 6 }, id: "apartment-room", kind: "door" }],
    solids: [{ col: 0, cols: 60, look: "ground", row: 50, rows: 10 }],
    theme: ["apartment-entrance", "apartment-restaurant"],
  },
};
