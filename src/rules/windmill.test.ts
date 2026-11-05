import { rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { MODULES } from "../data/modules";
import {
  OBSTACLE_MOVER_PAUSE,
  OBSTACLE_MOVER_SPEED,
  WINDMILL_SAILS,
  windmillSailOrbit,
} from "../data/obstacleTuning";
import { REACH } from "../data/reach";
import { TILE } from "../data/screen";
import type { BehaviourPlan, Character, Instance, Point, Rect } from "../data/types";
import { artOffset, spokeSegments, tetherLine } from "../presentation";
import { SKILL_PROFILES } from "../progress";
import {
  WINDMILL_FIXTURE,
  WINDMILL_FIXTURE_CATALOGUE,
  WINDMILL_FIXTURE_LIBRARY,
} from "../testing/chunks";
import { HITBOXES, TILESETS } from "../testing/walkSuite";
import { type ChunkLibrary, zonePlanOf } from "./assemble";
import { startBird } from "./bird";
import { effectiveCollision } from "./effectiveCollision";
import { chibiJumpScripts, chibiMovementProfile, groundMap, mapTerrain } from "./movementMaps";
import { orbitBounds } from "./orbit";
import { standsOn } from "./platformBird";
import { areaLayout, zoneLayout } from "./tiles";
import { windmillPlacementProblems } from "./windmillPlacement";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "./zone";
import { CHUNK_LIBRARY } from "./zonePlans";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const RADIUS = WINDMILL_SAILS.radius * TILE;
// A quarter turn's arc at the sail centres, at the obstacle mover speed, then the stop before it.
const QUARTER_SECONDS = ((Math.PI / 2) * WINDMILL_SAILS.radius) / OBSTACLE_MOVER_SPEED;
const SPAN_SECONDS = OBSTACLE_MOVER_PAUSE + QUARTER_SECONDS;
const SPAN_TICKS = Math.round(SPAN_SECONDS / STEP_SECONDS);
const TURN_TICKS = WINDMILL_SAILS.count * SPAN_TICKS;
// User-approved route-budget exception for the 4 tiles/s windmill over the ordinary 600 ticks: the
// fixture's route proof measured this many ticks from chunk entry to the exit.
const WINDMILL_ROUTE_TICKS = 937;
// Art's hub pixel in the countryside-windmill backdrop.
const HUB_PIXEL = { x: 72, y: 72 };
const HUB = { x: WINDMILL_FIXTURE.hub.col * TILE, y: WINDMILL_FIXTURE.hub.row * TILE };
const APPROACH_TOP = WINDMILL_FIXTURE.approach.row * TILE;
const APPROACH_RIGHT = (WINDMILL_FIXTURE.approach.col + WINDMILL_FIXTURE.approach.cols) * TILE;
const TROUGH_TOP = WINDMILL_FIXTURE.trough.row * TILE;

function fixture(
  library: ChunkLibrary = WINDMILL_FIXTURE_LIBRARY,
  characters: Readonly<Record<string, Character>> = WINDMILL_FIXTURE_CATALOGUE.characters,
  chunk = "test-windmill",
) {
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "test", 2, [chunk]);
  const layout = zoneLayout(
    TILE,
    BIRD_FRAME,
    { ...WINDMILL_FIXTURE_CATALOGUE, characters },
    HITBOXES,
    TILESETS,
    new Set(),
    plan,
  );
  const area = layout.areas[layout.start.area]!;
  const sails = area.objects.flatMap((object, index) =>
    object.character === "test-windmill-sail" ? [index] : [],
  );
  const hub = area.objects.findIndex(({ character }) => character === "test-windmill");
  return { area, hub, layout, sails };
}

