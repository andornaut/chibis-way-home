import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { WARNED_VENT_BEHAVIOUR, WARNED_VENT_SECONDS } from "../data/obstacleBehaviours";
import type { Archetype, BehaviourMotion, BehaviourPlan, Rect } from "../data/types";
import { startBehaviour, stepBehaviour } from "./behaviour";
import { traversalContext } from "./behaviourTraversal";
import { startBird } from "./bird";
import { hazardOccupancy } from "./hazardOccupancy";
import { objectLayout } from "./tiles";
import { createTimedHazardSampler } from "./timedHazard";

const archetype: Archetype = {
  collision: "hazard",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "static",
    direction: "right",
    distance: 0,
    hopHeight: 0,
    pause: 0,
    speed: 0,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const object = objectLayout(
  1,
  {
    archetypes: { obstacle: archetype },
    characters: {
      obstacle: {
        archetype: "obstacle",
        art: "placeholder-obstacle",
        behaviour: WARNED_VENT_BEHAVIOUR,
        cols: 4,
        rows: 6,
      },
    },
  },
  {},
  undefined,
  {},
  { character: "obstacle", col: 20, row: 30 },
);
const bird = startBird(BIRD, { x: 0, y: 0 });
const started = () => startBehaviour(BIRD, object, bird);
const full = { ...object.origin, height: object.height, width: object.width };
const snapshotTime = 10;
const activeTime = snapshotTime + WARNED_VENT_SECONDS.inactive + WARNED_VENT_SECONDS.warning;
const sampler = () =>
  createTimedHazardSampler(BIRD, object, {
    at: object.origin,
    state: started(),
    timeSeconds: snapshotTime,
  })!;

it("clips the actual executor's active slices to absolute query times and full volume", () => {
  const sample = sampler();
  expect(sample(snapshotTime, activeTime)).toEqual([
    { endSeconds: activeTime, rect: full, startSeconds: activeTime },
  ]);
  const contacts = sample(activeTime - 0.01, activeTime + 0.02)!;
  expect(contacts).toHaveLength(1);
  expect(contacts[0]!.startSeconds).toBeCloseTo(activeTime);
  expect(contacts[0]!.endSeconds).toBeCloseTo(activeTime + 0.02);
  expect(contacts[0]!.rect).toEqual(full);
  expect(sample(activeTime, activeTime)).toEqual([
    { endSeconds: activeTime, rect: full, startSeconds: activeTime },
  ]);
  const end = activeTime + WARNED_VENT_SECONDS.active;
  expect(sample(end, end + WARNED_VENT_SECONDS.recovery / 2)).toEqual([]);
});

it("anchors prediction to a copied live elapsed snapshot rather than a new cycle", () => {
  const elapsed = WARNED_VENT_SECONDS.inactive + WARNED_VENT_SECONDS.warning / 2;
  const live = stepBehaviour(BIRD, object, [], elapsed, bird, object.origin, started()).state;
  const sample = createTimedHazardSampler(BIRD, object, {
    at: object.origin,
    state: live,
    timeSeconds: snapshotTime,
  })!;
  Object.assign(live, { elapsed: 0 });
  const remaining = WARNED_VENT_SECONDS.warning / 2;
  expect(sample(snapshotTime, snapshotTime + remaining / 2)).toEqual([]);
  expect(sample(snapshotTime + remaining, snapshotTime + remaining + 0.01)).toHaveLength(1);
});

it.each([
  ["before snapshot", snapshotTime - 1, snapshotTime],
  ["reversed", snapshotTime + 1, snapshotTime],
  ["nonfinite", snapshotTime, Infinity],
  ["work exhaustion", snapshotTime, snapshotTime + 1e9],
])("keeps %s queries unknown", (_, start, end) => {
  expect(sampler()(start as number, end as number)).toBeUndefined();
});

const motion: Extract<BehaviourMotion, { mode: "ground" }> = {
  kind: "pursue",
  mode: "ground",
  speed: 10,
  traversal: { gravity: 100, jumpSpeed: 30, maxFallSpeed: 100, prepSeconds: 0 },
};
const plan: BehaviourPlan = {
  axis: "x",
  distance: 100,
  initial: "follow",
  pursuit: {
    distance: 100,
    escaped: { line: "escaped", speaker: "actor" },
    unreachableGraceSeconds: null,
  },
  states: { follow: { animation: null, motion, transitions: [] } },
};
const actor = { ...object, behaviour: plan };
function context(state = started()) {
  return traversalContext(
    {
      hazards: [
        {
          owner: object,
          ...hazardOccupancy(
            BIRD,
            [object],
            state,
            object.origin,
            { ...full, width: 1 },
            snapshotTime,
            object,
          ),
        },
      ],
      solids: [],
      traversalFrame: {
        bounds: { height: 1000, width: 1000, x: 0, y: 0 },
        dtSeconds: 0.1,
        platforms: [],
        timeSeconds: snapshotTime,
      },
    },
    0.1,
    actor,
    motion,
  )!;
}
function request(startSeconds: number, endSeconds: number, from: Rect = full, to = from) {
  return { endSeconds, from, phase: "sweep" as const, startSeconds, to };
}

it("uses native timed safety without rejecting inactive geometry as permanently lethal", () => {
  const native = context();
  expect(native.safe(request(snapshotTime, snapshotTime + 0.1))).toBe(true);
  expect(native.sampleColliders(snapshotTime + 0.1, 0.1, full).complete).toBe(true);
  expect(native.safe(request(activeTime - 0.01, activeTime + 0.01))).toBe(false);
  expect(native.safe(request(snapshotTime, activeTime))).toBe(false);
  expect(
    native.safe(request(activeTime, activeTime + 0.01, { ...full, x: full.x + full.width + 2 })),
  ).toBe(true);
});

it("distinguishes missing snapshot data from a certified empty active interval", () => {
  const missing = createTimedHazardSampler(BIRD, object, {
    at: object.origin,
    state: undefined,
    timeSeconds: snapshotTime,
  })!;
  expect(missing(snapshotTime, snapshotTime + 0.1)).toBeUndefined();
  const native = traversalContext(
    {
      hazards: [{ owner: object, rect: full, timedContacts: missing }],
      solids: [],
      traversalFrame: {
        bounds: { height: 1000, width: 1000, x: 0, y: 0 },
        dtSeconds: 0.1,
        platforms: [],
        timeSeconds: snapshotTime,
      },
    },
    0.1,
    actor,
    motion,
  )!;
  expect(native.safe(request(snapshotTime, snapshotTime + 0.1))).toBe(false);
  expect(native.sampleColliders(snapshotTime, 0.1, full).complete).toBe(false);
  expect(
    createTimedHazardSampler(BIRD, actor, {
      at: actor.origin,
      state: started(),
      timeSeconds: snapshotTime,
    }),
  ).toBeUndefined();
});
