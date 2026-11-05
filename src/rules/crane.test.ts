import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { GANTRY_BEHAVIOUR, GANTRY_DISTANCE } from "../data/obstacleBehaviours";
import { OBSTACLE_MOVER_PAUSE, OBSTACLE_MOVER_SPEED } from "../data/obstacleTuning";
import { TILE } from "../data/screen";
import { tetherSegments } from "../presentation";
import { SKILL_PROFILES } from "../progress";
import { CRANE_FIXTURE, CRANE_FIXTURE_CATALOGUE, CRANE_FIXTURE_LIBRARY } from "../testing/chunks";
import { HITBOXES, TILESETS } from "../testing/walkSuite";
import { type ChunkLibrary, zonePlanOf } from "./assemble";
import { startBird } from "./bird";
import { effectiveCollision } from "./effectiveCollision";
import { mapTerrain } from "./movementMaps";
import { standsOn } from "./platformBird";
import { areaLayout, zoneLayout } from "./tiles";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "./zone";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const LID = CRANE_FIXTURE.row * TILE;
const DOCK_X = CRANE_FIXTURE.pit.col * TILE;
const FAR_X = DOCK_X + GANTRY_DISTANCE * TILE;
const LEG_SECONDS = GANTRY_DISTANCE / OBSTACLE_MOVER_SPEED;
const CYCLE_SECONDS = 2 * (LEG_SECONDS + OBSTACLE_MOVER_PAUSE);
// User-approved route-budget exception for the 4 tiles/s crane over the ordinary 600 ticks: the
// fixture's route proof measured 754 ticks from chunk entry to the exit.
const CRANE_ROUTE_TICKS = 754;

// The fixture as authored (a 2 s first dock pause), or with the plain gantry behaviour.
function fixture(behaviour?: typeof GANTRY_BEHAVIOUR, archetype?: "solid") {
  const chunk = CRANE_FIXTURE_LIBRARY.chunks["test-crane"]!;
  const characters = archetype
    ? {
        ...CRANE_FIXTURE_CATALOGUE.characters,
        "test-crane-container": {
          ...CRANE_FIXTURE_CATALOGUE.characters["test-crane-container"]!,
          archetype,
        },
      }
    : CRANE_FIXTURE_CATALOGUE.characters;
  const library: ChunkLibrary = {
    ...CRANE_FIXTURE_LIBRARY,
    characters,
    chunks: {
      "test-crane": {
        ...chunk,
        objects: chunk.objects.map((instance) =>
          behaviour && instance.character === "test-crane-container"
            ? { ...instance, behaviour }
            : instance,
        ),
      },
    },
  };
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "test", 2, ["test-crane"]);
  const layout = zoneLayout(
    TILE,
    BIRD_FRAME,
    { ...CRANE_FIXTURE_CATALOGUE, characters },
    HITBOXES,
    TILESETS,
    new Set(),
    plan,
  );
  const area = layout.areas[layout.start.area]!;
  const crane = area.objects.findIndex(({ character }) => character === "test-crane-container");
  return { area, crane, layout };
}

type Fixture = ReturnType<typeof fixture>;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const craneAt = (f: Fixture, zone: ZoneState) => zone.objects[f.crane]!;
// The container's x at a dock, within the float drift of its travel.
const docked = (x: number, dock: number) => Math.abs(x - dock) < 0.01;
const lidRect = (f: Fixture, zone: ZoneState) => ({
  ...craneAt(f, zone),
  height: f.area.objects[f.crane]!.height,
  width: f.area.objects[f.crane]!.width,
});
const onLid = (f: Fixture, zone: ZoneState) =>
  zone.bird.grounded && standsOn(ordinary, zone.bird, lidRect(f, zone));
const toward = (zone: ZoneState, goal: number): ZoneInput => ({
  ...idle,
  move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
});
// Chibi's body x centred on the lid at the container's current x.
const lidCentre = (f: Fixture, zone: ZoneState) =>
  craneAt(f, zone).x + (f.area.objects[f.crane]!.width - ordinary.width) / 2;