type Fixture = ReturnType<typeof fixture>;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const sailRect = (f: Fixture, zone: ZoneState, sail: number): Rect => {
  const object = f.area.objects[sail]!;
  return { ...zone.objects[sail]!, height: object.height, width: object.width };
};
// A sail's top-left corner with its centre at angle about the hub.
const pose = (f: Fixture, angle: number): Point => {
  const object = f.area.objects[f.sails[0]!]!;
  return {
    x: HUB.x + RADIUS * Math.cos(angle) - object.width / 2,
    y: HUB.y + RADIUS * Math.sin(angle) - object.height / 2,
  };
};
const near = (a: Point, b: Point) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
// The sail stopped at angle, if one is there.
const sailAt = (f: Fixture, zone: ZoneState, angle: number) =>
  f.sails.find((sail) => near(zone.objects[sail]!, pose(f, angle)));
const toward = (zone: ZoneState, goal: number): ZoneInput => ({
  ...idle,
  move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
});
const feet = (zone: ZoneState) => zone.bird.y + ordinary.height;
const onSail = (f: Fixture, zone: ZoneState, sail: number) =>
  zone.bird.grounded && standsOn(ordinary, zone.bird, sailRect(f, zone, sail));
const sailCentre = (f: Fixture, zone: ZoneState, sail: number) =>
  zone.objects[sail]!.x + (f.area.objects[sail]!.width - ordinary.width) / 2;

// From where he stands: up out of the trough onto the approach, along it to its edge, onto the
// sail stopped at the bottom, held still on it through the quarter turn, then off to the right
// when it stops level with the exit bank. Decides only from the sails' observed positions.
function ride(f: Fixture, start: ZoneState, limit: number) {
  let zone = start;
  let phase: "approach" | "climb" | "jump" | "ride" | "exit" = "approach";
  let sail: number | undefined;
  let carried = 0;
  let airborne = false;
  const edge = APPROACH_RIGHT - ordinary.width - 2;
  let ticks = 0;
  for (; ticks < limit && !zone.cleared; ticks++) {
    let input: ZoneInput = idle;
    if (phase === "approach" && zone.bird.grounded && feet(zone) === TROUGH_TOP) {
      phase = "climb";
    }
    if (phase === "climb") {
      input =
        zone.bird.x > APPROACH_RIGHT + 4
          ? toward(zone, APPROACH_RIGHT + 2)
          : { ...idle, jumpHeld: true, move: -1 };
      if (zone.bird.grounded && feet(zone) === APPROACH_TOP) {
        phase = "approach";
      }
    }
    if (phase === "approach") {
      input = toward(zone, edge);
      sail = sailAt(f, zone, Math.PI / 2);
      if (zone.bird.grounded && Math.abs(zone.bird.x - edge) <= 2 && sail !== undefined) {
        phase = "jump";
      }
    }
    if (phase === "jump") {
      input = { ...toward(zone, sailCentre(f, zone, sail!)), jumpHeld: true };
      airborne ||= !zone.bird.grounded;
      if (onSail(f, zone, sail!)) {
        phase = "ride";
      } else if (airborne && zone.bird.grounded) {
        // Missed: back to the approach, or up out of the trough.
        airborne = false;
        phase = feet(zone) === TROUGH_TOP ? "climb" : "approach";
        input = idle;
      }
    }
    if (phase === "ride") {
      input = idle;
      if (near(zone.objects[sail!]!, pose(f, 0))) {
        phase = "exit";
      }
    }
    if (phase === "exit") {
      input = { ...idle, move: 1 };
    }
    const before = {
      bird: { ...zone.bird },
      sail: sail === undefined ? undefined : zone.objects[sail]!,
    };
    zone = step(f, zone, input);
    expect(zone.death).toBeUndefined();
    if (phase === "ride" && before.sail && before.bird.vx === 0 && onSail(f, zone, sail!)) {
      // Carried in both axes with the sail while he stands still on it.
      const moved = {
        x: zone.objects[sail!]!.x - before.sail.x,
        y: zone.objects[sail!]!.y - before.sail.y,
      };
      expect(zone.bird.x - before.bird.x).toBeCloseTo(moved.x, 6);
      expect(zone.bird.y - before.bird.y).toBeCloseTo(moved.y, 6);
      carried += Math.hypot(moved.x, moved.y);
    }
  }
  return { carried, phase, sail, ticks, zone };
}

