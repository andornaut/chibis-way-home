import {
  BOUNDARY_START,
  encounterStart,
  GROWL_FINISH,
  withoutEncounters,
} from "./chunkTemplates.ts";
import type { ChunkPlan } from "./types/index.ts";

export const WOODLAND_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "deep-woods-finish": { ...withoutEncounters(GROWL_FINISH), theme: "deep-woods" },
  "deep-woods-start": {
    ...encounterStart(4, GROWL_FINISH),
    backdrops: [
      { character: "facade-one-storey", col: 4, cols: 8, role: "near-wall", row: 34 },
      { character: "facade-one-storey", col: 48, cols: 8, role: "boundary-wall", row: 34 },
    ],
    theme: "deep-woods",
  },
  "forest-paths-finish": { ...withoutEncounters(GROWL_FINISH), theme: "forest-paths" },
  "forest-paths-start": { ...BOUNDARY_START, theme: "forest-paths" },
  "ravine-finish": { ...withoutEncounters(GROWL_FINISH), theme: "ravine" },
  "ravine-start": { ...BOUNDARY_START, theme: "ravine" },
};
