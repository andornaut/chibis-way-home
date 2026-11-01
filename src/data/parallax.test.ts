import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import deerSheet from "../../public/art/sprites/background-deer.json";
import reedSheet from "../../public/art/sprites/background-reeds.json";
import swallowSheet from "../../public/art/sprites/background-swallow.json";
import { assembleZone } from "../rules/assemble";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { stageLoader } from "../sim/catalogue";
import { artOffset, sceneryParallax } from "../view/objectArt";
import { CHUNKS, EXTERIOR_DEPTH_ALIASES, THEMES, WOODLAND_DEPTH_ALIASES } from "./chunks";
import { ZONE_MAP } from "./map";
import { TILE } from "./screen";
import type { ChunkPlan, ObjectLayout } from "./types";
import { WOODLAND_SCENERY_CHARACTERS } from "./woodlandScenery";
import { APARTMENT_WINDOW } from "./zone6";
import { RECIPES } from "./zones";

const depth = (object: Pick<ObjectLayout, "parallax">) =>
  object.parallax !== undefined && (object.parallax.x < 1 || object.parallax.y < 1);
const apartmentStages = ZONE_MAP.destinations.find(({ id }) => id === "apartment")!.stages;
const canonical = (id: string) =>
  Object.entries(EXTERIOR_DEPTH_ALIASES).find(([, alias]) => alias === id)?.[0] ?? id;

it("retains reusable exterior variants without adding duplicate pool families", () => {
  for (const [id, alias] of Object.entries(EXTERIOR_DEPTH_ALIASES)) {
    const physical = (chunk: ChunkPlan) =>
      Object.fromEntries(
        Object.entries(chunk).filter(([key]) => !["backdrops", "scenery", "theme"].includes(key)),
      );
    expect(physical(CHUNKS[alias]!)).toEqual(physical(CHUNKS[id]!));
    for (const field of ["objects", "solids", "slots", "noCross"] as const) {
      expect(CHUNKS[alias]![field]).toBe(CHUNKS[id]![field]);
    }
    expect(CHUNKS[alias]!.theme).toBe("apartment-exterior");
  }
  for (const recipe of Object.values(RECIPES)) {
    if ("sections" in recipe) {
      for (const section of recipe.sections) {
        expect(section.chunks.some((id) => canonical(id) !== id)).toBe(false);
      }
    } else {
      expect(recipe.chunks?.some((id) => canonical(id) !== id) ?? false).toBe(false);
    }
  }
});

it("guarantees a framed depth window in every Apartment finish while keeping ordinary chunks opaque", () => {
  for (const id of apartmentStages) {
    const recipe = RECIPES[id]!;
    if ("sections" in recipe) {
      throw new Error("Apartment floors are individual continuous stages");
    }
    const finish = CHUNKS[recipe.finish]!;
    const start = CHUNKS[recipe.start]!;
    expect((finish.backdrops ?? []).filter(depth)).toHaveLength(3);
    expect((start.backdrops ?? []).some(depth)).toBe(false);
    expect(recipe.chunks!.every((chunk) => !(CHUNKS[chunk]!.backdrops ?? []).some(depth))).toBe(
      true,
    );
    expect(THEMES[recipe.theme]!.backdrops).toEqual([]);
    const walls = (finish.backdrops ?? []).filter((object) => object.role === "wall");
    expect(walls.some((wall) => wall.col === 0 && wall.cols === APARTMENT_WINDOW.col)).toBe(true);
    expect(walls.some((wall) => wall.col === APARTMENT_WINDOW.col + APARTMENT_WINDOW.cols)).toBe(
      true,
    );
    expect(
      walls.some(
        (wall) =>
          wall.col === APARTMENT_WINDOW.col && wall.row === 0 && wall.rows === APARTMENT_WINDOW.row,
      ),
    ).toBe(true);
    expect(
      walls.some(
        (wall) =>
          wall.col === APARTMENT_WINDOW.col &&
          wall.row === APARTMENT_WINDOW.row + APARTMENT_WINDOW.rows,
      ),
    ).toBe(true);
  }
});

