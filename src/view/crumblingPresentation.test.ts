import { readFileSync } from "node:fs";

import { decodePng } from "@andornaut/art-kit/png";
import { expect, it } from "vitest";

import type { AreaLayout, Rect } from "../data/types";
import {
  CRUMBLING_FACES,
  crumblingAppearance,
  crumblingObjectFace,
  crumblingTerrainBatches,
} from "./crumblingPresentation";
import { terrainTiles, type Tileset } from "./tiles";

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

it("keeps the complete skin during a static warning and hides skin, cracks and lip only while absent", () => {
  const face = {
    height: marked.height - 6,
    width: marked.width - 4,
    x: marked.x + 2,
    y: marked.y + 5,
  };
  const intact = crumblingAppearance({ kind: "intact" }, face);
  const warning = crumblingAppearance({ kind: "warning", removeAtSeconds: 1 }, face);
  expect(intact).toEqual({ cracks: [], visible: true });
  expect(warning.visible).toBe(true);
  expect(warning.cracks.length).toBeGreaterThan(0);
  expect(crumblingAppearance({ kind: "warning", removeAtSeconds: 50 }, face)).toEqual(warning);
  for (const pixel of warning.cracks) {
    expect([pixel.width, pixel.height]).toEqual([1, 1]);
    expect(Number.isInteger(pixel.x) && Number.isInteger(pixel.y)).toBe(true);
    expect(pixel.x).toBeGreaterThanOrEqual(face.x);
    expect(pixel.x + pixel.width).toBeLessThanOrEqual(face.x + face.width);
    expect(pixel.y).toBeGreaterThanOrEqual(face.y);
    expect(pixel.y + pixel.height).toBeLessThanOrEqual(face.y + face.height);
  }
  expect(crumblingAppearance({ kind: "absent", restoreAfterSeconds: 4 }, face)).toEqual({
    cracks: [],
    visible: false,
  });
  expect(crumblingAppearance({ kind: "intact" }, face)).toEqual(intact);
});

it("confines warning marks to the actual thin opaque ledge face", () => {
  const face = { height: 1, width: 20, x: 50, y: 105 };
  const result = crumblingAppearance({ kind: "warning", removeAtSeconds: 1 }, face);
  expect(result.cracks.length).toBeGreaterThan(0);
  expect(result.cracks.every((pixel) => pixel.y === 105 && pixel.height === 1)).toBe(true);
  expect(result.cracks.every((pixel) => pixel.x >= 50 && pixel.x + pixel.width <= 70)).toBe(true);
});

it("registers each crumbling face on the actual opaque body below the safe lip", () => {
  for (const [key, faces] of Object.entries(CRUMBLING_FACES)) {
    const url = (path: string) =>
      new URL(`../../public/art/tilesets/${key}.${path}`, import.meta.url);
    const tileset = JSON.parse(readFileSync(url("json"), "utf8")) as Tileset;
    const image = decodePng(new Uint8Array(readFileSync(url("png"))));
    for (const [name, face] of Object.entries(faces)) {
      const index = tileset.tiles[name]!;
      const pixel = (x: number, y: number) => {
        const at =
          ((Math.floor(index / tileset.columns) * tileset.tileSize + y) * image.width +
            (index % tileset.columns) * tileset.tileSize +
            x) *
          4;
        return [...image.data.slice(at, at + 4)].join(",");
      };
      const body = new Set<string>();
      for (let y = face.y; y < face.y + face.height; y++) {
        for (let x = face.x; x < face.x + face.width; x++) {
          body.add(pixel(x, y));
        }
      }
      expect(body.size, name).toBe(1);
      const [colour] = [...body];
      expect(colour!.endsWith(",255"), name).toBe(true);
      // Every lip row above the face and any outline column beside it uses other colours.
      for (let y = 0; y < face.y; y++) {
        expect(pixel(face.x, y), `${name} lip ${y}`).not.toBe(colour);
      }
      for (const x of [face.x - 1, face.x + face.width]) {
        if (x >= 0 && x < tileset.tileSize) {
          expect(pixel(x, face.y), `${name} outline ${x}`).not.toBe(colour);
        }
      }
      for (let y = face.y + face.height; y < tileset.tileSize; y++) {
        expect(pixel(face.x, y).endsWith(",0"), `${name} under ${y}`).toBe(true);
      }
    }
  }
});

it("spans the selected ledge skin's tiles with one inner face band", () => {
  const tileset = JSON.parse(
    readFileSync(
      new URL("../../public/art/tilesets/tiles-platforming.json", import.meta.url),
      "utf8",
    ),
  ) as Tileset;
  const face = crumblingObjectFace(
    "tiles-platforming",
    tileset,
    { art: "one-way-ledge", height: 12, width: 72 },
    { x: 288, y: 576 },
  );
  expect(face).toEqual({ height: 1, width: 70, x: 289, y: 581 });
  expect(() =>
    crumblingObjectFace(
      "tiles-platforming",
      tileset,
      { art: "platform-top", height: 12, width: 12 },
      {
        x: 0,
        y: 0,
      },
    ),
  ).toThrow("No crumbling face");
});
