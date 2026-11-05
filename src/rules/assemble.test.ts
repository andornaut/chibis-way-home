import { describe, expect, it } from "vitest";

import type { AreaPlan, ChunkPlan, OrderedZoneRecipe, ZoneRecipe } from "../data/types";
import { FIXTURE_LIBRARY, FIXTURE_RECIPE } from "../testing/chunks";
import { ASSEMBLED_AREA, assembleZone, assembleZoneAvoiding, type ChunkLibrary } from "./assemble";
import { recipeProblems } from "./chunk";

const ROWS = 60;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

// A chunk 60 wide on ground at its entry row, rising or dropping to its exit row halfway.
function chunk(entry: 30 | 40 | 50, exit: 30 | 40 | 50, extra: Partial<ChunkPlan> = {}): ChunkPlan {
  return {
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: entry },
    exit: { row: exit },
    objects: [],
    solids: [
      { col: 0, cols: 30, look: "ground", row: entry, rows: ROWS - entry },
      { col: 30, cols: 30, look: "ground", row: exit, rows: ROWS - exit },
    ],
    theme: "t",
    ...extra,
  };
}

function library(chunks: Readonly<Record<string, ChunkPlan>>): ChunkLibrary {
  return {
    characters: { door: { cols: 2, rows: 3 } },
    chunks: { finish: chunk(50, 50), start: chunk(50, 50), ...chunks },
    rows: ROWS,
    rules: { cols: { max: 120, min: 60 }, footing: 4, headroom: 6 },
    seams: [30, 40, 50],
    themes: {
      t: {
        backdrops: [{ character: "sky", row: 0 }],
        bindings: { door: { character: "door" } },
        door: "door",
        looks: { ground: "grass" },
        tileset: "tiles",
      },
    },
  };
}

// A recipe for start, middles chunks between, then finish: exactly that wide at 60 each.
function recipe(middles: number, extra: Partial<ZoneRecipe> = {}): ZoneRecipe {
  const cols = 60 * (middles + 2);
  return {
    difficulty: { max: 1, min: 1 },
    doors: [],
    events: [],
    finish: "finish",
    length: { max: cols, min: cols },
    spawnCol: 2,
    start: "start",
    theme: "t",
    ...extra,
  };
}

const areaOf = (plan: ReturnType<typeof assembleZone>): AreaPlan => {
  const area = plan.areas[ASSEMBLED_AREA];
  if (!area) {
    throw new Error("no area");
  }
  return area;
};
const middleIds = (area: AreaPlan) => (area.chunks ?? []).slice(1, -1).map(({ chunk: id }) => id);
const runs = (lib: ChunkLibrary, zone: ZoneRecipe) =>
  new Set(SEEDS.map((seed) => middleIds(areaOf(assembleZone(lib, seed, "z", zone))).join(" ")));