describe.each(ZONE_MAP.destinations.flatMap(({ stages }) => stages))(
  "stage %s depth coverage",
  (id) => {
    it("resolves both selected depth chunks and plain chunks without changing stage limits", () => {
      const prepared = stageLoader(id)(1);
      const recipe = RECIPES[id]!;
      let selected = 0;
      let plain = 0;
      let cols = 0;
      let encounters = 0;
      for (const [areaId, area] of Object.entries(prepared.layout.areas)) {
        const theme =
          "sections" in recipe
            ? recipe.sections.find((section) => section.id === areaId)!.theme
            : recipe.theme;
        const layers = area.objects.filter(depth);
        if (
          theme.startsWith("apartment-") &&
          !["apartment-entrance", "apartment-exterior"].includes(theme)
        ) {
          expect(layers).toHaveLength(3);
          expect(layers.every((layer) => layer.origin.x === area.chunks.at(-1)!.x)).toBe(true);
        }
        expect(THEMES[theme]!.backdrops.some(depth)).toBe(false);
        for (const chunk of area.chunks) {
          cols += chunk.width / TILE;
          const layersHere = layers.filter(
            (object) => object.origin.x === chunk.x && object.width === chunk.width,
          );
          if (layersHere.length) {
            selected++;
            expect(layersHere).toHaveLength(3);
            for (const object of layersHere) {
              const art = manifest.backdrops.find(({ key }) => key === object.art)!;
              const offset = artOffset("repeated-backdrop", object, art);
              expect(object.origin.y + offset.y).toBe(0);
              expect(object.origin.y + offset.y + art.height).toBe(art.y);
            }
          } else {
            plain++;
          }
        }
        for (const chunkId of prepared.source!.chunkIds![areaId]!) {
          encounters += CHUNKS[chunkId]!.encounters;
        }
      }
      expect(selected).toBeGreaterThan(0);
      expect(plain).toBeGreaterThan(0);
      const lengths =
        "sections" in recipe ? recipe.sections.map(({ length }) => length) : [recipe.length];
      expect(cols).toBeGreaterThanOrEqual(lengths.reduce((sum, { min }) => sum + min, 0));
      expect(cols).toBeLessThanOrEqual(lengths.reduce((sum, { max }) => sum + max, 0));
      expect(encounters).toBe(recipe.encounters);
      if (!("sections" in recipe)) {
        expect(
          [recipe.start, recipe.finish].some((id) => (CHUNKS[id]!.backdrops ?? []).some(depth)),
        ).toBe(true);
        expect(
          recipe.chunks!.every(
            (id) =>
              (CHUNKS[id]!.backdrops ?? []).some(depth) ===
              Object.values(WOODLAND_DEPTH_ALIASES).includes(id),
          ),
        ).toBe(true);
      } else {
        expect((CHUNKS[recipe.start]!.backdrops ?? []).some(depth)).toBe(true);
      }
    });
  },
);

it("uses Woodland depth variants for horizontal challenges while preserving plain vertical templates", () => {
  const themes = ["deep-woods", "forest-paths", "ravine"];
  for (const [id, alias] of Object.entries(WOODLAND_DEPTH_ALIASES)) {
    const physical = (chunk: ChunkPlan) =>
      Object.fromEntries(
        Object.entries(chunk).filter(([key]) => !["backdrops", "scenery", "theme"].includes(key)),
      );
    expect(physical(CHUNKS[alias]!)).toEqual(physical(CHUNKS[id]!));
    expect(CHUNKS[alias]!.theme).toEqual(themes);
    expect(CHUNKS[alias]!.objects).toBe(CHUNKS[id]!.objects);
    expect(CHUNKS[alias]!.solids).toBe(CHUNKS[id]!.solids);
  }
  const pools = themes.map((theme) => {
    const recipe = RECIPES[theme]!;
    if ("sections" in recipe) {
      throw new Error("Woodland stages are continuous");
    }
    expect((CHUNKS[recipe.start]!.backdrops ?? []).some(depth)).toBe(true);
    expect((CHUNKS[recipe.finish]!.backdrops ?? []).some(depth)).toBe(false);
    expect(
      recipe.chunks!.filter((id) => Object.values(WOODLAND_DEPTH_ALIASES).includes(id)),
    ).toHaveLength(Object.keys(WOODLAND_DEPTH_ALIASES).length);
    expect(recipe.chunks).toContain(WOODLAND_DEPTH_ALIASES["vertical-red-gate"]);
    return recipe.chunks!;
  });
  expect(pools[1]).toEqual(pools[0]);
  expect(pools[2]).toEqual(pools[0]);
  for (const id of [
    "compound-ascent",
    "compound-compact-ascent",
    "compound-compact-climb",
    "compound-double-lift",
  ]) {
    expect(pools[0]).toContain(id);
    expect((CHUNKS[id]!.backdrops ?? []).some(depth)).toBe(false);
  }
});

