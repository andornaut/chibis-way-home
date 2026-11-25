import { describe, expect, it } from "vitest";

import { namedStreams } from "../../ai/randomStreams.ts";
import { STEP_SECONDS } from "../../core/index.ts";
import {
  BEAR_BEHAVIOUR,
  DOG_BEHAVIOUR,
  FERRET_BEHAVIOUR,
  GOOSE_BEHAVIOUR,
  RACCOON_BEHAVIOUR,
} from "../../data/behaviours.ts";
import { BIRD } from "../../data/bird.ts";
import { CHARGE_BAND, chargeScore, GROWL_BAND, PARCEL_BAND } from "../../data/bossScorers.ts";
import { TILE } from "../../data/screen.ts";
import type { ObjectLayout, Point, Rect } from "../../data/types/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/walkSuite.ts";
import { birdBox, startBird } from "../bird/bird.ts";
import { objectLayout } from "../stage/tiles.ts";
import type { AttackGateRefusal } from "./attackGate.ts";
import { type BehaviourState, startBehaviour } from "./behaviour.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { contactBox, pursuitTrack } from "./behaviourTrack.ts";
import { stepEncounter } from "./encounter.ts";

// Every boss whose charge is a tell followed by a committed rush.
const CHARGERS = [
  "bear-antagonist",
  "dog-antagonist",
  "ferret-antagonist",
  "goose-antagonist",
  "raccoon-antagonist",
] as const;
const PLANS = {
  "bear-antagonist": BEAR_BEHAVIOUR,
  "dog-antagonist": DOG_BEHAVIOUR,
  "ferret-antagonist": FERRET_BEHAVIOUR,
  "goose-antagonist": GOOSE_BEHAVIOUR,
  "raccoon-antagonist": RACCOON_BEHAVIOUR,
} as const;
const FACINGS = [-1, 1] as const;
// A level gap inside every charge's band.
const GAP = 5 * TILE;

function boss(character: string): ObjectLayout {
  // A rectangular body, so gaps read from the contact box whatever the pose.
  const { contact, ...object } = objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character, col: 200, row: 10 },
  );
  expect(contact).toBeDefined();
  return object;
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

// The scored transition of the boss's engaged state into an attack's tell.
function attackOf(object: ObjectLayout, id: string) {
  const plan = object.behaviour!;
  const engaged = plan.scorer!.engaged;
  const transition = plan.states[engaged]!.transitions.find(
    ({ score, to }) => score && plan.states[to]!.attack?.id === id,
  )!;
  return { engaged, tell: transition.to, transition };
}

// A gap limit of the transition, in layout pixels.
function limitOf(
  { when }: ReturnType<typeof attackOf>["transition"],
  kind: "height-gap" | "horizontal-gap",
  comparison: "at-least" | "below",
): number {
  for (const condition of when) {
    if (condition.kind === kind && condition.comparison === comparison) {
      return condition.distance;
    }
  }
  throw new Error(`No ${kind} ${comparison} limit`);
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

// One engaged step from the pursuit state, with the refusals the gate recorded for the attack,
// or for the scored transition into `to`.
function decide(
  object: ObjectLayout,
  solids: readonly Rect[],
  at: Point,
  facing: -1 | 1,
  bird: ReturnType<typeof chibiAt>,
  id = "charge",
  to?: string,
) {
  const engaged = object.behaviour!.scorer!.engaged;
  const tell = to ?? attackOf(object, id).tell;
  const state: BehaviourState = {
    ...startBehaviour(BIRD, object, bird),
    active: true,
    axis: "x",
    facing,
    pendingEntry: false,
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    stateKey: engaged,
  };
  const step = stepEncounter({ object, observe: {}, tuning: BIRD }, state, {
    at,
    kind: "tick",
    seconds: STEP_SECONDS,
    target: bird,
    world: worldOf(solids),
  });
  const refusals = (step.observations ?? []).flatMap((record) =>
    record.kind === "gate" && record.to === tell ? [record.reason] : [],
  );
  return { refusals, state: step.state, tell };
}

function expectRefused(
  result: ReturnType<typeof decide>,
  reason: AttackGateRefusal,
  id = "charge",
) {
  expect(result.refusals).toContain(reason);
  expect(result.state.stateKey).not.toBe(result.tell);
  expect(result.state.activeAttack?.id).not.toBe(id);
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

  const { transition } = attackOf(object, "charge");
  const minGap = limitOf(transition, "horizontal-gap", "at-least");
  const reach = limitOf(transition, "horizontal-gap", "below");
  const heightGap = limitOf(transition, "height-gap", "below");

  it("takes its band from the shared charge band and its score's reach", () => {
    expect(minGap).toBe(CHARGE_BAND.minGap * TILE);
    expect(heightGap).toBe(CHARGE_BAND.heightGap * TILE);
    const authored = Object.values(PLANS[character].states)
      .flatMap(({ transitions }) => transitions)
      .find(({ score, to }) => score && to === transition.to)!;
    expect(authored.score).toEqual(chargeScore(reach / TILE));
  });

  it.each(FACINGS)("is refused for band inside its minimum gap facing %s", (facing) => {
    const inside = decide(object, [floor], at, facing, chibiAt(object, at, facing, minGap - 1));
    expectRefused(inside, "band");
    const edge = decide(object, [floor], at, facing, chibiAt(object, at, facing, minGap));
    expect(edge.refusals).toEqual([]);
  });

  it.each(FACINGS)("is refused at its reach facing %s", (facing) => {
    const beyond = decide(object, [floor], at, facing, chibiAt(object, at, facing, reach));
    expect(["band", "engagement"]).toContain(beyond.refusals[0]);
    expect(beyond.state.activeAttack?.id).not.toBe("charge");
    const within = decide(object, [floor], at, facing, chibiAt(object, at, facing, reach - 1));
    expect(within.refusals).not.toContain("band");
  });

  it.each([-1, 1] as const)("is refused for band at its height gap, sign %s", (sign) => {
    const outside = chibiAt(object, at, 1, GAP, sign * heightGap);
    expectRefused(decide(object, [floor], at, 1, outside), "band");
    const inside = chibiAt(object, at, 1, GAP, sign * (heightGap - 1));
    expect(decide(object, [floor], at, 1, inside).refusals).toEqual([]);
  });
});