describe("gantry crane shuttle", () => {
  it("runs each leg at the obstacle mover speed between 1 s dock pauses", () => {
    const f = fixture(GANTRY_BEHAVIOUR);
    let zone = startZone(ordinary, f.layout, 1);
    const runs: { from: number; seconds: number; state: string; to: number }[] = [];
    for (let tick = 0; tick < Math.round((CYCLE_SECONDS + 1) / STEP_SECONDS); tick++) {
      const before = craneAt(f, zone).x;
      zone = step(f, zone, idle);
      const state = zone.behaviours[f.crane]!.stateKey;
      const last = runs.at(-1);
      if (last?.state === state) {
        last.seconds += STEP_SECONDS;
        last.to = craneAt(f, zone).x;
      } else {
        runs.push({ from: before, seconds: STEP_SECONDS, state, to: craneAt(f, zone).x });
      }
    }
    expect(runs.slice(0, 5).map(({ state }) => state)).toEqual([
      "wait-near",
      "forward",
      "wait-far",
      "back",
      "wait-near",
    ]);
    const [near, forward, far, back] = runs;
    expect(near!.seconds).toBeCloseTo(OBSTACLE_MOVER_PAUSE, 1);
    expect(far!.seconds).toBeCloseTo(OBSTACLE_MOVER_PAUSE, 1);
    expect(forward!.seconds).toBeCloseTo(LEG_SECONDS, 1);
    expect(back!.seconds).toBeCloseTo(LEG_SECONDS, 1);
    [DOCK_X, DOCK_X, FAR_X, FAR_X, DOCK_X].forEach((x, index) =>
      expect([near!.from, near!.to, forward!.to, far!.to, back!.to][index]).toBeCloseTo(x),
    );
    // Midway through a leg it moves at the obstacle mover speed.
    zone = startZone(ordinary, f.layout, 1);
    const sample = Math.round((OBSTACLE_MOVER_PAUSE + LEG_SECONDS / 2) / STEP_SECONDS);
    for (let tick = 0; tick < sample; tick++) {
      zone = step(f, zone, idle);
    }
    const before = craneAt(f, zone).x;
    zone = step(f, zone, idle);
    expect((craneAt(f, zone).x - before) / STEP_SECONDS).toBeCloseTo(OBSTACLE_MOVER_SPEED * TILE);
  });
});

describe("gantry crane layout", () => {
  it("resolves the ride's banks and column windows for the horizontal mover", () => {
    const { area, crane } = fixture();
    const transit = area.objects[crane]!.forcedTransit!;
    expect(transit.banks).toEqual([
      { id: "dock", purpose: "retreat", width: 4 * TILE, x: DOCK_X - 4 * TILE, y: LID },
      { id: "far", purpose: "forward", width: 4 * TILE, x: FAR_X + 6 * TILE, y: LID },
    ]);
    // Each bank is the module's footing, its top level with the lid.
    for (const [bank, solid] of [
      [transit.banks[0]!, CRANE_FIXTURE.dock],
      [transit.banks[1]!, CRANE_FIXTURE.far],
    ] as const) {
      expect([bank.x, bank.width]).toEqual([solid.col * TILE, solid.cols * TILE]);
    }
    expect(transit.windows.map(({ result, supportOrigin }) => [result, supportOrigin])).toEqual([
      [
        { bankId: "dock", kind: "egress" },
        { x: [DOCK_X, DOCK_X + 2 * TILE], y: [LID, LID] },
      ],
      [{ kind: "forced" }, { x: [DOCK_X, FAR_X], y: [LID, LID] }],
      [
        { bankId: "far", kind: "egress" },
        { x: [FAR_X - 2 * TILE, FAR_X], y: [LID, LID] },
      ],
    ]);
  });

  it("collides as a one-way ledge and hangs its tether from the rail", () => {
    const { area, crane } = fixture();
    const object = area.objects[crane]!;
    expect(effectiveCollision(object, undefined)).toBe("ledge");
    const y = (CRANE_FIXTURE.row + CRANE_FIXTURE.rail) * TILE;
    expect(object.tether).toEqual({ art: "freight-crane-cable", kind: "rail", y });
    const rail = area.objects.find(({ character }) => character === "test-gantry-rail")!;
    expect(rail.origin.y + rail.height).toBe(y);
  });

  it.each([0, 1])("refuses a tether rail at row offset %i", (row) => {
    expect(() =>
      areaLayout(TILE, CRANE_FIXTURE_CATALOGUE, HITBOXES, TILESETS, new Set(), {
        cols: 60,
        entries: { start: { col: 2, row: 50 } },
        objects: [
          {
            character: "test-crane-container",
            col: 20,
            row: 50,
            tether: { art: "freight-crane-cable", row },
          },
        ],
        rows: 60,
        solids: [{ col: 0, cols: 60, row: 50, rows: 10 }],
      }),
    ).toThrow(/rail row above it/);
  });
});

