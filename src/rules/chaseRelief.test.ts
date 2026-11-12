import { expect, it } from "vitest";

import { namedStreams } from "../ai/randomStreams.ts";
import { EDGE, STEP_SECONDS } from "../core/index.ts";
import { DOG_BEHAVIOUR } from "../data/behaviours.ts";
import { BIRD } from "../data/bird.ts";
import { TILE } from "../data/screen.ts";
import type { AreaLayout, BehaviourPlan, Point, Rect } from "../data/types/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import {
  type BehaviourState,
  type BehaviourStep,
  startBehaviour,
  stepBehaviour,
} from "./behaviour.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { openingScorerState } from "./behaviourScorer.ts";
import { birdBox, startBird } from "./bird.ts";
import { type PursuitGroundMap, pursuitGroundMap } from "./movementMaps.ts";
import { objectLayout } from "./tiles.ts";

// Archie on a wide flat floor, with targets inside the escape distance for chase-relief checks.
const archie = objectLayout(
  TILE,
  CATALOGUE,
  HITBOXES,
  TILESETS["tiles-street"],
  {},
  { character: "dog-antagonist", col: 22, row: 46 },
);
const relief = DOG_BEHAVIOUR.pursuit!.relief!;
const floor: Rect = { height: 240, width: 40000, x: -20000, y: archie.origin.y + archie.height };

function world(tick: number, at: Point): BehaviourWorld {
  return {
    chunks: [{ width: floor.width, x: floor.x }],
    decisions: namedStreams(1, "chase-relief:main:0"),
    solids: [floor],
    targetedAttackWindow: "allowed",
    traversalFrame: {
      bounds: { height: 1440, width: floor.width, x: floor.x, y: 0 },
      dtSeconds: STEP_SECONDS,
      platforms: [],
      timeSeconds: tick * STEP_SECONDS,
    },
    view: { height: 720, width: 1440, x: at.x - 720, y: floor.y - 600 },
  };
}

function chibi(left: number) {
  return { ...startBird(BIRD, { x: left + BIRD.width / 2, y: floor.y }), grounded: true };
}

interface Tick {
  readonly at: Point;
  readonly step: BehaviourStep;
  readonly target: number;
}

// Targets use tile offsets from Archie's right edge.
function run({
  ahead,
  groundMap,
  seconds,
}: {
  readonly ahead: (state: BehaviourState, at: Point) => number;
  readonly groundMap?: PursuitGroundMap;
  readonly seconds: number;
}) {
  let at = archie.origin;
  let state: BehaviourState = { ...startBehaviour(BIRD, archie, chibi(0)), active: true };
  const ticks: Tick[] = [];
  for (let tick = 0; tick < Math.round(seconds / STEP_SECONDS); tick++) {
    const target = at.x + archie.width + ahead(state, at) * TILE;
    const step = stepBehaviour(
      BIRD,
      archie,
      { ...world(tick, at), ...(groundMap && { groundMap: () => groundMap }) },
      STEP_SECONDS,
      chibi(target),
      at,
      state,
    );
    at = step.at;
    state = step.state;
    ticks.push({ at, step, target });
  }
  return ticks;
}

const seconds = (tick: number) => (tick + 1) * STEP_SECONDS;

function duePause(reachable: boolean | undefined) {
  const at = archie.origin;
  const target = {
    ...chibi(at.x + archie.width + 12 * TILE),
    y: floor.y - 6 * TILE - BIRD.height,
  };
  const state: BehaviourState = {
    ...startBehaviour(BIRD, archie, target),
    active: true,
    mapPursuit: {
      failed: [],
      key: "previous-support",
      route: { key: "previous-target", next: { pace: at.x }, reachable: reachable !== true },
    },
    pendingEntry: false,
    pursuit: {
      engagedSeconds: relief.giveUp.seconds.max + 1,
      giveUpSeconds: relief.giveUp.seconds.max,
      phase: "engaged",
      settled: false,
      unreachableSeconds: 1,
    },
    scorer: {
      ...openingScorerState(DOG_BEHAVIOUR.scorer!),
      chaseSeconds: relief.pause.afterSeconds.max + 1,
      sinceAttackSeconds: relief.pause.tellClearanceSeconds + 1,
    },
    stateKey: DOG_BEHAVIOUR.scorer!.engaged,
    traversal: {
      geometry: "current-support",
      inputs: [],
      physical: { ...at, fallFromY: floor.y, grounded: true, vy: 0 },
      status:
        reachable === true ? "found" : reachable === false ? "unreachable" : "budget-exhausted",
      target: birdBox(BIRD, target),
    },
  };
  const sampled = world(0, at);
  const current: BehaviourWorld = {
    ...sampled,
    solids: [floor, { height: 12, width: 120, x: target.x - 24, y: target.y + BIRD.height }],
  };
  return { at, current, state, target };
}

