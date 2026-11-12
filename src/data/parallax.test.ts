import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json" with { type: "json" };
import deerSheet from "../../public/art/sprites/background-deer.json" with { type: "json" };
import largeDeerSheet from "../../public/art/sprites/background-deer-large.json" with { type: "json" };
import reedSheet from "../../public/art/sprites/background-reeds.json" with { type: "json" };
import swallowSheet from "../../public/art/sprites/background-swallow.json" with { type: "json" };
import { artOffset, backgroundGroundOffset } from "../presentation/index.ts";
import { assembleZone } from "../rules/assemble.ts";
import { objectLayout } from "../rules/tiles.ts";
import { CHUNK_LIBRARY } from "../rules/zonePlans.ts";
import { stageLoader } from "../sim/catalogue.ts";
import { sceneryParallax, worldScenery } from "../stage/index.ts";
import { ARCHETYPES } from "./archetypes.ts";
import { BACKGROUND_SECTIONS } from "./backgrounds.ts";
import { CAMERA } from "./camera.ts";
import {
  CHUNKS,
  EXTERIOR_DEPTH_ALIASES,
  THEMES,
  WOODLAND_DEPTH_ALIASES,
  WOODLAND_VERTICAL_ALIASES,
} from "./chunks.ts";
import { ZONE_MAP } from "./map.ts";
import { SCREEN, TILE } from "./screen.ts";
import type { ChunkPlan, Instance, ObjectLayout } from "./types/index.ts";
import { WOODLAND_SCENERY, WOODLAND_SCENERY_CHARACTERS } from "./woodlandScenery.ts";
import { APARTMENT_WINDOW } from "./zone6.ts";
import { RECIPES } from "./zones.ts";

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

it("matches Apartment interior planes to opaque wall rectangles without filling the window", () => {
  const rectangle = ({
    col,
    cols,
    row,
    rows,
  }: Pick<Instance, "col" | "cols" | "row" | "rows">) => ({ col, cols, row, rows });
  for (const [id, chunk] of Object.entries(CHUNKS)) {
    const themes = typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
    if (!themes.some((theme) => theme.startsWith("apartment-")) || chunk.rows !== 90) {
      continue;
    }
    const walls = (chunk.backdrops ?? []).filter(({ role }) => role === "wall");
    const planes = (chunk.scenery ?? []).filter(
      ({ backdropPlane }) => backdropPlane === "interior",
    );
    expect(planes.map(rectangle), id).toEqual(walls.map(rectangle));
    for (const plane of planes) {
      expect(plane.cols).toBeGreaterThan(0);
      expect(plane.rows).toBeGreaterThan(0);
      expect(plane.backdropSpan).toBe(true);
      expect(plane.groundAnchor).toBe("start");
      if (id === "apartment-floor-finish") {
        const overlaps =
          plane.col < APARTMENT_WINDOW.col + APARTMENT_WINDOW.cols &&
          plane.col + plane.cols! > APARTMENT_WINDOW.col &&
          plane.row < APARTMENT_WINDOW.row + APARTMENT_WINDOW.rows &&
          plane.row + plane.rows! > APARTMENT_WINDOW.row;
        expect(overlaps).toBe(false);
      }
    }
  }
});

