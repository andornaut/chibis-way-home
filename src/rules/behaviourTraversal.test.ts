import { findTraversal, stepTraversal } from "@andornaut/game-kit/terrain/traversal";
import { expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, BehaviourPlan, Rect } from "../data/types";
import { withAnticipationContact } from "../testing/behaviours";
import { behaviourPose } from "../view/behaviour";
import { layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import type { BehaviourPlatformFrame, BehaviourWorld } from "./behaviourReach";
import { advanceTraversal, probeRearm, traversalContext } from "./behaviourTraversal";
import { startBird } from "./bird";
import { contactFrameAt } from "./bodyContact";
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
        traversal: { gravity: 1000, jumpSpeed: 300, maxFallSpeed: 500, prepSeconds: 0 },
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
    chunks: [{ width: 720, x: 0 }],
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
    traversal: { gravity: 12000, jumpSpeed: 3600, maxFallSpeed: 6000, prepSeconds: 0 },
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
    const repeated = context.sampleColliders(0, STEP_SECONDS, broad);
    expect(repeated.colliders).not.toBe(wide.colliders);
    expect(repeated.colliders).toEqual(wide.colliders);
    expect(repeated.colliders.every((collider, index) => collider === wide.colliders[index])).toBe(
      true,
    );
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

it("reuses solid wrappers while preserving query order, live rectangle references and snapshot boundaries", () => {
  const owner = actor();
  const first = { height: 10, width: 100, x: 0, y: 100 };
  const second = { height: 10, width: 100, x: 10, y: 100 };
  let terrain = [first, second];
  const base = world([], 0);
  const snapshot = {
    ...base,
    get solids() {
      return terrain;
    },
  };
  const motion = plan.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw Error("Expected ground pursuit");
  }
  const context = traversalContext(snapshot, STEP_SECONDS, owner, motion)!;
  const query = { height: 20, width: 40, x: 20, y: 95 };
  const initial = context.sampleColliders(0, STEP_SECONDS, query);
  const repeated = context.sampleColliders(STEP_SECONDS, STEP_SECONDS, { ...query, x: 30 });
  expect(repeated).toEqual(initial);
  expect(repeated.colliders[0]).toBe(initial.colliders[0]);
  expect(repeated.colliders[1]).toBe(initial.colliders[1]);
  terrain = [second, first];
  expect(context.sampleColliders(0, STEP_SECONDS, query).colliders).toEqual(
    [...initial.colliders].reverse(),
  );
  first.y = 300;
  expect(context.sampleColliders(0, STEP_SECONDS, query)).toEqual({
    colliders: [initial.colliders[1]],
    complete: true,
  });
  const moved = context.sampleColliders(0, STEP_SECONDS, { ...query, y: 295 });
  expect(moved).toEqual({
    colliders: [{ after: first, before: first, kind: "solid", supportId: first }],
    complete: true,
  });
  expect(moved.colliders[0]).toBe(initial.colliders[0]);
  expect(moved.colliders[0]!.before).toBe(first);
  expect(moved.colliders[0]!.after).toBe(first);
  expect(moved.colliders[0]!.supportId).toBe(first);
  expect(
    traversalContext(snapshot, STEP_SECONDS, owner, motion)!.sampleColliders(0, STEP_SECONDS, {
      ...query,
      y: 295,
    }).colliders[0],
  ).not.toBe(moved.colliders[0]);
  const unknown = traversalContext(
    {
      ...snapshot,
      traversalFrame: { ...base.traversalFrame!, platforms: [], sample: () => undefined },
    },
    STEP_SECONDS,
    owner,
    motion,
  )!;
  expect(unknown.sampleColliders(0, STEP_SECONDS, query)).toEqual({
    colliders: [initial.colliders[1]],
    complete: false,
  });
});
it("preserves exact native step and search results when solid wrappers are reused", () => {
  const object = actor();
  const solids = [
    { height: 60, width: 110, x: 0, y: 300 },
    { height: 96, width: 610, x: 110, y: 264 },
  ];
  const motion = plan.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw Error("Expected ground pursuit");
  }
  const context = traversalContext(world(solids, 0), STEP_SECONDS, object, motion)!;
  const freshWrappers = {
    ...context,
    sampleColliders: (...args: Parameters<typeof context.sampleColliders>) => {
      const geometry = context.sampleColliders(...args);
      return { ...geometry, colliders: geometry.colliders.map((collider) => ({ ...collider })) };
    },
  };
  const start = { fallFromY: 300, grounded: true, vy: 0, x: 30, y: 276 };
  const input = { jump: true, move: 1 as const, timeSeconds: 0 };
  expect(stepTraversal(context, input, start)).toEqual(stepTraversal(freshWrappers, input, start));
  const request = {
    goal: { height: 26, width: 300, x: 180, y: 239 },
    horizonSteps: 120,
    maxStates: 4096,
    maxSteps: 8192,
    start,
    timeSeconds: 0,
  };
  const actual = findTraversal(context, request);
  expect(actual).toEqual(findTraversal(freshWrappers, request));
  expect(actual.status).toBe("budget-exhausted");
  const flat = traversalContext(
    world([{ height: 60, width: 720, x: 0, y: 300 }], 0),
    STEP_SECONDS,
    object,
    motion,
  )!;
  const flatFresh = {
    ...flat,
    sampleColliders: (...args: Parameters<typeof flat.sampleColliders>) => {
      const geometry = flat.sampleColliders(...args);
      return { ...geometry, colliders: geometry.colliders.map((collider) => ({ ...collider })) };
    },
  };
  const flatRequest = { ...request, goal: { height: 26, width: 100, x: 60, y: 275 } };
  const found = findTraversal(flat, flatRequest);
  expect(found).toEqual(findTraversal(flatFresh, flatRequest));
  expect(found.status).toBe("found");
});

