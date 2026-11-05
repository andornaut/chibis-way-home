import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { CROSSWALK_BEHAVIOUR, CROSSWALK_SECONDS } from "../data/obstacleBehaviours";
import { CROSSWALK_PHASE_TILES, CROSSWALK_SIGNAL_ANIMATIONS } from "../data/obstacleCharacters";
import { REACH } from "../data/reach";
import { TILE } from "../data/screen";
import type { Character, Instance } from "../data/types";
import { SKILL_PROFILES } from "../progress";
import {
  CROSSWALK_FIXTURE_CATALOGUE,
  CROSSWALK_FIXTURE_LIBRARY,
  CROSSWALK_FIXTURE_STRIP,
} from "../testing/chunks";
import { HITBOXES, TILESETS } from "../testing/walkSuite";
import { type ChunkLibrary, zonePlanOf } from "./assemble";
import { effectiveHazardPhase } from "./effectiveCollision";
import {
  chibiJumpScripts,
  chibiMovementProfile,
  groundMap,
  groundMask,
  mapTerrain,
} from "./movementMaps";
import { phaseFollowerTag } from "./phaseSource";
import { areaLayout, zoneLayout } from "./tiles";
import { timedHazardRect } from "./timedHazard";
import { retryZone, startZone, stepZone, type ZoneInput, type ZoneState } from "./zone";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const CYCLE_SECONDS = Object.values(CROSSWALK_SECONDS).reduce((sum: number, s) => sum + s, 0);
const ROUTE_TICKS = 600;

function fixture(
  catalogue = CROSSWALK_FIXTURE_CATALOGUE,
  library: ChunkLibrary = CROSSWALK_FIXTURE_LIBRARY,
) {
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "test", 2, ["test-crosswalk"]);
  const layout = zoneLayout(TILE, BIRD_FRAME, catalogue, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const strip = area.objects.findIndex(({ character }) => character === "test-crosswalk-strip");
  const signal = area.objects.findIndex(({ character }) => character === "test-crosswalk-signal");
  const object = area.objects[strip]!;
  return { area, layout, object, rect: timedHazardRect(object, object.origin), signal, strip };
}

type Fixture = ReturnType<typeof fixture>;
const tagOf = (f: Fixture, zone: ZoneState) =>
  phaseFollowerTag(f.object, zone.behaviours[f.strip], f.area.objects[f.signal]!);
const overlapsStrip = ({ rect }: Fixture, zone: ZoneState) =>
  zone.bird.x < rect.x + rect.width &&
  zone.bird.x + ordinary.width > rect.x &&
  zone.bird.y + ordinary.height > rect.y;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const toward = (zone: ZoneState, goal: number): ZoneInput => ({
  ...idle,
  move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
});

describe("crosswalk cycle", () => {
  it("runs walk, warning, traffic and recovery for their seconds and the signal follows", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const runs: { seconds: number; state: string; tag: string }[] = [];
    for (let tick = 0; tick < Math.round((2 * CYCLE_SECONDS) / STEP_SECONDS); tick++) {
      const state = zone.behaviours[f.strip]?.stateKey ?? CROSSWALK_BEHAVIOUR.initial;
      const last = runs.at(-1);
      if (last?.state === state) {
        last.seconds += STEP_SECONDS;
        expect(tagOf(f, zone)).toBe(last.tag);
      } else {
        runs.push({ seconds: STEP_SECONDS, state, tag: tagOf(f, zone) });
      }
      zone = step(f, zone, idle);
    }
    expect(runs.slice(0, 5).map(({ state, tag }) => [state, tag])).toEqual([
      ["inactive", "walk"],
      ["warning", "warning"],
      ["active", "stop"],
      ["recovery", "stop"],
      ["inactive", "walk"],
    ]);
    for (const { seconds, state } of runs.slice(0, 4)) {
      expect(seconds).toBeCloseTo(CROSSWALK_SECONDS[state as keyof typeof CROSSWALK_SECONDS], 1);
    }
  });

  it("is lethal only in traffic and shows Walk only while walking", () => {
    const f = fixture();
    const phases = Object.fromEntries(
      Object.keys(CROSSWALK_BEHAVIOUR.states).map((stateKey) => [
        stateKey,
        [effectiveHazardPhase(f.object, { stateKey }), CROSSWALK_SIGNAL_ANIMATIONS[stateKey]],
      ]),
    );
    expect(phases).toEqual({
      active: ["active", "stop"],
      inactive: ["inactive", "walk"],
      recovery: ["inactive", "stop"],
      warning: ["warning", "warning"],
    });
  });

  it("leaves time to cross in walk and to finish from the middle in warning", () => {
    const speed = BIRD.walkSpeed / TILE;
    const cols = CROSSWALK_FIXTURE_STRIP.cols;
    expect(cols).toBeGreaterThan(REACH.gap);
    expect(CROSSWALK_SECONDS.inactive).toBeGreaterThanOrEqual((cols + 2 + REACH.hop) / speed);
    expect(CROSSWALK_SECONDS.warning).toBeGreaterThanOrEqual((cols / 2 + 2) / speed);
  });
});

