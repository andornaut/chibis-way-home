import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import type { Archetype, Character, Instance, ZonePlan } from "../data/types";
import { type Catalogue, isPlaced, objectLayout, tileRect, zoneLayout } from "./tiles";

describe("tileRect", () => {
  it.each([
    [10, { col: 0, cols: 1, row: 0, rows: 1 }, { height: 10, width: 10, x: 0, y: 0 }],
    [10, { col: 3, cols: 2, row: 31, rows: 5 }, { height: 50, width: 20, x: 30, y: 310 }],
    [8, { col: 3, cols: 2, row: 31, rows: 5 }, { height: 40, width: 16, x: 24, y: 248 }],
  ])("at %i px a tile, puts %j at %j", (tile, rect, pixels) => {
    expect(tileRect(tile, rect)).toEqual(pixels);
  });
});

describe("zoneLayout", () => {
  const PLATFORM: Archetype = {
    collision: "solid",
    interaction: { kind: "none", range: 0 },
    motion: {
      algorithm: "linear",
      direction: "up",
      distance: 6,
      hopHeight: 0,
      pause: 1,
      speed: 2,
      variance: 0,
    },
    reaction: { kind: "avoid", range: 5, speed: 3 },
  };
  const LIFT: Character = {
    animations: { idle: "rest", move: "rise" },
    archetype: "platform",
    art: "lift",
    cols: 4,
    lines: ["lift-hello"],
    quips: ["lift-quip"],
    quirks: [{ every: 3, tag: "creak", variance: 0.2 }],
    rows: 1,
    tuning: { interaction: { kind: "quip", range: 4 }, motion: { speed: 4 } },
  };
  const DOOR: Archetype = { ...PLATFORM, collision: "use" };
  const CATALOGUE: Catalogue = {
    archetypes: { door: DOOR, platform: PLATFORM },
    characters: { gate: { archetype: "door", art: "gate", cols: 3, rows: 4 }, lift: LIFT },
  };
  const PLAN: ZonePlan = {
    areas: {
      yard: {
        chunks: [
          { chunk: "lawn", col: 0, cols: 24 },
          { chunk: "pond", col: 24, cols: 40 },
        ],
        cols: 64,
        entries: { gate: { col: 5, row: 33 } },
        objects: [
          { character: "lift", col: 20, row: 30 },
          {
            character: "lift",
            col: 40,
            cols: 8,
            lines: ["lift-special"],
            overrides: { motion: { distance: 3, speed: 5 }, reaction: { kind: "none" } },
            phase: 0.5,
            row: 25,
            scene: "lift-scene",
          },
          { character: "lift", col: 0, requires: ["met-lift"], row: 0 },
          { character: "gate", col: 50, room: "shed", row: 29 },
        ],
        rows: 36,
        solids: [{ col: 0, cols: 64, row: 33, rows: 3 }],
      },
    },
    start: { area: "yard", entry: "gate" },
  };
  const hitboxes = {
    lift: { frame: { height: 10, width: 40 }, hitbox: { height: 6, width: 30, x: 5, y: 2 } },
  };
  const layout = zoneLayout(10, BIRD_FRAME, CATALOGUE, hitboxes, {}, new Set(), PLAN);
  const yard = layout.areas.yard;
  const [lift, special, gate] = yard?.objects ?? [];
  it.each([
    ["the area's size", { height: yard?.height, width: yard?.width }, { height: 360, width: 640 }],
    ["its entries", yard?.entries, { gate: { x: 50, y: 330 } }],
    ["its last column's left edge", yard?.exitX, 630],
    ["its terrain", yard?.solids, [{ height: 30, width: 640, x: 0, y: 330 }]],
    [
      "its chunks",
      yard?.chunks,
      [
        { width: 240, x: 0 },
        { width: 400, x: 240 },
      ],
    ],
    ["only the instances the set flags place", yard?.objects.length, 3],
    ["the archetype's collision", lift?.collision, "solid"],
    [
      "the character's size",
      lift && { height: lift.height, width: lift.width },
      { height: 10, width: 40 },
    ],
    ["an instance's own size", special?.width, 80],
    ["an instance's spot", lift?.origin, { x: 200, y: 300 }],
    ["the archetype's motion, in pixels", lift?.motion.distance, 60],
    ["the character's tuning over the archetype", lift?.motion.speed, 40],
    [
      "the instance's overrides over both",
      [special?.motion.distance, special?.motion.speed],
      [30, 50],
    ],
    [
      "the archetype's reaction, in pixels",
      lift?.reaction,
      { kind: "avoid", range: 50, speed: 30 },
    ],
    ["the instance's reaction override", special?.reaction.kind, "none"],
    ["the character's interaction, in pixels", lift?.interaction, { kind: "quip", range: 40 }],
    [
      "animations, a missing state playing idle's, and open the tag named open",
      lift?.animations,
      {
        idle: "rest",
        move: "rise",
        open: "open",
        react: "rest",
        talk: "rest",
      },
    ],
    ["the character's words", [lift?.lines, lift?.quips], [["lift-hello"], ["lift-quip"]]],
    [
      "an instance's own lines and scene",
      [special?.lines, special?.scene],
      [["lift-special"], "lift-scene"],
    ],
    ["the character's quirks", lift?.quirks, LIFT.quirks],
    ["a phase, 0 when unset", [lift?.phase, special?.phase], [0, 0.5]],
    ["a door's room, and none on anything else", [gate?.room, lift?.room], ["shed", undefined]],
    ["its art's hit box", lift?.hitbox, { height: 6, width: 30, x: 5, y: 2 }],
    [
      "its art's hit box, the frame centred on a wider placement",
      special?.hitbox,
      { height: 6, width: 30, x: 25, y: 2 },
    ],
    ["the start", layout.start, { area: "yard", entry: "gate" }],
  ])("resolves %s", (_, resolved, expected) => {
    expect(resolved).toEqual(expected);
  });

  it.each([
    ["an unknown character", { character: "kite", col: 0, row: 0 }, "kite"],
    ["a character with an unknown archetype", { character: "orphan", col: 0, row: 0 }, "nobody"],
    ["a door without a room", { character: "gate", col: 0, row: 0 }, "has no room"],
    [
      "a room on what is not a door",
      { character: "lift", col: 0, room: "shed", row: 0 },
      "not a door",
    ],
  ])("refuses %s", (_, instance, message) => {
    const catalogue = {
      ...CATALOGUE,
      characters: { ...CATALOGUE.characters, orphan: { ...LIFT, archetype: "nobody" } },
    };
    const bad = {
      ...PLAN,
      areas: { yard: { ...PLAN.areas.yard, objects: [instance] } },
    } as ZonePlan;
    expect(() => zoneLayout(10, BIRD_FRAME, catalogue, {}, {}, new Set(), bad)).toThrow(message);
  });
  it("changes a sprite skin while preserving canonical collision, footprint and bottom-centred anchor", () => {
    const assets = {
      ...hitboxes,
      industrial: {
        frame: { height: 20, width: 60 },
        hitbox: { height: 6, width: 30, x: 15, y: 12 },
      },
    };
    const instance = { character: "lift", col: 20, row: 30 };
    const canonical = objectLayout(10, CATALOGUE, assets, undefined, {}, instance);
    const skinned = objectLayout(
      10,
      CATALOGUE,
      assets,
      undefined,
      {},
      { ...instance, skin: { art: "industrial", tileset: null } },
    );
    expect(skinned).toEqual({ ...canonical, art: "industrial", tileset: null });
    expect(() =>
      objectLayout(
        10,
        CATALOGUE,
        {
          ...assets,
          industrial: { ...assets.industrial, hitbox: { ...assets.industrial.hitbox, width: 28 } },
        },
        undefined,
        {},
        { ...instance, skin: { art: "industrial", tileset: null } },
      ),
    ).toThrow("canonical hitbox");
  });

  it("accepts matching tile skins and rejects incompatible tile size, piece footprint and hitboxes", () => {
    const source = {
      columns: 4,
      pieces: { panel: [[0, 0, 0, 0]] },
      tileSize: 10,
      tiles: { edge: 0 },
    };
    const instance = {
      character: "lift",
      col: 20,
      row: 30,
      skin: { art: "panel", tileset: "industrial" },
    };
    const canonical = objectLayout(
      10,
      CATALOGUE,
      {},
      undefined,
      {},
      { character: "lift", col: 20, row: 30 },
    );
    expect(objectLayout(10, CATALOGUE, {}, undefined, { industrial: source }, instance)).toEqual({
      ...canonical,
      art: "panel",
      tileset: "industrial",
    });
    expect(() =>
      objectLayout(
        10,
        CATALOGUE,
        {},
        undefined,
        { industrial: { ...source, tileSize: 12 } },
        instance,
      ),
    ).toThrow("Invalid skin");
    expect(() =>
      objectLayout(
        10,
        CATALOGUE,
        {},
        undefined,
        { industrial: { ...source, pieces: { panel: [[0, 0]] } } },
        instance,
      ),
    ).toThrow("footprint");
    expect(() =>
      objectLayout(
        10,
        CATALOGUE,
        {},
        undefined,
        { industrial: { ...source, hitboxes: { edge: { height: 5, width: 10, x: 0, y: 5 } } } },
        { ...instance, skin: { art: "edge", tileset: "industrial" } },
      ),
    ).toThrow("canonical hitbox");
  });
});