function readyTakeoff(contact = false) {
  const base = actor();
  const motion = base.behaviour!.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground" || !motion.traversal) {
    throw new Error("Expected ground fixture");
  }
  const physical = {
    ...base,
    behaviour: {
      ...base.behaviour!,
      states: {
        ...base.behaviour!.states,
        chase: {
          ...base.behaviour!.states.chase!,
          animation: contact ? "walk" : base.behaviour!.states.chase!.animation,
          motion: { ...motion, traversal: { ...motion.traversal, prepSeconds: 0.6 } },
        },
      },
    },
  };
  const object = contact ? withAnticipationContact(physical) : physical;
  const solids = [
    { height: 60, width: 110, x: 0, y: 300 },
    { height: 96, width: 610, x: 110, y: 264 },
  ];
  const bird = { ...startBird(BIRD, { x: 250, y: 264 }), grounded: true };
  let at = object.origin;
  let state = {
    ...startBehaviour(BIRD, object, bird),
    pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
  };
  let tick = 0;
  let segments: ReturnType<typeof stepBehaviour>["segments"] = [];
  for (; tick < 160 && !state.traversal?.preparation; tick++) {
    const next = stepBehaviour(
      BIRD,
      object,
      world(solids, tick * STEP_SECONDS),
      STEP_SECONDS,
      bird,
      at,
      state,
    );
    at = next.at;
    state = next.state as typeof state;
    segments = next.segments;
  }
  expect(state.traversal?.preparation).toBeDefined();
  return { at, bird, object, segments, solids, state, tick };
}

it("holds a real verified takeoff for its tell and re-proves once before launching without an attack cooldown", () => {
  const fixture = readyTakeoff();
  let { at, state, tick } = fixture;
  const start = at;
  const started = tick;
  vi.mocked(findTraversal).mockClear();
  for (; tick < started + 100 && state.traversal?.preparation; tick++) {
    const next = stepBehaviour(
      BIRD,
      fixture.object,
      world(fixture.solids, tick * STEP_SECONDS),
      STEP_SECONDS,
      fixture.bird,
      at,
      state,
    );
    if (next.state.traversal?.preparation) {
      expect(next.at).toEqual(start);
    }
    at = next.at;
    state = next.state as typeof state;
  }
  expect((tick - started + 1) * STEP_SECONDS).toBeGreaterThanOrEqual(0.6 - STEP_SECONDS);
  expect(state.traversal?.physical.grounded).toBe(false);
  expect(at.y).toBeLessThan(start.y);
  expect(vi.mocked(findTraversal)).toHaveBeenCalledOnce();
  expect(state.activeAttack).toBeUndefined();
  expect(state.attackCooldownRemainingSeconds).toBeUndefined();
});

it("cancels takeoff preparation when support is lost and retains real falling physics", () => {
  const fixture = readyTakeoff();
  const next = stepBehaviour(
    BIRD,
    fixture.object,
    world([], fixture.tick * STEP_SECONDS),
    STEP_SECONDS,
    fixture.bird,
    fixture.at,
    fixture.state,
  );
  expect(next.state.traversal?.preparation).toBeUndefined();
  expect(next.state.traversal?.physical.grounded).toBe(false);
  expect(next.at.y).toBeGreaterThan(fixture.at.y);
});

