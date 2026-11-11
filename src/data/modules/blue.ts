import { CITY_GROUND_HAZARD_BEHAVIOUR, CITY_SHUTTLE_BEHAVIOUR } from "../behaviours";
import { redCeiling } from "../chunkTemplates";
import { CRUMBLING_SUPPORT_TUNING } from "../obstacleTuning";
import type { ChunkModule, Difficulty, Instance, ModuleSide, TerrainRect } from "../types";

// Blue cityscape halves on the lower route (rows 70 and 80). Halves fill either side, so both
// edges keep a 4-column seam footing. Grade 3 halves pair with any matching half; grade 4 halves
// pair only with grade 3 ones, since two grade 4 halves make a grade 5 chunk outside Blue's band.
const ROWS = 120;
const BOTH: readonly ModuleSide[] = ["left", "right"];

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
const ledge = (col: number, cols: number, row: number): Instance => ({
  character: "platform-ledge",
  col,
  cols,
  role: "ledge",
  row,
});
const crumbling = (col: number, cols: number, row: number): Instance => ({
  ...ledge(col, cols, row),
  crumbling: CRUMBLING_SUPPORT_TUNING,
});
const lift = (col: number, row: number): Instance => ({
  character: "city-lift",
  col,
  role: "lift",
  row,
});
const shuttle = (col: number, row: number, distance: number): Instance => ({
  behaviour: { ...CITY_SHUTTLE_BEHAVIOUR, distance },
  character: "city-shuttle",
  col,
  role: "shuttle",
  row,
});
const mover = (col: number, row: number, distance: number): Instance => ({
  behaviour: { ...CITY_GROUND_HAZARD_BEHAVIOUR, distance },
  character: "city-ground-hazard",
  col,
  role: "moving-hazard",
  row,
});
const vent = (col: number, deck: number): Instance => ({
  character: "warned-vent",
  col,
  row: deck - 6,
});
// A red-topped pit floor across `cols` columns at `row`.
const red = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ROWS - row },
];
const redFace = (col: number, row: number, rows: number): Instance => ({
  character: "red-edge-left",
  col,
  role: "edge-left",
  row,
  rows,
});

interface Half {
  readonly entry: number;
  readonly exit: number;
  readonly objects?: readonly Instance[];
  readonly route?: ChunkModule["route"];
  readonly sides?: readonly ModuleSide[];
  readonly slots?: ChunkModule["slots"];
  readonly solids: readonly TerrainRect[];
}
const half = (difficulty: Difficulty, id: string, spec: Half): ChunkModule => ({
  difficulty,
  encounters: 0,
  entry: { row: spec.entry },
  exit: { row: spec.exit },
  id,
  objects: spec.objects ?? [],
  route: spec.route ?? { profile: "recovery" },
  sides: spec.sides ?? BOTH,
  ...(spec.slots && { slots: spec.slots }),
  solids: spec.solids,
  zones: ["blue"],
});
// A door slot whose room building (15 cols, its door 5.5 cols in) stays inside the half on full floor:
// `col` from 6 to 20, with floor under cols `col - 5.5` to `col + 9.5`.
const door = (col: number, floorRow: number): NonNullable<ChunkModule["slots"]>[number] => ({
  area: { col, cols: 4, row: floorRow - 5, rows: 5 },
  id: "door",
  kind: "door",
});

