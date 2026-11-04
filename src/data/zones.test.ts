import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { type ArtManifest, BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { artKind, lookTiles } from "../presentation";
import { resolveNames, zoneLayout } from "../rules/tiles";
import { startZone, stepZone } from "../rules/zone";
import { zonePlanFor } from "../rules/zonePlans";
import { HITBOXES, TILESETS } from "../testing/walkSuite";
import { TEST_ZONES } from "../testing/zones";
import { ARCHETYPES } from "./archetypes";
import { BIRD } from "./bird";
import { CHARACTERS } from "./characters";
import { ZONE_MAP } from "./map";
import { ROOMS } from "./rooms";
import { TILE, ZONE_ROWS } from "./screen";
import { TEXT } from "./text";
import type { AreaPlan, TileRect, ZonePlan } from "./types";
import { RECIPES, ZONES as ZONES_BY_KEY } from "./zones";

const MANIFEST = manifestJson as ArtManifest;
const SHEETS = import.meta.glob<AsepriteSheet>("../../public/art/sprites/*.json", {
  eager: true,
  import: "default",
});
const tagsOf = (art: string) => {
  const sheet = SHEETS[`../../public/art/sprites/${art}.json`];
  return sheet ? [...sheetTags(sheet).keys()] : [];
};
const RECIPE_PLANS = Object.keys(RECIPES).map((key) => [key, zonePlanFor(1, key)] as const);
const ZONES = [
  ...Object.values(ZONES_BY_KEY),
  ...RECIPE_PLANS.map(([, plan]) => plan),
  ...TEST_ZONES,
];
const CATALOGUE = { archetypes: ARCHETYPES, characters: CHARACTERS };

const inside = (area: AreaPlan, rect: TileRect) =>
  rect.col >= 0 &&
  rect.row >= 0 &&
  rect.col + rect.cols <= area.cols &&
  rect.row + rect.rows <= area.rows;

const areas = ZONES.flatMap((zone, index) =>
  Object.entries(zone.areas).map(([name, area]) => [`${index + 1} ${name}`, zone, area] as const),
);
const instances = areas.flatMap(([name, , area]) =>
  area.objects.map(
    (instance, index) => [`${name} #${index} ${instance.character}`, area, instance] as const,
  ),
);

describe("the characters", () => {
  it.each(Object.entries(CHARACTERS))(
    "%s has drawable art, real tags and words",
    (name, character) => {
      if (character.tileset !== undefined) {
        expect(TILESETS[character.tileset], character.tileset).toBeDefined();
      }
      const tilesets =
        character.tileset === undefined ? Object.values(TILESETS) : [TILESETS[character.tileset]];
      expect(
        character.art.startsWith("placeholder-") ||
          character.art.startsWith("test-") ||
          tilesets.some((tileset) => artKind(MANIFEST, tileset, character.art) !== "placeholder"),
        `${name}: ${character.art} is drawable`,
      ).toBe(true);
      const tags = [
        ...Object.values(character.animations ?? {}),
        ...Object.values(character.behaviour?.states ?? {}).map((node) => node.animation),
        ...(character.behaviour?.inactiveAnimation === undefined
          ? []
          : [character.behaviour.inactiveAnimation]),
        ...(character.quirks ?? []).map(({ tag }) => tag),
      ];
      const known = tagsOf(character.art);
      expect(
        tags.filter((tag) => tag !== null && !known.includes(tag)),
        `${name}'s tags in ${character.art}`,
      ).toEqual([]);
      expect((character.lines ?? []).filter((key) => !(key in TEXT.lines))).toEqual([]);
      expect((character.quips ?? []).filter((key) => !(key in TEXT.quips))).toEqual([]);
    },
  );
});

describe("the zones", () => {
  it.each(areas)(
    "area %s uses its authored height, with its terrain inside it",
    (_, zone, area) => {
      const recipeKey = RECIPE_PLANS.find(([, plan]) => plan === zone)?.[0];
      const recipe = recipeKey === undefined ? undefined : RECIPES[recipeKey];
      const authored =
        recipe && "sections" in recipe
          ? recipe.sections.find(({ id }) => zone.areas[id] === area)
          : recipe;
      expect(area.rows).toBe(authored?.rows ?? ZONE_ROWS);
      const objects = area.objects.map((instance) => {
        const { character } = resolveNames(CATALOGUE, instance);
        return {
          col: instance.col,
          cols: instance.cols ?? character.cols,
          row: instance.row,
          rows: instance.rows ?? character.rows,
        };
      });
      expect([...area.solids, ...objects].every((rect) => inside(area, rect))).toBe(true);
    },
  );

  const doors = instances.filter(
    ([, , instance]) =>
      instance.room !== undefined ||
      resolveNames(CATALOGUE, instance).archetype.collision === "use",
  );
  const doorInputs = new Map(
    doors.map((entry) => [JSON.stringify([entry[2].character, entry[2].room]), entry] as const),
  );
  it.each([...doorInputs.values()])("door %s names a room that exists", (_, __, instance) => {
    const { archetype } = resolveNames(CATALOGUE, instance);
    expect(archetype.collision).toBe("use");
    expect(instance.room && ROOMS[instance.room], `${instance.room} in ROOMS`).toBeDefined();
  });

  it.each(areas)(
    "area %s draws from a tileset art has, with a look for each terrain run",
    (_, __, area) => {
      const tileset = area.tileset === undefined ? undefined : TILESETS[area.tileset];
      if (area.tileset !== undefined) {
        expect(tileset, area.tileset).toBeDefined();
      }
      for (const instance of area.objects) {
        const key = instance.character;
        const character = CHARACTERS[key];
        if (!character) {
          throw new Error(`No character ${key}`);
        }
        const art = instance.skin?.art ?? character.art;
        const sourceKey = instance.skin
          ? instance.skin.tileset
          : (character.tileset ?? area.tileset);
        const source =
          sourceKey === null || sourceKey === undefined ? undefined : TILESETS[sourceKey];
        expect(
          art.startsWith("placeholder-") ||
            art.startsWith("test-") ||
            artKind(MANIFEST, source, art) !== "placeholder",
          `${key}: ${art} in ${sourceKey ?? "sprite/image"}`,
        ).toBe(true);
      }
      for (const solid of area.solids) {
        if (!tileset) {
          expect(solid.look, JSON.stringify(solid)).toBeUndefined();
          continue;
        }
        expect(solid.look, JSON.stringify(solid)).toBeDefined();
        const missing = lookTiles(solid.look ?? "").filter((name) => !(name in tileset.tiles));
        expect(missing, `${solid.look} in ${area.tileset}`).toEqual([]);
      }
    },
  );
});

// The doors a zone places: instances with a room on a door's archetype.
const doorsOf = (plan: ZonePlan) =>
  Object.values(plan.areas).flatMap(({ objects }) =>
    objects.filter(
      (instance) =>
        instance.room !== undefined &&
        ARCHETYPES[CHARACTERS[instance.character]?.archetype ?? ""]?.collision === "use",
    ),
  );

describe("the real zones", () => {
  it.each(Object.entries(ZONES_BY_KEY))("hand-built zone %s has a door to a room", (_, plan) => {
    expect(doorsOf(plan).length).toBeGreaterThan(0);
  });

  it.each(RECIPE_PLANS)("recipe %s fills a slot with a door to a room", (_, plan) => {
    expect(doorsOf(plan).length).toBeGreaterThan(0);
  });
});

// Her collision box where a plan starts her: it must start clear of the first column, or she
// would turn back (rules/zone's turnedBack) on arrival.
const startsClear = (plan: ZonePlan) => {
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const start = startZone(BIRD, layout, 1);
  const area = layout.areas[start.area];
  return area !== undefined && start.bird.x >= area.backX && !start.turnedBack;
};

describe("every zone's start", () => {
  it.each([
    ...Object.entries(ZONES_BY_KEY),
    ...TEST_ZONES.map((plan, index): [string, ZonePlan] => [`test zone ${index + 1}`, plan]),
  ])("starts %s clear of its first column", (_, plan) => {
    expect(startsClear(plan)).toBe(true);
  });

  it.each(RECIPE_PLANS)("starts recipe %s clear of its first column", (_, plan) => {
    expect(startsClear(plan)).toBe(true);
  });
});

// Whether, held left with no jump from the plan's start, on art's real tiles and sprites, she
// turns back within seconds: nothing in a zone's first column may stop her reaching it.
const turnsBackWithin = (seconds: number, plan: ZonePlan) => {
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  let zone = startZone(BIRD, layout, 1);
  for (let step = 0; step < Math.round(seconds / STEP_SECONDS) && !zone.turnedBack; step++) {
    zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: -1, useHeld: false },
      zone,
    );
  }
  return zone.turnedBack;
};

