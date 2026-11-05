import { describe, expect, it } from "vitest";

import { CROSSWALK_PHASE_TILES } from "../data/obstacleCharacters";
import type { TerrainRect } from "../data/types";
import { drawsFrom, tileHitbox, type Tileset } from "../stage";
import {
  loadedTileset,
  lookTiles,
  objectTiles,
  phaseSkinTiles,
  type PlacedTile,
  terrainTiles,
} from "./tiles";

const NAMES = [
  ...lookTiles("sidewalk"),
  ...lookTiles("road"),
  ...lookTiles("post"),
  ...lookTiles("grass"),
  "one-way-awning",
  "one-way-awning-left",
  "one-way-awning-right",
  "planter",
  "planter-left",
  "planter-right",
  "planter-top",
  "planter-top-left",
  "planter-top-right",
  "pit-opening",
  "hatch-left",
  "pit-leaf-left",
  "pit-leaf-left-top",
  "hazard-pond",
  "hazard-pond-left",
  "hazard-pond-right",
  "hazard-pond-bed",
  "hazard-pond-bed-left",
  "hazard-pond-bed-right",
  "hazard-thorn",
  "hazard-thorn-left",
  "hazard-thorn-right",
];
const TILESET: Tileset = {
  columns: 8,
  pieces: {
    door: [
      [90, 91],
      [92, 93],
    ],
  },
  tileSize: 12,
  tiles: Object.fromEntries(NAMES.map((name, index) => [name, index])),
};
const nameOf = Object.fromEntries(NAMES.map((name, index) => [index, name]));
// Each placed tile as "col,row name", in row order.
const named = (tiles: PlacedTile[]) =>
  tiles.map(({ col, index, row }) => `${col},${row} ${nameOf[index] ?? index}`);

describe("terrainTiles", () => {
  it.each([
    [
      "a run of sidewalk with open ends, joints every other column",
      [{ col: 1, cols: 4, look: "sidewalk", row: 1, rows: 2 }],
      [
        "1,1 sidewalk-top-left",
        "2,1 sidewalk-top",
        "3,1 sidewalk-top-joint",
        "4,1 sidewalk-top-right",
        "1,2 sidewalk-face-left",
        "2,2 sidewalk-face",
        "3,2 sidewalk-face",
        "4,2 sidewalk-face-right",
      ],
    ],
    [
      "sidewalk meeting a road one lower, with kerbs",
      [
        { col: 0, cols: 2, look: "sidewalk", row: 0, rows: 2 },
        { col: 2, cols: 2, look: "road", row: 1, rows: 1 },
        { col: 4, cols: 2, look: "sidewalk", row: 0, rows: 2 },
      ],
      [
        "0,0 sidewalk-top",
        "1,0 kerb-right",
        "4,0 kerb-left",
        "5,0 sidewalk-top-joint",
        "0,1 sidewalk-face",
        "1,1 sidewalk-face",
        "2,1 road-top",
        "3,1 road-top",
        "4,1 sidewalk-face",
        "5,1 sidewalk-face",
      ],
    ],
    [
      "a post",
      [{ col: 0, cols: 2, look: "post", row: 0, rows: 3 }],
      [
        "0,0 post-cap-left",
        "1,0 post-cap-right",
        "0,1 post-left",
        "1,1 post-right",
        "0,2 post-base-left",
        "1,2 post-base-right",
      ],
    ],
    ["terrain with no look", [{ col: 0, cols: 2, row: 0, rows: 1 }], []],
  ] as [string, TerrainRect[], string[]][])("draws %s", (_, solids, tiles) => {
    expect(named(terrainTiles(TILESET, 6, 3, solids))).toEqual(tiles);
  });

  it("draws the park's grass: a grass top, a row of turf, then soil with pebbles scattered", () => {
    const solids = [{ col: 1, cols: 4, look: "grass", row: 1, rows: 4 }];
    expect(named(terrainTiles(TILESET, 6, 5, solids))).toEqual([
      "1,1 grass-top-left",
      "2,1 grass-top",
      "3,1 grass-top",
      "4,1 grass-top-right",
      "1,2 turf-left",
      "2,2 turf",
      "3,2 turf",
      "4,2 turf-right",
      "1,3 soil-left",
      "2,3 soil",
      "3,3 soil",
      "4,3 soil-right",
      "1,4 soil-left",
      "2,4 soil-pebbles",
      "3,4 soil",
      "4,4 soil-right",
    ]);
  });

  it("refuses a look the tileset has no tiles for", () => {
    expect(() =>
      terrainTiles(TILESET, 2, 1, [{ col: 0, cols: 2, look: "floor", row: 0, rows: 1 }]),
    ).toThrow("floor-top");
  });
});