// A gap near the reach over a red pit.
const gap = (row: number, near: number, width: number): Half => ({
  entry: row,
  exit: row,
  objects: red(near, width, row + 10),
  solids: [floor(0, near, row), floor(near + width, 30 - near - width, row)],
});
// A 2-tile red strip under a low red ceiling: only a short press crosses it.
const tapStrip = (row: number, col: number): Half => ({
  entry: row,
  exit: row,
  objects: [...redCeiling(col - 4, 12, row - 8), ...red(col + 1, 2, row)],
  solids: [floor(0, col + 1, row), floor(col + 3, 27 - col, row)],
});
// A shuttle across a pit too wide to jump.
const ferry = (row: number): Half => ({
  entry: row,
  exit: row,
  objects: [shuttle(6, row, 12), ...red(6, 18, row + 8)],
  solids: [floor(0, 6, row), floor(24, 6, row)],
});
// A crosswalk: its strip on the road between 5-col kerbs, too wide to jump, with the signal
// beside it on the near kerb. It fills the right half, after the half Chibi watches it from.
const crosswalk = (row: number): Half => ({
  entry: row,
  exit: row,
  objects: [
    { character: "crosswalk-strip", col: 5, id: "strip", row: row - 1 },
    { character: "crosswalk-signal", col: 3, phaseSource: "strip", row: row - 7 },
  ],
  sides: ["right"],
  solids: [floor(0, 30, row)],
});
// A warned vent on a raised deck with a refuge either side.
const ventDeck = (row: number): Half => ({
  entry: row,
  exit: row,
  objects: [vent(13, row - 6)],
  solids: [
    floor(0, 5, row),
    floor(5, 5, row - 3),
    floor(10, 10, row - 6),
    floor(20, 5, row - 3),
    floor(25, 5, row),
  ],
});
const MODULE_LIST: readonly ChunkModule[] = [
  // Grade 2: a planter to stand on and watch the next half from.
  half(2, "city-planter", {
    entry: 80,
    exit: 80,
    route: { profile: "primary", targets: [{ at: { col: 14, row: 77 } }] },
    sides: ["left"],
    solids: [floor(0, 30, 80), { col: 12, cols: 4, look: "raised", row: 77, rows: 3 }],
  }),
  // Grade 3: gaps near the reach, single moving platforms, single tap spots.
  half(3, "city-gap", gap(80, 6, 13)),
  half(3, "city-gap-high", gap(70, 7, 13)),
  half(3, "city-tap-strip", { ...tapStrip(80, 9), slots: [door(20, 80)] }),
  half(3, "city-tap-strip-high", tapStrip(70, 12)),
  half(3, "city-ferry", ferry(80)),
  half(3, "city-ferry-high", ferry(70)),
  half(3, "city-ledge-pit", {
    entry: 80,
    exit: 80,
    objects: [ledge(12, 6, 78), ...red(5, 20, 90)],
    solids: [floor(0, 5, 80), floor(25, 5, 80)],
  }),
  half(3, "city-gap-climb", {
    entry: 80,
    exit: 70,
    objects: red(12, 6, 85),
    solids: [floor(0, 6, 80), floor(6, 6, 75), floor(18, 12, 70)],
  }),
  half(3, "city-lift-climb", {
    entry: 80,
    exit: 70,
    objects: [lift(8, 80), ledge(14, 6, 75), ...red(8, 12, 88)],
    solids: [floor(0, 8, 80), floor(20, 10, 70)],
  }),
  half(3, "city-ledge-climb", {
    entry: 80,
    exit: 70,
    objects: [ledge(10, 6, 75), ...red(10, 6, 80)],
    solids: [floor(0, 10, 80), floor(16, 14, 70)],
  }),
  half(3, "city-red-face-climb", {
    entry: 80,
    exit: 70,
    objects: [redFace(17, 72, 3)],
    route: { profile: "recovery", targets: [{ at: { col: 13, row: 75 } }] },
    solids: [floor(0, 10, 80), floor(10, 8, 75), floor(18, 12, 70)],
  }),
  half(3, "city-drop-gap", {
    entry: 70,
    exit: 80,
    objects: [ledge(13, 6, 75), ...red(8, 14, 90)],
    solids: [floor(0, 8, 70), floor(22, 8, 80)],
  }),
  half(3, "city-low-descent", {
    entry: 70,
    exit: 80,
    objects: [...redCeiling(18, 8, 72), ...red(21, 2, 80)],
    solids: [floor(0, 8, 70), floor(8, 6, 75), floor(14, 7, 80), floor(23, 7, 80)],
  }),
  half(3, "city-lift-descent", {
    entry: 70,
    exit: 80,
    objects: [lift(11, 80), ledge(17, 6, 75), ...red(11, 13, 90)],
    solids: [floor(0, 11, 70), floor(24, 6, 80)],
  }),
  half(3, "city-ledge-descent", {
    entry: 70,
    exit: 80,
    objects: [ledge(17, 7, 75), ...red(16, 9, 86)],
    slots: [door(6, 70)],
    solids: [floor(0, 16, 70), floor(25, 5, 80)],
  }),
  // Grade 4: timed supports, warned vents and moving hazards on the required path.
  half(4, "crosswalk", crosswalk(80)),
  half(4, "city-vent-deck", ventDeck(80)),
  half(4, "city-vent-deck-high", ventDeck(70)),
  half(4, "city-crumbling-pit", {
    entry: 80,
    exit: 80,
    objects: [crumbling(12, 6, 78), ...red(4, 22, 88)],
    solids: [floor(0, 4, 80), floor(26, 4, 80)],
  }),
  half(4, "city-ground-hazard", {
    entry: 80,
    exit: 80,
    objects: [mover(8, 79, 10), ledge(11, 8, 75)],
    solids: [
      floor(0, 5, 80),
      floor(5, 3, 77),
      floor(8, 14, 80),
      floor(22, 3, 77),
      floor(25, 5, 80),
    ],
  }),
  half(4, "city-vent-climb", {
    entry: 80,
    exit: 70,
    objects: [vent(12, 75)],
    solids: [floor(0, 8, 80), floor(8, 14, 75), floor(22, 8, 70)],
  }),
  half(4, "city-crumbling-climb", {
    entry: 80,
    exit: 70,
    objects: [crumbling(10, 5, 75), ...red(6, 14, 90)],
    solids: [floor(0, 6, 80), floor(20, 10, 70)],
  }),
  half(4, "city-hazard-descent", {
    entry: 70,
    exit: 80,
    objects: [mover(15, 79, 6)],
    solids: [floor(0, 8, 70), floor(8, 6, 75), floor(14, 16, 80)],
  }),
  half(4, "city-crumbling-descent", {
    entry: 70,
    exit: 80,
    objects: [crumbling(13, 6, 76), ...red(6, 20, 90)],
    solids: [floor(0, 6, 70), floor(26, 4, 80)],
  }),
];

export const BLUE_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  MODULE_LIST.map((module) => [module.id, module]),
);