it("uses the current fallback path for a due pause despite an older unreachable map route", () => {
  const { at, current, state, target } = duePause(true);
  const paused = stepBehaviour(BIRD, archie, current, STEP_SECONDS, target, at, state);
  expect(paused.state.chasePause).toBeDefined();
  expect(paused.state.pursuit).toMatchObject({
    giveUp: true,
    phase: "engaged",
    unreachableSeconds: 0,
  });
  const ended = stepBehaviour(BIRD, archie, current, STEP_SECONDS, target, paused.at, paused.state);
  expect(ended.state.pursuit?.phase).toBe("escaped");
  expect(ended.escaped).toEqual(DOG_BEHAVIOUR.pursuit!.escaped);
});

it("does not turn current unknown or unreachable paths into a due chase pause", () => {
  for (const reachable of [undefined, false]) {
    const { at, current, state, target } = duePause(reachable);
    const step = stepBehaviour(BIRD, archie, current, STEP_SECONDS, target, at, state);
    expect(step.state.chasePause).toBeUndefined();
    expect(step.state.pursuit?.phase).toBe("engaged");
    expect(step.state.pursuit?.giveUp).toBeUndefined();
    expect(step.state.pursuit?.unreachableSeconds).toBe(
      1 + (reachable === false ? STEP_SECONDS : 0),
    );
    expect(step.escaped).toBeUndefined();
  }
});

it("gives up a reachable chase at the first pause after its drawn time, with the escape bark, then walks home", () => {
  const { giveUp, pause } = relief;
  // The latest give-up: the longest draw, then a full chase span and pause before the next pause.
  const latest = giveUp.seconds.max + pause.afterSeconds.max + pause.seconds.max;
  const width = floor.x + floor.width;
  const area: AreaLayout = {
    backX: 0,
    chunks: [{ width, x: 0 }],
    entries: {},
    exitX: width,
    height: floor.y + floor.height,
    objects: [],
    solids: [floor],
    terrain: [],
    tileset: undefined,
    width,
  };
  const groundMap = pursuitGroundMap(area, archie)!;
  expect(groundMap).toBeDefined();
  const gap = 20;
  const leash = archie.behaviour!.pursuit!.distance;
  const low = archie.origin.x + leash / 4;
  const high = archie.origin.x + leash / 2;
  let direction = 1;
  const ticks = run({
    ahead: (_state, at) => {
      // Keep the target beyond attack range and inside the canonical pursuit leash.
      if (at.x >= high) {
        direction = -1;
      }
      if (at.x <= low) {
        direction = 1;
      }
      return direction === 1 ? gap : -gap - (archie.width + BIRD.width) / TILE;
    },
    groundMap,
    seconds: latest + 2,
  });
  const ended = ticks.findIndex(({ step }) => step.escaped !== undefined);
  expect(ended).toBeGreaterThan(0);
  const drawn = ticks[ended - 1]!.step.state.pursuit!.giveUpSeconds!;
  expect(drawn).toBeGreaterThanOrEqual(giveUp.seconds.min);
  expect(drawn).toBeLessThanOrEqual(giveUp.seconds.max);
  expect(seconds(ended)).toBeGreaterThanOrEqual(drawn);
  expect(seconds(ended)).toBeLessThanOrEqual(latest + 2 * STEP_SECONDS);
  expect(ticks[ended]!.step.escaped).toEqual(DOG_BEHAVIOUR.pursuit!.escaped);
  expect(ticks[ended]!.step.state.pursuit?.giveUp).toBe(true);
  expect(ticks.slice(0, ended).some(({ step }) => step.state.chasePause)).toBe(true);
  // The walk home heads for the encounter position without teleporting: no step outruns
  // traversal speed.
  const after = ticks.slice(ended);
  const distance = (at: Point) => Math.abs(at.x - archie.origin.x);
  expect(distance(after.at(-1)!.at)).toBeLessThan(distance(after[0]!.at));
  for (let index = 1; index < after.length; index++) {
    expect(Math.abs(after[index]!.at.x - after[index - 1]!.at.x)).toBeLessThanOrEqual(
      2 * BIRD.walkSpeed * STEP_SECONDS + EDGE,
    );
  }
});

