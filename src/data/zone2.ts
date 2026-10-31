import { BOUNDARY_START, encounterStart, PERCH_FINISH, withoutEncounters } from "./chunkTemplates";
import type { ChunkPlan } from "./types";

const OPENING_PERCH_DROP = 5;

export const INDUSTRIAL_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "freight-terminal-finish": { ...PERCH_FINISH, theme: "freight-terminal" },
  "freight-terminal-start": { ...BOUNDARY_START, theme: "freight-terminal" },
  "loading-yards-finish": { ...withoutEncounters(PERCH_FINISH), theme: "loading-yards" },
  "loading-yards-start": {
    ...encounterStart(4, {
      ...PERCH_FINISH,
      objects: PERCH_FINISH.objects.map((object) =>
        object.role === "antagonist" ? { ...object, row: object.row + OPENING_PERCH_DROP } : object,
      ),
      solids: PERCH_FINISH.solids.map((solid) =>
        solid.look === "raised"
          ? { ...solid, row: solid.row + OPENING_PERCH_DROP, rows: solid.rows - OPENING_PERCH_DROP }
          : solid,
      ),
    }),
    backdrops: [{ character: "depot-loading-bay", col: 44, role: "loading-bay", row: 40 }],
    theme: "loading-yards",
  },
  "warehouse-district-finish": { ...withoutEncounters(PERCH_FINISH), theme: "warehouse-district" },
  "warehouse-district-start": { ...BOUNDARY_START, theme: "warehouse-district" },
};