describe("objectTiles", () => {
  it.each([
    ["a piece whole", "door", 2, 2, ["0,0 90", "1,0 91", "0,1 92", "1,1 93"]],
    [
      "an awning across its width",
      "one-way-awning",
      4,
      1,
      [
        "0,0 one-way-awning-left",
        "1,0 one-way-awning",
        "2,0 one-way-awning",
        "3,0 one-way-awning-right",
      ],
    ],
    [
      "a planter with its top row",
      "planter",
      3,
      2,
      [
        "0,0 planter-top-left",
        "1,0 planter-top",
        "2,0 planter-top-right",
        "0,1 planter-left",
        "1,1 planter",
        "2,1 planter-right",
      ],
    ],
    [
      "a hatch edge under its leaf",
      "hatch-left",
      1,
      3,
      ["0,0 pit-leaf-left-top", "0,1 pit-leaf-left", "0,2 hatch-left"],
    ],
    [
      "a hazard across the width it is placed with",
      "hazard-thorn",
      3,
      1,
      ["0,0 hazard-thorn-left", "1,0 hazard-thorn", "2,0 hazard-thorn-right"],
    ],
    [
      "a pond with its bed under its first row",
      "hazard-pond",
      3,
      2,
      [
        "0,0 hazard-pond-left",
        "1,0 hazard-pond",
        "2,0 hazard-pond-right",
        "0,1 hazard-pond-bed-left",
        "1,1 hazard-pond-bed",
        "2,1 hazard-pond-bed-right",
      ],
    ],
    ["a plain tile repeated", "pit-opening", 2, 1, ["0,0 pit-opening", "1,0 pit-opening"]],
    ["a one-wide run as its middle tile", "one-way-awning", 1, 1, ["0,0 one-way-awning"]],
  ])("draws %s", (_, art, cols, rows, tiles) => {
    expect(named(objectTiles(TILESET, art, cols, rows))).toEqual(tiles);
  });
});

describe("drawsFrom", () => {
  it.each([
    ["door", true],
    ["planter", true],
    ["storefront-cafe", false],
  ])("says the tileset draws %s: %s", (art, draws) => {
    expect(drawsFrom(TILESET, art)).toBe(draws);
  });
});

describe("loadedTileset", () => {
  const sheet = (tileSize: number): Tileset => ({ columns: 1, pieces: {}, tileSize, tiles: {} });
  const loaded: Readonly<Record<string, Tileset>> = { big: sheet(16), street: sheet(12) };
  const lookup = (key: string) => loaded[key];

  it.each([
    ["one that loaded", "street", loaded.street],
    ["none for an area without one, which draws flat", undefined, undefined],
    ["none for one art does not have yet, which draws flat", "placeholder-park", undefined],
  ])("gives %s", (_, key, tileset) => {
    expect(loadedTileset(12, lookup, key)).toBe(tileset);
  });

  it("refuses one whose tiles are another size", () => {
    expect(() => loadedTileset(12, lookup, "big")).toThrow(/not 12 px/);
  });
});

describe("tileHitbox", () => {
  // The park's: a thorn hurts from 2 px down its row, a pond's water from 4 px down its top row,
  // and its bed across the whole cell.
  const boxed: Tileset = {
    ...TILESET,
    hitboxes: Object.fromEntries([
      ...["hazard-thorn", "hazard-thorn-left", "hazard-thorn-right"].map(
        (name) => [name, { height: 10, width: 12, x: 0, y: 2 }] as const,
      ),
      ...["hazard-pond", "hazard-pond-left", "hazard-pond-right"].map(
        (name) => [name, { height: 8, width: 12, x: 0, y: 4 }] as const,
      ),
    ]),
  };

  it.each([
    [
      "a thorn hedge: 2 px lower at the top",
      boxed,
      "hazard-thorn",
      3,
      1,
      { height: 10, width: 36, x: 0, y: 2 },
    ],
    [
      "a pond: 4 px lower at its top row, its bed row full",
      boxed,
      "hazard-pond",
      4,
      2,
      { height: 20, width: 48, x: 0, y: 4 },
    ],
    ["none for tiles without hit boxes", boxed, "planter", 2, 2, undefined],
    ["none for a tileset without hit boxes", TILESET, "hazard-thorn", 3, 1, undefined],
    ["none for a piece", boxed, "door", 2, 2, undefined],
  ])("gives %s", (_, tileset, art, cols, rows, hitbox) => {
    expect(tileHitbox(12, tileset, art, cols, rows)).toEqual(hitbox);
  });

  it("scales a tile's hit box to the layout's tile size", () => {
    expect(tileHitbox(24, boxed, "hazard-thorn", 1, 1)).toEqual({
      height: 20,
      width: 24,
      x: 0,
      y: 4,
    });
  });
});

describe("phase skin tiles", () => {
  const object = { height: 12, phaseTiles: CROSSWALK_PHASE_TILES, width: 48 };
  const names = Object.values(CROSSWALK_PHASE_TILES).flatMap((tiles) => Object.values(tiles));
  const sheet = (present: readonly string[]): Tileset => ({
    columns: 16,
    pieces: {},
    tileSize: 12,
    tiles: Object.fromEntries(present.map((name, index) => [name, index])),
  });

  it("draws procedurally until the tileset has every phase tile", () => {
    expect(phaseSkinTiles(sheet(names.slice(1)), object)).toBeUndefined();
    expect(phaseSkinTiles(sheet(names), { height: 12, width: 48 })).toBeUndefined();
  });

  it("switches to each phase's left, middle and right tiles once they exist", () => {
    const tileset = sheet(names);
    const skin = phaseSkinTiles(tileset, object)!;
    const index = (name: string) => tileset.tiles[name];
    expect(skin.active).toEqual([
      { col: 0, index: index("crosswalk-traffic-left"), row: 0 },
      { col: 1, index: index("crosswalk-traffic-middle"), row: 0 },
      { col: 2, index: index("crosswalk-traffic-middle"), row: 0 },
      { col: 3, index: index("crosswalk-traffic-right"), row: 0 },
    ]);
    expect(skin.inactive.map(({ index: i }) => i)).toEqual(
      ["left", "middle", "middle", "right"].map((end) => index(`crosswalk-walk-${end}`)),
    );
    expect(skin.warning.map(({ index: i }) => i)).toEqual(
      ["left", "middle", "middle", "right"].map((end) => index(`crosswalk-warning-${end}`)),
    );
  });
});
