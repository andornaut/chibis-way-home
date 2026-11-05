import { rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import chandelierArt from "../../public/art/sprites/apartment-chandelier.json";
import chainArt from "../../public/art/sprites/apartment-chandelier-chain.json";
import mountArt from "../../public/art/sprites/apartment-chandelier-mount.json";
import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { MODULES } from "../data/modules";
import {
  CHANDELIER_SWING,
  chandelierOrbit,
  OBSTACLE_MOVER_PAUSE,
  OBSTACLE_MOVER_SPEED,
} from "../data/obstacleTuning";
import { REACH } from "../data/reach";
import { TILE } from "../data/screen";
import type { BehaviourPlan, Character, Instance, Point, Rect } from "../data/types";
import { artOffset, spokeSegments, tetherLine } from "../presentation";
import { SKILL_PROFILES } from "../progress";
import {
  CHANDELIER_FIXTURE,
  CHANDELIER_FIXTURE_CATALOGUE,
  CHANDELIER_FIXTURE_LIBRARY,
} from "../testing/chunks";
import { HITBOXES, TILESETS } from "../testing/walkSuite";
import { type ChunkLibrary, zonePlanOf } from "./assemble";
import { startBird } from "./bird";
import { chandelierPlacementProblems } from "./chandelierPlacement";
import { effectiveCollision } from "./effectiveCollision";
import { chibiJumpScripts, chibiMovementProfile, groundMap, mapTerrain } from "./movementMaps";
import { orbitBounds, pendulumCycleSeconds } from "./orbit";
import { standsOn } from "./platformBird";
import { areaLayout, zoneLayout } from "./tiles";
import { windmillPlacementProblems } from "./windmillPlacement";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "./zone";
import { CHUNK_LIBRARY } from "./zonePlans";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const { amplitude } = CHANDELIER_SWING;
const LENGTH = CHANDELIER_SWING.length * TILE;
// One end to the other along the arc at the rim's centre, at the obstacle mover speed.
const SWING_SECONDS = (2 * amplitude * CHANDELIER_SWING.length) / OBSTACLE_MOVER_SPEED;
const CYCLE_SECONDS = pendulumCycleSeconds(chandelierOrbit("mount", 0));
const CYCLE_TICKS = Math.round(CYCLE_SECONDS / STEP_SECONDS);
// User-approved route-budget exception for the 4 tiles/s chandelier over the ordinary 600 ticks:
// the fixture's route proof measured this many ticks from chunk entry to the exit.
const CHANDELIER_ROUTE_TICKS = 880;
// Art's pivot pixel in the apartment-chandelier-mount sprite.
const PIVOT_PIXEL = { x: 12, y: 6 };
const PIVOT = { x: CHANDELIER_FIXTURE.pivot.col * TILE, y: CHANDELIER_FIXTURE.pivot.row * TILE };
const BANK_TOP = CHANDELIER_FIXTURE.near.row * TILE;
const NEAR_RIGHT = (CHANDELIER_FIXTURE.near.col + CHANDELIER_FIXTURE.near.cols) * TILE;
const FAR_LEFT = CHANDELIER_FIXTURE.far.col * TILE;
const NEAR_FLOOR_TOP = CHANDELIER_FIXTURE.nearFloor.row * TILE;
const FAR_FLOOR_TOP = CHANDELIER_FIXTURE.farFloor.row * TILE;
const FAR_FLOOR_LEFT = CHANDELIER_FIXTURE.farFloor.col * TILE;

function fixture(
  library: ChunkLibrary = CHANDELIER_FIXTURE_LIBRARY,
  characters: Readonly<Record<string, Character>> = CHANDELIER_FIXTURE_CATALOGUE.characters,
  chunk = "test-chandelier",
) {
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "test", 2, [chunk]);
  const layout = zoneLayout(
    TILE,
    BIRD_FRAME,
    { ...CHANDELIER_FIXTURE_CATALOGUE, characters },
    HITBOXES,
    TILESETS,
    new Set(),
    plan,
  );
  const area = layout.areas[layout.start.area]!;
  const chandelier = area.objects.findIndex(({ character }) => character === "test-chandelier");
  const mount = area.objects.findIndex(({ character }) => character === "test-chandelier-mount");
  return { area, chandelier, layout, mount };
}

