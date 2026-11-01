import { BOUNDARY_START, encounterStart, PERCH_FINISH, withoutEncounters } from "./chunkTemplates";
import type { ChunkPlan } from "./types";

export const INDUSTRIAL_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "freight-terminal-finish": { ...PERCH_FINISH, theme: "freight-terminal" },
  "freight-terminal-start": { ...BOUNDARY_START, theme: "freight-terminal" },
  "loading-yards-finish": { ...withoutEncounters(PERCH_FINISH), theme: "loading-yards" },
  "loading-yards-start": {
    ...encounterStart(4, PERCH_FINISH),
    backdrops: [{ character: "depot-loading-bay", col: 44, role: "loading-bay", row: 40 }],
    theme: "loading-yards",
  },
  "warehouse-district-finish": { ...withoutEncounters(PERCH_FINISH), theme: "warehouse-district" },
  "warehouse-district-start": { ...BOUNDARY_START, theme: "warehouse-district" },
};