describe("windmill sails", () => {
  it("turns each quarter at the obstacle mover speed between stops at each quarter", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const sail = f.sails[0]!;
    const runs: { from: Point; moving: boolean; ticks: number; to: Point }[] = [];
    for (let tick = 0; tick < 2 * SPAN_TICKS + 30; tick++) {
      const from = zone.objects[sail]!;
      zone = step(f, zone, idle);
      const to = zone.objects[sail]!;
      const moving = from.x !== to.x || from.y !== to.y;
      // Every sail's centre stays a radius from the hub.
      for (const index of f.sails) {
        const object = f.area.objects[index]!;
        const at = zone.objects[index]!;
        expect(
          Math.hypot(at.x + object.width / 2 - HUB.x, at.y + object.height / 2 - HUB.y),
        ).toBeCloseTo(RADIUS, 6);
      }
      const last = runs.at(-1);
      if (last?.moving === moving) {
        last.ticks++;
        last.to = to;
      } else {
        runs.push({ from, moving, ticks: 1, to });
      }
    }
    expect(runs.slice(0, 5).map(({ moving }) => moving)).toEqual([false, true, false, true, false]);
    const [first, turn, stop, next] = runs;
    for (const { ticks } of [first!, stop!]) {
      expect(Math.abs(ticks - OBSTACLE_MOVER_PAUSE / STEP_SECONDS)).toBeLessThanOrEqual(1);
    }
    // Within the step each turn starts and ends in.
    for (const { ticks } of [turn!, next!]) {
      expect(Math.abs(ticks - QUARTER_SECONDS / STEP_SECONDS)).toBeLessThanOrEqual(2);
    }
    // From the bottom, rising on the right to hub height, then on to the top.
    expect(near(first!.from, pose(f, Math.PI / 2))).toBe(true);
    expect(near(turn!.to, pose(f, 0))).toBe(true);
    expect(near(next!.to, pose(f, -Math.PI / 2))).toBe(true);
    // Midway through a turn the sail centres move at the obstacle mover speed.
    zone = startZone(ordinary, f.layout, 1);
    for (
      let tick = 0;
      tick < Math.round((OBSTACLE_MOVER_PAUSE + QUARTER_SECONDS / 2) / STEP_SECONDS);
      tick++
    ) {
      zone = step(f, zone, idle);
    }
    const before = zone.objects[sail]!;
    zone = step(f, zone, idle);
    const after = zone.objects[sail]!;
    expect(Math.hypot(after.x - before.x, after.y - before.y) / STEP_SECONDS).toBeCloseTo(
      OBSTACLE_MOVER_SPEED * TILE,
      2,
    );
  });

  it("stops a sail at the bottom boarding pose at least every quarter turn", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const boarding: number[] = [];
    for (let tick = 0; tick < 2 * TURN_TICKS; tick++) {
      if (sailAt(f, zone, Math.PI / 2) !== undefined) {
        boarding.push(tick);
      }
      zone = step(f, zone, idle);
    }
    const gaps = boarding.slice(1).map((tick, index) => tick - boarding[index]!);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(Math.round(QUARTER_SECONDS / STEP_SECONDS) + 1);
    // Each stop holds the pose for the mover pause.
    expect(boarding.length).toBeGreaterThanOrEqual(
      2 * WINDMILL_SAILS.count * Math.floor(OBSTACLE_MOVER_PAUSE / STEP_SECONDS),
    );
  });
});