type Fixture = ReturnType<typeof fixture>;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const rimRect = (f: Fixture, zone: ZoneState): Rect => {
  const object = f.area.objects[f.chandelier]!;
  return { ...zone.objects[f.chandelier]!, height: object.height, width: object.width };
};
// The chandelier's top-left corner with its centre at angle from straight below the pivot.
const pose = (f: Fixture, angle: number): Point => {
  const object = f.area.objects[f.chandelier]!;
  return {
    x: PIVOT.x + LENGTH * Math.sin(angle) - object.width / 2,
    y: PIVOT.y + LENGTH * Math.cos(angle) - object.height / 2,
  };
};
const near = (a: Point, b: Point) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
const atEnd = (f: Fixture, zone: ZoneState, angle: number) =>
  near(zone.objects[f.chandelier]!, pose(f, angle));
const toward = (zone: ZoneState, goal: number): ZoneInput => ({
  ...idle,
  move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
});
const feet = (zone: ZoneState) => zone.bird.y + ordinary.height;
const onRim = (f: Fixture, zone: ZoneState) =>
  zone.bird.grounded && standsOn(ordinary, zone.bird, rimRect(f, zone));
const rimCentre = (f: Fixture, zone: ZoneState) =>
  zone.objects[f.chandelier]!.x + (f.area.objects[f.chandelier]!.width - ordinary.width) / 2;
const floorTop = (x: number) => (x < FAR_FLOOR_LEFT ? NEAR_FLOOR_TOP : FAR_FLOOR_TOP);

// From where he stands: left along the floors under the arc, hopping and jumping back up onto the
// near bank, along it to its edge, onto the chandelier once it holds at the near end, held still
// on it through the swing, then off to the right once it holds at the far end. Decides only from
// the chandelier's observed position and his own.
function ride(f: Fixture, start: ZoneState, limit: number) {
  let zone = start;
  let phase: "approach" | "board" | "climb" | "ride" | "exit" = "approach";
  let carried = 0;
  const edge = NEAR_RIGHT - ordinary.width - 2;
  let ticks = 0;
  for (; ticks < limit && !zone.cleared; ticks++) {
    let input: ZoneInput = idle;
    if (phase !== "climb" && zone.bird.grounded && !onRim(f, zone) && feet(zone) > BANK_TOP) {
      phase = "climb";
    }
    if (phase === "climb") {
      // Jump every 40 ticks against the step or wall to his left.
      input = { ...idle, jumpHeld: ticks % 40 < 30, move: -1 };
      if (zone.bird.grounded && feet(zone) === BANK_TOP && zone.bird.x < NEAR_RIGHT) {
        phase = "approach";
      }
    }
    if (phase === "approach") {
      input = toward(zone, edge);
      if (zone.bird.grounded && Math.abs(zone.bird.x - edge) <= 2 && atEnd(f, zone, -amplitude)) {
        phase = "board";
      }
    }
    if (phase === "board") {
      input = toward(zone, rimCentre(f, zone));
      if (onRim(f, zone) && input.move === 0) {
        phase = "ride";
      }
    }
    if (phase === "ride") {
      input = idle;
      if (atEnd(f, zone, amplitude)) {
        phase = "exit";
      }
    }
    if (phase === "exit") {
      input = { ...idle, move: 1 };
    }
    const before = { bird: { ...zone.bird }, rim: zone.objects[f.chandelier]! };
    zone = step(f, zone, input);
    expect(zone.death).toBeUndefined();
    if (phase === "ride" && before.bird.vx === 0 && onRim(f, zone)) {
      // Carried in both axes with the chandelier while he stands still on it.
      const moved = {
        x: zone.objects[f.chandelier]!.x - before.rim.x,
        y: zone.objects[f.chandelier]!.y - before.rim.y,
      };
      expect(zone.bird.x - before.bird.x).toBeCloseTo(moved.x, 6);
      expect(zone.bird.y - before.bird.y).toBeCloseTo(moved.y, 6);
      carried += Math.hypot(moved.x, moved.y);
    }
  }
  return { carried, phase, ticks, zone };
}