describe.each(ZONE_MAP.destinations.flatMap(({ stages }) => stages))(
  "stage %s depth coverage",
  (id) => {
    it("covers outdoor areas continuously and preserves authored indoor windows and stage limits", () => {
      const prepared = stageLoader(id)(1);
      const recipe = RECIPES[id]!;
      let cols = 0;
      let encounters = 0;
      for (const [areaId, area] of Object.entries(prepared.layout.areas)) {
        const themeId =
          "sections" in recipe
            ? recipe.sections.find((section) => section.id === areaId)!.theme
            : recipe.theme;
        const theme = THEMES[themeId]!;
        const authored = area.objects.filter((object) => depth(object) && !object.backdropSpan);
        if (theme.background) {
          const planes = [
            ...theme.background.weather,
            ...theme.background.sections.flatMap((key) => BACKGROUND_SECTIONS[key]!.backdrops),
          ];
          for (const plane of planes) {
            const spans = area.objects
              .filter(
                (object) =>
                  object.parallax?.x === plane.parallax?.x &&
                  object.parallax?.y === plane.parallax?.y,
              )
              .map((object) => [object.origin.x, object.origin.x + object.width] as const)
              .sort((a, b) => a[0] - b[0]);
            let covered = 0;
            for (const [start, end] of spans) {
              expect(start, `${themeId}:${JSON.stringify(plane.parallax)}`).toBeLessThanOrEqual(
                covered,
              );
              covered = Math.max(covered, end);
            }
            expect(covered).toBeGreaterThanOrEqual(area.width);
          }
        } else {
          expect(themeId.startsWith("apartment-")).toBe(true);
          expect(authored).toHaveLength(3);
          expect(
            area.objects
              .filter((object) => object.backdropSpan)
              .every((object) => object.backdropPlane === "interior"),
          ).toBe(true);
          expect(authored.every((layer) => layer.origin.x === area.chunks.at(-1)!.x)).toBe(true);
        }
        for (const object of authored) {
          const art = manifest.backdrops.find(({ key }) => key === object.art);
          if (art) {
            const offset = artOffset("repeated-backdrop", object, art);
            expect(object.origin.y + offset.y).toBe(0);
            expect(object.origin.y + offset.y + art.height).toBe(art.y);
          }
        }
        cols += area.chunks.reduce((sum, chunk) => sum + chunk.width / TILE, 0);
        for (const chunkId of prepared.source!.chunkIds![areaId]!) {
          encounters += CHUNK_LIBRARY.chunks[chunkId]!.encounters;
        }
      }
      const lengths =
        "sections" in recipe ? recipe.sections.map(({ length }) => length) : [recipe.length];
      expect(cols).toBeGreaterThanOrEqual(lengths.reduce((sum, { min }) => sum + min, 0));
      expect(cols).toBeLessThanOrEqual(lengths.reduce((sum, { max }) => sum + max, 0));
      expect(encounters).toBe(recipe.encounters);
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
    const background = THEMES[recipe.theme]!.background;
    expect(background).toBeDefined();
    const factors = new Map(
      background!.sections.flatMap((key) =>
        BACKGROUND_SECTIONS[key]!.backdrops.map(
          ({ parallax }) => [JSON.stringify(parallax), parallax] as const,
        ),
      ),
    );
    expect(factors.size).toBeGreaterThan(0);
    const area = stageLoader(theme)(1).layout.areas.main!;
    for (const cap of [area.chunks[0]!, area.chunks.at(-1)!]) {
      for (const [key, parallax] of factors) {
        const spans = area.objects
          .filter(
            (object) => object.parallax?.x === parallax?.x && object.parallax?.y === parallax?.y,
          )
          .map((object) => [object.origin.x, object.origin.x + object.width] as const)
          .filter(([left, right]) => left < cap.x + cap.width && right > cap.x)
          .sort(([a], [b]) => a - b);
        let covered = cap.x;
        for (const [left, right] of spans) {
          expect(left, `${theme}:${key}:${cap.x}`).toBeLessThanOrEqual(covered);
          covered = Math.max(covered, right);
        }
        expect(covered, `${theme}:${key}:${cap.x}`).toBeGreaterThanOrEqual(cap.x + cap.width);
      }
    }
    const depthVariants = Object.keys(WOODLAND_DEPTH_ALIASES).map(
      (id) => WOODLAND_VERTICAL_ALIASES[id]!,
    );
    expect(recipe.chunks!.filter((id) => depthVariants.includes(id))).toHaveLength(
      depthVariants.length,
    );
    expect(recipe.chunks).toContain(WOODLAND_VERTICAL_ALIASES["vertical-red-gate"]);
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
    expect((CHUNKS[id]!.backdrops ?? []).some(depth)).toBe(false);
  }
  for (const id of ["compound-ascent", "compound-double-lift"]) {
    const variant = WOODLAND_VERTICAL_ALIASES[id]!;
    expect(pools[0]).toContain(variant);
    expect((CHUNKS[variant]!.backdrops ?? []).some(depth)).toBe(false);
  }
});

it("appends grounded Woodland fauna without changing physical indices or seeded placements", () => {
  const recipe = RECIPES["deep-woods"]!;
  const beforeLibrary = {
    ...CHUNK_LIBRARY,
    chunks: Object.fromEntries(
      Object.entries(CHUNKS).map(([id, chunk]) => [
        id,
        {
          ...chunk,
          scenery: (chunk.scenery ?? []).filter(
            ({ character }) => !(character in WOODLAND_SCENERY_CHARACTERS),
          ),
        },
      ]),
    ),
  };
  const before = assembleZone(beforeLibrary, 1, "deep-woods", recipe);
  const after = assembleZone(CHUNK_LIBRARY, 1, "deep-woods", recipe);
  for (const [id, area] of Object.entries(after.areas)) {
    const original = before.areas[id]!;
    const physical = (objects: readonly Instance[], indices: readonly number[] | undefined) => {
      const scenery = new Set(indices);
      return objects.flatMap((object, index) =>
        !object.backdropSpan && !scenery.has(index) ? [{ index, object }] : [],
      );
    };
    expect(physical(area.objects, area.sceneryIndices)).toEqual(
      physical(original.objects, original.sceneryIndices),
    );
    expect(
      area.objects.filter(({ character }) => !(character in WOODLAND_SCENERY_CHARACTERS)),
    ).toEqual(original.objects);
    area.objects.forEach(({ character }, index) => {
      if (character in WOODLAND_SCENERY_CHARACTERS) {
        expect(area.sceneryIndices).toContain(index);
      }
    });
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
    expect(worldScenery(object) || sceneryParallax(object) !== undefined).toBe(true);
    expect(object.collision).toBe("none");
    expect(object.contact).toBeUndefined();
    expect(object.interaction.kind).toBe("none");
    if (object.art !== "background-swallow") {
      const area = Object.values(prepared.layout.areas).find(({ objects }) =>
        objects.includes(object),
      )!;
      expect(
        area.solids.some(
          (solid) =>
            solid.y === object.origin.y + object.height &&
            solid.x <= object.origin.x &&
            solid.x + solid.width >= object.origin.x + object.width,
        ),
      ).toBe(true);
      expect(object.parallax!.y).toBe(1);
    }
  }
  for (const [id, chunk] of Object.entries(CHUNKS)) {
    const fauna = (chunk.scenery ?? []).filter(
      ({ character }) => character in WOODLAND_SCENERY_CHARACTERS,
    );
    if (fauna.length) {
      expect([
        ...Object.values(WOODLAND_DEPTH_ALIASES),
        ...Object.values(WOODLAND_VERTICAL_ALIASES),
      ]).toContain(id);
      for (const instance of fauna) {
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
    "background-deer-large": largeDeerSheet,
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

it("keeps generated Woodland fills on the authored same-art vertical reference", () => {
  const prepared = stageLoader("deep-woods")(1);
  let compared = 0;
  for (const area of Object.values(prepared.layout.areas)) {
    const authored = area.objects.filter((object) => depth(object) && !object.backdropSpan);
    const generated = area.objects.filter((object) => depth(object) && object.backdropSpan);
    for (const object of generated) {
      const matches = authored.filter(
        (other) => other.art === object.art && other.parallax?.y === object.parallax?.y,
      );
      for (const other of matches) {
        const verticalReference = (value: ObjectLayout) =>
          value.origin.y + backgroundGroundOffset({ area, camera: CAMERA, screen: SCREEN }, value);
        expect(verticalReference(object), object.art).toBe(verticalReference(other));
        compared++;
      }
    }
  }
  expect(compared).toBeGreaterThan(0);
});

it("resolves Woodland wildlife as autonomous world scenery with supported deer and finite flybys", () => {
  const catalogue = { archetypes: ARCHETYPES, characters: WOODLAND_SCENERY_CHARACTERS };
  let deer = 0;
  let swallows = 0;
  for (const [family, instances] of Object.entries(WOODLAND_SCENERY)) {
    const chunk = CHUNKS[WOODLAND_DEPTH_ALIASES[family]!]!;
    expect(chunk.scenery).toEqual(instances);
    expect(
      instances.filter(({ character }) => character.startsWith("background-deer")).length,
    ).toBeLessThanOrEqual(1);
    for (const instance of instances) {
      if (instance.character === "background-reeds") {
        continue;
      }
      const object = {
        ...objectLayout(TILE, catalogue, {}, undefined, {}, instance),
        scenerySource: "chunk" as const,
      };
      const sheet =
        instance.character === "background-deer-large"
          ? largeDeerSheet
          : instance.character === "background-deer"
            ? deerSheet
            : swallowSheet;
      const frames = Object.values(sheet.frames);
      const native = frames[0]!.sourceSize;
      expect(
        frames.every(({ sourceSize }) => sourceSize.w === native.w && sourceSize.h === native.h),
      ).toBe(true);
      expect({ height: object.height, width: object.width }).toEqual({
        height: native.h,
        width: native.w,
      });
      expect(worldScenery(object)).toBe(true);
      expect(object.collision).toBe("none");
      expect(object.contact).toBeUndefined();
      expect(object.scene).toBeUndefined();
      expect(object.reaction.kind).toBe("none");
      if (instance.character.startsWith("background-deer")) {
        expect(instance.character).toBe("background-deer-large");
        deer++;
        expect(object.motion.algorithm).toBe("static");
        expect(
          Object.values(object.behaviour!.states).every(({ motion }) => motion.kind === "wait"),
        ).toBe(true);
        expect(
          chunk.solids.some(
            (solid) =>
              solid.row * TILE === object.origin.y + object.height &&
              solid.col * TILE <= object.origin.x &&
              (solid.col + solid.cols) * TILE >= object.origin.x + object.width,
          ),
        ).toBe(true);
      } else {
        swallows++;
        expect(object.behaviour).toBeUndefined();
        expect(object.motion.playback).toBe("once-visible");
        expect(object.motion.algorithm).toBe("hop");
        expect(object.phase).toBe(0);
        expect(object.motion.pause).toBe(0);
        expect(object.motion.variance).toBe(0);
        expect(object.motion.distance).toBeGreaterThan(SCREEN.width);
        expect(object.motion.speed).toBeGreaterThan(0);
        expect(object.motion.hopHeight).toBeGreaterThan(0);
      }
    }
  }
  expect(deer).toBeGreaterThan(0);
  expect(swallows).toBeGreaterThan(0);
});

it.each(
  ["compound-return-high", "vertical-red-gate"].flatMap((family) => [
    WOODLAND_DEPTH_ALIASES[family]!,
    WOODLAND_VERTICAL_ALIASES[family]!,
  ]),
)("supports the complete planted large deer silhouette in %s", (id) => {
  const chunk = CHUNKS[id]!;
  const instance = chunk.scenery!.find(({ character }) => character === "background-deer-large")!;
  const object = {
    ...objectLayout(
      TILE,
      { archetypes: ARCHETYPES, characters: WOODLAND_SCENERY_CHARACTERS },
      {},
      undefined,
      {},
      instance,
    ),
    scenerySource: "chunk" as const,
  };
  const frames = Object.values(largeDeerSheet.frames);
  const native = frames[0]!.sourceSize;
  expect(object.width).toBe(native.w);
  expect(object.height).toBe(native.h);
  expect(object.parallax).toEqual({ x: 1, y: 1 });
  expect(worldScenery(object)).toBe(true);
  expect(object.collision).toBe("none");
  expect(object.contact).toBeUndefined();
  expect(object.interaction.kind).toBe("none");
  expect(object.motion.algorithm).toBe("static");
  expect(
    chunk.solids.some(
      (solid) =>
        solid.row * TILE === object.origin.y + object.height &&
        solid.col * TILE <= object.origin.x &&
        (solid.col + solid.cols) * TILE >= object.origin.x + object.width,
    ),
  ).toBe(true);
  for (const tag of largeDeerSheet.meta.frameTags) {
    const node = Object.values(object.behaviour!.states).find(
      ({ animation }) => animation === tag.name,
    )!;
    expect(node.motion).toEqual({ kind: "wait" });
    const cycle =
      frames.slice(tag.from, tag.to + 1).reduce((sum, { duration }) => sum + duration, 0) / 1000;
    expect(
      node.transitions.some(({ when }) =>
        when.some((condition) => condition.kind === "elapsed" && condition.seconds === cycle),
      ),
    ).toBe(true);
  }
  expect(manifest.sprites.find(({ key }) => key === object.art)!.once).toEqual([]);
});