describe("going back from a zone's start", () => {
  it.each([
    ...Object.entries(ZONES_BY_KEY),
    ...TEST_ZONES.map((plan, index): [string, ZonePlan] => [`test zone ${index + 1}`, plan]),
    ...RECIPE_PLANS.map(([key, plan]): [string, ZonePlan] => [`recipe ${key}`, plan]),
  ])("held left from %s's start, she turns back", (_, plan) => {
    expect(turnsBackWithin(3, plan)).toBe(true);
  });
});

describe("the map", () => {
  const ids = ZONE_MAP.nodes.map(({ id }) => id);
  const after = (id: string, builtOnly = false) =>
    ZONE_MAP.edges
      .filter((edge) => edge.from === id && (!builtOnly || edge.built))
      .map(({ to }) => to);
  const reach = (from: string, next: (id: string) => string[]) => {
    const seen = new Set([from]);
    for (const id of seen) {
      for (const to of next(id)) {
        seen.add(to);
      }
    }
    return seen;
  };

  it("names each node once, and every path's ends", () => {
    expect(new Set(ids).size).toBe(ids.length);
    const ends = ZONE_MAP.edges.flatMap(({ from, to }) => [from, to]);
    expect(ends.filter((id) => !ids.includes(id))).toEqual([]);
    expect([ZONE_MAP.start, ZONE_MAP.finish].filter((id) => !ids.includes(id))).toEqual([]);
  });

  it("names a zone for every zone node a built path reaches, and only zones or recipes that exist", () => {
    const built = reach(ZONE_MAP.start, (id) => after(id, true));
    for (const node of ZONE_MAP.nodes) {
      if (node.zone !== undefined) {
        expect(ZONES_BY_KEY[node.zone] ?? RECIPES[node.zone], node.zone).toBeDefined();
      }
      if (node.kind === "zone" && built.has(node.id)) {
        expect(node.zone, node.id).toBeDefined();
      }
    }
  });

  it("assembles every playable stage, including the first, from a recipe", () => {
    const first = ZONE_MAP.nodes.find(({ id }) => id === ZONE_MAP.start);
    expect(first?.kind).toBe("zone");
    expect(first?.zone).toBeDefined();
    const playable = ZONE_MAP.nodes.filter(
      (node) => node.kind === "zone" && node.zone !== undefined,
    );
    expect(playable.length).toBeGreaterThan(0);
    expect(
      playable.map(({ zone }) => zone).filter((key) => key === undefined || !(key in RECIPES)),
    ).toEqual([]);
  });

  it("leads every node from the start and on to the finish, never back", () => {
    expect([...reach(ZONE_MAP.start, (id) => after(id))].sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect(reach(id, (each) => after(each)).has(ZONE_MAP.finish), id).toBe(true);
      expect(
        after(id).some((to) => reach(to, (each) => after(each)).has(id)),
        `${id} loops back`,
      ).toBe(false);
    }
  });

  it("keeps unbuilt continuation closed while the catalogue still leads to its actual final stage", () => {
    const allBuilt = ZONE_MAP.nodes.every(
      (node) => node.kind !== "zone" || node.zone !== undefined,
    );
    expect(reach(ZONE_MAP.start, (id) => after(id, true)).has(ZONE_MAP.finish)).toBe(allBuilt);
  });
});