describe("windmill layout", () => {
  it("hangs four level one-way sails from the hub, which stands where the art draws it", () => {
    const { area, hub, sails } = fixture();
    expect(sails).toHaveLength(WINDMILL_SAILS.count);
    const host = area.objects[hub]!;
    expect(effectiveCollision(host, undefined)).toBe("none");
    for (const index of sails) {
      const object = area.objects[index]!;
      expect(effectiveCollision(object, undefined)).toBe("ledge");
      expect(object.orbit).toMatchObject({ host: hub, kind: "circle", radius: RADIUS });
      expect(object.tether).toEqual({ art: "windmill-spoke", kind: "pivot" });
    }
    // The pivot is the hub's centre, on Art's hub pixel in the backdrop standing on its bottom.
    const art = manifest.backdrops.find(({ key }) => key === "countryside-windmill")!;
    const offset = artOffset("backdrop", host, art);
    expect({
      x: host.origin.x + offset.x + HUB_PIXEL.x,
      y: host.origin.y + offset.y + HUB_PIXEL.y,
    }).toEqual({ x: host.origin.x + host.width / 2, y: host.origin.y + host.height / 2 });
    expect({ x: host.origin.x + host.width / 2, y: host.origin.y + host.height / 2 }).toEqual(HUB);
    // The swept bounds stay clear of every solid and inside the area.
    for (const index of sails) {
      const bounds = orbitBounds(area.objects, area.objects[index]!);
      expect(area.solids.some((solid) => rectsOverlap(solid, bounds))).toBe(false);
    }
  });

  it("stops a sail level and flush with the exit bank, and one within a jump of the approach", () => {
    const f = fixture();
    const sail = f.area.objects[f.sails[0]!]!;
    const risen = pose(f, 0);
    const bottom = pose(f, Math.PI / 2);
    expect(risen.y).toBe(WINDMILL_FIXTURE.exit.row * TILE);
    expect(risen.x + sail.width).toBe(WINDMILL_FIXTURE.exit.col * TILE);
    expect((APPROACH_TOP - bottom.y) / TILE).toBeLessThanOrEqual(REACH.jump);
    expect((bottom.x - APPROACH_RIGHT) / TILE).toBeLessThan(REACH.gap);
    // The ride is required: the exit bank is beyond a jump from the approach, and the trough
    // climbs back onto the approach.
    const [noCross] = WINDMILL_FIXTURE_LIBRARY.chunks["test-windmill"]!.noCross!;
    expect(noCross!.from.row - noCross!.to.row).toBeGreaterThan(REACH.jump);
    expect(WINDMILL_FIXTURE.trough.row - WINDMILL_FIXTURE.approach.row).toBeLessThanOrEqual(
      REACH.jump,
    );
  });

  const catalogue = (characters: Readonly<Record<string, Character>>) => ({
    ...WINDMILL_FIXTURE_CATALOGUE,
    characters: { ...WINDMILL_FIXTURE_CATALOGUE.characters, ...characters },
  });
  const area = (
    objects: readonly Instance[],
    characters: Readonly<Record<string, Character>> = {},
  ) =>
    areaLayout(TILE, catalogue(characters), HITBOXES, TILESETS, new Set(), {
      cols: 60,
      entries: { start: { col: 2, row: 58 } },
      objects,
      rows: 60,
      solids: [{ col: 0, cols: 60, row: 58, rows: 2 }],
    });
  const hub: Instance = { character: "test-windmill", col: 24, id: "hub", row: 10 };
  const STILL: BehaviourPlan = {
    axis: "x",
    distance: 0,
    initial: "still",
    states: { still: { animation: "idle", motion: { kind: "wait" }, transitions: [] } },
  };
  // Sail 0's reference pose about that hub: centre (30, 24) tiles, 7 below it.
  const sail: Instance = {
    character: "test-windmill-sail",
    col: 27.5,
    orbit: windmillSailOrbit("hub", 0),
    row: 30.5,
    tether: { art: "windmill-spoke" },
  };
  const turning = windmillSailOrbit("hub", 0);

  it("accepts a sail about a static hub", () => {
    expect(() => area([hub, sail])).not.toThrow();
  });

  it.each([
    ["a moving hub", [{ ...hub, character: "test-mover" }, sail], /Unsupported orbit host/],
    ["a hub with a behaviour", [{ ...hub, behaviour: STILL }, sail], /Unsupported orbit host/],
    ["a sail with a behaviour", [hub, { ...sail, character: "test-crane-sail" }], /inert/],
    [
      "stops on a hazard child",
      [hub, { ...sail, character: "test-hazard" }],
      /stops require a ledge/,
    ],
    [
      "no stop seconds",
      [hub, { ...sail, orbit: { ...turning, stops: { count: 4, seconds: 0 } } }],
      /Invalid orbit configuration/,
    ],
    [
      "a fractional stop count",
      [hub, { ...sail, orbit: { ...turning, stops: { count: 1.5, seconds: 1 } } }],
      /Invalid orbit configuration/,
    ],
    [
      "stops without turning",
      [hub, { ...sail, orbit: { ...turning, angularSpeed: 0 } }],
      /Invalid orbit configuration/,
    ],
    [
      "an unknown kind",
      [hub, { ...sail, orbit: { ...turning, kind: "spiral" as "circle" } }],
      /Invalid orbit configuration/,
    ],
    [
      "a rail row on its tether",
      [hub, { ...sail, tether: { art: "windmill-spoke", row: -4 } }],
      /no rail row/,
    ],
    ["a pose off its path", [hub, { ...sail, col: 28 }], /reference pose/],
  ] as const)("refuses %s", (_, objects, error) => {
    expect(() =>
      area(objects, {
        "test-crane-sail": {
          ...WINDMILL_FIXTURE_CATALOGUE.characters["test-windmill-sail"]!,
          behaviour: STILL,
        },
      }),
    ).toThrow(error);
  });
});

