import { rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import { CHARACTERS } from "../data/characters.ts";
import { MODULES } from "../data/modules/index.ts";
import { GUST_BEHAVIOUR, GUST_SECONDS, gustCycle } from "../data/obstacleBehaviours.ts";
import { GUST_PULSE } from "../data/obstacleTuning.ts";
import { TILE } from "../data/screen.ts";
import type { BehaviourPlan, ChunkPlan, Instance } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { GUST_FIXTURE, GUST_FIXTURE_CATALOGUE, GUST_FIXTURE_LIBRARY } from "../testing/chunks.ts";
import { HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import { type ChunkLibrary, zonePlanOf } from "./assemble.ts";
import { birdBox } from "./bird.ts";
import { effectiveCollision, effectiveGustPhase } from "./effectiveCollision.ts";
import { forcePulseVolume } from "./force.ts";
import { gustPlacementProblems } from "./gustPlacement.ts";
import { chibiJumpScripts, chibiMovementProfile, groundMap, mapTerrain } from "./movementMaps.ts";
import { areaLayout, zoneLayout } from "./tiles.ts";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "./zone.ts";
import { CHUNK_LIBRARY } from "./zonePlans.ts";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const CYCLE_SECONDS = GUST_SECONDS.calm + GUST_SECONDS.warning + GUST_SECONDS.gust;
const CYCLE_TICKS = Math.round(CYCLE_SECONDS / STEP_SECONDS);
const GUST_TICKS = Math.round(GUST_SECONDS.gust / STEP_SECONDS);
const ROUTE_TICKS = 600;
// The push over one whole gust, in pixels.
const GUST_PUSH = GUST_PULSE.velocity.x * TILE * GUST_SECONDS.gust;

function fixture(chunk: string, library: ChunkLibrary = GUST_FIXTURE_LIBRARY) {
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "test", 2, [chunk]);
  const layout = zoneLayout(
    TILE,
    BIRD_FRAME,
    GUST_FIXTURE_CATALOGUE,
    HITBOXES,
    TILESETS,
    new Set(),
    plan,
  );
  const area = layout.areas[layout.start.area]!;
  const emitter = area.objects.findIndex(({ character }) => character === "test-gust-emitter");
  return { area, emitter, layout };
}

type Fixture = ReturnType<typeof fixture>;
const stateOf = (f: Fixture, zone: ZoneState) =>
  zone.behaviours[f.emitter]?.stateKey ?? f.area.objects[f.emitter]!.behaviour!.initial;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const toward = (zone: ZoneState, goal: number): ZoneInput => ({
  ...idle,
  move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
});

// Walks Chibi to x out of a gust and lets him come to rest there, the emitter calm or warning.
function standAt(f: Fixture, x: number): ZoneState {
  let zone = startZone(ordinary, f.layout, 1);
  const settle = () => {
    for (let tick = 0; tick < ROUTE_TICKS && Math.abs(zone.bird.x - x) > 2; tick++) {
      zone = step(f, zone, toward(zone, x));
    }
    for (let tick = 0; tick < ROUTE_TICKS && zone.bird.vx !== 0; tick++) {
      zone = step(f, zone, idle);
    }
  };
  settle();
  // A gust on the way blows him off his spot: walk back once it has passed.
  for (
    let tick = 0;
    tick < CYCLE_TICKS && (stateOf(f, zone) === "gust" || zone.pulses.length);
    tick++
  ) {
    zone = step(f, zone, idle);
  }
  settle();
  expect(stateOf(f, zone)).not.toBe("gust");
  expect(zone.pulses).toEqual([]);
  expect(Math.abs(zone.bird.x - x)).toBeLessThan(TILE);
  return zone;
}

// Idles until the emitter enters its gust, then through the whole gust, returning Chibi's x on
// the step before the gust and on its last step, and the pulse that blew.
function idleThroughGust(f: Fixture, start: ZoneState) {
  let zone = start;
  for (let tick = 0; tick < CYCLE_TICKS && stateOf(f, zone) === "gust"; tick++) {
    zone = step(f, zone, idle);
  }
  let before = zone.bird.x;
  for (let tick = 0; tick < CYCLE_TICKS && stateOf(f, zone) !== "gust"; tick++) {
    before = zone.bird.x;
    zone = step(f, zone, idle);
  }
  const pulse = zone.pulses[0]!;
  expect(pulse).toBeDefined();
  for (let tick = 0; tick < CYCLE_TICKS && stateOf(f, zone) === "gust"; tick++) {
    zone = step(f, zone, idle);
  }
  return { after: zone.bird.x, before, pulse, zone };
}

describe("gust cycle", () => {
  it("runs warning, gust and calm for their seconds and blows one pulse through each gust", () => {
    const f = fixture("test-gust");
    let zone = startZone(ordinary, f.layout, 1);
    const runs: { state: string; ticks: number }[] = [];
    // Each step's state after it, and whether a pulse blows through it.
    const ticks: { pulse: boolean; state: string }[] = [];
    const pulseIds = new Set<number>();
    for (let tick = 0; tick < 2 * CYCLE_TICKS; tick++) {
      zone = step(f, zone, idle);
      const state = stateOf(f, zone);
      ticks.push({ pulse: zone.pulses.length > 0, state });
      zone.pulses.forEach(({ id }) => pulseIds.add(id));
      const last = runs.at(-1);
      if (last?.state === state) {
        last.ticks++;
      } else {
        runs.push({ state, ticks: 1 });
      }
    }
    expect(runs.slice(0, 5).map(({ state }) => state)).toEqual([
      "warning",
      "gust",
      "calm",
      "warning",
      "gust",
    ]);
    // Within a step of each state's seconds; the first warning began before the first step.
    for (const { state, ticks: count } of runs.slice(0, 4)) {
      const seconds = GUST_SECONDS[state as keyof typeof GUST_SECONDS];
      expect(Math.abs(count - seconds / STEP_SECONDS)).toBeLessThanOrEqual(1);
    }
    // The pulse starts on the step that enters the gust, blows only in it and lasts its seconds.
    const first = ticks.findIndex(({ state }) => state === "gust");
    expect(ticks.findIndex(({ pulse }) => pulse)).toBe(first);
    expect(ticks.every(({ pulse, state }) => !pulse || state === "gust")).toBe(true);
    const blowing = ticks.filter(({ pulse }) => pulse).length;
    expect(Math.abs(blowing - 2 * GUST_TICKS)).toBeLessThanOrEqual(2);
    // One pulse per cycle: no overlap, no extra emission.
    expect(pulseIds.size).toBe(2);
  });

  it("never collides and plays each state's tag", () => {
    const { area, emitter } = fixture("test-gust");
    const object = area.objects[emitter]!;
    expect(
      Object.fromEntries(
        Object.keys(GUST_BEHAVIOUR.states).map((stateKey) => [
          stateKey,
          [effectiveGustPhase(object, { stateKey }), effectiveCollision(object, { stateKey })],
        ]),
      ),
    ).toEqual({
      calm: ["calm", "none"],
      gust: ["gust", "none"],
      warning: ["warning", "none"],
    });
    expect(
      Object.entries(GUST_BEHAVIOUR.states).map(([key, node]) => [key, node.animation]),
    ).toEqual(Object.keys(GUST_BEHAVIOUR.states).map((key) => [key, key]));
  });
});

describe("gust layout", () => {
  const area = (behaviour: BehaviourPlan, archetype = "scenery") =>
    areaLayout(
      TILE,
      {
        ...GUST_FIXTURE_CATALOGUE,
        characters: {
          ...GUST_FIXTURE_CATALOGUE.characters,
          "test-other-emitter": {
            ...GUST_FIXTURE_CATALOGUE.characters["test-gust-emitter"]!,
            archetype,
          },
        },
      },
      HITBOXES,
      TILESETS,
      new Set(),
      {
        cols: 60,
        entries: { start: { col: 2, row: 50 } },
        objects: [{ behaviour, character: "test-other-emitter", col: 44, row: 46 }],
        rows: 60,
        solids: [{ col: 0, cols: 60, row: 50, rows: 10 }],
      },
    );
  const states = GUST_BEHAVIOUR.states;
  const gust = states.gust!;
  const pulse = gust.onEnter![0]!;

  it("accepts the gust cycle from any state, facing either way", () => {
    expect(() => area(gustCycle(GUST_SECONDS, GUST_PULSE, 1, "gust"))).not.toThrow();
    expect(() => area(gustCycle(GUST_SECONDS, GUST_PULSE, -1, "calm"))).not.toThrow();
  });

  it.each(["ledge", "solid", "hazard"])("refuses gust phases on a %s", (archetype) => {
    expect(() => area(GUST_BEHAVIOUR, archetype)).toThrow(/phases require/);
  });

  it.each([
    ["an unlabelled state", { calm: { ...states.calm!, gustPhase: undefined } }],
    ["a pulse shorter than its gust", { gust: { ...gust, onEnter: [{ ...pulse, seconds: 0.5 }] } }],
    ["two pulses in its gust", { gust: { ...gust, onEnter: [pulse, pulse] } }],
    ["no pulse", { gust: { ...gust, onEnter: [] } }],
    ["a pulse while calm", { calm: { ...states.calm!, onEnter: [pulse] } }],
    [
      "two gust states",
      {
        calm: {
          ...gust,
          transitions: [{ to: "warning", when: [{ kind: "elapsed", seconds: GUST_SECONDS.gust }] }],
        },
      },
    ],
  ] as const)("refuses %s", (_, replaced) => {
    expect(() =>
      area({ ...GUST_BEHAVIOUR, states: { ...states, ...replaced } } as BehaviourPlan),
    ).toThrow(/Gust phases require a stationary/);
  });

  it("refuses a moving emitter and an invalid facing", () => {
    expect(() => area({ ...GUST_BEHAVIOUR, distance: 2 })).toThrow(/Gust phases require/);
    expect(() => area({ ...GUST_BEHAVIOUR, facing: 0 as unknown as 1 })).toThrow(
      /Invalid behaviour facing/,
    );
  });
});

describe("gust push", () => {
  it("blows the band from the emitter's left side and pushes Chibi left through the gust", () => {
    const f = fixture("test-gust");
    const { after, before, pulse } = idleThroughGust(f, standAt(f, 36 * TILE));
    expect(pulse.facing).toBe(-1);
    const band = GUST_FIXTURE.band;
    expect(forcePulseVolume(pulse)).toEqual({
      height: band.rows * TILE,
      width: band.cols * TILE,
      x: band.col * TILE,
      y: band.row * TILE,
    });
    expect(before - after).toBeCloseTo(GUST_PUSH, -1);
  });

  it("blows right from a mirrored emitter and pushes Chibi right", () => {
    const f = fixture("test-gust-right");
    const { after, before, pulse } = idleThroughGust(f, standAt(f, 22 * TILE));
    expect(pulse.facing).toBe(1);
    expect(forcePulseVolume(pulse).x).toBe((GUST_FIXTURE.mirrored.col + 1) * TILE);
    expect(after - before).toBeCloseTo(GUST_PUSH, -1);
  });

  it("leaves Chibi still through calm and warning, and behind the emitter through the gust", () => {
    const f = fixture("test-gust");
    let zone = standAt(f, 36 * TILE);
    const at = zone.bird.x;
    let still = 0;
    for (zone = step(f, zone, idle); stateOf(f, zone) !== "gust"; zone = step(f, zone, idle)) {
      expect(zone.bird.x).toBe(at);
      still++;
    }
    // He blows on the very step the gust enters.
    expect(zone.bird.x).toBeLessThan(at);
    expect(still).toBeGreaterThan(GUST_SECONDS.warning / STEP_SECONDS);
    const behind = idleThroughGust(f, standAt(f, 50 * TILE));
    expect(behind.after).toBe(behind.before);
  });
});

describe("gust bosses", () => {
  // Bini in the band, the emitter appended so his index and motion seeds match the plain chunk.
  const BEAR: Instance = { character: "bear-antagonist", col: 28, row: 46 };
  const bossLibrary = (objects: readonly Instance[]): ChunkLibrary => ({
    ...GUST_FIXTURE_LIBRARY,
    chunks: {
      "test-gust-bear": { ...GUST_FIXTURE_LIBRARY.chunks["test-gust"]!, objects },
    },
  });

  it("pushes Chibi only: a boss in the band moves exactly as it does without the gust", () => {
    const emitter = GUST_FIXTURE_LIBRARY.chunks["test-gust"]!.objects[0]!;
    const run = (library: ChunkLibrary) => {
      const f = fixture("test-gust-bear", library);
      const bear = f.area.objects.findIndex(({ character }) => character === BEAR.character);
      let zone = startZone(ordinary, f.layout, 1);
      const trace: { x: number; y: number }[] = [];
      let blown = false;
      for (let tick = 0; tick < 2 * CYCLE_TICKS && !zone.death; tick++) {
        zone = step(f, zone, idle);
        const at = zone.objects[bear] ?? f.area.objects[bear]!.origin;
        trace.push({ ...at });
        const object = f.area.objects[bear]!;
        blown ||= zone.pulses.some((pulse) =>
          rectsOverlap(forcePulseVolume(pulse), {
            ...at,
            height: object.height,
            width: object.width,
          }),
        );
      }
      return { bird: zone.bird, blown, trace };
    };
    const gusty = run(bossLibrary([BEAR, emitter]));
    const plain = run(bossLibrary([BEAR]));
    expect(gusty.blown).toBe(true);
    expect(gusty.trace).toEqual(plain.trace);
    expect(birdBox(ordinary, gusty.bird)).toEqual(birdBox(ordinary, plain.bird));
  });

  it("leaves the movement map as the same area without the emitter", () => {
    const withEmitter = fixture("test-gust");
    const without = fixture("test-gust-plain", {
      ...GUST_FIXTURE_LIBRARY,
      chunks: {
        "test-gust-plain": { ...GUST_FIXTURE_LIBRARY.chunks["test-gust"]!, objects: [] },
      },
    });
    const emitter = withEmitter.area.objects[withEmitter.emitter]!;
    const terrain = mapTerrain({}, withEmitter.area);
    const plain = mapTerrain({}, without.area);
    expect(terrain.area.colliders.some(({ supportId }) => supportId === emitter)).toBe(false);
    expect(terrain.crumbling.has(emitter)).toBe(false);
    expect(terrain.hazards.some(({ owner }) => owner === emitter)).toBe(false);
    const map = (t: typeof terrain) =>
      groundMap({ jumps: chibiJumpScripts(ordinary) }, t, chibiMovementProfile(ordinary));
    const gusty = map(terrain);
    const still = map(plain);
    expect(gusty.nodes.map(({ deps, id }) => [id, deps.length])).toEqual(
      still.nodes.map(({ deps, id }) => [id, deps.length]),
    );
    expect(gusty.edges.length).toBe(still.edges.length);
  });
});

describe("gust route", () => {
  it("waits at the band for the gust to end, crosses in the calm and exits within the route budget", () => {
    const f = fixture("test-gust");
    const edge = (GUST_FIXTURE.band.col - 1) * TILE - ordinary.width;
    let zone = startZone(ordinary, f.layout, 1);
    let crossing = false;
    let sawGust = false;
    for (let tick = 0; tick < ROUTE_TICKS; tick++) {
      const state = stateOf(f, zone);
      // From the band's edge, cross only on a calm observed to follow a gust.
      if (!crossing && zone.bird.x >= edge - 2) {
        sawGust ||= state !== "calm";
        crossing = sawGust && state === "calm";
      }
      const x = zone.bird.x;
      zone = step(f, zone, crossing ? { ...idle, move: 1 } : toward(zone, edge));
      expect(zone.death).toBeUndefined();
      if (crossing) {
        // Never pushed back once committed.
        expect(zone.bird.x).toBeGreaterThan(x);
      }
      if (zone.cleared) {
        expect(sawGust).toBe(true);
        // Measured: 461 ticks.
        expect(tick + 1).toBeLessThanOrEqual(ROUTE_TICKS);
        return;
      }
    }
    expect.fail(JSON.stringify({ bird: zone.bird, crossing }));
  });
});

describe("gust placement", () => {
  const chunk = GUST_FIXTURE_LIBRARY.chunks["test-gust"]!;
  const problems = (plan: ChunkPlan) =>
    gustPlacementProblems(GUST_FIXTURE_CATALOGUE.characters, plan);

  it("keeps every pooled chunk and module's gusts out of encounters and against the route", () => {
    for (const [id, plan] of Object.entries(CHUNK_LIBRARY.chunks)) {
      expect([id, gustPlacementProblems(CHARACTERS, plan)]).toEqual([id, []]);
    }
    for (const [id, module] of Object.entries(MODULES)) {
      expect([id, gustPlacementProblems(CHARACTERS, module)]).toEqual([id, []]);
    }
    expect(problems(chunk)).toEqual([]);
  });

  it("flags a gust in an encounter chunk, beside a boss or blowing with the route", () => {
    expect(problems({ ...chunk, encounters: 1 })).toEqual(["gusts with 1 encounters"]);
    expect(
      problems({
        ...chunk,
        objects: [
          ...chunk.objects,
          { character: "test-door", col: 4, role: "antagonist", row: 46 },
        ],
      }),
    ).toEqual(["gusts beside antagonist test-door"]);
    expect(
      problems({
        ...chunk,
        objects: [...chunk.objects, { character: "bear-antagonist", col: 4, row: 46 }],
      }),
    ).toEqual(["gusts beside pursuing bear-antagonist"]);
    expect(problems(GUST_FIXTURE_LIBRARY.chunks["test-gust-right"]!)).toEqual([
      "test-gust-emitter at col 15 does not blow against the route",
    ]);
  });
});
