import { findTraversal, stepTraversal } from "@andornaut/game-kit/terrain/traversal";
import { expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, BehaviourPlan, Rect } from "../data/types";
import { layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import type { BehaviourPlatformFrame, BehaviourWorld } from "./behaviourReach";
import { probeRearm, traversalContext } from "./behaviourTraversal";
import { startBird } from "./bird";
import { STEP_SECONDS } from "./step";
import { objectLayout } from "./tiles";

vi.mock("@andornaut/game-kit/terrain/traversal", async (original) => {
  const actual = await original<typeof import("@andornaut/game-kit/terrain/traversal")>();
  return {
    ...actual,
    findTraversal: vi.fn(actual.findTraversal),
    stepTraversal: vi.fn(actual.stepTraversal),
  };
});
const checkBudget = vi.hoisted(() => ({ maxStates: undefined as number | undefined }));
vi.mock("../data/behaviours", async (original) => {
  const actual = await original<typeof import("../data/behaviours")>();
  return {
    ...actual,
    BEHAVIOUR_TRAVERSAL_SEARCH: {
      ...actual.BEHAVIOUR_TRAVERSAL_SEARCH,
      budget: {
        ...actual.BEHAVIOUR_TRAVERSAL_SEARCH.budget,
        get maxStates() {
          return checkBudget.maxStates ?? actual.BEHAVIOUR_TRAVERSAL_SEARCH.budget.maxStates;
        },
      },
    },
  };
});

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
const plan: BehaviourPlan = {
  axis: "x",
  distance: 100,
  initial: "chase",
  pursuit: {
    distance: 1000,
    escaped: { line: "escaped", speaker: "fixture" },
    unreachableGraceSeconds: 3,
  },
  states: {
    chase: {
      animation: null,
      motion: {
        kind: "pursue",
        mode: "ground",
        speed: 120,
        traversal: { gravity: 1000, jumpSpeed: 300, maxFallSpeed: 500 },
      },
      transitions: [],
    },
  },
};
function actor() {
  return objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: {
        actor: { archetype: "actor", art: "actor", behaviour: plan, cols: 24, rows: 24 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 30, row: 276 },
  );
}
function world(solids: readonly Rect[], timeSeconds: number): BehaviourWorld {
  return {
    solids,
    traversalFrame: {
      bounds: { height: 360, width: 720, x: 0, y: 0 },
      dtSeconds: STEP_SECONDS,
      platforms: [],
      timeSeconds,
    },
    view: { height: 360, width: 720, x: 0, y: 0 },
  };
}
it("scales only authored spatial traversal units", () => {
  const resolved = layoutBehaviour(12, plan).states.chase!.motion;
  expect(resolved).toMatchObject({
    speed: 1440,
    traversal: { gravity: 12000, jumpSpeed: 3600, maxFallSpeed: 6000 },
  });
});
it.each([
  { rise: 0, states: undefined },
  { rise: 36, states: 128 },
  { rise: 36, states: undefined },
])("physically traverses rise=$rise with bounded states=$states", ({ rise, states }) => {
  checkBudget.maxStates = states;
  vi.mocked(findTraversal).mockClear();
  const object = actor();
  const target = { ...startBird(BIRD, { x: 250, y: 300 - rise }), grounded: true };
  const solids = [
    { height: 60, width: 110, x: 0, y: 300 },
    { height: 60 + rise, width: 610, x: 110, y: 300 - rise },
  ];
  let at = object.origin;
  let state = {
    ...startBehaviour(BIRD, object, target),
    pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
  };
  let airborne = false;
  for (let tick = 0; tick < 480; tick++) {
    const next = stepBehaviour(
      BIRD,
      object,
      world(solids, tick * STEP_SECONDS),
      STEP_SECONDS,
      target,
      at,
      state,
    );
    airborne ||= next.at.y < object.origin.y;
    expect(next.at.x - at.x).toBeLessThanOrEqual(120 * STEP_SECONDS + 1e-8);
    at = next.at;
    state = next.state as typeof state;
    if (at.x > 180 && at.y + object.height === 300 - rise) {
      checkBudget.maxStates = undefined;
      expect(airborne).toBe(rise > 0);
      expect(state.pursuit?.phase).toBe("engaged");
      return;
    }
  }
  checkBudget.maxStates = undefined;
  if (rise === 36 && states === 128) {
    expect(state.traversal?.status).toBe("budget-exhausted");
    expect(vi.mocked(findTraversal)).toHaveBeenCalledTimes(1);
    expect(at).toEqual({ x: 86, y: 276 });
    return;
  }
  expect.fail(JSON.stringify({ at, state }));
});

it("keeps pursuit engaged when future support geometry is unavailable", () => {
  const object = actor();
  const target = { ...startBird(BIRD, { x: 250, y: 264 }), grounded: true };
  const solids = [
    { height: 60, width: 110, x: 0, y: 300 },
    { height: 96, width: 610, x: 110, y: 264 },
  ];
  let at = object.origin;
  let state = {
    ...startBehaviour(BIRD, object, target),
    pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
  };
  const support = { ...object, collision: "ledge" as const };
  for (let tick = 0; tick < 480; tick++) {
    const base = world(solids, tick * STEP_SECONDS);
    const frame = base.traversalFrame!;
    const geometry = {
      ...base,
      traversalFrame: {
        ...frame,
        platforms: [
          {
            after: { height: 12, width: 40, x: 400, y: 200 },
            before: { height: 12, width: 40, x: 400, y: 200 },
            collision: "ledge" as const,
            owner: support,
          },
        ],
        sample: () => undefined,
      },
    };
    const next = stepBehaviour(BIRD, object, geometry, STEP_SECONDS, target, at, state);
    at = next.at;
    state = next.state as typeof state;
  }
  expect(state.traversal?.status).toBe("geometry-unavailable");
  expect(state.pursuit).toMatchObject({ phase: "engaged", unreachableSeconds: 0 });
  expect(at.x + object.width).toBeLessThanOrEqual(110);
});

it("forwards each shared traversal leg into the engine contact path", () => {
  const object = actor();
  const target = { ...startBird(BIRD, { x: 250, y: 300 }), grounded: true };
  const geometry = world([{ height: 60, width: 720, x: 0, y: 300 }], 2);
  const state = {
    ...startBehaviour(BIRD, object, target),
    pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
  };
  const from = { ...object.origin, height: object.height, width: object.width };
  const middle = { ...from, x: from.x + 0.25 };
  const to = { ...middle, x: middle.x + 0.25, y: middle.y - 0.25 };
  vi.mocked(stepTraversal).mockImplementationOnce(() => ({
    segments: [
      { endSeconds: 2 + STEP_SECONDS / 2, from, phase: "sweep", startSeconds: 2, to: middle },
      {
        endSeconds: 2 + STEP_SECONDS,
        from: middle,
        phase: "sweep",
        startSeconds: 2 + STEP_SECONDS / 2,
        to,
      },
    ],
    state: { fallFromY: 300, grounded: true, vy: 0, x: to.x, y: to.y },
    status: "ok",
  }));
  const result = stepBehaviour(BIRD, object, geometry, STEP_SECONDS, target, object.origin, state);
  expect(result.segments.map(({ end, from, start, to }) => ({ end, from, start, to }))).toEqual([
    {
      end: 2 + STEP_SECONDS / 2 - 2,
      from: object.origin,
      start: 0,
      to: { x: middle.x, y: middle.y },
    },
    {
      end: 2 + STEP_SECONDS - 2,
      from: { x: middle.x, y: middle.y },
      start: 2 + STEP_SECONDS / 2 - 2,
      to: { x: to.x, y: to.y },
    },
  ]);
});

it("rearms a settled antagonist from a visible supported jump proof without a duplicate search", () => {
  vi.mocked(findTraversal).mockClear();
  const object = actor();
  const at = { x: 86, y: 276 };
  const target = { ...startBird(BIRD, { x: 190, y: 100 }), grounded: false };
  const solids = [
    { height: 60, width: 110, x: 0, y: 300 },
    { height: 96, width: 610, x: 110, y: 264 },
  ];
  const state = {
    ...startBehaviour(BIRD, object, target),
    anchor: at,
    pursuit: { phase: "escaped" as const, settled: true, unreachableSeconds: 3 },
  };
  const next = stepBehaviour(BIRD, object, world(solids, 0), STEP_SECONDS, target, at, state);
  expect(next.state.pursuit?.phase).toBe("engaged");
  expect(next.at.y).toBeLessThan(at.y);
  expect(vi.mocked(findTraversal)).toHaveBeenCalledTimes(1);
});
it("does not repeat an incomplete rearm search for each moving patrol start", () => {
  vi.mocked(findTraversal).mockClear();
  const object = actor();
  const motion = object.behaviour!.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw new Error("Expected ground pursuit");
  }
  const at = { x: 86, y: 276 };
  const target = { height: BIRD.height, width: BIRD.width, x: 238, y: 164 };
  const solids = [
    { height: 60, width: 110, x: 0, y: 300 },
    { height: 96, width: 610, x: 110, y: 264 },
  ];
  const geometry = world(solids, 0);
  const unknown = {
    ...geometry,
    traversalFrame: {
      ...geometry.traversalFrame!,
      sample: (time: number) => (time === 0 ? [] : undefined),
    },
  };
  const first = probeRearm(
    unknown,
    STEP_SECONDS,
    object,
    motion,
    at,
    "wait",
    true,
    undefined,
    at,
    target,
  );
  expect(first.reachable).toBeUndefined();
  expect(first.rearm.status).toBe("geometry-unavailable");
  expect(vi.mocked(findTraversal)).toHaveBeenCalledTimes(1);
  const moved = probeRearm(
    unknown,
    STEP_SECONDS,
    object,
    motion,
    at,
    "wait",
    true,
    first.rearm,
    { ...at, x: 85 },
    target,
  );
  expect(moved.reachable).toBeUndefined();
  expect(vi.mocked(findTraversal)).toHaveBeenCalledTimes(1);
  probeRearm(
    unknown,
    STEP_SECONDS,
    object,
    motion,
    at,
    "return",
    true,
    moved.rearm,
    { ...at, x: 85 },
    target,
  );
  expect(vi.mocked(findTraversal)).toHaveBeenCalledTimes(2);
});

