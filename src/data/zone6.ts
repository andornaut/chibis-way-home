import { CHARACTERS } from "./characters";
import { CHUNK_COLS } from "./chunkTemplates";
import { SCREEN, TILE, ZONE_ROWS } from "./screen";
import type { ChunkPlan, Instance, TerrainRect } from "./types";

export const APARTMENT_ROWS = (4 * SCREEN.height) / TILE;
export const APARTMENT_SPAWN_ROW = APARTMENT_ROWS - 10;
export const APARTMENT_WINDOW = { col: 12, cols: 36, row: 4, rows: 24 } as const;
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

export const APARTMENT_LOWER_SHELVES: readonly TerrainRect[] = [105, 100, 95, 90, 85].map(
  (row, index) => shelf(index % 2 === 0 ? 6 : 0, 4, row),
);

export function apartmentWallBands(col: number, cols: number, fromRow = 0): readonly Instance[] {
  const rows = CHARACTERS["apartment-wall-panel"]!.rows;
  return Array.from({ length: Math.ceil((APARTMENT_ROWS - fromRow) / rows) }, (_, index) => ({
    character: "apartment-wall-panel",
    col,
    cols,
    parallax: { x: 1, y: 1 },
    role: "wall",
    row: fromRow + index * rows,
    rows: Math.min(rows, APARTMENT_ROWS - fromRow - index * rows),
  }));
}

export function interiorPlanes(backdrops: readonly Instance[]): readonly Instance[] {
  return backdrops
    .filter(({ role }) => role === "wall")
    .map((band) => ({
      ...band,
      backdropPlane: "interior",
      backdropSpan: true,
      groundAnchor: "start",
      parallax: { x: 0.8, y: 0.25 },
    }));
}

const LANDING_DEPTH: readonly Instance[] = [
  {
    character: "street-sky",
    col: 0,
    cols: CHUNK_COLS,
    parallax: { x: 0, y: 0 },
    role: "sky",
    row: 10,
  },
  {
    character: "street-city-far",
    col: 0,
    cols: CHUNK_COLS,
    parallax: { x: 0.15, y: 0.05 },
    role: "far-background",
    row: 10,
  },
  {
    character: "street-city-mid",
    col: 0,
    cols: CHUNK_COLS,
    parallax: { x: 0.4, y: 0.15 },
    role: "mid-background",
    row: 10,
  },
];

const FLOOR_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "apartment-floor-finish": {
    backdrops: [
      ...LANDING_DEPTH,
      ...apartmentWallBands(0, APARTMENT_WINDOW.col),
      ...apartmentWallBands(
        APARTMENT_WINDOW.col + APARTMENT_WINDOW.cols,
        CHUNK_COLS - APARTMENT_WINDOW.col - APARTMENT_WINDOW.cols,
      ),
      {
        character: "apartment-wall-panel",
        col: APARTMENT_WINDOW.col,
        cols: APARTMENT_WINDOW.cols,
        parallax: { x: 1, y: 1 },
        role: "wall",
        row: 0,
        rows: APARTMENT_WINDOW.row,
      },
      ...apartmentWallBands(
        APARTMENT_WINDOW.col,
        APARTMENT_WINDOW.cols,
        APARTMENT_WINDOW.row + APARTMENT_WINDOW.rows,
      ),
    ],
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
    backdrops: apartmentWallBands(0, CHUNK_COLS),
    cols: CHUNK_COLS,
    difficulty: 4,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    rows: APARTMENT_ROWS,
    slots: [
      {
        area: { col: 2, cols: 4, row: APARTMENT_SPAWN_ROW - 6, rows: 6 },
        id: "apartment-room",
        kind: "door",
      },
    ],
    solids: [
      shelf(0, 4, 50),
      {
        col: 0,
        cols: 10,
        look: "ground",
        row: APARTMENT_SPAWN_ROW,
        rows: APARTMENT_ROWS - APARTMENT_SPAWN_ROW,
      },
      ...APARTMENT_LOWER_SHELVES,
      shelf(0, 4, 80),
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

export const APARTMENT_CHUNKS: Readonly<Record<string, ChunkPlan>> = Object.fromEntries(
  Object.entries(FLOOR_CHUNKS).map(([id, chunk]) => [
    id,
    { ...chunk, scenery: [...(chunk.scenery ?? []), ...interiorPlanes(chunk.backdrops ?? [])] },
  ]),
);

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
          backdrops: [...apartmentWallBands(0, CHUNK_COLS), ...(chunk.backdrops ?? [])],
          rows: APARTMENT_ROWS,
          scenery: [...(chunk.scenery ?? []), ...interiorPlanes(apartmentWallBands(0, CHUNK_COLS))],
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