describe("crosswalk layout", () => {
  const strip = (cols: number): Instance => ({
    character: "test-crosswalk-strip",
    col: 20,
    cols,
    id: "strip",
    row: 49,
  });
  const signal: Instance = {
    character: "test-crosswalk-signal",
    col: 18,
    phaseSource: "strip",
    row: 43,
  };
  const area = (
    objects: readonly Instance[],
    characters = CROSSWALK_FIXTURE_CATALOGUE.characters,
  ) =>
    areaLayout(
      TILE,
      { ...CROSSWALK_FIXTURE_CATALOGUE, characters },
      HITBOXES,
      TILESETS,
      new Set(),
      {
        cols: 60,
        entries: { start: { col: 2, row: 50 } },
        objects,
        rows: 60,
        solids: [{ col: 0, cols: 60, row: 50, rows: 10 }],
        tileset: "tiles-street",
      },
    );

  it("refuses a strip a running jump could clear", () => {
    expect(() => area([strip(REACH.gap)])).toThrow(/running jump/);
    expect(() => area([strip(REACH.gap + 1)])).not.toThrow();
  });

  it("points the signal at its strip's index", () => {
    const { objects } = area([signal, strip(20)]);
    expect(objects[0]!.phaseSource).toBe(1);
  });

  it("scopes the signal's source to its chunk when assembled", () => {
    const f = fixture();
    expect(f.area.objects[f.signal]!.phaseSource).toBe(f.strip);
  });

  it.each([
    ["a missing source", [{ ...signal, phaseSource: "nowhere" }]],
    [
      "a source with no clock",
      [
        { ...signal, phaseSource: "post" },
        { character: "test-hazard", col: 30, id: "post", row: 49 },
      ],
    ],
    ["animations without a source", [{ character: "test-crosswalk-signal", col: 18, row: 43 }]],
  ] as const)("refuses a follower with %s", (_, objects) => {
    expect(() => area(objects as readonly Instance[])).toThrow(/[Pp]hase/);
  });

  it("refuses a follower without a tag for every strip state", () => {
    const partial = Object.fromEntries(
      Object.entries(CROSSWALK_SIGNAL_ANIMATIONS).filter(([key]) => key !== "recovery"),
    );
    const characters = {
      ...CROSSWALK_FIXTURE_CATALOGUE.characters,
      "test-crosswalk-signal": {
        ...CROSSWALK_FIXTURE_CATALOGUE.characters["test-crosswalk-signal"]!,
        phaseAnimations: partial,
      },
    };
    expect(() => area([signal, strip(20)], characters)).toThrow(/recovery/);
  });

  it("refuses phase tiles on a hazard without a clock", () => {
    const characters = {
      ...CROSSWALK_FIXTURE_CATALOGUE.characters,
      "test-hazard": {
        ...CROSSWALK_FIXTURE_CATALOGUE.characters["test-hazard"]!,
        phaseTiles: CROSSWALK_PHASE_TILES,
      },
    };
    expect(() => area([{ character: "test-hazard", col: 30, row: 49 }], characters)).toThrow(
      /Phase tiles/,
    );
  });
});