it("keeps fixed-step traversal independent of contact animation boundaries", () => {
  const base = actor();
  const behaviour = {
    ...base.behaviour!,
    states: { chase: { ...base.behaviour!.states.chase!, animation: "walk" } },
  };
  const target = { ...startBird(BIRD, { x: 250, y: 264 }), grounded: true };
  const solids = [
    { height: 60, width: 110, x: 0, y: 300 },
    { height: 96, width: 610, x: 110, y: 264 },
  ];
  const run = (contact: boolean) => {
    const object = {
      ...base,
      behaviour,
      ...(contact && {
        contact: {
          frame: { height: 24, width: 24 },
          frames: { body: Array.from({ length: 24 }, (_, row) => [row, 0, 24] as const) },
          tags: {
            walk: {
              frames: [
                { frame: "body", seconds: 0.1 },
                { frame: "body", seconds: 0.1 },
              ],
              once: false,
            },
          },
        },
      }),
    };
    let at = object.origin;
    let state = {
      ...startBehaviour(BIRD, object, target),
      animationSeconds: 0.005,
      pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
    };
    const positions = [];
    for (let tick = 0; tick < 190; tick++) {
      const next = stepBehaviour(
        BIRD,
        object,
        world(solids, tick * STEP_SECONDS),
        STEP_SECONDS,
        target,
        at,
        state,
      );
      at = next.at;
      state = next.state as typeof state;
      positions.push(at);
    }
    return positions;
  };
  const plain = run(false);
  const animated = run(true);
  for (let tick = 0; tick < plain.length; tick++) {
    expect(animated[tick]!.x).toBeCloseTo(plain[tick]!.x, 8);
    expect(animated[tick]!.y).toBeCloseTo(plain[tick]!.y, 8);
  }
});