it("waits the rearm cooldown after an ended chase before engaging again", () => {
  const cooldown = DOG_BEHAVIOUR.pursuit!.rearmSeconds!;
  // Archie settled at his encounter position after an ended chase, Chibi close by on his floor.
  const engagedAfter = (endedSeconds: number) => {
    const target = chibi(archie.origin.x + archie.width + 4 * TILE);
    let state: BehaviourState = {
      ...startBehaviour(BIRD, archie, target),
      active: true,
      pursuit: { endedSeconds, phase: "escaped", settled: true, unreachableSeconds: 0 },
    };
    for (let tick = 0; tick < Math.round((cooldown + 1) / STEP_SECONDS); tick++) {
      state = stepBehaviour(
        BIRD,
        archie,
        world(tick, archie.origin),
        STEP_SECONDS,
        target,
        archie.origin,
        state,
      ).state;
      if (state.pursuit?.phase === "engaged") {
        return seconds(tick);
      }
    }
    return Infinity;
  };
  expect(engagedAfter(cooldown)).toBeLessThanOrEqual(2 * STEP_SECONDS);
  const waited = engagedAfter(0);
  expect(waited).toBeGreaterThanOrEqual(cooldown - STEP_SECONDS);
  expect(waited).toBeLessThanOrEqual(cooldown + 2 * STEP_SECONDS);
});

it("pauses facing Chibi, never within the tell clearance of a tell", () => {
  const ticks = run({ ahead: () => 6, seconds: relief.giveUp.seconds.min });
  const engaged = ticks.filter(({ step }) => step.state.pursuit?.phase === "engaged");
  const telling = engaged.flatMap(({ step }, index) =>
    step.state.activeAttack?.phase === "tell" ? [index] : [],
  );
  const paused = engaged.flatMap(({ step }, index) => (step.state.chasePause ? [index] : []));
  expect(telling.length).toBeGreaterThan(0);
  expect(paused.length).toBeGreaterThan(0);
  const clearance = Math.round(relief.pause.tellClearanceSeconds / STEP_SECONDS);
  for (const pause of paused) {
    for (const tell of telling) {
      expect(Math.abs(pause - tell)).toBeGreaterThanOrEqual(clearance);
    }
    const { at, step, target } = engaged[pause]!;
    expect(step.state.facing).toBe(target > at.x ? 1 : -1);
    expect(step.at).toEqual(engaged[pause - 1]!.at);
  }
});

it("keeps clear of Chibi after an ended chase until the rearm cooldown ends", () => {
  const cooldown = DOG_BEHAVIOUR.pursuit!.rearmSeconds!;
  // Archie just escaped 20 tiles right of his encounter position, Chibi beyond it on the left,
  // so the walk home heads toward him.
  const walkHome = (plan: BehaviourPlan) => {
    const object = { ...archie, behaviour: plan };
    const target = chibi(archie.origin.x - 8 * TILE);
    let at = { ...archie.origin, x: archie.origin.x + 20 * TILE };
    let state: BehaviourState = {
      ...startBehaviour(BIRD, object, target),
      active: true,
      pursuit: {
        endedSeconds: 0,
        home: true,
        phase: "escaped",
        settled: false,
        unreachableSeconds: 0,
      },
    };
    const xs: number[] = [];
    for (let tick = 0; tick < Math.round((cooldown - 0.5) / STEP_SECONDS); tick++) {
      const step = stepBehaviour(BIRD, object, world(tick, at), STEP_SECONDS, target, at, state);
      at = step.at;
      state = step.state;
      xs.push(at.x);
    }
    return xs;
  };
  const kept = walkHome(archie.behaviour!);
  expect(kept.every((x, index) => index === 0 || x >= kept[index - 1]! - EDGE)).toBe(true);
  const unkept = walkHome({
    ...archie.behaviour!,
    pursuit: { ...archie.behaviour!.pursuit!, keepClear: false },
  });
  expect(unkept.at(-1)!).toBeLessThan(unkept[0]! - 4 * TILE);
});
