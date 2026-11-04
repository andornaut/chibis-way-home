import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, Character, Rect, ZonePlan } from "../data/types";
import type { Tileset } from "../stage";
import { BIRD_FRAME } from "../view/bird";
import { type Catalogue, zoneLayout } from "./tiles";
import { startZone, stepZone } from "./zone";

const TILE = 12;
const HAZARD: Archetype = {
  collision: "hazard",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "static",
    direction: "right",
    distance: 0,
    hopHeight: 0,
    pause: 0,
    speed: 0,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const EDGES = [
  { art: "hazard-top", box: { height: 3, width: 12, x: 0, y: 9 }, cols: 4, rows: 1 },
  { art: "hazard-bottom", box: { height: 3, width: 12, x: 0, y: 0 }, cols: 4, rows: 1 },
  { art: "hazard-left", box: { height: 12, width: 3, x: 9, y: 0 }, cols: 1, rows: 4 },
  { art: "hazard-right", box: { height: 12, width: 3, x: 0, y: 0 }, cols: 1, rows: 4 },
] as const;
const SHARED: Tileset = {
  columns: 8,
  hitboxes: Object.fromEntries(EDGES.map(({ art, box }) => [art, box])),
  pieces: {},
  tileSize: TILE,
  tiles: Object.fromEntries(EDGES.map(({ art }, index) => [art, index])),
};
const AREA: Tileset = {
  ...SHARED,
  hitboxes: Object.fromEntries(
    EDGES.map(({ art }) => [art, { height: TILE, width: TILE, x: 0, y: 0 }]),
  ),
};
const TILES = { area: AREA, shared: SHARED };
const CATALOGUE: Catalogue = {
  archetypes: { hazard: HAZARD },
  characters: Object.fromEntries(
    EDGES.map(({ art, cols, rows }): [string, Character] => [
      art,
      { archetype: "hazard", art, cols, rows, tileset: "shared" },
    ]),
  ),
};
const plan = (character: string): ZonePlan => ({
  areas: {
    main: {
      cols: 60,
      entries: { start: { col: 3, row: 50 } },
      objects: [{ character, col: 20, row: 20 }],
      rows: 60,
      solids: [{ col: 0, cols: 60, row: 50, rows: 10 }],
      tileset: "area",
    },
  },
  start: { area: "main", entry: "start" },
});
const resolve = (catalogue: Catalogue, character: string) =>
  zoneLayout(TILE, BIRD_FRAME, catalogue, {}, TILES, new Set(), plan(character));

describe.each(EDGES)("shared $art", ({ art, box, cols, rows }) => {
  const layout = resolve(CATALOGUE, art);
  const object = layout.areas.main?.objects[0];
  const hitbox: Rect = {
    ...box,
    height: box.height + (rows - 1) * TILE,
    width: box.width + (cols - 1) * TILE,
  };

  it("resolves the character's tileset instead of the area's tile hitbox", () => {
    expect(object?.tileset).toBe("shared");
    expect(object?.hitbox).toEqual(hitbox);
  });

  it.each([false, true])("restarts only when the red strip is touched: %s", (touches) => {
    if (!object) {
      throw new Error("Missing hazard");
    }
    const start = startZone(BIRD, layout, 42);
    const x = object.origin.x + hitbox.x;
    const y = object.origin.y + hitbox.y;
    const overlap = touches ? 1 : -1;
    // At the strip's far end, and above/left of it, or below/right for the opposite edge.
    const at =
      art === "hazard-top"
        ? { x: x + hitbox.width - 1, y: y - BIRD.height + overlap }
        : art === "hazard-bottom"
          ? { x: x + hitbox.width - 1, y: y + hitbox.height - overlap }
          : art === "hazard-left"
            ? { x: x - BIRD.width + overlap, y: y + hitbox.height - 1 }
            : { x: x + hitbox.width - overlap, y: y + hitbox.height - 1 };
    const state = { ...start, bird: { ...start.bird, ...at } };
    const next = stepZone(BIRD, layout, 0, { jumpHeld: false, move: 0, useHeld: false }, state);
    expect(next.death !== undefined).toBe(touches);
    if (touches) {
      expect(next.bird).toEqual(state.bird);
    }
  });
});

describe("a character tileset", () => {
  const art = EDGES[0].art;

  it("inherits the area's tileset when the character names none", () => {
    const catalogue = {
      ...CATALOGUE,
      characters: { [art]: { archetype: "hazard", art, cols: 1, rows: 1 } },
    };
    const object = resolve(catalogue, art).areas.main?.objects[0];
    expect(object?.tileset).toBeUndefined();
    expect(object?.hitbox).toEqual(AREA.hitboxes?.[art]);
  });

  it("refuses a named tileset that is not loaded", () => {
    expect(() => zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), plan(art))).toThrow(
      "No tileset shared",
    );
  });
});