it("reuses sampled collider projections across queries without sharing owner exclusions", () => {
  const first = actor();
  const second = actor();
  const support = actor();
  const segments = [
    {
      endSeconds: STEP_SECONDS,
      from: { height: 10, width: 10, x: 0, y: 100 },
      startSeconds: 0,
      to: { height: 10, width: 10, x: 100, y: 100 },
    },
  ];
  const reads = vi.fn(() => segments);
  const moving: BehaviourPlatformFrame = {
    after: segments[0]!.to,
    before: segments[0]!.from,
    collision: "ledge",
    owner: support,
    get segments() {
      return reads();
    },
  };
  const rect = { height: 10, width: 10, x: 10, y: 100 };
  const frames: readonly BehaviourPlatformFrame[] = [
    { after: rect, before: rect, collision: "solid", owner: first },
    moving,
    { after: rect, before: rect, collision: "ledge", owner: second },
  ];
  const floor = { height: 10, width: 300, x: 0, y: 200 };
  const broad = { height: 300, width: 300, x: 0, y: 0 };
  const narrow = { height: 1, width: 1, x: 50, y: 100 };
  const base = world([floor], 0);
  const motion = plan.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw Error("Expected ground pursuit");
  }
  for (const owner of [first, second]) {
    const context = traversalContext(
      {
        ...base,
        traversalFrame: { ...base.traversalFrame!, platforms: frames, sample: () => frames },
      },
      STEP_SECONDS,
      owner,
      motion,
    )!;
    const uncached = traversalContext(
      {
        ...base,
        traversalFrame: { ...base.traversalFrame!, platforms: frames, sample: () => [...frames] },
      },
      STEP_SECONDS,
      owner,
      motion,
    )!;
    reads.mockClear();
    const wide = context.sampleColliders(0, STEP_SECONDS, broad);
    const projectedReads = reads.mock.calls.length;
    const small = context.sampleColliders(0, STEP_SECONDS, narrow);
    expect(projectedReads).toBeGreaterThan(0);
    expect(reads).toHaveBeenCalledTimes(projectedReads);
    expect(wide).toEqual(uncached.sampleColliders(0, STEP_SECONDS, broad));
    expect(small).toEqual(uncached.sampleColliders(0, STEP_SECONDS, narrow));
    expect(reads.mock.calls.length).toBeGreaterThan(projectedReads);
    expect(wide).toEqual({
      colliders: [
        { after: floor, before: floor, kind: "solid", supportId: floor },
        ...(owner === second
          ? [{ after: rect, before: rect, kind: "solid", supportId: first }]
          : []),
        { after: moving.after, before: moving.before, kind: "ledge", segments, supportId: support },
        ...(owner === first
          ? [{ after: rect, before: rect, kind: "ledge", supportId: second }]
          : []),
      ],
      complete: true,
    });
    expect(small).toEqual({
      colliders: [
        { after: moving.after, before: moving.before, kind: "ledge", segments, supportId: support },
      ],
      complete: true,
    });
    expect(wide.colliders.find((c) => c.supportId === support)).toBe(small.colliders[0]);
    expect(small.colliders[0]!.before).toBe(moving.before);
    expect(small.colliders[0]!.segments).toBe(segments);
  }
});
it("keeps different sampled frames, contexts and unknown future geometry separate", () => {
  const owner = actor();
  const support = actor();
  const before = { height: 10, width: 10, x: 0, y: 100 };
  const after = { ...before, x: 20 };
  const initial = [{ after: before, before, collision: "ledge" as const, owner: support }];
  const later = [{ after, before: after, collision: "ledge" as const, owner: support }];
  const base = world([], 0);
  const motion = plan.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw Error("Expected ground pursuit");
  }
  const snapshot = {
    ...base,
    traversalFrame: {
      ...base.traversalFrame!,
      platforms: initial,
      sample: (time: number) => (time === 0 ? initial : time === STEP_SECONDS ? later : undefined),
    },
  };
  const context = traversalContext(snapshot, STEP_SECONDS, owner, motion)!;
  const query = { height: 300, width: 300, x: 0, y: 0 };
  const first = context.sampleColliders(0, STEP_SECONDS, query);
  expect(context.sampleColliders(STEP_SECONDS, STEP_SECONDS, query)).toEqual({
    colliders: [{ after, before: after, kind: "ledge", supportId: support }],
    complete: true,
  });
  expect(context.sampleColliders(2 * STEP_SECONDS, STEP_SECONDS, query)).toEqual({
    colliders: [],
    complete: false,
  });
  expect(context.sampleColliders(0, STEP_SECONDS, query)).toEqual(first);
  const fresh = traversalContext(snapshot, STEP_SECONDS, owner, motion)!.sampleColliders(
    0,
    STEP_SECONDS,
    query,
  );
  expect(fresh).toEqual(first);
  expect(fresh.colliders[0]).not.toBe(first.colliders[0]);
  const fallback = traversalContext(
    { ...base, traversalFrame: { ...base.traversalFrame!, platforms: initial } },
    STEP_SECONDS,
    owner,
    motion,
  )!;
  expect(fallback.sampleColliders(0, STEP_SECONDS, query)).toEqual(first);
  expect(fallback.sampleColliders(STEP_SECONDS, STEP_SECONDS, query)).toEqual({
    colliders: [],
    complete: false,
  });
});