describe("chandelier swing", () => {
  it("swings end to end at the obstacle mover speed between holds at each end", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const runs: { from: Point; moving: boolean; ticks: number; to: Point }[] = [];
    for (let tick = 0; tick < CYCLE_TICKS + 30; tick++) {
      const from = zone.objects[f.chandelier]!;
      zone = step(f, zone, idle);
      const to = zone.objects[f.chandelier]!;
      const moving = from.x !== to.x || from.y !== to.y;
      // The rim's centre stays length from the pivot, below it.
      const object = f.area.objects[f.chandelier]!;
      const centre = { x: to.x + object.width / 2, y: to.y + object.height / 2 };
      expect(Math.hypot(centre.x - PIVOT.x, centre.y - PIVOT.y)).toBeCloseTo(LENGTH, 6);
      expect(centre.y).toBeGreaterThan(PIVOT.y);
      const last = runs.at(-1);
      if (last?.moving === moving) {
        last.ticks++;
        last.to = to;
      } else {
        runs.push({ from, moving, ticks: 1, to });
      }
    }
    // Starting on the swing back, then a hold at the near end, a swing, a hold at the far end.
    expect(runs.slice(0, 5).map(({ moving }) => moving)).toEqual([true, false, true, false, true]);
    const [back, nearHold, swing, farHold] = runs;
    expect(near(back!.to, pose(f, -amplitude))).toBe(true);
    for (const { ticks } of [nearHold!, farHold!]) {
      expect(Math.abs(ticks - OBSTACLE_MOVER_PAUSE / STEP_SECONDS)).toBeLessThanOrEqual(1);
    }
    // Within the step the swing starts and ends in.
    expect(Math.abs(swing!.ticks - SWING_SECONDS / STEP_SECONDS)).toBeLessThanOrEqual(2);
    expect(near(swing!.to, pose(f, amplitude))).toBe(true);
    // Through the swing the rim's centre moves along the arc at the obstacle mover speed.
    const holdStart = back!.ticks;
    for (const fraction of [0.1, 0.5, 0.9]) {
      zone = startZone(ordinary, f.layout, 1);
      const ticks =
        holdStart + nearHold!.ticks + Math.round((fraction * SWING_SECONDS) / STEP_SECONDS);
      for (let tick = 0; tick < ticks; tick++) {
        zone = step(f, zone, idle);
      }
      const before = zone.objects[f.chandelier]!;
      zone = step(f, zone, idle);
      const after = zone.objects[f.chandelier]!;
      expect(Math.hypot(after.x - before.x, after.y - before.y) / STEP_SECONDS).toBeCloseTo(
        OBSTACLE_MOVER_SPEED * TILE,
        2,
      );
    }
  });

  it("holds at the near end for the mover pause once every cycle", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const holding: number[] = [];
    for (let tick = 0; tick < 2 * CYCLE_TICKS; tick++) {
      if (atEnd(f, zone, -amplitude)) {
        holding.push(tick);
      }
      zone = step(f, zone, idle);
    }
    const gaps = holding.slice(1).map((tick, index) => tick - holding[index]!);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(
      CYCLE_TICKS - Math.round(OBSTACLE_MOVER_PAUSE / STEP_SECONDS) + 2,
    );
    expect(holding.length).toBeGreaterThanOrEqual(
      2 * Math.floor(OBSTACLE_MOVER_PAUSE / STEP_SECONDS),
    );
  });
});

