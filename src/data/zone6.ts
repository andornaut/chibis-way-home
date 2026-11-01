import { CHUNK_COLS } from "./chunkTemplates";
import { ZONE_ROWS } from "./screen";
import type { ChunkPlan, TerrainRect } from "./types";

export const APARTMENT_ROWS = 90;
export const APARTMENT_SPAWN_ROW = 80;
export const APARTMENT_STAGE_EXIT = { col: 54, cols: 4, row: 4, rows: 6 } as const;
export const APARTMENT_THEMES = [
  "apartment-lobby",
  "apartment-penthouse",
  "apartment-pool",
  "apartment-residential",
  "apartment-restaurant",
  "apartment-spa",
] as const;

const shelf = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "raised",
  row,
  rows: 1,
});

export const APARTMENT_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "apartment-floor-finish": {
    cols: CHUNK_COLS,
    difficulty: 4,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 30 },
    objects: [
      {
        character: "apartment-stairwell",
        col: APARTMENT_STAGE_EXIT.col,
        role: "transition-up",
        row: APARTMENT_STAGE_EXIT.row,
      },
    ],
    rows: APARTMENT_ROWS,
    solids: [
      shelf(0, 8, 30),
      shelf(8, 6, 25),
      shelf(20, 6, 20),
      shelf(32, 6, 15),
      shelf(44, 12, 10),
      shelf(56, 4, 30),
    ],
    theme: APARTMENT_THEMES,
  },
  "apartment-floor-start": {
    cols: CHUNK_COLS,
    difficulty: 4,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    rows: APARTMENT_ROWS,
    slots: [{ area: { col: 2, cols: 4, row: 74, rows: 6 }, id: "apartment-room", kind: "door" }],
    solids: [
      shelf(0, 4, 50),
      {
        col: 0,
        cols: 10,
        look: "ground",
        row: APARTMENT_SPAWN_ROW,
        rows: APARTMENT_ROWS - APARTMENT_SPAWN_ROW,
      },
      shelf(6, 9, 75),
      shelf(0, 4, 70),
      shelf(6, 4, 65),
      shelf(0, 4, 60),
      shelf(6, 4, 55),
      ...[70, 65, 60, 55].map((row, index) => shelf(15 + index * 5, 5, row)),
      shelf(35, CHUNK_COLS - 35, 50),
    ],
    theme: APARTMENT_THEMES,
  },
};

export const apartmentChunkId = (id: string): string => `apartment-tall-${id}`;

export function createApartmentMiddleChunks(
  shared: Readonly<Record<string, ChunkPlan>>,
): Readonly<Record<string, ChunkPlan>> {
  return Object.fromEntries(
    Object.entries(shared)
      .filter(([id, chunk]) => {
        const themes = typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
        return (
          !Object.hasOwn(APARTMENT_CHUNKS, id) &&
          themes.some((theme) =>
            APARTMENT_THEMES.includes(theme as (typeof APARTMENT_THEMES)[number]),
          )
        );
      })
      .map(([id, chunk]) => [
        apartmentChunkId(id),
        {
          ...chunk,
          rows: APARTMENT_ROWS,
          solids: chunk.solids.map((solid) =>
            solid.row + solid.rows === ZONE_ROWS
              ? { ...solid, rows: APARTMENT_ROWS - solid.row }
              : solid,
          ),
          theme: APARTMENT_THEMES,
        },
      ]),
  );
}