describe("assembleZone", () => {
  it("places the configured spawn on the opening entry row", () => {
    const lib = library({
      a: chunk(50, 50),
      start: chunk(40, 50),
    });
    const plan = assembleZone(lib, 1, "unrelated-stage-key", recipe(1, { spawnCol: 9 }));
    expect(plan.areas[plan.start.area]?.entries[plan.start.entry]).toEqual({ col: 9, row: 40 });
  });

  it.each([-1, 0, 1, 2.5, 60, 61, NaN, Infinity])("refuses invalid spawn column %s", (spawnCol) => {
    expect(() =>
      assembleZone(library({ a: chunk(50, 50) }), 1, "z", recipe(1, { spawnCol })),
    ).toThrow(/^Spawn column/);
  });
  it.each<[string, Record<string, ChunkPlan>, ZoneRecipe, string[]]>([
    [
      "joins only where an exit meets the next entry, backing out of a likelier dead end",
      { dead: chunk(50, 30, { weight: 1000 }), down: chunk(40, 50), up: chunk(50, 40) },
      recipe(2),
      ["up down"],
    ],
    [
      "never places one chunk twice in a row",
      { a: chunk(50, 50), b: chunk(50, 50) },
      recipe(2),
      ["a b", "b a"],
    ],
    [
      "places a chunk at most its maxPerZone times",
      { a: chunk(50, 50, { maxPerZone: 2 }), b: chunk(50, 50, { maxPerZone: 1 }) },
      recipe(3),
      ["a b a"],
    ],
    [
      "keeps every middle chunk in the same inclusive band, with either extreme first or last",
      {
        easy: chunk(50, 50, { difficulty: 1 }),
        hard: chunk(50, 50, { difficulty: 5 }),
        x: chunk(50, 50, { difficulty: 2, maxPerZone: 1 }),
        y: chunk(50, 50, { difficulty: 4, maxPerZone: 1 }),
        z: chunk(50, 50, { difficulty: 3, maxPerZone: 1 }),
      },
      recipe(3, { difficulty: { max: 4, min: 2 } }),
      ["x y z", "x z y", "y x z", "y z x", "z x y", "z y x"],
    ],
    [
      "keeps the whole zone within its length",
      { a: chunk(50, 50), b: chunk(50, 50) },
      recipe(1, { length: { max: 200, min: 120 } }),
      ["", "a", "b"],
    ],
  ])("%s", (_, chunks, zone, allowed) => {
    const found = [...runs(library(chunks), zone)];
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((run) => !allowed.includes(run))).toEqual([]);
  });

  it.each<[string, Record<string, ChunkPlan>, ZoneRecipe]>([
    ["no chunk joins", { up: chunk(50, 40) }, recipe(1)],
    ["only one chunk fits a run of two", { a: chunk(50, 50) }, recipe(2)],
    [
      "maxPerZone runs out",
      { a: chunk(50, 50, { maxPerZone: 1 }), b: chunk(50, 50, { maxPerZone: 1 }) },
      recipe(3),
    ],
    ["no chunk is in the band", { a: chunk(50, 50, { difficulty: 4 }) }, recipe(1)],
    [
      "too few slots for the events",
      {
        a: chunk(50, 50, {
          slots: [{ area: { col: 0, cols: 1, row: 0, rows: 1 }, id: "s", kind: "event" }],
        }),
      },
      recipe(1, { events: [{ count: 2, id: "e" }] }),
    ],
  ])("fails clearly when %s", (_, chunks, zone) => {
    expect(() => assembleZone(library(chunks), 1, "z", zone)).toThrow(/^No assembly of zone z/);
  });

  it("supports one selected difficulty while keeping safe boundary chunks exempt", () => {
    const lib = library({
      a: chunk(50, 50, { difficulty: 3 }),
      b: chunk(50, 50, { difficulty: 3 }),
      easy: chunk(50, 50, { difficulty: 2 }),
      hard: chunk(50, 50, { difficulty: 4 }),
    });
    expect([...runs(lib, recipe(2, { difficulty: { max: 3, min: 3 } }))].sort()).toEqual([
      "a b",
      "b a",
    ]);
  });

  it.each([
    [0, 3],
    [2, 6],
    [4, 2],
    [1.5, 3],
    [2, 3.5],
    [NaN, 3],
    [1, Infinity],
  ])("refuses an invalid difficulty band %s to %s", (min, max) => {
    const difficulty = { max, min } as ZoneRecipe["difficulty"];
    expect(recipeProblems(library({}), recipe(0, { difficulty }))).toContain(
      `difficulty ${min} to ${max} is not an ordered band from 1 to 5`,
    );
  });

  it("gives the same zone for the same seed, and different zones across seeds", () => {
    const lib = library({ a: chunk(50, 50), b: chunk(50, 50), c: chunk(50, 50) });
    const zone = recipe(3);
    expect(assembleZone(lib, 7, "z", zone)).toEqual(assembleZone(lib, 7, "z", zone));
    expect(runs(lib, zone).size).toBeGreaterThan(1);
  });

  it("places three real quiet chunks between encounter caps and middles", () => {
    const lib = library({
      enemy: chunk(50, 50, { encounters: 1, maxPerZone: 1, weight: 1000 }),
      finish: chunk(50, 50, { encounters: 1 }),
      quietA: chunk(50, 50),
      quietB: chunk(50, 50),
      start: chunk(50, 50, { encounters: 1 }),
    });
    const selected = recipe(7, { encounters: 3, minEncounterGap: 3 });
    const ids = areaOf(assembleZone(lib, 7, "spaced", selected)).chunks!.map(({ chunk }) => chunk);
    expect(ids).toHaveLength(9);
    expect(ids.flatMap((id, index) => (lib.chunks[id]!.encounters > 0 ? [index] : []))).toEqual([
      0, 4, 8,
    ]);
    expect(ids.filter((id) => id === "enemy")).toHaveLength(1);
  });

  it("enforces an explicit gap without a quota and rejects invalid gap metadata", () => {
    const lib = library({
      finish: chunk(50, 50, { encounters: 1 }),
      quietA: chunk(50, 50),
      quietB: chunk(50, 50),
      start: chunk(50, 50, { encounters: 1 }),
    });
    expect(() => assembleZone(lib, 7, "short", recipe(2, { minEncounterGap: 3 }))).toThrow(
      "No assembly",
    );
    expect(
      areaOf(assembleZone(lib, 7, "fits", recipe(3, { minEncounterGap: 3 }))).chunks,
    ).toHaveLength(5);
    for (const gap of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => assembleZone(lib, 7, "invalid", recipe(3, { minEncounterGap: gap }))).toThrow(
        "Minimum encounter gap",
      );
    }
    const bad = library({ bad: chunk(50, 50, { encounters: NaN }) });
    expect(() => assembleZone(bad, 7, "invalid-count", recipe(1, { minEncounterGap: 1 }))).toThrow(
      "Invalid encounter count",
    );
  });

  it("backtracks equal-width prefixes with different gaps and resets spacing for each stage", () => {
    const lib = library({
      enemy: chunk(50, 50, { encounters: 1, weight: 0.001 }),
      finish: chunk(50, 50, { encounters: 1 }),
      quietA: chunk(50, 50),
      quietB: chunk(50, 50),
      quietC: chunk(50, 50),
    });
    const selected = recipe(4, { encounters: 2, minEncounterGap: 3 });
    for (const stage of ["first-stage", "next-stage"]) {
      const ids = areaOf(assembleZone(lib, 42, stage, selected)).chunks!.map(({ chunk }) => chunk);
      expect(ids[1]).toBe("enemy");
      expect(ids.slice(2, -1).every((id) => lib.chunks[id]!.encounters === 0)).toBe(true);
    }
  });

  it.each([undefined, 3])("zero extra gap preserves legacy seeded quota %s", (encounters) => {
    const lib = library({
      enemy: chunk(50, 50, { encounters: 1 }),
      finish: chunk(50, 50, { encounters: 1 }),
      quiet: chunk(50, 50),
      start: chunk(50, 50, { encounters: 1 }),
    });
    const selected = recipe(3, encounters === undefined ? {} : { encounters });
    const legacy = assembleZone(lib, 7, "legacy", selected);
    expect(assembleZone(lib, 7, "legacy", { ...selected, minEncounterGap: 0 })).toEqual(legacy);
    if (encounters !== undefined) {
      expect(areaOf(legacy).chunks!.map(({ chunk }) => chunk)).toEqual([
        "start",
        "quiet",
        "enemy",
        "quiet",
        "finish",
      ]);
    }
  });

  it("counts caps from metadata and leaves a zero-encounter chunk between encounters", () => {
    const lib = library({
      encounter: chunk(50, 50, { encounters: 1, weight: 1000 }),
      finish: chunk(50, 50, { encounters: 1 }),
      quiet: chunk(50, 50),
      start: chunk(50, 50, { encounters: 1 }),
    });
    const zone = recipe(3, { encounters: 3 });
    const plan = assembleZone(lib, 7, "metadata", zone);
    expect(plan).toEqual(assembleZone(lib, 7, "metadata", zone));
    expect(areaOf(plan).chunks?.map(({ chunk }) => chunk)).toEqual([
      "start",
      "quiet",
      "encounter",
      "quiet",
      "finish",
    ]);
  });

  it.each([
    ["caps exhaust the quota", 2, 1, 1, 1, ["quiet"]],
    ["zero quota excludes a positive middle", 0, 0, 0, 1, ["quiet"]],
  ])("%s", (_, encounters, start, finish, middle, expected) => {
    const lib = library({
      encounter: chunk(50, 50, { encounters: middle, weight: 1000 }),
      finish: chunk(50, 50, { encounters: finish }),
      quiet: chunk(50, 50),
      start: chunk(50, 50, { encounters: start }),
    });
    expect(middleIds(areaOf(assembleZone(lib, 1, "quota", recipe(1, { encounters }))))).toEqual(
      expected,
    );
  });

  it("preserves unconstrained recipes but rejects impossible quota or cap adjacency", () => {
    const lib = library({
      encounter: chunk(50, 50, { encounters: 1 }),
      finish: chunk(50, 50, { encounters: 1 }),
      start: chunk(50, 50, { encounters: 1 }),
    });
    expect(middleIds(areaOf(assembleZone(lib, 1, "debug", recipe(1))))).toEqual(["encounter"]);
    for (const encounters of [1, 3]) {
      expect(() => assembleZone(lib, 1, "quota", recipe(1, { encounters }))).toThrow(
        /^No assembly/,
      );
    }
  });

  it("rejects invalid quotas and explicit metadata rather than inferring encounters", () => {
    expect(() => assembleZone(library({}), 1, "invalid", recipe(0, { encounters: -1 }))).toThrow(
      "Encounter quota",
    );
    const lib = library({ bad: chunk(50, 50, { encounters: NaN }) });
    expect(() => assembleZone(lib, 1, "invalid", recipe(1, { encounters: 1 }))).toThrow(
      "Invalid encounter count",
    );
  });

  it("preserves theme and placed backdrop parallax across chunk assembly", () => {
    const lib = library({
      a: chunk(50, 50, {
        backdrops: [{ character: "tree", col: 3, parallax: { x: 0.4, y: 0.2 }, row: 20 }],
      }),
    });
    const theme = lib.themes.t;
    if (!theme) {
      throw new Error("no theme");
    }
    const withParallax = {
      ...lib,
      themes: {
        t: { ...theme, backdrops: [{ character: "sky", parallax: { x: 0, y: 0 }, row: 0 }] },
      },
    };
    const area = areaOf(assembleZone(withParallax, 1, "z", recipe(1)));
    expect(area.objects).toEqual([
      { character: "sky", col: 0, cols: area.cols, parallax: { x: 0, y: 0 }, row: 0 },
      { character: "tree", col: 63, parallax: { x: 0.4, y: 0.2 }, row: 20 },
    ]);
  });

  it("binds all placed categories and sizes filled doors from the selected character", () => {
    const base = library({
      a: chunk(50, 50, {
        backdrops: [{ character: "tree", col: 3, role: "scenery", row: 20 }],
        objects: [{ character: "animal", col: 5, role: "actor", row: 45, scene: "old-intro" }],
        slots: [{ area: { col: 10, cols: 4, row: 45, rows: 5 }, id: "door", kind: "door" }],
      }),
    });
    const theme = base.themes.t;
    if (!theme) {
      throw new Error("Missing fixture theme");
    }
    const bound = {
      ...base,
      characters: { ...base.characters, industrialDoor: { cols: 4, rows: 5 } },
      themes: {
        t: {
          ...theme,
          backdrops: [{ character: "sky", role: "sky", row: 0 }],
          bindings: {
            actor: { character: "industrial-animal", scene: null },
            door: { character: "industrialDoor" },
            scenery: { character: "factory-prop" },
            sky: { character: "factory-sky", parallax: { x: 0, y: 0 } },
          },
        },
      },
    };
    const area = areaOf(
      assembleZone(bound, 1, "stage", recipe(1, { doors: [{ count: 1, room: "test" }] })),
    );
    expect(area.objects).toMatchObject([
      { character: "factory-sky", col: 0, cols: 180, parallax: { x: 0, y: 0 }, row: 0 },
      { character: "factory-prop", col: 63, row: 20 },
      { character: "industrial-animal", col: 65, row: 45 },
      { character: "industrialDoor", col: 70, room: "test", row: 45 },
    ]);
    expect(area.objects[2]?.scene).toBeUndefined();
    expect(() =>
      assembleZone(
        { ...bound, themes: { t: { ...bound.themes.t, bindings: {} } } },
        1,
        "stage",
        recipe(1),
      ),
    ).toThrow("No binding for role door");
  });

  it("moves each chunk's contents to its zone columns, drawn in the theme, with its doors", () => {
    const lib = library({
      a: chunk(50, 50, {
        backdrops: [{ character: "tree", col: 3, row: 20 }],
        escapes: [
          {
            area: { col: 20, cols: 4, row: 44, rows: 6 },
            from: { col: 18, row: 50 },
            id: "gap",
            kind: "flutter-gap",
            to: { col: 26, row: 50 },
          },
        ],
        noCross: [{ from: { col: 1, row: 50 }, to: { col: 9, row: 50 } }],
        objects: [{ character: "bench", col: 5, row: 48 }],
        outOfReach: [{ col: 2, row: 10 }],
        slots: [{ area: { col: 6, cols: 2, row: 40, rows: 4 }, id: "s", kind: "door" }],
      }),
    });
    const area = areaOf(assembleZone(lib, 1, "z", recipe(1, { doors: [{ count: 1, room: "r" }] })));
    expect(area).toMatchObject({
      chunks: [
        { chunk: "start", col: 0, cols: 60 },
        { chunk: "a", col: 60, cols: 60 },
        { chunk: "finish", col: 120, cols: 60 },
      ],
      cols: 180,
      entries: { start: { col: 2, row: 50 } },
      escapes: [
        {
          area: { col: 80, cols: 4, row: 44, rows: 6 },
          chunk: 1,
          from: { col: 78, row: 50 },
          id: "gap",
          kind: "flutter-gap",
          to: { col: 86, row: 50 },
        },
      ],
      noCross: [{ from: { col: 61, row: 50 }, to: { col: 69, row: 50 } }],
      objects: [
        { character: "sky", col: 0, cols: 180, row: 0 },
        { character: "tree", col: 63, row: 20 },
        { character: "bench", col: 65, row: 48 },
        { character: "door", col: 66, room: "r", row: 41 },
      ],
      outOfReach: [{ col: 62, row: 10 }],
      rows: ROWS,
      slots: [
        {
          area: { col: 66, cols: 2, row: 40, rows: 4 },
          chunk: 1,
          fill: "r",
          id: "s",
          kind: "door",
        },
      ],
      tileset: "tiles",
    });
    expect(area.solids.map(({ col, look }) => [col, look])).toEqual(
      [0, 30, 60, 90, 120, 150].map((col) => [col, "grass"]),
    );
  });

  it("fills as many slots as the recipe asks for, by the seed, and leaves the rest empty", () => {
    const slot = (id: string, kind: "door" | "event") => ({
      area: { col: 0, cols: 1, row: 0, rows: 1 },
      id,
      kind,
    });
    const lib = library({
      a: chunk(50, 50, { slots: [slot("e1", "event"), slot("e2", "event"), slot("d1", "door")] }),
      b: chunk(50, 50, { slots: [slot("e3", "event"), slot("d2", "door")] }),
    });
    const zone = recipe(2, {
      doors: [{ count: 1, room: "r" }],
      events: [
        { count: 1, id: "x" },
        { count: 1, id: "y" },
      ],
    });
    const fills = SEEDS.map((seed) =>
      (areaOf(assembleZone(lib, seed, "z", zone)).slots ?? []).map((each) => each.fill ?? "-"),
    );
    for (const each of fills) {
      expect([...each].sort()).toEqual(["-", "-", "r", "x", "y"]);
    }
    expect(new Set(fills.map((each) => each.join())).size).toBeGreaterThan(1);
  });

  it.each([0, 1, 2])("places the theme's door in each of %i filled door slots", (count) => {
    const slot = (id: string, col: number) => ({
      area: { col, cols: 4, row: 45, rows: 5 },
      id,
      kind: "door" as const,
    });
    const lib = library({
      a: chunk(50, 50, { slots: [slot("d1", 10)] }),
      b: chunk(50, 50, { slots: [slot("d2", 20)] }),
    });
    const zone = recipe(2, { doors: count === 0 ? [] : [{ count, room: "r" }] });
    for (const seed of SEEDS) {
      const area = areaOf(assembleZone(lib, seed, "z", zone));
      const doors = area.objects.filter(({ character }) => character === "door");
      const filled = (area.slots ?? []).filter(({ fill }) => fill !== undefined);
      expect(doors.map(({ col }) => col - 1)).toEqual(filled.map(({ area: rect }) => rect.col));
      expect(doors).toHaveLength(count);
    }
  });

  // A slot 4 wide and 5 tall at col 10 and row 45 of the middle chunk (zone col 70), its floor at
  // row 50.
  it.each([
    ["one narrower by an odd count, half a tile in", { cols: 3, rows: 5 }, { col: 70.5, row: 45 }],
    ["one narrower by an even count, a tile in", { cols: 2, rows: 3 }, { col: 71, row: 47 }],
    ["one as wide, flush", { cols: 4, rows: 4 }, { col: 70, row: 46 }],
  ])("centres %s and stands it on the slot's floor", (_, size, at) => {
    const lib = {
      ...library({
        a: chunk(50, 50, {
          slots: [{ area: { col: 10, cols: 4, row: 45, rows: 5 }, id: "d", kind: "door" }],
        }),
      }),
      characters: { door: size },
    };
    const area = areaOf(assembleZone(lib, 1, "z", recipe(1, { doors: [{ count: 1, room: "r" }] })));
    const door = area.objects.find(({ character }) => character === "door");
    expect(door && { col: door.col, row: door.row }).toEqual(at);
  });
});

