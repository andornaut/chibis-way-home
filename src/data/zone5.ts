import { BOUNDARY_START, VERTICAL_FINISH } from "./chunkTemplates";
import type { ChunkPlan } from "./types";

export const HOME_CITY_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "city-outskirts-finish": { ...VERTICAL_FINISH, theme: "city-outskirts" },
  "city-outskirts-start": { ...BOUNDARY_START, theme: "city-outskirts" },
  "familiar-neighbourhood-finish": { ...VERTICAL_FINISH, theme: "familiar-neighbourhood" },
  "familiar-neighbourhood-start": { ...BOUNDARY_START, theme: "familiar-neighbourhood" },
};
