import { BOUNDARY_START, GROWL_FINISH } from "./chunkTemplates";
import type { ChunkPlan } from "./types";

const FIRST_GROWL_START: Omit<ChunkPlan, "theme"> = {
  ...BOUNDARY_START,
  cols: BOUNDARY_START.cols + GROWL_FINISH.cols,
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
  "forest-paths-finish": { ...GROWL_FINISH, theme: "forest-paths" },
  "forest-paths-start": { ...FIRST_GROWL_START, theme: "forest-paths" },
  "ravine-finish": { ...GROWL_FINISH, theme: "ravine" },
  "ravine-start": { ...BOUNDARY_START, theme: "ravine" },
};
