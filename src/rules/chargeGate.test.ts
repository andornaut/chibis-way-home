import { describe, expect, it } from "vitest";

import { namedStreams } from "../ai/randomStreams.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import { TILE } from "../data/screen.ts";
import type { ObjectLayout, Point, Rect } from "../data/types/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import type { AttackGateRefusal } from "./attackGate.ts";
import { type BehaviourState, startBehaviour } from "./behaviour.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { contactBox, pursuitTrack } from "./behaviourTrack.ts";
import { birdBox, startBird } from "./bird.ts";
import { stepEncounter } from "./encounter.ts";
import { objectLayout } from "./tiles.ts";

// Every boss whose charge is a tell followed by a committed rush.
const CHARGERS = [
  "bear-antagonist",
  "dog-antagonist",
  "ferret-antagonist",
  "goose-antagonist",
  "raccoon-antagonist",
] as const;
const FACINGS = [-1, 1] as const;
// A level gap inside every charge's band.
const GAP = 5 * TILE;

function boss(character: string): ObjectLayout {
  return objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character, col: 200, row: 10 },
  );
}

function worldOf(solids: readonly Rect[]): BehaviourWorld {
  return {
    decisions: namedStreams(1, "charge-gate"),
    solids,
    targetedAttackWindow: "allowed",
    traversalFrame: {
      bounds: { height: 2400, width: 24000, x: -12000, y: -1200 },
      dtSeconds: STEP_SECONDS,
      platforms: [],
      timeSeconds: 0,
    },
  };
}

// The scored charge transition of the boss's engaged state and its rush.
function chargeOf(object: ObjectLayout) {
  const plan = object.behaviour!;
  const engaged = plan.scorer!.engaged;
  const transition = plan.states[engaged]!.transitions.find(
    ({ score, to }) => score && plan.states[to]!.attack?.id === "charge",
  )!;
  return { engaged, tell: transition.to, transition };
}

// Chibi standing with his box `gap` pixels from the boss's contact box on its facing side, his
// feet `rise` pixels above the boss's.
function chibiAt(object: ObjectLayout, at: Point, facing: -1 | 1, gap: number, rise = 0) {
  const body = contactBox(object, at, facing, "x");
  const x = facing === 1 ? body.x + body.width + gap : body.x - gap - BIRD.width;
  const bird = { ...startBird(BIRD, { x: 0, y: 0 }), grounded: true };
  const box = birdBox(BIRD, bird);
  return {
    ...bird,
    x: bird.x + x - box.x,
    y: bird.y + at.y + object.height - rise - (box.y + box.height),
  };
}

// One engaged step from the pursuit state, with the refusals the gate recorded for the charge.
function decide(
  object: ObjectLayout,
  solids: readonly Rect[],
  at: Point,
  facing: -1 | 1,
  bird: ReturnType<typeof chibiAt>,
  patch: Partial<BehaviourState> = {},
) {
  const { engaged, tell } = chargeOf(object);
  const state: BehaviourState = {
    ...startBehaviour(BIRD, object, bird),
    active: true,
    axis: "x",
    facing,
    pendingEntry: false,
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    stateKey: engaged,
    ...patch,
  };
  const step = stepEncounter({ object, observe: {}, tuning: BIRD }, state, {
    at,
    seconds: STEP_SECONDS,
    target: bird,
    world: worldOf(solids),
  });
  const refusals = (step.observations ?? []).flatMap((record) =>
    record.kind === "gate" && record.to === tell ? [record.reason] : [],
  );
  return { refusals, state: step.state, tell };
}

function expectRefused(result: ReturnType<typeof decide>, reason: AttackGateRefusal) {
  expect(result.refusals).toContain(reason);
  expect(result.state.stateKey).not.toBe(result.tell);
  expect(result.state.activeAttack?.id).not.toBe("charge");
  expect(result.state.attackCooldownRemainingSeconds).toBeUndefined();
}

describe.each(CHARGERS)("%s's scored charge", (character) => {
  const object = boss(character);
  const at = object.origin;
  const feet = at.y + object.height;
  const floor: Rect = { height: 240, width: 24000, x: -12000, y: feet };

  it.each(FACINGS)("is not refused on open ground facing %s", (facing) => {
    const result = decide(object, [floor], at, facing, chibiAt(object, at, facing, GAP));
    expect(result.refusals).toEqual([]);
  });

  it.each(FACINGS)("is refused for no-room against a wall facing %s", (facing) => {
    const body = contactBox(object, at, facing, "x");
    const wall = { ...body, x: body.x + facing * body.width };
    const result = decide(object, [floor, wall], at, facing, chibiAt(object, at, facing, GAP));
    expectRefused(result, "no-room");
  });

  it.each(FACINGS)("is refused for no-room at the edge of its support facing %s", (facing) => {
    const body = contactBox(object, at, facing, "x");
    const edge = facing === 1 ? body.x + body.width : body.x;
    const bank: Rect = {
      height: 2 * TILE,
      width: 40 * TILE,
      x: facing === 1 ? edge - 40 * TILE : edge,
      y: feet,
    };
    const far: Rect = {
      height: 2 * TILE,
      width: 40 * TILE,
      x: facing === 1 ? edge + GAP - TILE : edge - GAP + TILE - 40 * TILE,
      y: feet,
    };
    const pit: Rect = { ...floor, y: feet + 2 * TILE };
    const bird = chibiAt(object, at, facing, GAP);
    expectRefused(decide(object, [bank, far, pit], at, facing, bird), "no-room");
  });

  it.each(FACINGS)("is refused for no-room at its pursuit boundary facing %s", (facing) => {
    const track = pursuitTrack(object);
    const end = { ...at, x: facing === 1 ? track.origin!.x + track.distance : track.origin!.x };
    const result = decide(object, [floor], end, facing, chibiAt(object, end, facing, GAP));
    expectRefused(result, "no-room");
  });
});

it("starts Archie's charge tell when the gate admits it", () => {
  const object = boss("dog-antagonist");
  const at = object.origin;
  const floor: Rect = { height: 240, width: 24000, x: -12000, y: at.y + object.height };
  for (const facing of FACINGS) {
    const result = decide(object, [floor], at, facing, chibiAt(object, at, facing, GAP));
    expect(result.state.stateKey).toBe(result.tell);
    expect(result.state.activeAttack).toEqual({ id: "charge", phase: "tell" });
  }
});
