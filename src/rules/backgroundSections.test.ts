import { expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { BIRD } from "../data/bird";
import type { Archetype, BackgroundSection, ChunkPlan, ThemePlan, ZoneRecipe } from "../data/types";
import { chunkBackdropSpan } from "../presentation";
import { assembleZone, type ChunkLibrary } from "./assemble";
import { withBackgroundSections } from "./backgroundSections";
import { objectLayout, zoneLayout } from "./tiles";
import { enterArea, retryZone, startZone, stepZone } from "./zone";

const section = (cols: number, key: string): BackgroundSection => ({
  backdrops: [
    { character: "far", parallax: { x: 0.15, y: 0.05 }, row: 0, skin: { art: key, tileset: null } },
  ],
  cols,
});
const theme: ThemePlan = {
  backdrops: [{ character: "sky", row: 0 }],
  bindings: { door: { character: "door" } },
  door: "door",
  looks: { ground: "ground" },
  tileset: "fixture",
};
const chunk: ChunkPlan = {
  cols: 60,
  difficulty: 1,
  encounters: 0,
  entry: { row: 50 },
  exit: { row: 50 },
  objects: [{ character: "mover", col: 10, row: 40 }],
  slots: [{ area: { col: 4, cols: 2, row: 46, rows: 4 }, id: "door", kind: "door" }],
  solids: [{ col: 0, cols: 60, look: "ground", row: 50, rows: 10 }],
  theme: "t",
};
const backgrounds = { a: section(7, "a"), b: section(11, "b"), c: section(13, "c") };
const characters = {
  door: { archetype: "door", art: "door", cols: 2, rows: 4 },
  far: { archetype: "scenery", art: "far", cols: 60, rows: 50 },
  mover: { archetype: "mover", art: "mover", cols: 2, rows: 2 },
  sky: { archetype: "scenery", art: "sky", cols: 4, rows: 50 },
};
const library: ChunkLibrary = {
  backgrounds,
  characters,
  chunks: { a: chunk, b: chunk, finish: chunk, start: chunk },
  rows: 60,
  rules: { cols: { max: 60, min: 60 }, footing: 4, headroom: 6 },
  seams: [50],
  themes: { t: theme },
};
const recipe: ZoneRecipe = {
  chunks: ["a", "b"],
  difficulty: { max: 1, min: 1 },
  doors: [{ count: 1, room: "test" }],
  events: [],
  finish: "finish",
  length: { max: 240, min: 240 },
  spawnCol: 2,
  start: "start",
  theme: "t",
};
const profile = {
  sections: ["a", "b", "c"],
  weather: [{ character: "sky", parallax: { x: 0, y: 0 }, row: 0 }],
};
const depthLibrary: ChunkLibrary = { ...library, themes: { t: { ...theme, background: profile } } };
const staticScenery: Archetype = {
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
const catalogue = {
  archetypes: {
    door: { ...staticScenery, collision: "use" as const },
    mover: {
      ...staticScenery,
      motion: {
        ...staticScenery.motion,
        algorithm: "linear" as const,
        distance: 4,
        speed: 2,
        variance: 0.1,
      },
    },
    scenery: staticScenery,
  },
  characters,
};

it("appends background coverage without changing terrain, slots, indices or physical motion seeds", () => {
  const plain = assembleZone(library, 1, "stage", recipe);
  const layered = assembleZone(depthLibrary, 1, "stage", recipe);
  const original = plain.areas.main!;
  const area = layered.areas.main!;
  expect({ ...area, objects: area.objects.slice(0, original.objects.length) }).toEqual(original);
  expect(layered.start).toEqual(plain.start);
  expect(
    area.objects
      .slice(original.objects.length)
      .every((object) => object.backdropExtendBottom === true),
  ).toBe(true);
  expect(original.objects.every((object) => object.backdropExtendBottom === undefined)).toBe(true);
  const before = startZone(
    BIRD,
    zoneLayout(12, BIRD_FRAME, catalogue, {}, {}, new Set(), plain),
    1,
  );
  const resolved = zoneLayout(12, BIRD_FRAME, catalogue, {}, {}, new Set(), layered);
  expect(
    resolved.areas
      .main!.objects.slice(before.objects.length)
      .every((object) => object.backdropExtendBottom === true),
  ).toBe(true);
  const after = startZone(BIRD, resolved, 1);
  expect(after.objects.slice(0, before.objects.length)).toEqual(before.objects);
  before.tracks.forEach((track, index) => expect(after.tracks[index]!.at(1)).toEqual(track.at(1)));
});
it("replays a separate background stream and covers the final partial section without gaps", () => {
  const original = assembleZone(library, 1, "stage", recipe).areas.main!;
  const first = assembleZone(depthLibrary, 1, "stage", recipe);
  expect(assembleZone(depthLibrary, 1, "stage", recipe)).toEqual(first);
  const generated = first.areas.main!.objects.slice(original.objects.length);
  expect(generated.filter(({ character }) => character === "sky")).toEqual([
    { ...profile.weather[0]!, backdropExtendBottom: true, backdropSpan: true, col: 0, cols: 240 },
  ]);
  const pieces = generated.filter(({ character }) => character === "far");
  let edge = 0;
  for (const piece of pieces) {
    expect(piece.col).toBe(edge);
    expect(piece.cols).toBeGreaterThan(0);
    edge += piece.cols!;
  }
  expect(edge).toBe(first.areas.main!.cols);
  const other = assembleZone(depthLibrary, 2, "stage", recipe).areas.main!.objects.slice(
    original.objects.length,
  );
  expect(other.map(({ skin }) => skin?.art)).not.toEqual(generated.map(({ skin }) => skin?.art));
  expect(other[0]).toEqual(generated[0]);
});
it("clips an explicit background span independently of terrain chunk boundaries", () => {
  const plan = assembleZone(depthLibrary, 1, "stage", recipe);
  const area = zoneLayout(12, BIRD_FRAME, catalogue, {}, {}, new Set(), plan).areas.main!;
  const pieces = area.objects.filter(({ backdropSpan }) => backdropSpan);
  expect(pieces.length).toBeGreaterThan(1);
  for (const object of pieces) {
    expect(chunkBackdropSpan(area, object)).toEqual({ width: object.width, x: object.origin.x });
  }
});
it.each([
  { background: { ...profile, sections: [] }, backgrounds },
  { background: { ...profile, sections: ["absent"] }, backgrounds },
  { background: { ...profile, sections: ["a", "a"] }, backgrounds },
  { background: profile, backgrounds: { ...backgrounds, a: section(0, "invalid") } },
  { background: profile, backgrounds: { ...backgrounds, a: { backdrops: [], cols: 7 } } },
])("rejects an invalid selected profile or section %#", ({ background, backgrounds }) => {
  expect(() =>
    assembleZone(
      { ...library, backgrounds, themes: { t: { ...theme, background } } },
      1,
      "stage",
      recipe,
    ),
  ).toThrow(/background/);
});
it("rejects physical characters as backdrop spans even at world scroll speed", () => {
  expect(() =>
    objectLayout(
      12,
      catalogue,
      {},
      undefined,
      {},
      { backdropSpan: true, character: "mover", col: 0, row: 0 },
    ),
  ).toThrow(/nonphysical static scenery/);
});

it("appends section-area coverage after physical transition markers in ordered stages", () => {
  const section = {
    chunks: ["a", "b"],
    difficulty: recipe.difficulty,
    doors: [],
    events: [],
    length: { max: 120, min: 120 },
    spawnCol: 2,
    theme: "t",
  };
  const ordered = {
    finish: "finish",
    sections: [
      { ...section, id: "first" },
      { ...section, id: "last" },
    ],
    start: "start",
    transitionRoles: { left: "door", right: "door" },
  };
  const plain = assembleZone(library, 1, "ordered", ordered);
  const decorated = assembleZone(depthLibrary, 1, "ordered", ordered);
  expect(decorated.areaOrder).toEqual(plain.areaOrder);
  for (const id of plain.areaOrder!) {
    const old = plain.areas[id]!;
    const current = decorated.areas[id]!;
    expect({ ...current, objects: current.objects.slice(0, old.objects.length) }).toEqual(old);
    const weather = current.objects[old.objects.length]!;
    expect(weather).toMatchObject({ backdropSpan: true, col: 0, cols: current.cols });
  }
});

it("preserves complete authored depth stacks and fills only their uncovered horizontal complement", () => {
  const plain = assembleZone(library, 1, "stage", recipe);
  const authored = [
    { character: "sky", col: 60, cols: 30, parallax: { x: 0, y: 0 }, row: 0 },
    {
      character: "far",
      col: 60,
      cols: 30,
      parallax: { x: 0.15, y: 0.05 },
      row: 0,
      skin: { art: "authored-birch", tileset: null },
    },
  ];
  const area = { ...plain.areas.main!, objects: [...plain.areas.main!.objects, ...authored] };
  const plan = { ...plain, areas: { main: area } };
  const result = withBackgroundSections(depthLibrary, 1, "stage", { main: "t" }, plan).areas.main!;
  expect(result.objects.slice(0, area.objects.length)).toEqual(area.objects);
  const generated = result.objects.slice(area.objects.length);
  expect(
    generated
      .filter(({ character }) => character === "sky")
      .map(({ col, cols }) => ({ col, cols })),
  ).toEqual([
    { col: 0, cols: 60 },
    { col: 90, cols: 150 },
  ]);
  for (const piece of generated) {
    expect(piece.col + piece.cols! <= 60 || piece.col >= 90).toBe(true);
  }
  const full = assembleZone(depthLibrary, 1, "stage", recipe).areas.main!.objects.filter(
    ({ backdropSpan, character }) => backdropSpan && character === "far",
  );
  for (const piece of generated.filter(({ character }) => character === "far")) {
    expect(
      full.some(
        (original) =>
          original.skin?.art === piece.skin?.art &&
          original.col <= piece.col &&
          original.col + original.cols! >= piece.col + piece.cols!,
      ),
    ).toBe(true);
  }
});

it("resolves a named backdrop ground anchor and rejects an absent entry", () => {
  const plan = assembleZone(depthLibrary, 1, "stage", recipe);
  const withAnchor = (entry: string): typeof plan => ({
    ...plan,
    areas: {
      ...plan.areas,
      main: {
        ...plan.areas.main!,
        objects: plan.areas.main!.objects.map((object) =>
          object.backdropSpan ? { ...object, groundAnchor: entry } : object,
        ),
      },
    },
  });
  const layout = zoneLayout(12, BIRD_FRAME, catalogue, {}, {}, new Set(), withAnchor("start"));
  expect(
    layout.areas
      .main!.objects.filter((object) => object.backdropSpan)
      .every((object) => object.groundAnchor === "start"),
  ).toBe(true);
  expect(() =>
    zoneLayout(12, BIRD_FRAME, catalogue, {}, {}, new Set(), withAnchor("missing")),
  ).toThrow(/ground anchor entry missing/);
});

it("resolves an interior plane only from an explicit static rectangle and named entry", () => {
  const instance = {
    backdropPlane: "interior" as const,
    backdropSpan: true,
    character: "far",
    col: 2,
    cols: 3,
    groundAnchor: "start",
    row: 4,
    rows: 5,
  };
  const object = objectLayout(12, catalogue, {}, undefined, {}, instance);
  expect(object.backdropExtendBottom).toBeUndefined();
  expect(() =>
    objectLayout(
      12,
      catalogue,
      {},
      undefined,
      {},
      { backdropExtendBottom: true, character: "far", col: 0, row: 0 },
    ),
  ).toThrow(/outdoor backdrop span/);
  expect(object).toMatchObject({
    backdropPlane: "interior",
    height: 60,
    origin: { x: 24, y: 48 },
    width: 36,
  });
  expect(() =>
    objectLayout(12, catalogue, {}, undefined, {}, { ...instance, backdropExtendBottom: true }),
  ).toThrow(/outdoor backdrop span/);
  expect(() => objectLayout(12, catalogue, {}, undefined, {}, { ...instance, cols: 0 })).toThrow(
    /explicit rectangle/,
  );
  const withoutRows = { ...instance };
  delete (withoutRows as { rows?: number }).rows;
  expect(() => objectLayout(12, catalogue, {}, undefined, {}, withoutRows)).toThrow(
    /explicit rectangle/,
  );
});

it("derives scenery provenance after physical objects and preserves it through placement filtering", () => {
  const decorated = {
    ...library,
    chunks: Object.fromEntries(
      Object.entries(library.chunks).map(([key, chunk]) => [
        key,
        {
          ...chunk,
          objects: chunk.objects.map((instance) => ({ ...instance, requires: ["hidden"] })),
          scenery: [{ character: "far", col: 8, row: 30 }],
        },
      ]),
    ),
  };
  const plan = assembleZone(decorated, 1, "stage", recipe);
  const area = plan.areas.main!;
  const source = new Set(area.sceneryIndices);
  expect(source.size).toBe(area.chunks!.length);
  expect(
    area.objects
      .filter((_, index) => source.has(index))
      .every(({ character }) => character === "far"),
  ).toBe(true);
  const layout = zoneLayout(12, BIRD_FRAME, catalogue, {}, {}, new Set(), plan);
  expect(
    layout.areas.main!.objects.filter(({ scenerySource }) => scenerySource === "chunk"),
  ).toHaveLength(source.size);
  expect(
    layout.areas
      .main!.objects.filter(({ scenerySource }) => scenerySource === "chunk")
      .every(({ character }) => character === "far"),
  ).toBe(true);
  expect(layout.areas.main!.objects.some(({ character }) => character === "mover")).toBe(false);
});
it.each(["linear", "hop"] as const)(
  "keeps autonomous %s decorative tracks independent of Chibi reversals",
  (algorithm) => {
    const decorated = {
      ...library,
      chunks: Object.fromEntries(
        Object.entries(library.chunks).map(([key, chunk]) => [
          key,
          {
            ...chunk,
            scenery: [{ character: "mover", col: 8, row: 30 }],
          },
        ]),
      ),
    };
    const plan = assembleZone(decorated, 1, "stage", recipe);
    const autonomous = {
      ...catalogue,
      archetypes: {
        ...catalogue.archetypes,
        mover: {
          ...catalogue.archetypes.mover,
          motion: { ...catalogue.archetypes.mover.motion, algorithm, hopHeight: 2 },
        },
      },
    };
    const layout = zoneLayout(12, BIRD_FRAME, autonomous, {}, {}, new Set(), plan);
    const index = layout.areas.main!.objects.findIndex(
      ({ scenerySource }) => scenerySource === "chunk",
    );
    let left = startZone(BIRD, layout, 1),
      right = startZone(BIRD, layout, 1);
    left = { ...left, bird: { ...left.bird, x: 200 } };
    right = { ...right, bird: { ...right.bird, x: 200 } };
    for (let tick = 0; tick < 3; tick++) {
      left = stepZone(BIRD, layout, 1 / 120, { jumpHeld: false, move: -1, useHeld: false }, left);
      right = stepZone(BIRD, layout, 1 / 120, { jumpHeld: false, move: 1, useHeld: false }, right);
    }
    expect(left.seconds).toBe(right.seconds);
    expect(left.bird.x).not.toBe(right.bird.x);
    expect(left.objects[index]).toEqual(right.objects[index]);
    expect(left.objects[index]).not.toEqual(layout.areas.main!.objects[index]!.origin);
  },
);

it("activates finite fauna only on actual view, freezes under room covers and resets on Retry or area entry", () => {
  const decorated = {
    ...library,
    chunks: Object.fromEntries(
      Object.entries(library.chunks).map(([key, chunk]) => [
        key,
        {
          ...chunk,
          scenery: [
            {
              character: "mover",
              col: 100,
              overrides: { motion: { playback: "once-visible" as const } },
              row: 40,
            },
          ],
        },
      ]),
    ),
  };
  const layout = zoneLayout(
    12,
    BIRD_FRAME,
    catalogue,
    {},
    {},
    new Set(),
    assembleZone(decorated, 1, "stage", recipe),
  );
  const index = layout.areas.main!.objects.findIndex(
    ({ scenerySource }) => scenerySource === "chunk",
  );
  const initial = startZone(BIRD, layout, 1);
  const unseen = stepZone(
    BIRD,
    layout,
    1 / 120,
    { jumpHeld: false, move: 0, useHeld: false },
    initial,
  );
  expect(unseen.sceneryPlayback![index]).toEqual({ elapsedSeconds: 0, status: "waiting" });
  expect(unseen.objects[index]).toEqual(initial.objects[index]);
  const visible = stepZone(
    BIRD,
    layout,
    1 / 120,
    { jumpHeld: false, move: 0, useHeld: false },
    { ...unseen, bird: { ...unseen.bird, x: 1200 } },
  );
  expect(visible.sceneryPlayback![index]!.status).toBe("active");
  expect(visible.objects[index]).not.toEqual(initial.objects[index]);
  const covered = { ...visible, door: 0 };
  expect(stepZone(BIRD, layout, 1, { jumpHeld: false, move: 0, useHeld: false }, covered)).toBe(
    covered,
  );
  expect(enterArea(BIRD, layout, layout.start, visible).sceneryPlayback).toBeUndefined();
  const failed = {
    ...visible,
    death: {
      position: { x: visible.bird.x, y: visible.bird.y },
      reason: "fall" as const,
      support: undefined,
      velocity: { x: 0, y: 0 },
    },
  };
  expect(retryZone(BIRD, layout, failed).sceneryPlayback).toBeUndefined();
  expect(retryZone(BIRD, layout, failed).attempt).toBe(initial.attempt + 1);
});

it.each([
  { phase: 0.5 },
  { overrides: { motion: { pause: 1 } } },
  { overrides: { motion: { algorithm: "static" as const } } },
  { overrides: { motion: { distance: 0 } } },
])("rejects incompatible finite scenery playback %j", (change) => {
  const base = {
    character: "mover",
    col: 8,
    overrides: { motion: { playback: "once-visible" as const } },
    row: 30,
  };
  const instance = {
    ...base,
    ...change,
    overrides: { motion: { ...base.overrides.motion, ...change.overrides?.motion } },
  };
  const decorated = {
    ...library,
    chunks: Object.fromEntries(
      Object.entries(library.chunks).map(([key, chunk]) => [
        key,
        { ...chunk, scenery: [instance] },
      ]),
    ),
  };
  const plan = assembleZone(decorated, 1, "stage", recipe);
  expect(() => zoneLayout(12, BIRD_FRAME, catalogue, {}, {}, new Set(), plan)).toThrow(
    /Finite scenery playback/,
  );
});