it("carries a preparing actor on its actual moving support instead of freezing its world position", () => {
  const object = actor();
  const owner = { ...object, character: "support" };
  const before = { height: 10, width: 110, x: 0, y: 300 };
  const after = { ...before, x: 1 };
  const geometry = {
    ...world([], 1),
    traversalFrame: {
      ...world([], 1).traversalFrame!,
      platforms: [{ after, before, collision: "ledge" as const, owner }],
    },
  };
  const motion = object.behaviour!.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw new Error("Expected ground fixture");
  }
  const result = advanceTraversal(
    geometry,
    object,
    motion,
    STEP_SECONDS,
    {
      geometry: "",
      inputs: [],
      physical: { ...object.origin, fallFromY: 300, grounded: true, supportId: owner, vy: 0 },
      preparation: { move: 1, remainingSeconds: 0.6, startedAtSeconds: 0, supportId: owner },
      status: "found",
      target: { height: 24, width: 24, x: 200, y: 276 },
    },
    object.origin,
    { height: 36, width: 24, x: 200, y: 264 },
  );
  expect(result.at.x).toBeCloseTo(object.origin.x + 1);
  expect(result.traversal?.preparation?.remainingSeconds).toBeCloseTo(0.6 - STEP_SECONDS);
});

it("cancels an uncommitted takeoff tell on real pursuit escape", () => {
  const fixture = readyTakeoff();
  const next = stepBehaviour(
    BIRD,
    fixture.object,
    world(fixture.solids, fixture.tick * STEP_SECONDS),
    STEP_SECONDS,
    { ...fixture.bird, x: 3000 },
    fixture.at,
    fixture.state,
  );
  expect(next.state.pursuit?.phase).toBe("escaped");
  expect(next.state.traversal?.preparation).toBeUndefined();
  expect(next.state.activeAttack).toBeUndefined();
  expect(next.state.attackCooldownRemainingSeconds).toBeUndefined();
});

it("preserves preparation seconds while scaling traversal space", () => {
  const motion = plan.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground" || !motion.traversal) {
    throw new Error("Expected ground fixture");
  }
  const resolved = layoutBehaviour(12, {
    ...plan,
    states: {
      ...plan.states,
      chase: {
        ...plan.states.chase!,
        motion: { ...motion, traversal: { ...motion.traversal, prepSeconds: 0.6 } },
      },
    },
  }).states.chase!.motion;
  expect(resolved).toMatchObject({ traversal: { prepSeconds: 0.6 } });
});

it("binds the first actual takeoff wait, native cue boundaries and final pose to the preparation clock", () => {
  const fixture = readyTakeoff(true);
  let { at, state, tick } = fixture;
  const started = state.traversal!.preparation!.startedAtSeconds;
  expect(state.animationTag).toBe("anticipate-lift");
  expect(state.animationSeconds).toBeCloseTo(tick * STEP_SECONDS - started);
  expect(fixture.segments.every(({ frame }) => frame === "load")).toBe(true);
  const seen = new Set(fixture.segments.map(({ frame }) => frame));
  const finish =
    fixture.tick + Math.ceil(state.traversal!.preparation!.remainingSeconds / STEP_SECONDS) + 2;
  for (; tick < finish && state.traversal?.preparation; tick++) {
    const next = stepBehaviour(
      BIRD,
      fixture.object,
      world(fixture.solids, tick * STEP_SECONDS),
      STEP_SECONDS,
      fixture.bird,
      at,
      state,
    );
    if (next.state.traversal?.preparation) {
      expect(next.state.traversal.preparation.startedAtSeconds).toBe(started);
      expect(next.state.animationSeconds).toBeCloseTo((tick + 1) * STEP_SECONDS - started);
      expect(behaviourPose(fixture.object, next.state).animation).toBe("anticipate-lift");
      for (const segment of next.segments) {
        seen.add(segment.frame);
      }
      expect(
        contactFrameAt(
          fixture.object.contact!,
          next.state.animationTag!,
          next.state.animationSeconds!,
        ).frame,
      ).toBe(
        next.state.animationSeconds! < 0.12 - 1e-9
          ? "load"
          : next.state.animationSeconds! < 0.28 - 1e-9
            ? "lift"
            : "brace",
      );
    } else {
      expect(next.state.animationTag).toBe("walk");
    }
    at = next.at;
    state = next.state as typeof state;
  }
  expect(seen).toEqual(new Set(["load", "lift", "brace"]));
  expect(state.traversal?.preparation).toBeUndefined();
  expect(state.traversal?.physical.grounded).toBe(false);
});

it("restores the ordinary pose when physical support cancels takeoff preparation", () => {
  const fixture = readyTakeoff(true);
  const next = stepBehaviour(
    BIRD,
    fixture.object,
    world([], fixture.tick * STEP_SECONDS),
    STEP_SECONDS,
    fixture.bird,
    fixture.at,
    fixture.state,
  );
  expect(next.state.traversal?.preparation).toBeUndefined();
  expect(next.state.animationTag).toBe("walk");
  expect(next.segments.every(({ frame }) => frame === "normal")).toBe(true);
});
