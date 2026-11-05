import {
  BLUE_CONNECTORS,
  BLUE_THEMES,
  COUNTRYSIDE_CONNECTORS,
  COUNTRYSIDE_THEMES,
  HOME_CONNECTORS,
  HOME_ROUTE_THEMES,
  INDUSTRIAL_CONNECTORS,
  INDUSTRIAL_ROOF_ROW,
  INDUSTRIAL_THEMES,
  localDepth,
  tunnelWalls,
  WOODLAND_CONNECTORS,
  WOODLAND_ROUTE_THEMES,
} from "./chunks";
import { CHUNK_COLS } from "./chunkTemplates";
import type { ChunkPlan, ZoneFrame, ZoneKey } from "./types";
import { woodlandDepth } from "./woodlandScenery";
import { APARTMENT_THEMES, apartmentWallBands, interiorPlanes } from "./zone6";

const plain = (chunk: ChunkPlan): ChunkPlan => chunk;

// Each zone's stage themes, connectors and the layers its own middle chunks carry: the
// Industrial roof and tunnel walls, the Apartment wall bands and interior planes, and the
// Woodland depth layers. Modules are authored at zone height, so no frame shifts rows.
export const ZONE_FRAMES: Readonly<Record<ZoneKey, ZoneFrame>> = {
  apartment: {
    connectors: [],
    frame: (chunk) => {
      const bands = apartmentWallBands(0, CHUNK_COLS);
      return {
        ...chunk,
        backdrops: [...bands, ...(chunk.backdrops ?? [])],
        scenery: [...(chunk.scenery ?? []), ...interiorPlanes(bands)],
      };
    },
    themes: APARTMENT_THEMES,
  },
  blue: { connectors: BLUE_CONNECTORS, frame: plain, themes: BLUE_THEMES },
  countryside: { connectors: COUNTRYSIDE_CONNECTORS, frame: plain, themes: COUNTRYSIDE_THEMES },
  home: { connectors: HOME_CONNECTORS, frame: plain, themes: HOME_ROUTE_THEMES },
  industrial: {
    connectors: INDUSTRIAL_CONNECTORS,
    frame: (chunk) => ({
      ...chunk,
      outOfReach: [...(chunk.outOfReach ?? []), { col: CHUNK_COLS / 2, row: INDUSTRIAL_ROOF_ROW }],
      scenery: [...(chunk.scenery ?? []), ...tunnelWalls()],
      solids: [
        ...chunk.solids,
        { col: 0, cols: CHUNK_COLS, look: "ground", row: INDUSTRIAL_ROOF_ROW, rows: 1 },
      ],
    }),
    themes: INDUSTRIAL_THEMES,
  },
  woodland: {
    connectors: WOODLAND_CONNECTORS,
    frame: (chunk) => ({
      ...chunk,
      backdrops: [...woodlandDepth(localDepth(0)), ...(chunk.backdrops ?? [])],
    }),
    themes: WOODLAND_ROUTE_THEMES,
  },
};