describe("windmill tether", () => {
  it("runs each spoke from the hub's centre to its sail's top centre at every pose", () => {
    const f = fixture();
    const size = 8;
    let zone = startZone(ordinary, f.layout, 1);
    for (let tick = 0; tick < TURN_TICKS; tick += 45) {
      for (const index of f.sails) {
        const object = f.area.objects[index]!;
        const at = zone.objects[index]!;
        const line = tetherLine(f.area.objects, zone.objects, object, at)!;
        const anchor = { x: at.x + object.width / 2, y: at.y };
        expect(line).toEqual({ anchor, kind: "pivot", pivot: HUB });
        const segments = spokeSegments(size, HUB, anchor);
        const length = Math.hypot(anchor.x - HUB.x, anchor.y - HUB.y);
        expect(segments).toHaveLength(Math.floor(length / size));
        const centres = segments.map(({ x, y }) => ({ x: x + size / 2, y: y + size / 2 }));
        // Unrotated squares centred on the line, size apart, the last half a segment from the sail.
        for (const centre of centres) {
          const cross =
            (anchor.x - HUB.x) * (centre.y - HUB.y) - (anchor.y - HUB.y) * (centre.x - HUB.x);
          expect(cross / length).toBeCloseTo(0, 6);
        }
        centres
          .slice(1)
          .forEach((centre, i) =>
            expect(Math.hypot(centre.x - centres[i]!.x, centre.y - centres[i]!.y)).toBeCloseTo(
              size,
            ),
          );
        const last = centres.at(-1)!;
        expect(Math.hypot(anchor.x - last.x, anchor.y - last.y)).toBeCloseTo(size / 2);
        expect(segments.every(({ tag }) => tag === "idle")).toBe(true);
      }
      for (let next = 0; next < 45; next++) {
        zone = step(f, zone, idle);
      }
    }
  });
});

