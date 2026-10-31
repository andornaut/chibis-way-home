import { BOUNDARY_START, encounterStart, GROWL_FINISH, withoutEncounters } from "./chunkTemplates";
import type { ChunkPlan } from "./types";

const FIRST_GROWL_START: Omit<ChunkPlan, "theme"> = {
  ...BOUNDARY_START,
  cols: BOUNDARY_START.cols + GROWL_FINISH.cols,
  encounters: BOUNDARY_START.encounters + GROWL_FINISH.encounters,
  objects: [
    ...BOUNDARY_START.objects,
    ...GROWL_FINISH.objects.map((object) => ({
      ...object,
      col: object.col + BOUNDARY_START.cols,
      ...(object.role === "antagonist" ? { role: "antagonist-intro", scene: "bini-intro" } : {}),
    })),
  ],
  solids: [
    ...BOUNDARY_START.solids,
    ...GROWL_FINISH.solids.map((solid) => ({ ...solid, col: solid.col + BOUNDARY_START.cols })),
  ],
};

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
  "forest-paths-start": { ...withoutEncounters(FIRST_GROWL_START), theme: "forest-paths" },
  "ravine-finish": { ...GROWL_FINISH, theme: "ravine" },
  "ravine-start": { ...BOUNDARY_START, theme: "ravine" },
};