describe("flat recipe chunk pools", () => {
  it("keeps repeated chunk-local orbit references in their own placement", () => {
    const objects = [
      { character: "lift", col: 18, id: "lift", row: 40 },
      {
        character: "hazard",
        col: 26.5,
        id: "hazard",
        orbit: { angularSpeed: 1, host: "lift", phase: 0, radius: 6 },
        row: 40,
      },
    ];
    const lib = library({ a: chunk(50, 50, { objects }), b: chunk(50, 50, { objects }) });
    const area = areaOf(assembleZone(lib, 1, "repeat-orbits", recipe(3)));
    const identified = area.objects.filter(({ id }) => id !== undefined);
    expect(new Set(identified.map(({ id }) => id)).size).toBe(6);
    for (const follower of identified.filter(({ orbit }) => orbit)) {
      const host = identified.find(({ id }) => id === follower.orbit!.host)!;
      expect(host.col - follower.col).toBe(-8.5);
    }
  });
  it.each([0, 1])(
    "restricts the middle pool while preserving encounter quota %s and chunk limits",
    (encounters) => {
      const lib = library({
        a: chunk(50, 50, { maxPerZone: 1 }),
        b: chunk(50, 50),
        enemy: chunk(50, 50, { encounters: 1 }),
        excluded: chunk(50, 50, { weight: 100000 }),
      });
      const selected = recipe(3, { chunks: ["a", "b", "enemy"], encounters });
      const plan = assembleZone(lib, 7, "pool", selected);
      const ids = areaOf(plan).chunks!.map(({ chunk }) => chunk);
      expect(plan).toEqual(assembleZone(lib, 7, "pool", selected));
      expect(Object.keys(plan.areas)).toEqual([ASSEMBLED_AREA]);
      expect(ids[0]).toBe(selected.start);
      expect(ids.at(-1)).toBe(selected.finish);
      expect(ids).not.toContain("excluded");
      expect(ids.filter((id) => id === "a").length).toBeLessThanOrEqual(1);
      expect(ids.reduce((sum, id) => sum + lib.chunks[id]!.encounters, 0)).toBe(encounters);
      expect(ids.every((id, index) => index === 0 || id !== ids[index - 1])).toBe(true);
      expect(areaOf(plan).cols).toBe(selected.length.min);
    },
  );
  it("retains grade weights within the pool and never falls back to excluded chunks", () => {
    const lib = library({
      a: chunk(50, 50),
      b: chunk(50, 50, { difficulty: 2 }),
      excluded: chunk(50, 50, { difficulty: 2, encounters: 1, weight: 100000 }),
    });
    const selected = recipe(1, {
      chunks: ["a", "b"],
      difficulty: { max: 2, min: 1 },
      difficultyWeights: { 1: 0 },
    });
    expect(middleIds(areaOf(assembleZone(lib, 1, "weighted-pool", selected)))).toEqual(["b"]);
    expect(() => assembleZone(lib, 1, "missing-encounter", { ...selected, encounters: 1 })).toThrow(
      "No assembly",
    );
  });
  it.each([1, 7, 42])("keeps legacy implicit-pool results identical for seed %s", (seed) => {
    const lib = library(Object.fromEntries(["z", "a", "m"].map((id) => [id, chunk(50, 50)])));
    const implicit = recipe(3);
    expect(assembleZone(lib, seed, "legacy", implicit)).toEqual(
      assembleZone(lib, seed, "legacy", { ...implicit, chunks: ["a", "m", "z"] }),
    );
  });
  it.each([
    { chunks: [], error: "invalid chunk pool" },
    { chunks: ["a", "a"], error: "invalid chunk pool" },
    { chunks: ["missing"], error: "no chunk missing" },
    { chunks: ["start"], error: "invalid pool chunk start" },
    { chunks: ["finish"], error: "invalid pool chunk finish" },
    { chunks: ["foreign"], error: "invalid pool chunk foreign" },
    { chunks: ["too-wide"], error: "invalid generated width" },
  ])("rejects invalid authored pool $chunks before selection", ({ chunks, error }) => {
    const lib = library({
      a: chunk(50, 50),
      foreign: chunk(50, 50, { theme: "other" }),
      "too-wide": chunk(50, 50, { cols: 121 }),
    });
    const selected = recipe(1, { chunks });
    expect(recipeProblems(lib, selected).join("; ")).toContain(error);
    expect(() => assembleZone(lib, 1, "invalid-pool", selected)).toThrow(error);
  });
});

