import { isDeepStrictEqual } from "node:util";

import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { type ArtManifest, BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { lookTiles } from "../presentation";
import { ASSEMBLED_AREA, assembleZone, themesOf, zonePlanOf } from "../rules/assemble";
import { contactBox } from "../rules/behaviour";
import { chunkProblems, recipeProblems } from "../rules/chunk";
import { bindElement } from "../rules/elementBinding";
import { resolveNames, zoneLayout } from "../rules/tiles";
import { standsOn, startZone, stepZone } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import type { Tileset } from "../stage";
import { ALL_CHUNKS, ALL_RECIPES, ALL_THEMES, FIXTURE_LIBRARY } from "../testing/chunks";
import { HITBOXES, TILESETS as WALK_TILESETS } from "../testing/walkSuite";
import { ARCHETYPES } from "./archetypes";
import { BIRD } from "./bird";
import { CHARACTERS } from "./characters";
import { ROOMS } from "./rooms";
import { TILE } from "./screen";
import type { ChunkPlan, ZonePlan } from "./types";
import { RECIPES, ZONES } from "./zones";

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

describe("the recipes", () => {
  it("never share a key with a hand-built zone", () => {
    expect(Object.keys(RECIPES).filter((key) => key in ZONES)).toEqual([]);
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

it.each([
  {
    budget: 720,
    id: "apartment-tall-city-boundary-climb-yard",
    route: [
      [9, 45],
      [15, 40],
      [19, 34],
      [25, 40],
      [37, 36],
      [44, 40],
      [50, 34],
      [56.5, 40],
    ],
    theme: "apartment-lobby",
    underpass: 4,
  },
  {
    budget: 600,
    id: "growl-clearing-woodland-depth",
    route: [
      [14, 34],
      [30, 34],
      [46, 34],
      [53, 40],
    ],
    theme: "forest-paths",
    underpass: undefined,
  },
])(
  "crosses actual $id through its grounded refuges without movement abilities",
  ({ budget, id, route, theme, underpass }) => {
    const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, theme, 2, [id]);
    const layout = zoneLayout(
      TILE,
      BIRD_FRAME,
      CATALOGUE,
      HITBOXES,
      WALK_TILESETS,
      new Set(),
      plan,
    );
    const startObjects = layout.areas[layout.start.area]!.objects;
    const pursuer = startObjects.findIndex((object) => object.behaviour?.pursuit);
    const ordinary = { ...BIRD, doubleJump: false };
    delete ordinary.dash;
    let zone = startZone(ordinary, layout, 1);
    let targetIndex = 0;
    let jumpStart = -1000;
    let previousJump = false;
    let pursuerX = Infinity;
    let pursuerLeapedWest = false;
    const trace: unknown[] = [];
    for (let tick = 0; tick < budget && !zone.death && !zone.cleared; tick++) {
      const target = route[targetIndex];
      const feet = zone.bird.y + BIRD.height;
      if (
        target &&
        zone.bird.grounded &&
        Math.abs(feet - target[1]! * TILE) < 0.1 &&
        Math.abs(zone.bird.x / TILE - target[0]!) < 1.5
      ) {
        trace.push({ feet, reached: targetIndex, tick, x: zone.bird.x });
        targetIndex++;
      }
      const goal = route[targetIndex];
      const dx = goal ? goal[0]! * TILE - zone.bird.x : 100;
      const braking = (zone.bird.vx * Math.abs(zone.bird.vx)) / (2 * BIRD.brakeAccel);
      let move: -1 | 0 | 1 = Math.abs(dx - braking) < 2 ? 0 : dx - braking > 0 ? 1 : -1;
      let needsJump =
        goal &&
        (feet > goal[1]! * TILE + 0.1 ||
          (Math.abs(feet - goal[1]! * TILE) < 0.1 && Math.abs(dx) > 3 * TILE));
      const pursuerAt = pursuer < 0 ? undefined : zone.objects[pursuer];
      const pursuerState = pursuer < 0 ? undefined : zone.behaviours?.[pursuer];
      if (pursuerAt) {
        // The pursuer has committed to a westward leap once it is airborne and its x decreases.
        pursuerLeapedWest ||=
          pursuerState?.traversal?.physical.grounded === false && pursuerAt.x < pursuerX;
        pursuerX = pursuerAt.x;
      }
      if (targetIndex === underpass && pursuerAt) {
        // Wait on the ground side until the pursuer leaps west, run east under its arc while
        // its contact box still reaches Chibi's column, then climb once it is behind Chibi.
        const box = contactBox(startObjects[pursuer]!, pursuerAt, pursuerState?.facing ?? 1);
        if (!pursuerLeapedWest) {
          move = 0;
          needsJump = false;
        } else if (box.x + box.width >= zone.bird.x) {
          move = 1;
          needsJump = false;
        }
      }
      if (needsJump && zone.bird.grounded && !previousJump) {
        jumpStart = tick;
      }
      const jumpHeld = (tick - jumpStart) * STEP_SECONDS < BIRD.jumpRiseTime;
      zone = stepZone(ordinary, layout, STEP_SECONDS, { jumpHeld, move, useHeld: false }, zone);
      previousJump = jumpHeld;
      if (tick % 60 === 0) {
        trace.push({
          grounded: zone.bird.grounded,
          pursuer: pursuerAt && { leapedWest: pursuerLeapedWest, x: pursuerAt.x, y: pursuerAt.y },
          targetIndex,
          tick,
          x: zone.bird.x,
          y: zone.bird.y,
        });
      }
    }
    const witness = JSON.stringify({
      bird: zone.bird,
      cleared: zone.cleared,
      death: zone.death,
      id,
      targetIndex,
      trace,
    });
    expect(zone.death, witness).toBeUndefined();
    expect(targetIndex, witness).toBe(route.length);
    expect(zone.bird.airJumpUsed, witness).toBe(false);
    expect(zone.bird.dash?.airUsed, witness).not.toBe(true);
    expect(zone.cleared, witness).toBe(true);
  },
);
