import type { ChunkModule, TerrainRect } from "../types/index.ts";

// Woodland halves on the lower route (row 80). The gust ravine fills the right half and its
// lookout the left half in front of it. Neither holds an encounter.
const ROWS = 120;

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});

// The gust ravine: from the entry run (row 80), jumps across three 4-col pockets (row 82) by two
// cover posts (tops at row 77) to the exit run. The emitter stands on the exit run at col 25 and
// blows left across cols 4 to 25 in rows 76 to 80: Chibi on a post top or in the last pocket is in
// the band, behind a post he is not, and the push carries him at worst into a pocket, which climbs
// back out. The band stays 4 cols clear of both module edges.
const ravine: ChunkModule = {
  difficulty: 4,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "gust-ravine",
  objects: [{ character: "woodland-gust-emitter", col: 25, row: 76 }],
  route: { profile: "recovery", targets: [{ at: { col: 17, row: 77 } }] },
  sides: ["right"],
  solids: [
    floor(0, 6, 80),
    floor(6, 4, 82),
    floor(10, 2, 77),
    floor(12, 4, 82),
    floor(16, 2, 77),
    floor(18, 4, 82),
    floor(22, 8, 80),
  ],
  zones: ["woodland"],
};

// The ravine's lookout: a rise 5 rows up, a full jump, from which the leaf stream shows before the
// ravine.
const lookout: ChunkModule = {
  difficulty: 2,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "ravine-lookout",
  objects: [],
  route: { profile: "recovery", targets: [{ at: { col: 15, row: 75 } }] },
  sides: ["left"],
  solids: [floor(0, 10, 80), floor(10, 10, 75), floor(20, 10, 80)],
  zones: ["woodland"],
};

export const WOODLAND_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  [lookout, ravine].map((module) => [module.id, module]),
);