describe("chandelier layout", () => {
  it("hangs a level one-way chandelier from the mount, which stands where the art draws it", () => {
    const { area, chandelier, mount } = fixture();
    const host = area.objects[mount]!;
    const object = area.objects[chandelier]!;
    expect(effectiveCollision(host, undefined)).toBe("none");
    expect(effectiveCollision(object, undefined)).toBe("ledge");
    expect(object.orbit).toMatchObject({ host: mount, kind: "pendulum", length: LENGTH });
    expect(object.tether).toEqual({ art: "apartment-chandelier-chain", kind: "pivot" });
    // The pivot is the mount's centre, on Art's pivot pixel in the sprite on the footprint.
    const offset = artOffset("sprite", host, sizeOf(mountArt));
    expect({
      x: host.origin.x + offset.x + PIVOT_PIXEL.x,
      y: host.origin.y + offset.y + PIVOT_PIXEL.y,
    }).toEqual(PIVOT);
    expect({ x: host.origin.x + host.width / 2, y: host.origin.y + host.height / 2 }).toEqual(
      PIVOT,
    );
    // The rim's lip is the sprite's top row, on the footprint's top.
    expect(sizeOf(chandelierArt)).toEqual({ height: object.height, width: object.width });
    expect(artOffset("sprite", object, sizeOf(chandelierArt))).toEqual({ x: 0, y: 0 });
    // The arc's bounds stay clear of every solid.
    const bounds = orbitBounds(area.objects, object);
    expect(area.solids.some((solid) => rectsOverlap(solid, bounds))).toBe(false);
  });

  it("holds level and flush with each bank at the ends, with the ride required", () => {
    const f = fixture();
    const object = f.area.objects[f.chandelier]!;
    const nearEnd = pose(f, -amplitude);
    const farEnd = pose(f, amplitude);
    expect(nearEnd.y).toBeCloseTo(BANK_TOP, 6);
    expect(farEnd.y).toBeCloseTo(BANK_TOP, 6);
    expect(nearEnd.x).toBeCloseTo(NEAR_RIGHT, 6);
    expect(farEnd.x + object.width).toBeCloseTo(FAR_LEFT, 6);
    // Beyond a running jump across, the far floor beyond a jump of the far bank, and each floor a
    // hop or a jump below the next one back.
    const [noCross] = CHANDELIER_FIXTURE_LIBRARY.chunks["test-chandelier"]!.noCross!;
    expect(noCross!.to.col - noCross!.from.col).toBeGreaterThan(REACH.gap);
    expect(CHANDELIER_FIXTURE.far.col - CHANDELIER_FIXTURE.nearFloor.col).toBeGreaterThan(
      REACH.gap,
    );
    expect(CHANDELIER_FIXTURE.farFloor.row - CHANDELIER_FIXTURE.far.row).toBeGreaterThan(
      REACH.jump,
    );
    expect(CHANDELIER_FIXTURE.farFloor.row - CHANDELIER_FIXTURE.nearFloor.row).toBeLessThanOrEqual(
      REACH.hop,
    );
    expect(CHANDELIER_FIXTURE.nearFloor.row - CHANDELIER_FIXTURE.near.row).toBeLessThanOrEqual(
      REACH.jump,
    );
  });

  const catalogue = (characters: Readonly<Record<string, Character>>) => ({
    ...CHANDELIER_FIXTURE_CATALOGUE,
    characters: { ...CHANDELIER_FIXTURE_CATALOGUE.characters, ...characters },
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
  const mount: Instance = { character: "test-chandelier-mount", col: 24, id: "mount", row: 10 };
  const STILL: BehaviourPlan = {
    axis: "x",
    distance: 0,
    initial: "still",
    states: { still: { animation: "idle", motion: { kind: "wait" }, transitions: [] } },
  };
  // The reference pose at the near end below that mount: centre (17, 16.5) tiles, 8 left of the
  // pivot and 6 below it.
  const chandelier: Instance = {
    character: "test-chandelier",
    col: 14,
    orbit: chandelierOrbit("mount", 0),
    row: 15.5,
    tether: { art: "apartment-chandelier-chain" },
  };
  const swing = chandelier.orbit as ReturnType<typeof chandelierOrbit>;

  it("accepts a chandelier below a static mount", () => {
    expect(() => area([mount, chandelier])).not.toThrow();
  });

  it.each([
    [
      "a moving mount",
      [{ ...mount, character: "test-mover" }, chandelier],
      /Unsupported orbit host/,
    ],
    [
      "a mount with a behaviour",
      [{ ...mount, behaviour: STILL }, chandelier],
      /Unsupported orbit host/,
    ],
    [
      "a chandelier with a behaviour",
      [mount, { ...chandelier, character: "test-busy-chandelier" }],
      /inert/,
    ],
    [
      "a swinging hazard",
      [mount, { ...chandelier, character: "test-hazard" }],
      /pendulum orbit requires a ledge/,
    ],
    [
      "no swing speed",
      [mount, { ...chandelier, orbit: { ...swing, angularSpeed: 0 } }],
      /Invalid orbit configuration/,
    ],
    [
      "a quarter-turn amplitude",
      [mount, { ...chandelier, orbit: { ...swing, amplitude: Math.PI / 2 } }],
      /Invalid orbit configuration/,
    ],
    [
      "no length",
      [mount, { ...chandelier, orbit: { ...swing, length: 0 } }],
      /Invalid orbit configuration/,
    ],
    [
      "a negative pause",
      [mount, { ...chandelier, orbit: { ...swing, pause: -1 } }],
      /Invalid orbit configuration/,
    ],
    [
      "a whole-cycle phase",
      [mount, { ...chandelier, orbit: { ...swing, phase: 1 } }],
      /Invalid orbit configuration/,
    ],
    [
      "a rail row on its tether",
      [mount, { ...chandelier, tether: { art: "apartment-chandelier-chain", row: -4 } }],
      /no rail row/,
    ],
    ["a pose off its path", [mount, { ...chandelier, col: 15 }], /reference pose/],
  ] as const)("refuses %s", (_, objects, error) => {
    expect(() =>
      area(objects, {
        "test-busy-chandelier": {
          ...CHANDELIER_FIXTURE_CATALOGUE.characters["test-chandelier"]!,
          behaviour: STILL,
        },
      }),
    ).toThrow(error);
  });
});

describe("chandelier tether", () => {
  it("runs the chain from the mount's centre to the rim's top centre at every pose", () => {
    const f = fixture();
    const size = sizeOf(chainArt).width;
    const object = f.area.objects[f.chandelier]!;
    let zone = startZone(ordinary, f.layout, 1);
    for (let tick = 0; tick < CYCLE_TICKS; tick += 45) {
      const at = zone.objects[f.chandelier]!;
      const line = tetherLine(f.area.objects, zone.objects, object, at)!;
      const anchor = { x: at.x + object.width / 2, y: at.y };
      expect(line).toEqual({ anchor, kind: "pivot", pivot: PIVOT });
      const segments = spokeSegments(size, PIVOT, anchor);
      const length = Math.hypot(anchor.x - PIVOT.x, anchor.y - PIVOT.y);
      expect(segments).toHaveLength(Math.floor(length / size));
      const centres = segments.map(({ x, y }) => ({ x: x + size / 2, y: y + size / 2 }));
      // Unrotated squares centred on the line, size apart, the last half a link from the rim.
      for (const centre of centres) {
        const cross =
          (anchor.x - PIVOT.x) * (centre.y - PIVOT.y) - (anchor.y - PIVOT.y) * (centre.x - PIVOT.x);
        expect(cross / length).toBeCloseTo(0, 6);
      }
      centres
        .slice(1)
        .forEach((centre, i) =>
          expect(Math.hypot(centre.x - centres[i]!.x, centre.y - centres[i]!.y)).toBeCloseTo(size),
        );
      expect(Math.hypot(anchor.x - centres.at(-1)!.x, anchor.y - centres.at(-1)!.y)).toBeCloseTo(
        size / 2,
      );
      for (let next = 0; next < 45; next++) {
        zone = step(f, zone, idle);
      }
    }
  });
});

describe("chandelier ride", () => {
  it.each([
    ["near", CHANDELIER_FIXTURE.nearFloor.col + 4, NEAR_FLOOR_TOP],
    ["far", CHANDELIER_FIXTURE.farFloor.col + 6, FAR_FLOOR_TOP],
  ])("rejoins the ride from the %s floor by climbing back onto the near bank", (_, col, top) => {
    const f = fixture();
    const start = startZone(ordinary, f.layout, 1);
    const fallen = { ...start, bird: startBird(ordinary, { x: col * TILE, y: top }) };
    const { carried, zone } = ride(f, fallen, 4 * CHANDELIER_ROUTE_TICKS);
    expect(zone.cleared).toBe(true);
    expect(carried).toBeGreaterThan(2 * LENGTH * Math.sin(amplitude) - 1);
  });

  it("drops him from under the rim at any pose with room beneath onto a floor under the arc", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const landings = new Set<string>();
    let drops = 0;
    for (let tick = 0; tick < CYCLE_TICKS; tick += 30) {
      const rect = rimRect(f, zone);
      const x = rect.x + rect.width / 2;
      const start = rect.y + rect.height + ordinary.height;
      if (start <= floorTop(x)) {
        drops++;
        let fall: ZoneState = {
          ...zone,
          bird: { ...startBird(ordinary, { x, y: start }), grounded: false },
        };
        for (let t = 0; t < 240 && !fall.bird.grounded; t++) {
          fall = step(f, fall, idle);
          expect(fall.death).toBeUndefined();
        }
        expect(fall.bird.grounded).toBe(true);
        landings.add(
          feet(fall) === NEAR_FLOOR_TOP ? "near" : feet(fall) === FAR_FLOOR_TOP ? "far" : "other",
        );
      }
      for (let next = 0; next < 30; next++) {
        zone = step(f, zone, idle);
      }
    }
    expect(drops).toBeGreaterThan(CYCLE_TICKS / 30 / 4);
    expect([...landings].sort()).toEqual(["far", "near"]);
  });

  it("lets transients pass through the chandelier, where a fixed ledge would stop them", () => {
    // A parcel dropped above the chandelier holding at the near end, from a dropper appended last.
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
    const chunk = CHANDELIER_FIXTURE_LIBRARY.chunks["test-chandelier"]!;
    const [mountInstance, swinging] = chunk.objects as [Instance, Instance];
    // Held at the near end from area entry, so the parcel falls onto its rim.
    const holding: Instance = {
      ...swinging,
      col: CHANDELIER_FIXTURE.near.cols,
      orbit: chandelierOrbit("mount", 0),
      row: CHANDELIER_FIXTURE.near.row,
    };
    const dropper: Instance = {
      behaviour: parcel,
      character: "test-chandelier-dropper",
      col: holding.col + 2,
      row: holding.row - 4,
    };
    const characters = {
      ...CHANDELIER_FIXTURE_CATALOGUE.characters,
      "test-chandelier-dropper": {
        archetype: "scenery",
        art: "placeholder-dropper",
        cols: 2,
        rows: 2,
      },
    };
    const library = (objects: readonly Instance[]): ChunkLibrary => ({
      ...CHANDELIER_FIXTURE_LIBRARY,
      characters,
      chunks: { "test-chandelier": { ...chunk, objects } },
    });
    // The parcel's lowest top edge before it lands or expires.
    const lowest = (objects: readonly Instance[]) => {
      const f = fixture(library(objects), characters);
      let zone = startZone(ordinary, f.layout, 1);
      let y = -Infinity;
      for (let tick = 0; tick < Math.round(OBSTACLE_MOVER_PAUSE / STEP_SECONDS); tick++) {
        zone = step(f, zone, idle);
        for (const { at } of zone.transients) {
          y = Math.max(y, at.y);
        }
      }
      return y;
    };
    const rimBottom = (holding.row + 2) * TILE;
    expect(lowest([mountInstance, holding, dropper])).toBeGreaterThan(rimBottom);
    // The same ledge fixed in place catches it on its top.
    const fixed = { character: "test-chandelier", col: holding.col, row: holding.row };
    expect(lowest([mountInstance, fixed, dropper])).toBeLessThan(holding.row * TILE);
  });
});

describe("chandelier route", () => {
  it("boards at the near hold, rides across and exits within its recorded budget", () => {
    const f = fixture();
    const { carried, ticks, zone } = ride(
      f,
      startZone(ordinary, f.layout, 1),
      2 * CHANDELIER_ROUTE_TICKS,
    );
    expect(zone.cleared).toBe(true);
    // End to end at least, carried on the chandelier.
    expect(carried).toBeGreaterThan(2 * LENGTH * Math.sin(amplitude) - 1);
    console.info("Chandelier fixture route ticks", ticks);
    expect(ticks).toBeLessThanOrEqual(CHANDELIER_ROUTE_TICKS);
  });
});

describe("chandelier boss maps", () => {
  it("leaves the chandelier and mount out of the movement map, so no boss perches on them", () => {
    const swinging = fixture();
    const chunk = CHANDELIER_FIXTURE_LIBRARY.chunks["test-chandelier"]!;
    const without = fixture({
      ...CHANDELIER_FIXTURE_LIBRARY,
      chunks: { "test-chandelier": { ...chunk, objects: chunk.objects.slice(0, 1) } },
    });
    const terrain = mapTerrain({}, swinging.area);
    const owners = [swinging.mount, swinging.chandelier].map(
      (index) => swinging.area.objects[index]!,
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
    const swung = map(swinging.area);
    const plain = map(without.area);
    expect(swung.nodes.map(({ deps, id }) => [id, deps.length])).toEqual(
      plain.nodes.map(({ deps, id }) => [id, deps.length]),
    );
    expect(swung.edges.length).toBe(plain.edges.length);
  });
});

describe("chandelier placement", () => {
  const chunk = CHANDELIER_FIXTURE_LIBRARY.chunks["test-chandelier"]!;
  const problems = (plan: typeof chunk) =>
    chandelierPlacementProblems(CHANDELIER_FIXTURE_CATALOGUE, plan);

  it("keeps every pooled chunk and module's chandeliers clear of encounters and module edges", () => {
    const catalogue = {
      archetypes: CHANDELIER_FIXTURE_CATALOGUE.archetypes,
      characters: CHARACTERS,
    };
    for (const [id, plan] of Object.entries(CHUNK_LIBRARY.chunks)) {
      expect([id, chandelierPlacementProblems(catalogue, plan)]).toEqual([id, []]);
    }
    for (const [id, module] of Object.entries(MODULES)) {
      expect([id, chandelierPlacementProblems(catalogue, { ...module, cols: 30 })]).toEqual([
        id,
        [],
      ]);
    }
    expect(problems(chunk)).toEqual([]);
    // A chandelier is no windmill sail, so the windmill's encounter-free chunk rule leaves it be.
    expect(
      windmillPlacementProblems(CHANDELIER_FIXTURE_CATALOGUE, { ...chunk, encounters: 1 }),
    ).toEqual([]);
  });

  it("flags an encounter or pursuing boss in the chandelier's module, not in the paired one", () => {
    const beside = (col: number, instance: Omit<Instance, "col" | "row">) =>
      problems({
        ...chunk,
        objects: [...chunk.objects, { ...instance, col, row: 46 } as Instance],
      });
    const antagonist = { character: "test-hazard", role: "antagonist" };
    expect(beside(40, antagonist)).toEqual(["chandelier module beside antagonist test-hazard"]);
    expect(beside(40, { character: "bear-antagonist" })).toEqual([
      "chandelier module beside pursuing bear-antagonist",
    ]);
    expect(beside(4, antagonist)).toEqual([]);
    expect(beside(4, { character: "bear-antagonist" })).toEqual([]);
  });

  it("flags an arc whose bounds or chain come within the footing of a module edge", () => {
    // Four cols left, the arc's left bounds and its chain, 3 cols inside them, reach within 4
    // cols of the join at col 30.
    const shifted = {
      ...chunk,
      objects: chunk.objects.map((instance) => ({ ...instance, col: instance.col - 4 })),
    };
    const swinging = shifted.objects[1]!;
    expect(problems(shifted)).toEqual(
      ["bounds", "tether"].map(
        (name) =>
          `test-chandelier at col ${swinging.col} ${name} within 4 cols of the module edge at col 30`,
      ),
    );
    // Two cols left, only the bounds do.
    const nudged = {
      ...chunk,
      objects: chunk.objects.map((instance) => ({ ...instance, col: instance.col - 2 })),
    };
    expect(problems(nudged)).toEqual([
      `test-chandelier at col ${nudged.objects[1]!.col} bounds within 4 cols of the module edge at col 30`,
    ]);
  });
});

// A sprite sheet's frame size.
function sizeOf(sheet: {
  readonly frames: Readonly<Record<string, { readonly frame: { h: number; w: number } }>>;
}) {
  const { frame } = Object.values(sheet.frames)[0]!;
  return { height: frame.h, width: frame.w };
}
