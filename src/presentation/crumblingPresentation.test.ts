import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import type { AreaLayout, Rect } from "../data/types";
import type { Tileset } from "../stage";
import {
  CRUMBLING_SKINS,
  crumblingAppearance,
  crumblingSkinTiles,
  crumblingTerrainBatches,
} from "./crumblingPresentation";
import { terrainTiles } from "./tiles";

const tileset: Tileset = {
  columns: 6,
  pieces: {},
  tileSize: 12,
  tiles: {
    "floor-face": 4,
    "floor-face-left": 3,
    "floor-face-right": 5,
    "floor-top": 1,
    "floor-top-joint": 2,
    "floor-top-left": 0,
    "floor-top-right": 2,
  },
};
const permanent: Rect = { height: 24, width: 24, x: 0, y: 12 };
const marked: Rect = { height: 24, width: 24, x: 24, y: 12 };
const terrain = [
  { col: 0, cols: 2, look: "floor", row: 1, rows: 2 },
  { col: 2, cols: 2, look: "floor", row: 1, rows: 2 },
];
const area: AreaLayout = {
  backX: 0,
  chunks: [],
  crumbling: [
    { profile: { absentSeconds: 2, warningSeconds: 0.8 }, supportId: marked, volume: marked },
  ],
  entries: {},
  exitX: 48,
  height: 48,
  objects: [],
  solids: [permanent, marked],
  terrain,
  tileset: "fixture",
  width: 48,
};

it("splits flat and tiled terrain without regenerating neighbour-dependent skin", () => {
  const original = terrainTiles(tileset, 4, 4, terrain);
  const result = crumblingTerrainBatches(12, area, original);
  expect(result.permanentSolids).toEqual([permanent]);
  expect(result.supports).toHaveLength(1);
  expect(result.supports[0]!.supportId).toBe(marked);
  expect(result.supports[0]!.volume).toBe(marked);
  expect(result.permanentTiles).toEqual(original.filter(({ col }) => col < 2));
  expect(result.supports[0]!.tiles).toEqual(original.filter(({ col }) => col >= 2));
  // An independently regenerated platform would wrongly gain a left edge against its neighbour.
  expect(result.supports[0]!.tiles.find(({ col, row }) => col === 2 && row === 1)!.index).toBe(1);
  expect(result.supports[0]!.tiles.find(({ col, row }) => col === 3 && row === 1)!.index).toBe(2);
  expect(original).toHaveLength(8);
});

it("keeps independent support identities out of the terrain batch", () => {
  const object = { ...marked };
  const original = terrainTiles(tileset, 4, 4, terrain);
  const result = crumblingTerrainBatches(
    12,
    {
      ...area,
      crumbling: [{ ...area.crumbling![0]!, supportId: object }],
    },
    original,
  );
  expect(result.permanentTiles).toBe(original);
  expect(result.permanentSolids).toBe(area.solids);
  expect(result.supports).toEqual([]);
});

it("shows the intact skin, then the warning skin, and nothing while absent", () => {
  expect(crumblingAppearance({ kind: "intact" })).toBe("intact");
  expect(crumblingAppearance({ kind: "warning", removeAtSeconds: 1 })).toBe("warning");
  expect(crumblingAppearance({ kind: "absent", restoreAfterSeconds: 4 })).toBeUndefined();
});

it("swaps a crumbling ledge onto its dedicated intact and warning tiles", () => {
  const real = JSON.parse(
    readFileSync(
      new URL("../../public/art/tilesets/tiles-platforming.json", import.meta.url),
      "utf8",
    ),
  ) as Tileset;
  const ledge = { art: "one-way-ledge", height: 12, width: 72 };
  const indices = (names: readonly string[]) => names.map((name) => real.tiles[name]);
  const run = (key: string) => [`${key}-left`, ...Array(4).fill(`${key}-middle`), `${key}-right`];
  const tiles = crumblingSkinTiles(real, ledge);
  expect(tiles.intact.map(({ index }) => index)).toEqual(indices(run("crumbling-ledge")));
  expect(tiles.warning.map(({ index }) => index)).toEqual(indices(run("crumbling-ledge-warn")));
  // Same cells as the base skin, none of its tiles.
  const base = new Set(indices(run(ledge.art)));
  for (const skin of [tiles.intact, tiles.warning]) {
    expect(skin.map(({ col, row }) => [col, row])).toEqual(
      tiles.intact.map(({ col, row }) => [col, row]),
    );
    expect(skin.some(({ index }) => base.has(index))).toBe(false);
  }
  expect(() => crumblingSkinTiles(real, { ...ledge, art: "platform-top" })).toThrow(
    "No crumbling skin for platform-top",
  );
  const warn = `${CRUMBLING_SKINS[ledge.art]}-warn`;
  const unwarned = {
    ...real,
    tiles: Object.fromEntries(
      Object.entries(real.tiles).filter(([name]) => !name.startsWith(warn)),
    ),
  };
  expect(() => crumblingSkinTiles(unwarned, ledge)).toThrow(
    "No crumbling skin crumbling-ledge-warn in the tileset",
  );
});
