import { describe, expect, it } from "vitest";

import { namedStreams } from "../../ai/randomStreams.ts";
import { EDGE, STEP_SECONDS } from "../../core/index.ts";
import { BIRD } from "../../data/bird.ts";
import { TILE } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/walkSuite.ts";
import { startBird } from "../bird/bird.ts";
import { objectLayout } from "../stage/tiles.ts";
import { type BehaviourState, contactBox, startBehaviour } from "./behaviour.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { nodeOf, trackEndpoint } from "./behaviourTrack.ts";
import { stepBehaviour } from "./encounter.ts";

// Archie's committed charge from a bank whose left edge is at x 240, with Chibi far left.
const archie = objectLayout(
  TILE,
  CATALOGUE,
  HITBOXES,
  TILESETS["tiles-street"],
  {},
  { character: "dog-antagonist", col: 22, row: 46 },
);
const bank: Rect = { height: 120, width: 480, x: 240, y: 600 };
const pit: Rect = { height: 24, width: 720, x: 0, y: 696 };
const chibi = { ...startBird(BIRD, { x: 12, y: 600 - BIRD.height }), grounded: true };

function world(solids: readonly Rect[], tick: number): BehaviourWorld {
  return {
    decisions: namedStreams(1, "ground-rush:main:0"),
    solids,
    targetedAttackWindow: "allowed",
    traversalFrame: {
      bounds: { height: 720, width: 720, x: 0, y: 0 },
      dtSeconds: STEP_SECONDS,
      platforms: [],
      timeSeconds: tick * STEP_SECONDS,
    },
  };
}

function charge(solids: (tick: number) => readonly Rect[]) {
  let state: BehaviourState = {
    ...startBehaviour(BIRD, archie, chibi),
    active: true,
    activeAttack: { id: "charge", phase: "committed" },
    facing: -1,
    pendingEntry: true,
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    stateKey: "rush",
  };
  let at = archie.origin;
  const path: { at: typeof at; state: string }[] = [];
  for (let tick = 0; tick < 90; tick++) {
    const step = stepBehaviour(
      BIRD,
      archie,
      world(solids(tick), tick),
      STEP_SECONDS,
      chibi,
      at,
      state,
    );
    at = step.at;
    state = step.state;
    path.push({ at, state: state.stateKey });
  }
  return path;
}

it("stops a committed rush at the edge of its support and recovers there", () => {
  const path = charge(() => [bank, pit]);
  for (const { at } of path) {
    expect(at.y).toBe(archie.origin.y);
    expect(contactBox(archie, at, -1).x).toBeGreaterThanOrEqual(bank.x - EDGE);
  }
  expect(contactBox(archie, path.at(-1)!.at, -1).x).toBeCloseTo(bank.x);
  expect(path.map(({ state }) => state)).toContain("rest");
});

it("drops a committed rush whose support vanishes instead of holding it in the air", () => {
  const path = charge((tick) => (tick < 10 ? [bank, pit] : [pit]));
  const last = path.at(-1)!.at;
  expect(last.y + archie.height).toBeCloseTo(pit.y);
  for (let index = 11; index < path.length; index++) {
    const { at } = path[index]!;
    expect(at.y > path[index - 1]!.at.y || at.y + archie.height === pit.y).toBe(true);
  }
});

// Every boss whose charge is a committed rush along its facing, on one wide floor.
const CHARGERS = [
  "bear-antagonist",
  "dog-antagonist",
  "ferret-antagonist",
  "goose-antagonist",
  "raccoon-antagonist",
] as const;
const FACINGS = [-1, 1] as const;

describe.each(CHARGERS)("%s's committed rush", (character) => {
  const boss = objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character, col: 22, row: 46 },
  );
  const at = boss.origin;
  const floor: Rect = { height: 120, width: 4800, x: at.x - 2400, y: at.y + boss.height };
  const rush = nodeOf(boss, "rush");
  const length = Math.abs((rush.track ?? boss.behaviour!).distance);
  const rushing = (facing: -1 | 1): BehaviourState => ({
    ...startBehaviour(BIRD, boss, chibi),
    active: true,
    activeAttack: { id: rush.attack!.id, phase: "committed" },
    anchor: at,
    axis: "x",
    facing,
    pendingEntry: true,
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    stateKey: "rush",
  });

  it("is a committed move along its facing", () => {
    expect(rush.attack?.phase).toBe("committed");
    expect(rush.motion).toMatchObject({ direction: "facing", kind: "move" });
    expect(length).toBeGreaterThan(0);
  });

  it.each(FACINGS)("has its track's length ahead when facing %s", (facing) => {
    const state = rushing(facing);
    expect(trackEndpoint(boss, facing, state)).toBe(at.x + facing * length);
    expect(trackEndpoint(boss, -facing as -1 | 1, state)).toBe(at.x);
  });

  it.each(FACINGS)("travels the way it faces when facing %s", (facing) => {
    const step = stepBehaviour(
      BIRD,
      boss,
      world([floor], 0),
      STEP_SECONDS,
      chibi,
      at,
      rushing(facing),
    );
    expect(step.state.stateKey).toBe("rush");
    expect((step.at.x - at.x) * facing).toBeGreaterThan(0);
  });
});

it("keeps an uncommitted state's track on its authored side", () => {
  const wandering = { ...startBehaviour(BIRD, archie, chibi), anchor: archie.origin };
  const authored = archie.origin.x + archie.behaviour!.distance;
  for (const facing of FACINGS) {
    const turned = { ...wandering, facing };
    expect(nodeOf(archie, turned.stateKey).attack).toBeUndefined();
    expect(trackEndpoint(archie, -1, turned)).toBe(Math.min(archie.origin.x, authored));
    expect(trackEndpoint(archie, 1, turned)).toBe(Math.max(archie.origin.x, authored));
  }
});
