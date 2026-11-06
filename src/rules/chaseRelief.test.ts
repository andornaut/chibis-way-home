import { expect, it } from "vitest";

import { namedStreams } from "../ai/randomStreams";
import { EDGE, STEP_SECONDS } from "../core";
import { DOG_BEHAVIOUR } from "../data/behaviours";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { Point, Rect } from "../data/types";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import {
  type BehaviourState,
  type BehaviourStep,
  startBehaviour,
  stepBehaviour,
} from "./behaviour";
import type { BehaviourWorld } from "./behaviourReach";
import { startBird } from "./bird";
import { objectLayout } from "./tiles";

// Archie on an unbounded flat floor, with Chibi held a fixed number of tiles to his right, so
// pursuit never ends by distance and every chase pause, tell and give-up comes from the plan.
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

// Steps Archie for `seconds` with Chibi `ahead(state)` tiles right of his body.
function run(ahead: (state: BehaviourState) => number, seconds: number) {
  let at = archie.origin;
  let state: BehaviourState = { ...startBehaviour(BIRD, archie, chibi(0)), active: true };
  const ticks: Tick[] = [];
  for (let tick = 0; tick < Math.round(seconds / STEP_SECONDS); tick++) {
    const target = at.x + archie.width + ahead(state) * TILE;
    const step = stepBehaviour(
      BIRD,
      archie,
      world(tick, at),
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

it("gives up a reachable chase by the certain limit with the escape bark, then walks home", () => {
  const ticks = run(() => 20, relief.giveUp.certainSeconds + 2);
  const ended = ticks.findIndex(({ step }) => step.escaped !== undefined);
  expect(ended).toBeGreaterThan(0);
  expect(seconds(ended)).toBeLessThanOrEqual(relief.giveUp.certainSeconds + 2 * STEP_SECONDS);
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
  const ticks = run(() => 6, relief.giveUp.fromSeconds + 5);
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