describe("windmill ride", () => {
  it("rejoins the ride from the trough by climbing back onto the approach", () => {
    const f = fixture();
    const start = startZone(ordinary, f.layout, 1);
    const trough = {
      ...start,
      bird: startBird(ordinary, { x: (WINDMILL_FIXTURE.trough.col + 6) * TILE, y: TROUGH_TOP }),
    };
    const { carried, zone } = ride(f, trough, 3 * WINDMILL_ROUTE_TICKS);
    expect(zone.cleared).toBe(true);
    expect(carried).toBeGreaterThan(RADIUS);
  });

  it("drops him from under any sail pose onto the trough, the approach or another sail", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const landings = new Set<string>();
    for (let tick = 0; tick < TURN_TICKS; tick += 30) {
      for (const index of f.sails) {
        const rect = sailRect(f, zone, index);
        let fall: ZoneState = {
          ...zone,
          bird: {
            ...startBird(ordinary, {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height + ordinary.height,
            }),
            grounded: false,
          },
        };
        for (let t = 0; t < 240 && !fall.bird.grounded; t++) {
          fall = step(f, fall, idle);
          expect(fall.death).toBeUndefined();
        }
        expect(fall.bird.grounded).toBe(true);
        const support = [TROUGH_TOP, APPROACH_TOP].includes(feet(fall))
          ? feet(fall) === TROUGH_TOP
            ? "trough"
            : "approach"
          : f.sails.some((other) => onSail(f, fall, other))
            ? "sail"
            : "other";
        landings.add(support);
      }
      for (let next = 0; next < 30; next++) {
        zone = step(f, zone, idle);
      }
    }
    expect([...landings].sort()).toEqual(expect.arrayContaining(["trough"]));
    expect(landings.has("other")).toBe(false);
  });

  it("lets transients pass through the sails, where a fixed ledge would stop them", () => {
    // A parcel dropped above the sail stopped at the bottom, from a dropper appended last.
    const parcel: BehaviourPlan = {
      axis: "x",
      distance: 0,
      initial: "ready",
      states: {
        drop: {
          animation: "idle",
          motion: { kind: "wait" },
          onEnter: [
            {
              armSeconds: 0,
              character: "ferret-parcel",
              gravity: 24,
              kind: "spawn",
              lifeSeconds: 2,
              maxAlive: 1,
              offset: { x: 0, y: 0 },
              velocity: { x: 0, y: 6 },
            },
          ],
          transitions: [{ to: "ready", when: [{ kind: "elapsed", seconds: 10 }] }],
        },
        ready: {
          animation: "idle",
          motion: { kind: "wait" },
          transitions: [{ to: "drop", when: [{ kind: "elapsed", seconds: 0.05 }] }],
        },
      },
    };
    const chunk = WINDMILL_FIXTURE_LIBRARY.chunks["test-windmill"]!;
    const bottom = chunk.objects[1]!;
    const dropper: Instance = {
      behaviour: parcel,
      character: "test-windmill-dropper",
      col: bottom.col + 1.5,
      row: bottom.row - 4,
    };
    const characters = {
      ...WINDMILL_FIXTURE_CATALOGUE.characters,
      "test-windmill-dropper": {
        archetype: "scenery",
        art: "placeholder-dropper",
        cols: 2,
        rows: 2,
      },
    };
    const library = (objects: readonly Instance[]): ChunkLibrary => ({
      ...WINDMILL_FIXTURE_LIBRARY,
      characters,
      chunks: { "test-windmill": { ...chunk, objects } },
    });
    // The parcel's lowest top edge before it lands or expires.
    const lowest = (objects: readonly Instance[]) => {
      const f = fixture(library(objects), characters);
      let zone = startZone(ordinary, f.layout, 1);
      let y = -Infinity;
      for (let tick = 0; tick < Math.round(1 / STEP_SECONDS); tick++) {
        zone = step(f, zone, idle);
        for (const { at } of zone.transients) {
          y = Math.max(y, at.y);
        }
      }
      return y;
    };
    const sailBottom = (bottom.row + 1) * TILE;
    expect(lowest([...chunk.objects, dropper])).toBeGreaterThan(sailBottom);
    // The same ledge fixed in place catches it on its top.
    const fixed = { character: "test-windmill-sail", col: bottom.col, row: bottom.row };
    expect(lowest([chunk.objects[0]!, fixed, ...chunk.objects.slice(2), dropper])).toBeLessThan(
      bottom.row * TILE,
    );
  });
});

describe("windmill route", () => {
  it("boards the sail stopped at the bottom, rides it up and exits within its recorded budget", () => {
    const f = fixture();
    const { carried, ticks, zone } = ride(
      f,
      startZone(ordinary, f.layout, 1),
      2 * WINDMILL_ROUTE_TICKS,
    );
    expect(zone.cleared).toBe(true);
    // The quarter turn's chord at least, carried on the sail.
    expect(carried).toBeGreaterThan(RADIUS * Math.SQRT2 - 1);
    console.info("Windmill fixture route ticks", ticks);
    expect(ticks).toBeLessThanOrEqual(WINDMILL_ROUTE_TICKS);
  });
});