describe("gantry crane tether", () => {
  it("draws the cable from the rail to a hook resting on the lid's centre at every pose", () => {
    const f = fixture();
    const object = f.area.objects[f.crane]!;
    const rail = (CRANE_FIXTURE.row + CRANE_FIXTURE.rail) * TILE;
    const size = 8;
    let zone = startZone(ordinary, f.layout, 1);
    const seen = new Set<number>();
    for (let tick = 0; tick < Math.round(CYCLE_SECONDS / STEP_SECONDS); tick += 60) {
      const at = craneAt(f, zone);
      seen.add(at.x);
      const segments = tetherSegments(size, rail, { x: at.x + object.width / 2, y: at.y });
      const hook = segments.at(-1)!;
      expect(segments.map(({ tag }) => tag)).toEqual([
        ...Array<string>(Math.ceil((LID - rail) / size) - 1).fill("cable"),
        "hook",
      ]);
      expect(segments[0]!.y).toBe(rail);
      expect(hook.y + size).toBe(at.y);
      // End to end, unrotated, centred on the lid.
      segments.slice(1, -1).forEach(({ y }, index) => expect(y).toBe(segments[index]!.y + size));
      expect(segments.every(({ x }) => x === at.x + object.width / 2 - size / 2)).toBe(true);
      for (let next = 0; next < 60; next++) {
        zone = step(f, zone, idle);
      }
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it("draws nothing while the anchor is within a segment of the rail", () => {
    expect(tetherSegments(8, 100, { x: 50, y: 107 })).toEqual([]);
    expect(tetherSegments(8, 100, { x: 50, y: 108 })).toEqual([{ tag: "hook", x: 46, y: 100 }]);
  });
});

// From the start, onto the lid's centre during the dock pause, held still across the pit, then
// off to the right when it pauses at the far dock. Decides only from the container's observed
// position.
function ride(f: Fixture, limit: number) {
  let zone = startZone(ordinary, f.layout, 1);
  const log: { phase: string | undefined; window: string; x: number }[] = [];
  let boardedAt: number | undefined;
  let ticks = 0;
  for (; ticks < limit && !zone.cleared; ticks++) {
    const at = craneAt(f, zone).x;
    let input: ZoneInput;
    if (boardedAt === undefined) {
      input = docked(at, DOCK_X)
        ? toward(zone, lidCentre(f, zone))
        : toward(zone, DOCK_X - 2 * TILE);
      if (onLid(f, zone) && Math.abs(zone.bird.x - lidCentre(f, zone)) <= 2) {
        boardedAt = at;
      }
    } else {
      input = docked(at, FAR_X) ? { ...idle, move: 1 } : idle;
    }
    zone = step(f, zone, input);
    expect(zone.death).toBeUndefined();
    if (boardedAt !== undefined) {
      log.push({
        phase: zone.forcedTransit?.episode?.phase,
        window: zone.forcedTransit?.attackWindow ?? "allowed",
        x: craneAt(f, zone).x - DOCK_X,
      });
    }
  }
  return { boardedAt, log, ticks, zone };
}

describe("gantry crane ride", () => {
  it("carries Chibi from the dock over the forced leg to the far bank", () => {
    const f = fixture();
    const { boardedAt, log, zone } = ride(f, 2 * CRANE_ROUTE_TICKS);
    expect(zone.cleared).toBe(true);
    expect(docked(boardedAt!, DOCK_X)).toBe(true);
    // Boarding while within reach of the dock, deferred over the pit, spent at the far dock.
    const phases = log.map(({ phase }) => phase).filter((phase, i, all) => phase !== all[i - 1]);
    expect(phases).toEqual(["boarding", "forced", "spent", undefined]);
    for (const { phase, window, x } of log) {
      // A tile clear of each egress window, since observation reads the step's starting pose.
      if (x > 3 * TILE && x < (GANTRY_DISTANCE - 3) * TILE) {
        expect([phase, window]).toEqual(["forced", "deferred"]);
      }
    }
    expect(Math.max(...log.map(({ x }) => x))).toBeCloseTo(GANTRY_DISTANCE * TILE);
  });

  it("leaves a boarding from the far bank unprotected", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const far = f.area.objects[f.crane]!.forcedTransit!.banks[1]!;
    zone = { ...zone, bird: startBird(ordinary, { x: far.x + far.width / 2, y: far.y }) };
    let boarded = false;
    let carried = 0;
    for (let tick = 0; tick < Math.round((2 * CYCLE_SECONDS) / STEP_SECONDS); tick++) {
      boarded ||= onLid(f, zone) && Math.abs(zone.bird.x - lidCentre(f, zone)) <= 2;
      const input =
        !boarded && docked(craneAt(f, zone).x, FAR_X) && zone.bird.grounded
          ? toward(zone, lidCentre(f, zone))
          : idle;
      zone = step(f, zone, input);
      expect(zone.death).toBeUndefined();
      expect(zone.forcedTransit?.attackWindow ?? "allowed").toBe("allowed");
      if (boarded && onLid(f, zone)) {
        carried = Math.max(carried, FAR_X - craneAt(f, zone).x);
      }
    }
    expect(boarded).toBe(true);
    expect(carried).toBeCloseTo(GANTRY_DISTANCE * TILE);
  });

  it("passes through a body at the docks without moving or killing it", () => {
    // The container returns to the near dock while Chibi's body overlaps its docked footprint.
    const inside = { x: DOCK_X + TILE, y: LID + TILE };
    const run = (archetype?: "solid") => {
      const f = fixture(GANTRY_BEHAVIOUR, archetype);
      let zone = startZone(ordinary, f.layout, 1);
      // From leaving the far dock, back to the near dock and halfway through its pause.
      const from = Math.round((2 * OBSTACLE_MOVER_PAUSE + LEG_SECONDS) / STEP_SECONDS);
      for (let tick = 0; tick < from; tick++) {
        zone = step(f, zone, idle);
      }
      let pushed = 0;
      const ticks = Math.round((LEG_SECONDS + OBSTACLE_MOVER_PAUSE / 2) / STEP_SECONDS);
      for (let tick = 0; tick < ticks; tick++) {
        zone = {
          ...zone,
          bird: { ...zone.bird, grounded: false, vx: 0, vy: 0, x: inside.x, y: inside.y },
        };
        zone = step(f, zone, idle);
        pushed = Math.max(pushed, Math.abs(zone.bird.x - inside.x));
        if (zone.death) {
          return { died: true, docked: false, pushed };
        }
      }
      return { died: false, docked: docked(craneAt(f, zone).x, DOCK_X), pushed };
    };
    expect(run()).toEqual({ died: false, docked: true, pushed: 0 });
    // A solid container would shove or crush him there.
    const solid = run("solid");
    expect(solid.died || solid.pushed > 0).toBe(true);
  });
});

describe("gantry crane route", () => {
  it("boards at the dock pause from chunk entry and exits within its recorded budget", () => {
    const f = fixture();
    const { boardedAt, ticks, zone } = ride(f, 2 * CRANE_ROUTE_TICKS);
    expect(zone.cleared).toBe(true);
    expect(docked(boardedAt!, DOCK_X)).toBe(true);
    console.info("Crane fixture route ticks", ticks);
    expect(ticks).toBeLessThanOrEqual(CRANE_ROUTE_TICKS);
  });
});

describe("gantry crane boss maps", () => {
  it("leaves the moving container out of the movement map and blocks the red pit", () => {
    const { area, crane } = fixture();
    const terrain = mapTerrain({}, area);
    const container = area.objects[crane]!;
    expect(terrain.area.colliders.some(({ supportId }) => supportId === container)).toBe(false);
    expect((terrain.world.platforms ?? []).some(({ owner }) => owner === container)).toBe(false);
    expect(terrain.crumbling.has(container)).toBe(false);
    // The pit's red floor is a static hazard across its whole width.
    const pit = terrain.hazards.filter(({ owner }) => owner.character === "red-edge-top");
    expect(pit.map(({ rect }) => [rect.x, rect.width])).toEqual([
      [CRANE_FIXTURE.pit.col * TILE, CRANE_FIXTURE.pit.cols * TILE],
    ]);
  });
});
