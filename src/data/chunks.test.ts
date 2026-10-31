import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { ASSEMBLED_AREA, assembleZone, themesOf } from "../rules/assemble";
import { chunkProblems, recipeProblems } from "../rules/chunk";
import { bindElement } from "../rules/elementBinding";
import { resolveNames } from "../rules/tiles";
import { ALL_CHUNKS, ALL_RECIPES, ALL_THEMES, FIXTURE_LIBRARY } from "../testing/chunks";
import type { ArtManifest } from "../view/aseprite";
import { lookTiles, type Tileset } from "../view/tiles";
import { ARCHETYPES } from "./archetypes";
import { CHARACTERS } from "./characters";
import { ROOMS } from "./rooms";
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

describe.each(ALL_THEMES)("theme %s", (_, theme) => {
  it("draws from a tileset art has, with every look's tiles, or from a placeholder drawn flat", () => {
    if (theme.tileset.startsWith("placeholder-")) {
      return;
    }
    const tileset = TILESETS[`../../public/art/tilesets/${theme.tileset}.json`];
    expect(tileset, theme.tileset).toBeDefined();
    const missing = Object.values(theme.looks).flatMap((look) =>
      lookTiles(look).filter((name) => !(tileset && name in tileset.tiles)),
    );
    expect(missing).toEqual([]);
  });

  it("draws each backdrop from a character that exists", () => {
    expect(
      theme.backdrops
        .map((backdrop) => bindElement(theme.bindings, { ...backdrop, col: 0 }))
        .filter(({ character }) => !(character in CHARACTERS)),
    ).toEqual([]);
  });

  it("places doors as a character whose archetype is a door", () => {
    const character = theme.bindings[theme.door]?.character;
    expect(character && CHARACTERS[character]?.archetype, theme.door).toBe("door");
  });
});

describe.each(ALL_CHUNKS)("chunk %s", (_, library, chunk) => {
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
      const catalogue = { archetypes: ARCHETYPES, characters: library.characters };
      const encounters = Object.values(plan().areas).flatMap(({ objects }) =>
        objects.filter((instance) => {
          const { archetype, character } = resolveNames(catalogue, instance);
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