it("refuses Fert's parcel for band inside its minimum gap", () => {
  const object = boss("ferret-antagonist");
  const at = object.origin;
  const floor: Rect = { height: 240, width: 24000, x: -12000, y: at.y + object.height };
  const minGap = limitOf(attackOf(object, "parcel").transition, "horizontal-gap", "at-least");
  expect(minGap).toBe(PARCEL_BAND.minGap * TILE);
  const inside = chibiAt(object, at, 1, minGap - 1);
  expectRefused(decide(object, [floor], at, 1, inside, "parcel"), "band", "parcel");
  const edge = chibiAt(object, at, 1, minGap);
  expect(decide(object, [floor], at, 1, edge, "parcel").refusals).toEqual([]);
});

it("refuses Bini's growl for band at its height gap", () => {
  const object = boss("bear-antagonist");
  const at = object.origin;
  const floor: Rect = { height: 240, width: 24000, x: -12000, y: at.y + object.height };
  const heightGap = limitOf(attackOf(object, "growl").transition, "height-gap", "below");
  expect(heightGap).toBe(GROWL_BAND.heightGap * TILE);
  for (const sign of FACINGS) {
    const outside = chibiAt(object, at, 1, GAP, sign * heightGap);
    expectRefused(decide(object, [floor], at, 1, outside, "growl"), "band", "growl");
    const inside = chibiAt(object, at, 1, GAP, sign * (heightGap - 1));
    expect(decide(object, [floor], at, 1, inside, "growl").refusals).toEqual([]);
  }
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

describe("Kiwi's drop", () => {
  const object = boss("raccoon-antagonist");
  const plan = object.behaviour!;
  const at = object.origin;
  const floor: Rect = { height: 240, width: 24000, x: -12000, y: at.y + object.height };
  // Her drop starts with the scored walk to her climb's foot, outside any attack sequence.
  const start = plan.states[plan.scorer!.engaged]!.transitions.find(
    ({ score, to }) => score && !plan.states[to]!.attack,
  )!;
  const lined = limitOf(start, "horizontal-gap", "below");
  const engaged = plan.scorer!.engaged;
  const drop = (bird: ReturnType<typeof chibiAt>) =>
    decide(object, [floor], at, 1, bird, undefined, start.to);

  it("is refused beside Chibi on her own floor, however close", () => {
    const result = drop(chibiAt(object, at, 1, lined / 2));
    expect(result.refusals).toEqual(["condition"]);
    expect(result.state.stateKey).toBe(engaged);
  });

  it("is refused with Chibi lower than her top", () => {
    const result = drop(chibiAt(object, at, 1, -object.width / 2, object.height - 1));
    expect(result.refusals).toEqual(["condition"]);
    expect(result.state.stateKey).toBe(engaged);
  });

  it("starts lined up under a Chibi above her", () => {
    const result = drop(chibiAt(object, at, 1, -object.width / 2, object.height));
    expect(result.refusals).toEqual([]);
    expect(result.state.stateKey).not.toBe(engaged);
    expect(plan.states[result.state.stateKey]!.motion.kind).toBe("move");
  });
});