describe("windmill boss maps", () => {
  it("leaves the sails and hub out of the movement map, so no boss perches or stands on them", () => {
    const withSails = fixture();
    const chunk = WINDMILL_FIXTURE_LIBRARY.chunks["test-windmill"]!;
    const without = fixture({
      ...WINDMILL_FIXTURE_LIBRARY,
      chunks: { "test-windmill": { ...chunk, objects: chunk.objects.slice(0, 1) } },
    });
    const terrain = mapTerrain({}, withSails.area);
    const owners = [withSails.hub, ...withSails.sails].map(
      (index) => withSails.area.objects[index]!,
    );
    expect(
      terrain.area.colliders.some(({ supportId }) => owners.includes(supportId as never)),
    ).toBe(false);
    expect((terrain.world.platforms ?? []).some(({ owner }) => owners.includes(owner))).toBe(false);
    expect(owners.some((owner) => terrain.crumbling.has(owner))).toBe(false);
    expect(terrain.hazards.some(({ owner }) => owners.includes(owner))).toBe(false);
    const map = (area: Fixture["area"]) =>
      groundMap(
        { jumps: chibiJumpScripts(ordinary) },
        mapTerrain({}, area),
        chibiMovementProfile(ordinary),
      );
    const sailed = map(withSails.area);
    const plain = map(without.area);
    expect(sailed.nodes.map(({ deps, id }) => [id, deps.length])).toEqual(
      plain.nodes.map(({ deps, id }) => [id, deps.length]),
    );
    expect(sailed.edges.length).toBe(plain.edges.length);
  });
});

describe("windmill placement", () => {
  const chunk = WINDMILL_FIXTURE_LIBRARY.chunks["test-windmill"]!;
  const problems = (plan: typeof chunk) =>
    windmillPlacementProblems(WINDMILL_FIXTURE_CATALOGUE, plan);

  it("keeps every pooled chunk and module's sails out of encounters and clear of module edges", () => {
    const catalogue = { archetypes: WINDMILL_FIXTURE_CATALOGUE.archetypes, characters: CHARACTERS };
    for (const [id, plan] of Object.entries(CHUNK_LIBRARY.chunks)) {
      expect([id, windmillPlacementProblems(catalogue, plan)]).toEqual([id, []]);
    }
    for (const [id, module] of Object.entries(MODULES)) {
      expect([id, windmillPlacementProblems(catalogue, { ...module, cols: 30 })]).toEqual([id, []]);
    }
    expect(problems(chunk)).toEqual([]);
  });

  it("flags sails in an encounter chunk or beside a boss", () => {
    expect(problems({ ...chunk, encounters: 1 })).toEqual(["windmill with 1 encounters"]);
    expect(
      problems({
        ...chunk,
        objects: [
          ...chunk.objects,
          { character: "test-hazard", col: 4, role: "antagonist", row: 46 },
        ],
      }),
    ).toEqual(["windmill beside antagonist test-hazard"]);
    expect(
      problems({
        ...chunk,
        objects: [...chunk.objects, { character: "bear-antagonist", col: 4, row: 46 }],
      }),
    ).toEqual(["windmill beside pursuing bear-antagonist"]);
  });

  it("flags a wheel whose bounds or spokes come within the footing of a module edge", () => {
    // Four cols left, the wheel's left bounds reach within 4 cols of the join at col 30.
    const shifted = {
      ...chunk,
      objects: chunk.objects.map((instance) => ({ ...instance, col: instance.col - 4 })),
    };
    expect(problems(shifted)).toEqual(
      chunk.objects
        .slice(1)
        .map(
          (instance) =>
            `test-windmill-sail at col ${instance.col - 4} bounds within 4 cols of the module edge at col 30`,
        ),
    );
  });
});