describe("backdrop parallax", () => {
  const scenery: Archetype = {
    collision: "none",
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
  const resolve = (instance: Partial<Instance>, archetype: Archetype = scenery) =>
    objectLayout(
      12,
      {
        archetypes: { scenery: archetype },
        characters: { sky: { archetype: "scenery", art: "sky", cols: 1, rows: 50 } },
      },
      {},
      undefined,
      {},
      { character: "sky", col: 0, row: 0, ...instance },
    );

  it.each([undefined, { x: 0, y: 0 }, { x: 0.4, y: 0.2 }, { x: 1, y: 1 }])(
    "preserves optional factors %j without scaling them to pixels",
    (parallax) => {
      expect(resolve(parallax ? { parallax } : {}).parallax).toEqual(parallax);
    },
  );

  it.each([-1, 1.1, Infinity, NaN])("rejects invalid factor %s on either axis", (factor) => {
    for (const parallax of [
      { x: factor, y: 1 },
      { x: 1, y: factor },
    ]) {
      expect(() => resolve({ parallax })).toThrow("factors must be from 0 to 1");
    }
  });

  it.each<Partial<Archetype>>([
    { collision: "solid" },
    { collision: "hazard" },
    { collision: "ledge" },
    { interaction: { kind: "talk", range: 1 } },
    { motion: { ...scenery.motion, algorithm: "linear" } },
    { reaction: { ...scenery.reaction, kind: "avoid" } },
  ])("refuses parallax on gameplay objects %j", (extra) => {
    expect(() => resolve({ parallax: { x: 0.5, y: 1 } }, { ...scenery, ...extra })).toThrow(
      "requires static scenery without interaction",
    );
  });
});

describe("isPlaced", () => {
  const placed = (fields: Partial<Instance>): Instance => ({
    character: "x",
    col: 0,
    row: 0,
    ...fields,
  });
  it.each([
    ["with no flags named", placed({}), [], true],
    ["requiring a flag that is set", placed({ requires: ["a"] }), ["a"], true],
    ["requiring a flag that is not", placed({ requires: ["a", "b"] }), ["a"], false],
    ["excluding a flag that is set", placed({ excludes: ["a"] }), ["a"], false],
    ["excluding a flag that is not", placed({ excludes: ["b"] }), ["a"], true],
  ])("places an instance %s: %s", (_, instance, flags, expected) => {
    expect(isPlaced(new Set(flags), instance)).toBe(expected);
  });
});