it("appends grounded Woodland fauna without changing physical indices or seeded placements", () => {
  const recipe = RECIPES["deep-woods"]!;
  const beforeLibrary = {
    ...CHUNK_LIBRARY,
    chunks: Object.fromEntries(
      Object.entries(CHUNKS).map(([id, chunk]) => [id, { ...chunk, scenery: [] }]),
    ),
  };
  const before = assembleZone(beforeLibrary, 1, "deep-woods", recipe);
  const after = assembleZone(CHUNK_LIBRARY, 1, "deep-woods", recipe);
  for (const [id, area] of Object.entries(after.areas)) {
    const original = before.areas[id]!;
    expect(area.objects.slice(0, original.objects.length)).toEqual(original.objects);
    expect(area.solids).toEqual(original.solids);
    expect(area.chunks).toEqual(original.chunks);
    expect(area.objects.length).toBeGreaterThan(original.objects.length);
  }
  const prepared = stageLoader("deep-woods")(1);
  const scenery = Object.values(prepared.layout.areas).flatMap(({ objects }) =>
    objects.filter((object) => object.art in WOODLAND_SCENERY_CHARACTERS),
  );
  expect(scenery.length).toBeGreaterThan(0);
  for (const object of scenery) {
    expect(sceneryParallax(object)).toEqual(object.parallax);
    expect(object.collision).toBe("none");
    expect(object.contact).toBeUndefined();
    expect(object.interaction.kind).toBe("none");
    if (object.art !== "background-swallow") {
      expect(object.origin.y + object.height).toBe(600);
      expect(object.parallax!.y).toBe(1);
    }
  }
  for (const [id, chunk] of Object.entries(CHUNKS)) {
    if ((chunk.scenery ?? []).length) {
      expect(Object.values(WOODLAND_DEPTH_ALIASES)).toContain(id);
      for (const instance of chunk.scenery!) {
        if (instance.character === "background-swallow") {
          continue;
        }
        const character = WOODLAND_SCENERY_CHARACTERS[instance.character]!;
        expect(
          chunk.solids.some(
            (solid) =>
              solid.row === instance.row + character.rows &&
              solid.col <= instance.col &&
              solid.col + solid.cols >= instance.col + character.cols,
          ),
        ).toBe(true);
      }
    }
  }
});

it("uses looping art tags and only stationary animation nodes for decorative wildlife", () => {
  const sheets = {
    "background-deer": deerSheet,
    "background-reeds": reedSheet,
    "background-swallow": swallowSheet,
  };
  for (const [id, character] of Object.entries(WOODLAND_SCENERY_CHARACTERS)) {
    const tags = sheets[id as keyof typeof sheets].meta.frameTags.map(({ name }) => name);
    const animations = character.behaviour
      ? Object.values(character.behaviour.states).map(({ animation, motion }) => {
          expect(motion.kind).toBe("wait");
          return animation;
        })
      : Object.values(character.animations!);
    expect(animations.every((tag) => tags.includes(tag!))).toBe(true);
    expect(manifest.sprites.find(({ key }) => key === character.art)!.once).toEqual([]);
  }
});