describe("ordered section assembly", () => {
  const base = library({ a: chunk(50, 50), b: chunk(50, 50) });
  const theme = base.themes.t;
  if (!theme) {
    throw new Error("Missing fixture theme");
  }
  const lib: ChunkLibrary = {
    ...base,
    characters: {
      ...base.characters,
      stairDown: { cols: 4, rows: 6 },
      stairUp: { cols: 4, rows: 6 },
    },
    themes: {
      t: {
        ...theme,
        bindings: {
          ...theme.bindings,
          down: { character: "stairDown" },
          up: { character: "stairUp" },
        },
      },
    },
  };
  const section = (id: string) => ({
    chunks: ["a", "b"],
    difficulty: { max: 1 as const, min: 1 as const },
    doors: [],
    events: [],
    id,
    length: { max: 60, min: 60 },
    spawnCol: 2,
    theme: "t",
  });
  const ordered: OrderedZoneRecipe = {
    finish: "finish",
    sections: [
      { ...section("lobby"), length: { max: 120, min: 120 } },
      section("landing"),
      { ...section("home"), length: { max: 120, min: 120 } },
    ],
    start: "start",
    transitionRoles: { left: "down", right: "up" },
  };
  it("chooses one generated chunk per section, adds only global caps and places directional stairs", () => {
    const plan = assembleZone(lib, 42, "stage", ordered);
    expect(plan).toEqual(assembleZone(lib, 42, "stage", ordered));
    expect(plan.areaOrder).toEqual(["lobby", "landing", "home"]);
    expect(Object.values(plan.areas).map(({ chunks }) => chunks?.length)).toEqual([2, 1, 2]);
    expect(plan.areas.landing?.walkLinks).toEqual({
      left: { area: "lobby", entry: "return" },
      right: { area: "home", entry: "start" },
    });
    expect(
      plan.areas.landing?.objects.filter(({ role }) => role === "down" || role === "up"),
    ).toMatchObject([
      { character: "stairDown", col: 0, row: 44 },
      { character: "stairUp", col: 56, row: 44 },
    ]);
    expect(plan.areas.landing?.entries.return).toEqual({ col: 58, row: 50 });
  });
  it("assembles multiple middles within whole-section bounds without repeating adjacent chunks", () => {
    const longer = {
      ...ordered,
      sections: ordered.sections.map((section, index) => ({
        ...section,
        doors: index === 1 ? [{ count: 2, room: "test" }] : section.doors,
        length: { max: section.length.max + 60, min: section.length.min + 60 },
      })),
    };
    const slots = [
      { area: { col: 10, cols: 4, row: 45, rows: 5 }, id: "door", kind: "door" as const },
    ];
    const withSlots = {
      ...lib,
      chunks: { ...lib.chunks, a: { ...lib.chunks.a!, slots }, b: { ...lib.chunks.b!, slots } },
    };
    const plan = assembleZone(withSlots, 42, "longer", longer);
    const all = Object.values(plan.areas).flatMap((area) =>
      (area.chunks ?? []).map(({ chunk }) => chunk),
    );
    expect(Object.values(plan.areas).map(({ cols }) => cols)).toEqual([180, 120, 180]);
    expect(all.filter((id) => id === ordered.start)).toHaveLength(1);
    expect(all.filter((id) => id === ordered.finish)).toHaveLength(1);
    expect(all.every((id, index) => index === 0 || id !== all[index - 1])).toBe(true);
    expect(plan.areas.landing?.entries.return?.col).toBe(118);
    expect(plan.areas.landing?.slots?.filter(({ fill }) => fill === "test")).toHaveLength(2);
  });
  it("counts both global caps in a one-section stage and enforces global generated limits", () => {
    const one = { ...ordered, sections: [{ ...section("one"), length: { max: 180, min: 180 } }] };
    expect(assembleZone(lib, 42, "one", one).areas.one?.cols).toBe(180);
    expect(() =>
      assembleZone(lib, 42, "short", {
        ...one,
        sections: [{ ...one.sections[0]!, length: { max: 180, min: 120 } }],
      }),
    ).toThrow("must include its caps");
    const limited = {
      ...lib,
      chunks: {
        ...lib.chunks,
        a: { ...lib.chunks.a!, maxPerZone: 1 },
        b: { ...lib.chunks.b!, maxPerZone: 1 },
      },
    };
    expect(() => assembleZone(limited, 42, "limited", ordered)).toThrow("No ordered assembly");
  });
  it("applies difficulty weights to generated pools and rejects invalid weights in either recipe shape", () => {
    const weightedLib = {
      ...lib,
      chunks: { ...lib.chunks, b: { ...lib.chunks.b!, difficulty: 2 as const } },
    };
    const recipe = {
      ...ordered,
      sections: [
        {
          ...section("weighted"),
          difficulty: { max: 2 as const, min: 1 as const },
          difficultyWeights: { 1: 0 },
          length: { max: 180, min: 180 },
        },
      ],
    };
    expect(
      assembleZone(weightedLib, 42, "weighted", recipe).areas.weighted?.chunks?.map(
        ({ chunk }) => chunk,
      ),
    ).toEqual(["start", "b", "finish"]);
    const flat: ZoneRecipe = { ...recipe.sections[0]!, finish: "finish", start: "start" };
    expect(middleIds(areaOf(assembleZone(weightedLib, 42, "flat", flat)))).toEqual(["b"]);
    expect(
      recipeProblems(weightedLib, { ...flat, difficultyWeights: { 1: 0, 2: 0 } }).join(" "),
    ).toContain("exclude every eligible");
    expect(
      recipeProblems(weightedLib, { ...flat, difficultyWeights: { 1: -1 } }).join(" "),
    ).toContain("finite nonnegative");
    expect(() =>
      assembleZone(weightedLib, 42, "invalid", {
        ...recipe,
        sections: [{ ...recipe.sections[0]!, difficultyWeights: { 2: Infinity } }],
      }),
    ).toThrow("finite nonnegative");
  });
  it("carries one quota and cap spacing across all ordered sections", () => {
    const quotaLib = {
      ...lib,
      chunks: {
        ...lib.chunks,
        a: chunk(50, 50, { encounters: 1, maxPerZone: 1, weight: 1000 }),
        finish: chunk(50, 50, { encounters: 1 }),
        start: chunk(50, 50, { encounters: 1 }),
      },
    };
    const recipe = { ...ordered, encounters: 3 };
    const plan = assembleZone(quotaLib, 42, "whole-stage", recipe);
    const ids = plan.areaOrder?.flatMap(
      (id) => plan.areas[id]?.chunks?.map(({ chunk }) => chunk) ?? [],
    );
    expect(ids).toEqual(["start", "b", "a", "b", "finish"]);
  });

  it("carries three quiet chunks across section boundaries and includes hostile global caps", () => {
    const spaced: ChunkLibrary = {
      ...lib,
      chunks: {
        ...lib.chunks,
        a: chunk(50, 50, { encounters: 1, maxPerZone: 1, weight: 1000 }),
        c: chunk(50, 50),
        finish: chunk(50, 50, { encounters: 1 }),
        start: chunk(50, 50, { encounters: 1 }),
      },
    };
    const selected = {
      ...ordered,
      encounters: 3,
      sections: ordered.sections.map((part) => ({
        ...part,
        chunks: ["a", "b", "c"],
        length: { max: 180, min: 180 },
      })),
    };
    const plan = assembleZone(spaced, 42, "ordered-spaced", { ...selected, minEncounterGap: 3 });
    const ids = plan.areaOrder!.flatMap((id) => plan.areas[id]!.chunks!.map(({ chunk }) => chunk));
    expect(plan.areaOrder).toEqual(["lobby", "landing", "home"]);
    expect(ids).toHaveLength(9);
    expect(ids.flatMap((id, index) => (spaced.chunks[id]!.encounters > 0 ? [index] : []))).toEqual([
      0, 4, 8,
    ]);
    expect(assembleZone(spaced, 42, "ordered-legacy", { ...selected, minEncounterGap: 0 })).toEqual(
      assembleZone(spaced, 42, "ordered-legacy", selected),
    );
    expect(() =>
      assembleZone(spaced, 42, "ordered-invalid", { ...selected, minEncounterGap: -1 }),
    ).toThrow("Minimum encounter gap");
  });

  it("requires a quiet chunk across section boundaries only for quota recipes", () => {
    const encounters = {
      ...lib,
      chunks: {
        ...lib.chunks,
        a: chunk(50, 50, { encounters: 1 }),
        b: chunk(50, 50, { encounters: 1 }),
      },
    };
    const pair = { ...ordered, sections: [ordered.sections[0]!, ordered.sections[2]!] };
    expect(assembleZone(encounters, 42, "unconstrained", pair).areaOrder).toEqual([
      "lobby",
      "home",
    ]);
    expect(() => assembleZone(encounters, 42, "adjacent", { ...pair, encounters: 2 })).toThrow(
      "No ordered assembly",
    );
  });

  it("rejects invalid section ids, missing pools and impossible cap seams without searching live physics", () => {
    expect(() =>
      assembleZone(lib, 42, "stage", { ...ordered, sections: [section("same"), section("same")] }),
    ).toThrow("unique");
    expect(() =>
      assembleZone(lib, 42, "stage", {
        ...ordered,
        sections: [{ ...section("one"), chunks: ["missing"] }],
      }),
    ).toThrow("no chunk");
    const badCap = { ...lib, chunks: { ...lib.chunks, finish: chunk(30, 30) } };
    expect(() => assembleZone(badCap, 42, "stage", ordered)).toThrow("No ordered assembly");
  });
});

