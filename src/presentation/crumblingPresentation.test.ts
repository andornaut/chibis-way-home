import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import type { Tileset } from "../stage";
import { CRUMBLING_SKINS, crumblingAppearance, crumblingSkinTiles } from "./crumblingPresentation";

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
