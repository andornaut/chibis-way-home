import { mapHash } from "@andornaut/game-kit/terrain/movementMap";
import { describe, expect, it } from "vitest";

import type { AreaLayout, ObjectLayout } from "../data/types";
import { chunkLayout, ORDINARY } from "../testing/encounterLayouts";
import {
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  chibiJumpScripts,
  chibiMovementProfile,
  groundMap,
  groundMask,
  mapTerrain,
  pursuitGroundMap,
} from "./movementMaps";

function areaOf(theme: string, id: string): AreaLayout {
  const layout = chunkLayout(theme, id);
  return layout.areas[layout.start.area]!;
}

function boss(area: AreaLayout, character: string): ObjectLayout {
  return area.objects.find((object) => object.character === character)!;
}

const ALLOW = () => true;

describe("boss movement profiles", () => {
  it("derives a walker from ground pursuit data", () => {
    const archie = boss(areaOf("city-streets", "patrol-cover-late"), "dog-antagonist");
    const pursuit = archie.behaviour!.states.pursuit!.motion;
    if (pursuit.kind !== "pursue" || pursuit.mode !== "ground" || !pursuit.traversal) {
      throw new Error("Expected ground pursuit");
    }
    const [entry, ...rest] = bossMovementProfiles(archie);
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({
      kind: "ground",
      profile: {
        gravity: pursuit.traversal.gravity,
        jumpSpeed: pursuit.traversal.jumpSpeed,
        walkSpeed: pursuit.traversal.speed,
      },
    });
    expect(entry?.kind === "ground" ? entry.profile.climb : "air").toBeUndefined();
  });

  it("gives a climber its vertical track as its climb", () => {
    const kiwi = boss(areaOf("city-outskirts", "vertical-stack-early"), "raccoon-antagonist");
    const [entry] = bossMovementProfiles(kiwi);
    expect(entry?.kind === "ground" ? entry.profile.climb : "air").toEqual({
      height: Math.abs(kiwi.behaviour!.distance),
      speed: (kiwi.behaviour!.states.climb!.motion as { speed: number }).speed,
    });
  });

  it("flies a flyer with its frame as the body", () => {
    const pebble = boss(areaOf("loading-yards", "bounded-flyer-post"), "pigeon-antagonist");
    const entries = bossMovementProfiles(pebble);
    expect(entries.map(({ kind }) => kind)).toEqual(["air"]);
    expect(entries[0]!.profile.body).toEqual({
      height: pebble.height,
      offset: { x: 0, y: 0 },
      width: pebble.width,
    });
  });
});

describe("map terrain", () => {
  it("builds crumbling supports intact and masks them through deps", () => {
    const area = areaOf("city-streets", "crumbling-support-crossing");
    const terrain = mapTerrain({}, area);
    const map = groundMap(
      { jumps: chibiJumpScripts(ORDINARY) },
      terrain,
      chibiMovementProfile(ORDINARY),
    );
    const crumbling = map.nodes.filter(({ kind }) => kind === "crumbling");
    expect(crumbling.length).toBeGreaterThan(0);
    expect(crumbling.every(({ deps, supportId }) => deps.includes(supportId))).toBe(true);
    const fallen = groundMask(
      { allowed: (id) => !terrain.crumbling.has(id), climb: false, key: "fallen" },
      map,
    );
    expect(crumbling.some(({ id }) => fallen.node(id))).toBe(false);
    expect(
      map.edges
        .filter(({ to }) => crumbling.some(({ id }) => id === to))
        .every(({ id }) => !fallen.edge(id, 0)),
    ).toBe(true);
  });

  it("keeps a timed hazard out of the static terrain and on the edges through it", () => {
    const area = areaOf("city-streets", "warned-vent-terrace");
    const vent = area.objects.find(({ character }) => character === "warned-vent")!;
    const terrain = mapTerrain({}, area);
    expect(terrain.hazards.some(({ owner }) => owner === vent)).toBe(false);
    const map = groundMap(
      { jumps: chibiJumpScripts(ORDINARY) },
      terrain,
      chibiMovementProfile(ORDINARY),
    );
    const through = map.edges.filter(({ deps }) => deps.includes(vent));
    expect(through.length).toBeGreaterThan(0);
    const closed = groundMask({ allowed: (id) => id !== vent, climb: false, key: "closed" }, map);
    expect(through.some(({ id }) => closed.edge(id, 0))).toBe(false);
  });

  it("leaves moving platforms out of the colliders", () => {
    const area = areaOf("city-streets", "city-boundary-lift");
    const lift = area.objects.find(({ character }) => character === "city-lift")!;
    const { colliders } = mapTerrain({}, area).area;
    expect(colliders.some(({ supportId }) => supportId === lift)).toBe(false);
  });

  it("blocks static hazards", () => {
    const area = areaOf("deep-woods", "growl-cover-late");
    const terrain = mapTerrain({}, area);
    expect(terrain.hazards.length).toBeGreaterThan(0);
    for (const { rect } of terrain.hazards) {
      expect(terrain.area.blocked(rect)).toBe(true);
    }
  });
});

describe("area movement maps", () => {
  it("builds each pursuer's map once per area and reads it from the cache", () => {
    const area = areaOf("city-streets", "patrol-cover-late");
    const archie = boss(area, "dog-antagonist");
    expect(pursuitGroundMap(area, archie, false)).toBeUndefined();
    const first = pursuitGroundMap(area, archie);
    expect(first).toBeDefined();
    expect(pursuitGroundMap(area, archie)).toBe(first);
    expect(pursuitGroundMap(area, archie, false)).toBe(first);
  });

  it("hashes identical builds identically", () => {
    const area = areaOf("city-streets", "patrol-cover-late");
    const entry = bossMovementProfiles(boss(area, "dog-antagonist"))[0]!;
    if (entry.kind !== "ground") {
      throw new Error("Expected ground");
    }
    const build = () => {
      const terrain = mapTerrain({}, area);
      return mapHash(
        terrain.depKey,
        groundMap({ jumps: BOSS_JUMP_SCRIPTS }, terrain, entry.profile),
      );
    };
    expect(build()).toBe(build());
    expect(build()).toMatchInlineSnapshot(`"678a9ce62bb25914"`);
  });

  it("disables climb edges for pursuit only", () => {
    const area = areaOf("city-outskirts", "vertical-stack-early");
    const entry = bossMovementProfiles(boss(area, "raccoon-antagonist"))[0]!;
    if (entry.kind !== "ground") {
      throw new Error("Expected ground");
    }
    const map = groundMap({ jumps: BOSS_JUMP_SCRIPTS }, mapTerrain({}, area), entry.profile);
    const climbs = map.edges.filter(({ kind }) => kind === "climb");
    expect(climbs.length).toBeGreaterThan(0);
    const pursuit = groundMask({ allowed: ALLOW, climb: false, key: "pursuit" }, map);
    const special = groundMask({ allowed: ALLOW, climb: true, key: "special" }, map);
    expect(climbs.every(({ id }) => !pursuit.edge(id, 0) && special.edge(id, 0))).toBe(true);
  });
});