describe("crosswalk route", () => {
  it("waits on the near kerb for Walk, crosses without meeting traffic and exits", () => {
    const f = fixture();
    const kerb = f.rect.x - ordinary.width - TILE;
    const exitGoal = 60 * TILE;
    let zone = startZone(ordinary, f.layout, 1);
    let stage: "approach" | "wait" | "cross" = "approach";
    let sawStop = false;
    let previous = tagOf(f, zone);
    for (let tick = 0; tick < ROUTE_TICKS + Math.ceil(CYCLE_SECONDS / STEP_SECONDS); tick++) {
      const tag = tagOf(f, zone);
      if (stage === "approach" && zone.bird.grounded && Math.abs(zone.bird.x - kerb) <= 2) {
        stage = "wait";
      }
      sawStop ||= stage === "wait" && tag === "stop";
      // Commit only on the observed change to Walk.
      if (stage === "wait" && sawStop && previous !== "walk" && tag === "walk") {
        stage = "cross";
      }
      previous = tag;
      zone = step(f, zone, toward(zone, stage === "cross" ? exitGoal : kerb));
      expect(zone.death, stage).toBeUndefined();
      if (stage === "cross" && overlapsStrip(f, zone)) {
        expect(effectiveHazardPhase(f.object, zone.behaviours[f.strip])).not.toBe("active");
      }
      if (stage === "cross" && zone.cleared) {
        return;
      }
    }
    expect.fail(JSON.stringify({ bird: zone.bird, stage }));
  });

  it("kills a walker in traffic with the red cue and retries from walk", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    for (
      let tick = 0;
      tick < Math.ceil((2 * CYCLE_SECONDS) / STEP_SECONDS) && !zone.death;
      tick++
    ) {
      zone = step(f, zone, toward(zone, f.rect.x + f.rect.width / 2));
    }
    expect(zone.death?.contact).toMatchObject({ contactCue: "red-hazard", index: f.strip });
    expect(effectiveHazardPhase(f.object, zone.behaviours[f.strip])).toBe("active");
    const retried = retryZone(ordinary, f.layout, zone);
    expect(retried.death).toBeUndefined();
    expect(retried.behaviours[f.strip]!.stateKey).toBe(CROSSWALK_BEHAVIOUR.initial);
  });

  it.each([
    // Clearing a strip lifts his whole body over it, so the clearable width is well under gap reach.
    [10, false],
    [REACH.gap + 1, true],
    [CROSSWALK_FIXTURE_STRIP.cols, true],
  ])("a running jump over a %i-col strip lands on it: %s", (cols, lands) => {
    const free: Character = {
      ...CROSSWALK_FIXTURE_CATALOGUE.characters["test-crosswalk-strip"]!,
      cols,
    };
    delete (free as { noJumpOver?: true }).noJumpOver;
    const characters: Readonly<Record<string, Character>> = {
      ...CROSSWALK_FIXTURE_CATALOGUE.characters,
      "test-crosswalk-strip": free,
    };
    const chunk = CROSSWALK_FIXTURE_LIBRARY.chunks["test-crosswalk"]!;
    const library = {
      ...CROSSWALK_FIXTURE_LIBRARY,
      characters,
      chunks: {
        "test-crosswalk": {
          ...chunk,
          objects: chunk.objects.map((o) => (o.id === "strip" ? { ...o, cols } : o)),
        },
      },
    };
    const f = fixture({ ...CROSSWALK_FIXTURE_CATALOGUE, characters }, library);
    let zone = startZone(ordinary, f.layout, 1);
    let touched = false;
    let jumped = false;
    let held = 0;
    for (let tick = 0; tick < ROUTE_TICKS && zone.bird.x < f.rect.x + f.rect.width; tick++) {
      const front = zone.bird.x + ordinary.width;
      if (!jumped && zone.bird.grounded && front >= f.rect.x - TILE) {
        jumped = true;
      }
      const jumpHeld = jumped && held < 120 && (held++ === 0 || !zone.bird.grounded);
      zone = step(f, zone, { ...idle, jumpHeld, move: 1 });
      // Contact, not death: the strip may be in walk while he lands on it.
      touched ||= overlapsStrip(f, zone);
      if (zone.death) {
        touched = true;
        break;
      }
    }
    expect(jumped).toBe(true);
    expect(touched).toBe(lands);
  });
});

describe("crosswalk boss maps", () => {
  it("keeps the strip out of static terrain and masks the road under it", () => {
    const { area, object } = fixture();
    const terrain = mapTerrain({}, area);
    expect(terrain.hazards.some(({ owner }) => owner === object)).toBe(false);
    const map = groundMap(
      { jumps: chibiJumpScripts(ordinary) },
      terrain,
      chibiMovementProfile(ordinary),
    );
    const road = map.nodes.filter(({ deps }) => deps.includes(object));
    expect(road.length).toBeGreaterThan(0);
    const closed = groundMask({ allowed: (id) => id !== object, climb: false, key: "closed" }, map);
    expect(road.some(({ id }) => closed.node(id))).toBe(false);
    const open = groundMask({ allowed: () => true, climb: false, key: "open" }, map);
    expect(road.every(({ id }) => open.node(id))).toBe(true);
  });
});
