import {
  BOUNDARY_START,
  encounterStart,
  VERTICAL_FINISH,
  withoutEncounters,
} from "./chunkTemplates";
import type { ChunkPlan } from "./types";

export const HOME_CITY_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "back-streets-finish": { ...withoutEncounters(VERTICAL_FINISH), theme: "back-streets" },
  "back-streets-start": { ...encounterStart(4, VERTICAL_FINISH), theme: "back-streets" },
  "city-outskirts-finish": { ...withoutEncounters(VERTICAL_FINISH), theme: "city-outskirts" },
  "city-outskirts-start": { ...BOUNDARY_START, theme: "city-outskirts" },
  "familiar-neighbourhood-finish": { ...VERTICAL_FINISH, theme: "familiar-neighbourhood" },
  "familiar-neighbourhood-start": { ...BOUNDARY_START, theme: "familiar-neighbourhood" },
};
