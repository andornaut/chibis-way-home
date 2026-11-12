import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import { AWNING_BEHAVIOUR, AWNING_SECONDS, awningCycle } from "../data/obstacleBehaviours.ts";
import { TILE } from "../data/screen.ts";
import type { BehaviourPlan, Instance, ObjectLayout } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import {
  AWNING_FIXTURE_CATALOGUE,
  AWNING_FIXTURE_COLS,
  AWNING_FIXTURE_LIBRARY,
} from "../testing/chunks.ts";
import { HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import { zonePlanOf } from "./assemble.ts";
import { pursuitMapMask } from "./behaviourMapPursuit.ts";
import { effectiveCollision, effectiveSupportPhase } from "./effectiveCollision.ts";
import {
  chibiJumpScripts,
  chibiMovementProfile,
  groundMap,
  groundMask,
  mapTerrain,
} from "./movementMaps.ts";
import { areaLayout, zoneLayout } from "./tiles.ts";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "./zone.ts";
import { clockedSupportPrediction } from "./zoneCrumbling.ts";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const CYCLE_SECONDS = Object.values(AWNING_SECONDS).reduce((sum: number, s) => sum + s, 0);
const ROUTE_TICKS = 600;
const UPPER = 50 * TILE;
const LOWER = 58 * TILE;

function fixture(chunk: "test-awning-overhead" | "test-awnings") {
  const plan = zonePlanOf(AWNING_FIXTURE_LIBRARY, () => 0, { door: [], event: [] }, "test", 2, [
    chunk,
  ]);
  const layout = zoneLayout(
    TILE,
    BIRD_FRAME,
    AWNING_FIXTURE_CATALOGUE,
    HITBOXES,
    TILESETS,
    new Set(),
    plan,
  );
  const area = layout.areas[layout.start.area]!;
  const awnings = area.objects.flatMap((object, index) =>
    object.character === "test-awning" ? [index] : [],
  );
  return { area, awnings, layout };
}

type Fixture = ReturnType<typeof fixture>;
const stateOf = (f: Fixture, zone: ZoneState, awning: number) =>
  zone.behaviours[f.awnings[awning]!]?.stateKey ??
  f.area.objects[f.awnings[awning]!]!.behaviour!.initial;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const toward = (zone: ZoneState, goal: number): ZoneInput => ({
  ...idle,
  move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
});
const feet = (zone: ZoneState) => zone.bird.y + ordinary.height;
const centre = (f: Fixture, awning: number) => {
  const object = f.area.objects[f.awnings[awning]!]!;
  return object.origin.x + (object.width - ordinary.width) / 2;
};

describe("awning cycle", () => {
  it("runs out, warning, retracted and extending for their seconds", () => {
    const f = fixture("test-awnings");
    let zone = startZone(ordinary, f.layout, 1);
    const runs: { seconds: number; state: string }[] = [];
    for (let tick = 0; tick < Math.round((2 * CYCLE_SECONDS) / STEP_SECONDS); tick++) {
      const state = stateOf(f, zone, 0);
      const last = runs.at(-1);
      if (last?.state === state) {
        last.seconds += STEP_SECONDS;
      } else {
        runs.push({ seconds: STEP_SECONDS, state });
      }
      zone = step(f, zone, idle);
    }
    expect(runs.slice(0, 5).map(({ state }) => state)).toEqual([
      "out",
      "warning",
      "retracted",
      "extending",
      "out",
    ]);
    for (const { seconds, state } of runs.slice(0, 4)) {
      expect(seconds).toBeCloseTo(AWNING_SECONDS[state as keyof typeof AWNING_SECONDS], 1);
    }
  });

  it("collides as a ledge only while out or warning and plays each state's tag", () => {
    const { area, awnings } = fixture("test-awnings");
    const object = area.objects[awnings[0]!]!;
    const labels = Object.fromEntries(
      Object.keys(AWNING_BEHAVIOUR.states).map((stateKey) => [
        stateKey,
        [effectiveSupportPhase(object, { stateKey }), effectiveCollision(object, { stateKey })],
      ]),
    );
    expect(labels).toEqual({
      extending: ["absent", "none"],
      out: ["present", "ledge"],
      retracted: ["absent", "none"],
      warning: ["warning", "ledge"],
    });
    expect(
      Object.entries(AWNING_BEHAVIOUR.states).map(([key, node]) => [key, node.animation]),
    ).toEqual(Object.keys(AWNING_BEHAVIOUR.states).map((key) => [key, key]));
  });

  it("offsets a neighbour by its initial state", () => {
    const f = fixture("test-awnings");
    let zone = startZone(ordinary, f.layout, 1);
    expect([0, 1, 2].map((awning) => stateOf(f, zone, awning))).toEqual([
      "out",
      "retracted",
      "retracted",
    ]);
    for (let tick = 0; tick < Math.round(2 / STEP_SECONDS); tick++) {
      zone = step(f, zone, idle);
    }
    expect([0, 1].map((awning) => stateOf(f, zone, awning))).toEqual(["warning", "out"]);
  });
});

describe("awning layout", () => {
  const area = (
    behaviour: BehaviourPlan,
    character = "test-awning",
    extra: Partial<Instance> = {},
  ) =>
    areaLayout(
      TILE,
      {
        ...AWNING_FIXTURE_CATALOGUE,
        characters: {
          ...AWNING_FIXTURE_CATALOGUE.characters,
          "test-solid-awning": {
            ...AWNING_FIXTURE_CATALOGUE.characters["test-awning"]!,
            archetype: "solid",
          },
        },
      },
      HITBOXES,
      TILESETS,
      new Set(),
      {
        cols: 60,
        entries: { start: { col: 2, row: 50 } },
        objects: [{ behaviour, character, col: 20, row: 47, ...extra }],
        rows: 60,
        solids: [{ col: 0, cols: 60, row: 50, rows: 10 }],
      },
    );
  const out = AWNING_BEHAVIOUR.states.out!;

  it("accepts the awning cycle from any state", () => {
    expect(() => area(awningCycle(AWNING_SECONDS, "extending"))).not.toThrow();
  });

  it.each([
    ["a solid", AWNING_BEHAVIOUR, "test-solid-awning"],
    [
      "a hazard phase beside it",
      {
        ...AWNING_BEHAVIOUR,
        states: { ...AWNING_BEHAVIOUR.states, out: { ...out, hazardPhase: "inactive" as const } },
      },
      "test-awning",
    ],
  ] as const)("refuses support phases on %s", (_, behaviour, character) => {
    expect(() => area(behaviour, character)).toThrow(/phases require a stationary/);
  });

  it.each([
    [
      "an unlabelled state",
      {
        ...AWNING_BEHAVIOUR,
        states: { ...AWNING_BEHAVIOUR.states, out: { ...out, supportPhase: undefined } },
      },
    ],
    ["a moving clock", { ...AWNING_BEHAVIOUR, distance: 2 }],
    [
      "a broken ring",
      {
        ...AWNING_BEHAVIOUR,
        states: {
          ...AWNING_BEHAVIOUR.states,
          out: { ...out, transitions: [{ ...out.transitions[0]!, to: "out" }] },
        },
      },
    ],
  ] as const)("refuses %s", (_, behaviour) => {
    expect(() => area(behaviour as BehaviourPlan)).toThrow(/Support phases require a stationary/);
  });
});

describe("awning support", () => {
  it("holds Chibi while out and warning and drops him when it retracts", () => {
    const f = fixture("test-awnings");
    const awning = f.area.objects[f.awnings[0]!]!;
    let zone = startZone(ordinary, f.layout, 1);
    // Onto the first awning, which starts out.
    let tick = 0;
    for (; tick < ROUTE_TICKS && !(zone.bird.grounded && zone.bird.x >= 13 * TILE); tick++) {
      zone = step(f, zone, toward(zone, 13 * TILE));
    }
    let held = 0;
    for (
      ;
      tick < ROUTE_TICKS &&
      !(zone.bird.grounded && feet(zone) === UPPER && zone.bird.x > awning.origin.x);
      tick++
    ) {
      zone = step(f, zone, { ...toward(zone, centre(f, 0)), jumpHeld: held++ < 20 });
    }
    expect(feet(zone)).toBe(UPPER);
    // Standing still: held through out and warning, then falls.
    let fell: { seconds: number; state: string } | undefined;
    for (; tick < ROUTE_TICKS + Math.round(CYCLE_SECONDS / STEP_SECONDS); tick++) {
      const state = stateOf(f, zone, 0);
      zone = step(f, zone, idle);
      expect(zone.death).toBeUndefined();
      if (!fell && feet(zone) > UPPER) {
        fell = { seconds: zone.seconds, state };
      }
      if (fell && zone.bird.grounded) {
        break;
      }
    }
    expect(fell).toBeDefined();
    expect(fell!.state).not.toBe("out");
    expect(fell!.seconds).toBeGreaterThanOrEqual(AWNING_SECONDS.out + AWNING_SECONDS.warning);
    expect(feet(zone)).toBe(LOWER);
  });

  it("extends around a body inside its footprint without moving, lifting or killing him", () => {
    const f = fixture("test-awning-overhead");
    const awning = f.area.objects[f.awnings[0]!]!;
    let zone = startZone(ordinary, f.layout, 1);
    const inside = awning.origin.x + TILE;
    let tick = 0;
    for (; tick < ROUTE_TICKS && Math.abs(zone.bird.x - inside) > 2; tick++) {
      zone = step(f, zone, toward(zone, inside));
    }
    for (; tick < ROUTE_TICKS && zone.bird.vx !== 0; tick++) {
      zone = step(f, zone, idle);
    }
    expect(stateOf(f, zone, 0)).not.toBe("out");
    const at = { x: zone.bird.x, y: zone.bird.y };
    let sawOut = false;
    for (let wait = 0; wait < Math.round(CYCLE_SECONDS / STEP_SECONDS); wait++) {
      zone = step(f, zone, idle);
      sawOut ||= stateOf(f, zone, 0) === "out";
      expect(zone.death).toBeUndefined();
      expect({ x: zone.bird.x, y: zone.bird.y }).toEqual(at);
    }
    expect(sawOut).toBe(true);
  });
});

describe("awning route", () => {
  it("hops each awning when the next reads out and exits within the route budget", () => {
    const f = fixture("test-awnings");
    const goals = [...AWNING_FIXTURE_COLS.map((_, awning) => centre(f, awning)), 60 * TILE];
    let zone = startZone(ordinary, f.layout, 1);
    let at = -1;
    let target = 13 * TILE;
    let held = 0;
    const visited: number[] = [];
    for (let tick = 0; tick < ROUTE_TICKS; tick++) {
      const settled =
        zone.bird.grounded && feet(zone) === UPPER && Math.abs(zone.bird.x - target) <= 2;
      if (settled && at < goals.length - 1) {
        const next = at + 1;
        // Commit only on an observed out: warning still leaves a hop's airtime.
        if (next === goals.length - 1 || stateOf(f, zone, next) === "out") {
          if (at >= 0) {
            visited.push(at);
          }
          at = next;
          target = goals[at]!;
          held = 0;
        }
      }
      const jumpHeld = at >= 0 && held < 20 && (held++ === 0 || !zone.bird.grounded);
      zone = step(f, zone, { ...toward(zone, target), jumpHeld });
      expect(zone.death).toBeUndefined();
      expect(feet(zone)).toBeLessThan(LOWER);
      if (zone.cleared) {
        expect(visited).toEqual([0, 1, 2]);
        return;
      }
    }
    expect.fail(JSON.stringify({ at, bird: zone.bird }));
  });

  it("rejoins the exit from the lower street by its step", () => {
    const f = fixture("test-awnings");
    // Beside the step, on it, then out along the exit run.
    const goals = [43 * TILE, 45 * TILE, 60 * TILE];
    let zone = startZone(ordinary, f.layout, 1);
    // Off the entry run's edge onto the lower street.
    let tick = 0;
    for (; tick < ROUTE_TICKS && !(zone.bird.grounded && feet(zone) === LOWER); tick++) {
      zone = step(f, zone, { ...idle, move: 1 });
    }
    let leg = 0;
    let held = 0;
    for (; tick < 2 * ROUTE_TICKS; tick++) {
      const reached = zone.bird.grounded && Math.abs(zone.bird.x - goals[leg]!) <= 2;
      if (reached && leg < goals.length - 1) {
        leg++;
        held = 0;
      }
      const jumpHeld = leg > 0 && held < 40 && (held++ === 0 || !zone.bird.grounded);
      zone = step(f, zone, { ...toward(zone, goals[leg]!), jumpHeld });
      expect(zone.death).toBeUndefined();
      if (zone.cleared) {
        return;
      }
    }
    expect.fail(JSON.stringify({ bird: zone.bird, leg }));
  });
});

describe("awning boss maps", () => {
  it("maps each awning as a crumbling-kind dependency and never as a perch", () => {
    const { area, awnings } = fixture("test-awnings");
    const terrain = mapTerrain({}, area);
    const owners = awnings.map((index) => area.objects[index]!);
    for (const object of owners) {
      expect(terrain.crumbling.has(object)).toBe(true);
      expect(terrain.area.kind?.(object, terrain.bounds)).toBe("crumbling");
      expect(terrain.area.colliders.some(({ supportId }) => supportId === object)).toBe(true);
    }
    expect((terrain.world.platforms ?? []).some(({ owner }) => owners.includes(owner))).toBe(false);
    const map = groundMap(
      { jumps: chibiJumpScripts(ordinary) },
      terrain,
      chibiMovementProfile(ordinary),
    );
    const first = owners[0] as ObjectLayout;
    const on = map.nodes.filter(({ deps }) => deps.includes(first));
    expect(on.length).toBeGreaterThan(0);
    const closed = groundMask({ allowed: (id) => id !== first, climb: false, key: "closed" }, map);
    expect(on.some(({ id }) => closed.node(id))).toBe(false);
    const open = groundMask({ allowed: () => true, climb: false, key: "open" }, map);
    expect(on.every(({ id }) => open.node(id))).toBe(true);
  });

  it("lets a pursuit map use an awning only while present and known", () => {
    const f = fixture("test-awnings");
    const terrain = mapTerrain({}, f.area);
    const map = groundMap(
      { jumps: chibiJumpScripts(ordinary) },
      terrain,
      chibiMovementProfile(ordinary),
    );
    const first = f.area.objects[f.awnings[0]!]!;
    const node = map.nodes.find(({ deps }) => deps.includes(first))!;
    const rect = { ...first.origin, height: first.height, width: first.width };
    const mask = (present: boolean, timeSeconds: number) => {
      const prediction = clockedSupportPrediction(f.area, [f.awnings[0]!], [], 0);
      return pursuitMapMask(
        {
          platforms: present ? [{ collision: "ledge", owner: first, rect }] : [],
          solids: f.area.solids,
          traversalFrame: {
            bounds: terrain.bounds,
            crumbling: prediction,
            dtSeconds: STEP_SECONDS,
            platforms: [],
            timeSeconds,
          },
        },
        { map, terrain },
        [],
      );
    };
    expect(mask(true, 0).node(node.id)).toBe(true);
    expect(mask(false, 0).node(node.id)).toBe(false);
    // Out ends at its seconds; after that its presence is unknown, never safe.
    expect(mask(true, AWNING_SECONDS.out).node(node.id)).toBe(false);
  });

  it("gives a pursuit mask's verdicts by argument alone, in any call order", () => {
    const f = fixture("test-awnings");
    const terrain = mapTerrain({}, f.area);
    const map = groundMap(
      { jumps: chibiJumpScripts(ordinary) },
      terrain,
      chibiMovementProfile(ordinary),
    );
    const prediction = clockedSupportPrediction(f.area, f.awnings, [], 0);
    const platforms = f.awnings.map((index) => {
      const owner = f.area.objects[index]!;
      const rect = { ...owner.origin, height: owner.height, width: owner.width };
      return { collision: "ledge" as const, owner, rect };
    });
    const mask = () =>
      pursuitMapMask(
        {
          platforms,
          solids: f.area.solids,
          traversalFrame: {
            bounds: terrain.bounds,
            crumbling: prediction,
            dtSeconds: STEP_SECONDS,
            platforms: [],
            timeSeconds: 0.5,
          },
        },
        { map, terrain },
        [],
      );
    const departs = [0, 0.5, AWNING_SECONDS.out, CYCLE_SECONDS];
    const calls = map.edges.flatMap(({ id }) => departs.map((depart) => [id, depart] as const));
    const fresh = calls.map(([id, depart]) => mask().edge(id, depart));
    // Some awning edge is open at one departure and closed at a later one.
    expect(
      map.edges.some(({ id }) => {
        const verdicts = departs.map((depart) => mask().edge(id, depart));
        return verdicts.includes(true) && verdicts.includes(false);
      }),
    ).toBe(true);
    const shared = mask();
    const forwards = calls.map(([id, depart]) => shared.edge(id, depart));
    const backwards = [...calls].reverse().map(([id, depart]) => shared.edge(id, depart));
    expect(forwards).toEqual(fresh);
    expect(backwards.reverse()).toEqual(fresh);
    const nodes = map.nodes.map(({ id }) => mask().node(id));
    expect(map.nodes.map(({ id }) => shared.node(id))).toEqual(nodes);
    expect(map.nodes.map(({ id }) => shared.node(id))).toEqual(nodes);
  });

  it("knows presence until the current state ends and nothing after", () => {
    const f = fixture("test-awnings");
    let zone = startZone(ordinary, f.layout, 1);
    for (let tick = 0; tick < Math.round(0.5 / STEP_SECONDS); tick++) {
      zone = step(f, zone, idle);
    }
    const prediction = clockedSupportPrediction(f.area, f.awnings, zone.behaviours, zone.seconds);
    const volume = (awning: number) => {
      const object = f.area.objects[f.awnings[awning]!]!;
      return { ...object.origin, height: object.height, width: object.width };
    };
    // The first is out until 1.6 s; the others are retracted until 1.2 s.
    expect(prediction.unknown(zone.seconds)).toEqual([]);
    expect(prediction.unknown(1.1)).toEqual([]);
    expect(prediction.unknown(1.3)).toEqual([volume(1), volume(2)]);
    expect(prediction.unknown(AWNING_SECONDS.out + 0.01)).toEqual([
      volume(0),
      volume(1),
      volume(2),
    ]);
    // Later presence is unknown even a whole cycle on, when the clock would show out again.
    expect(prediction.unknown(CYCLE_SECONDS + 0.1)).toContainEqual(volume(0));
  });
});