describe("assembleZoneAvoiding", () => {
  const middles = (plan: ReturnType<typeof assembleZone>) =>
    plan.areas[ASSEMBLED_AREA]!.chunks!.slice(1, -1).map(({ chunk }) => chunk);

  it("assembles as assembleZone with nothing to avoid", () => {
    expect(assembleZoneAvoiding(FIXTURE_LIBRARY, [], 7, "fixture", FIXTURE_RECIPE)).toEqual(
      assembleZone(FIXTURE_LIBRARY, 7, "fixture", FIXTURE_RECIPE),
    );
  });

  it("leaves avoided chunks out while a run fits without them", () => {
    const avoid = middles(assembleZone(FIXTURE_LIBRARY, 7, "fixture", FIXTURE_RECIPE)).slice(0, 1);
    const plan = assembleZoneAvoiding(FIXTURE_LIBRARY, avoid, 7, "fixture", FIXTURE_RECIPE);
    expect(middles(plan).filter((id) => avoid.includes(id))).toEqual([]);
  });

  it("falls back to the whole pool when nothing fits without the avoided chunks", () => {
    const avoid = Object.keys(FIXTURE_LIBRARY.chunks);
    expect(assembleZoneAvoiding(FIXTURE_LIBRARY, avoid, 7, "fixture", FIXTURE_RECIPE)).toEqual(
      assembleZone(FIXTURE_LIBRARY, 7, "fixture", FIXTURE_RECIPE),
    );
  });
});
