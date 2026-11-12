import { isDeepStrictEqual } from "node:util";

import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json" with { type: "json" };
import { type ArtManifest, BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { lookTiles } from "../presentation/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { ASSEMBLED_AREA, assembleZone, themesOf, zonePlanOf } from "../rules/assemble.ts";
import { chunkProblems, recipeProblems } from "../rules/chunk.ts";
import { bindElement } from "../rules/elementBinding.ts";
import { resolveNames, zoneLayout } from "../rules/tiles.ts";
import { standsOn, startZone, stepZone } from "../rules/zone.ts";
import type { Tileset } from "../stage/index.ts";
import { ALL_CHUNKS, ALL_RECIPES, ALL_THEMES, FIXTURE_LIBRARY } from "../testing/chunks.ts";
import { HITBOXES, TILESETS as WALK_TILESETS } from "../testing/walkSuite.ts";
import { ARCHETYPES } from "./archetypes.ts";
import { BIRD } from "./bird.ts";
import { CHARACTERS } from "./characters.ts";
import { ROOMS } from "./rooms.ts";
import { TILE } from "./screen.ts";
import type { ChunkPlan, ZonePlan } from "./types/index.ts";

const CATALOGUE = { archetypes: ARCHETYPES, characters: CHARACTERS };
const ENCOUNTER_ART = new Set(
  (manifestJson as ArtManifest).sprites
    .filter(({ contact }) => contact === "silhouette")
    .map(({ key }) => key),
);
const TILESETS = import.meta.glob<Tileset>("../../public/art/tilesets/*.json", {
  eager: true,
  import: "default",
});

// A chunk 60 wide whose ground is at row 50 at both edges, with extra placed on it.
function seamCase(extra: Partial<ChunkPlan>): ChunkPlan {
  return {
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    solids: [{ col: 0, cols: 60, look: "ground", row: 50, rows: 10 }],
    theme: "test",
    ...extra,
  };
}

function distinctInputs<T>(inputOf: (subject: T) => unknown, subjects: readonly T[]): T[] {
  const seen: unknown[] = [];
  return subjects.filter((subject) => {
    const input = inputOf(subject);
    if (seen.some((previous) => isDeepStrictEqual(previous, input))) {
      return false;
    }
    seen.push(input);
    return true;
  });
}

const TILE_THEMES = distinctInputs(([, theme]) => [theme.tileset, theme.looks], ALL_THEMES);
const BACKDROP_THEMES = distinctInputs(
  ([, theme]) =>
    [
      ...new Set(
        theme.backdrops.map(
          (backdrop) => bindElement(theme.bindings, { ...backdrop, col: 0 }).character,
        ),
      ),
    ].sort(),
  ALL_THEMES.filter(([, theme]) => theme.backdrops.length > 0),
);
const DOOR_THEMES = distinctInputs(
  ([, theme]) => theme.bindings[theme.door]?.character,
  ALL_THEMES,
);
const LIBRARIES = [...new Set(ALL_CHUNKS.map(([, library]) => library))];
const RULE_CHUNKS = distinctInputs(
  ([, library, chunk]) => [LIBRARIES.indexOf(library), chunk],
  ALL_CHUNKS,
);

it.each(TILE_THEMES)(
  "theme %s draws from a tileset art has, with every look's tiles, or from a placeholder drawn flat",
  (_, theme) => {
    if (theme.tileset.startsWith("placeholder-")) {
      return;
    }
    const tileset = TILESETS[`../../public/art/tilesets/${theme.tileset}.json`];
    expect(tileset, theme.tileset).toBeDefined();
    const missing = Object.values(theme.looks).flatMap((look) =>
      lookTiles(look).filter((name) => !(tileset && name in tileset.tiles)),
    );
    expect(missing).toEqual([]);
  },
);

it.each(BACKDROP_THEMES)(
  "theme %s draws each backdrop from a character that exists",
  (_, theme) => {
    expect(
      theme.backdrops
        .map((backdrop) => bindElement(theme.bindings, { ...backdrop, col: 0 }))
        .filter(({ character }) => !(character in CHARACTERS)),
    ).toEqual([]);
  },
);

it.each(DOOR_THEMES)(
  "theme %s places doors as a character whose archetype is a door",
  (_, theme) => {
    const character = theme.bindings[theme.door]?.character;
    expect(character && CHARACTERS[character]?.archetype, theme.door).toBe("door");
  },
);

describe.each(RULE_CHUNKS)("chunk %s", (_, library, chunk) => {
  it("keeps the chunk rules and the seam rule", () => {
    expect(chunkProblems(library, CATALOGUE, chunk)).toEqual([]);
  });

  if ((chunk.slots ?? []).some(({ kind }) => kind === "door")) {
    it("fits each of its themes' doors in each door slot", () => {
      const tooSmall = themesOf(chunk).flatMap((key) => {
        const theme = library.themes[key];
        const door = CHARACTERS[theme?.bindings[theme.door]?.character ?? ""];
        return (chunk.slots ?? [])
          .filter(
            ({ area, kind }) =>
              kind === "door" && (!door || area.cols < door.cols || area.rows < door.rows),
          )
          .map(({ id }) => `${id} for ${key}`);
      });
      expect(tooSmall).toEqual([]);
    });
  }
});

it("supports ordinary room doors without intersecting terrain or platforms", () => {
  const roomSlots = new Set([
    "apartment-room",
    "country-room",
    "depot-room",
    "encounter-room",
    "loading-room",
  ]);
  let checked = 0;
  for (const [id, library, chunk] of ALL_CHUNKS) {
    for (const slot of chunk.slots ?? []) {
      if (slot.kind !== "door" || !roomSlots.has(slot.id)) {
        continue;
      }
      for (const key of themesOf(chunk)) {
        const theme = library.themes[key]!;
        const door = CHARACTERS[theme.bindings[theme.door]!.character]!;
        const rect = {
          col: slot.area.col + (slot.area.cols - door.cols) / 2,
          cols: door.cols,
          row: slot.area.row + slot.area.rows - door.rows,
          rows: door.rows,
        };
        const label = `${id}/${slot.id}/${key}`;
        expect(slot.area.cols, label).toBeGreaterThanOrEqual(door.cols);
        expect(slot.area.rows, label).toBeGreaterThanOrEqual(door.rows);
        const platforms = chunk.objects.flatMap((object) => {
          const instance = bindElement(theme.bindings, object);
          const character = CHARACTERS[instance.character ?? ""];
          const collision = character && ARCHETYPES[character.archetype]?.collision;
          return character && (collision === "solid" || collision === "ledge")
            ? [
                {
                  col: instance.col,
                  cols: instance.cols ?? character.cols,
                  row: instance.row,
                  rows: instance.rows ?? character.rows,
                },
              ]
            : [];
        });
        expect(
          [...chunk.solids, ...platforms].filter(
            (solid) =>
              rect.col < solid.col + solid.cols &&
              rect.col + rect.cols > solid.col &&
              rect.row < solid.row + solid.rows &&
              rect.row + rect.rows > solid.row,
          ),
          label,
        ).toEqual([]);
        expect(
          chunk.solids.some(
            (solid) =>
              solid.row === rect.row + rect.rows &&
              solid.col <= rect.col &&
              solid.col + solid.cols >= rect.col + rect.cols,
          ),
          label,
        ).toBe(true);
        checked++;
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
});

describe("the seam rule", () => {
  it.each<[string, Partial<ChunkPlan>, string]>([
    [
      "a gap within the footing",
      { solids: [{ col: 2, cols: 58, look: "ground", row: 50, rows: 10 }] },
      "entry: no terrain top at row 50 in cols 0, 1",
    ],
    [
      "terrain within the headroom",
      {
        solids: [
          { col: 0, cols: 60, look: "ground", row: 50, rows: 10 },
          { col: 56, cols: 4, look: "ground", row: 45, rows: 1 },
        ],
      },
      "exit: terrain within 6 rows above the seam",
    ],
    [
      "a hazard at the seam",
      { objects: [{ character: "test-hazard", col: 3, row: 49 }] },
      "entry: hazard test-hazard at col 3 row 49 at the seam",
    ],
    [
      "a mover's path through the seam",
      {
        objects: [
          {
            character: "test-mover",
            col: 10,
            overrides: { motion: { direction: "left", distance: 8 } },
            row: 47,
          },
        ],
      },
      "entry: test-mover at col 10 row 47 moves through the seam",
    ],
    [
      "a graph-driven mover's path through the seam",
      {
        objects: [
          {
            behaviour: {
              axis: "x",
              distance: -8,
              initial: "move",
              states: {
                move: {
                  animation: null,
                  motion: { direction: -1, kind: "move", speed: 1 },
                  transitions: [],
                },
              },
            },
            character: "test-mover",
            col: 10,
            row: 47,
          },
        ],
      },
      "entry: test-mover at col 10 row 47 moves through the seam",
    ],
    ["a seam off the seam rows", { exit: { row: 45 as 50 } }, "exit row 45 is not a seam row"],
  ])("refuses %s", (_, extra, problem) => {
    expect(chunkProblems(FIXTURE_LIBRARY, CATALOGUE, seamCase(extra))).toContain(problem);
  });
});

describe.each(ALL_RECIPES)("recipe %s", (key, library, recipe) => {
  const chunkAt = (id: string) => library.chunks[id] as ChunkPlan;
  let assembled: ZonePlan | undefined;
  const plan = () => (assembled ??= assembleZone(library, 1, key, recipe));

  it("names a theme and start and finish chunks that exist, and fits them", () => {
    expect(recipeProblems(library, recipe)).toEqual([]);
  });

  it("starts and finishes on its chunks, joined where their seams meet, never one twice in a row", () => {
    const layout = plan();
    const areas = (layout.areaOrder ?? Object.keys(layout.areas)).map((id) => layout.areas[id]!);
    const ids = areas.flatMap((area) => (area.chunks ?? []).map(({ chunk }) => chunk));
    expect([ids[0], ids.at(-1)]).toEqual([recipe.start, recipe.finish]);
    for (const area of areas) {
      const local = (area.chunks ?? []).map(({ chunk }) => chunk);
      local.slice(1).forEach((id, index) => {
        const prev = local[index] as string;
        expect(id, `${prev} then ${id}`).not.toBe(prev);
        expect(chunkAt(prev).exit.row, `${prev} into ${id}`).toBe(chunkAt(id).entry.row);
      });
    }
  });

  it("fits its length, difficulty band and encounter quota and keeps each chunk's maxPerZone", () => {
    if (recipe.encounters !== undefined) {
      const encounters = Object.values(plan().areas).flatMap(({ objects }) =>
        objects.filter((instance) => {
          const { archetype, character } = resolveNames(CATALOGUE, instance);
          return (
            archetype.collision === "hazard" &&
            ENCOUNTER_ART.has(character.art) &&
            (instance.behaviour ?? character.behaviour) !== undefined
          );
        }),
      );
      expect(encounters).toHaveLength(recipe.encounters);
    }
    if ("sections" in recipe) {
      expect(plan().areaOrder).toEqual(recipe.sections.map(({ id }) => id));
      const counts = new Map<string, number>();
      recipe.sections.forEach((section, index) => {
        const area = plan().areas[section.id];
        const placed = area?.chunks ?? [];
        expect(area?.cols).toBeGreaterThanOrEqual(section.length.min);
        expect(area?.cols).toBeLessThanOrEqual(section.length.max);
        const capStart = index === 0 ? 1 : 0;
        const capEnd = index === recipe.sections.length - 1 ? 1 : 0;
        const middle = placed.slice(capStart, placed.length - capEnd);
        expect(middle.length).toBeGreaterThanOrEqual(1);
        for (const { chunk } of middle) {
          counts.set(chunk, (counts.get(chunk) ?? 0) + 1);
          expect(section.chunks).toContain(chunk);
          expect(chunkAt(chunk).difficulty).toBeGreaterThanOrEqual(section.difficulty.min);
          expect(chunkAt(chunk).difficulty).toBeLessThanOrEqual(section.difficulty.max);
        }
      });
      expect(
        [...counts].filter(([id, count]) => count > (chunkAt(id).maxPerZone ?? count)),
      ).toEqual([]);
      return;
    }
    const area = plan().areas[ASSEMBLED_AREA];
    const placed = area?.chunks ?? [];
    const total = area?.cols ?? 0;
    expect(total).toBeGreaterThanOrEqual(recipe.length.min);
    expect(total).toBeLessThanOrEqual(recipe.length.max);
    const off = placed.slice(1, -1).filter(({ chunk }) => {
      const { difficulty } = chunkAt(chunk);
      return difficulty < recipe.difficulty.min || difficulty > recipe.difficulty.max;
    });
    expect(off).toEqual([]);
    const counts = new Map<string, number>();
    for (const { chunk } of placed.slice(1, -1)) {
      counts.set(chunk, (counts.get(chunk) ?? 0) + 1);
    }
    const over = [...counts].filter(([id, count]) => count > (chunkAt(id).maxPerZone ?? count));
    expect(over).toEqual([]);
  });

  it("asks for doors only to rooms that exist", () => {
    const sections = "sections" in recipe ? recipe.sections : [recipe];
    expect(sections.flatMap(({ doors }) => doors).filter(({ room }) => !(room in ROOMS))).toEqual(
      [],
    );
  });

  it("places every event and door it asks for in a slot of that kind", () => {
    const sections = "sections" in recipe ? recipe.sections : [{ ...recipe, id: ASSEMBLED_AREA }];
    for (const section of sections) {
      const wanted = [
        ...section.events.flatMap(({ count, id }) => Array<string>(count).fill(`event ${id}`)),
        ...section.doors.flatMap(({ count, room }) => Array<string>(count).fill(`door ${room}`)),
      ].sort();
      const placed = (plan().areas[section.id]?.slots ?? []).flatMap(({ fill, kind }) =>
        fill === undefined ? [] : [`${kind} ${fill}`],
      );
      expect(placed.sort()).toEqual(wanted);
    }
  });
});

it("bounds the wide reachable fixture with an ordinary running jump", () => {
  const source = FIXTURE_LIBRARY.chunks["test-wide-50"]!;
  const near = source.solids[0]!;
  const outcomes = [0, 1].map((extraGap) => {
    const col = source.solids[1]!.col + extraGap;
    const gap = col - near.col - near.cols;
    const chunk = {
      ...source,
      solids: [near, { ...source.solids[1]!, col, cols: source.cols - col }],
    };
    const library = { ...FIXTURE_LIBRARY, chunks: { wide: chunk } };
    const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "test", 2, ["wide"]);
    const layout = zoneLayout(
      TILE,
      BIRD_FRAME,
      CATALOGUE,
      HITBOXES,
      WALK_TILESETS,
      new Set(),
      plan,
    );
    const far = layout.areas.main!.solids[1]!;
    let zone = startZone(BIRD, layout, 1);
    let jumped = false;
    let landed = false;
    let usedAirJump = false;
    let ticks = 0;
    for (; ticks < 600 && !zone.death && !zone.cleared; ticks++) {
      jumped ||=
        !zone.bird.grounded && zone.bird.coyoteLeft > 0 && zone.bird.coyoteLeft <= 2 * STEP_SECONDS;
      zone = stepZone(
        SKILL_PROFILES,
        BIRD,
        layout,
        STEP_SECONDS,
        { jumpHeld: jumped, move: 1, useHeld: false },
        zone,
      );
      usedAirJump ||= zone.bird.airJumpUsed;
      landed ||= zone.bird.grounded && standsOn(BIRD, zone.bird, far);
    }
    expect(jumped).toBe(true);
    expect(usedAirJump).toBe(false);
    return { cleared: zone.cleared, death: zone.death?.reason, gap, landed, ticks };
  });
  console.info("Wide fixture ordinary jump outcomes", outcomes);
  expect(outcomes[0]!.landed).toBe(true);
  expect(outcomes[0]!.cleared).toBe(true);
  expect(outcomes[1]!.landed).toBe(false);
  expect(outcomes[1]!.cleared).toBe(false);
  expect(outcomes[1]!.death).toBe("fall");
});
