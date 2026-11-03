import { findTraversal } from "@andornaut/game-kit/terrain/traversal";
import { afterEach, expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { Archetype, BehaviourPlan, Rect } from "../data/types";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { type BehaviourState, layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import type { BehaviourWorld } from "./behaviourReach";
import { startBird } from "./bird";
import { supportedLanding } from "./flyLanding";
import { objectLayout } from "./tiles";

const search = vi.hoisted(() => ({ unknown: false }));
vi.mock("@andornaut/game-kit/terrain/traversal", async (original) => {
  const actual = await original<typeof import("@andornaut/game-kit/terrain/traversal")>();
  return {
    ...actual,
    findTraversal: vi.fn((...args: Parameters<typeof actual.findTraversal>) =>
      search.unknown
        ? { status: "geometry-unavailable" as const, work: { states: 0, steps: 0 } }
        : actual.findTraversal(...args),
    ),
  };
});
afterEach(() => {
  search.unknown = false;
  vi.clearAllMocks();
});
const plan: BehaviourPlan = {
  attackCooldownSeconds: 2.5,
  axis: "x",
  distance: 400,
  groundReposition: {
    distance: 30,
    intervalSeconds: 0.2,
    maxAttempts: 2,
    minDistance: 10,
    resume: "pursuit",
  },
  initial: "pursuit",
  pursuit: {
    distance: 1000,
    escapeDistance: 1000,
    escaped: { line: "unused", speaker: "fixture" },
    unreachableGraceSeconds: null,
  },
  states: {
    committed: {
      animation: null,
      attack: { id: "attack", phase: "committed" },
      motion: { kind: "wait" },
      transitions: [],
    },
    pursuit: {
      allowGroundReposition: true,
      animation: null,
      motion: {
        kind: "pursue",
        mode: "ground",
        speed: 40,
        traversal: { gravity: 100, jumpSpeed: 40, maxFallSpeed: 100, prepSeconds: 0.2 },
      },
      transitions: [],
    },
    tell: {
      animation: null,
      attack: { id: "attack", phase: "tell" },
      motion: { kind: "wait" },
      transitions: [],
    },
    vertical: {
      animation: null,
      motion: { direction: -1, kind: "move", speed: 10 },
      track: { axis: "y", distance: -32 },
      transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 3.2 }] }],
    },
  },
};
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
const actor = (profile = plan) =>
  objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: {
        actor: { archetype: "actor", art: "actor", behaviour: profile, cols: 20, rows: 10 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 100, row: 290 },
  );
const floor: Rect = { height: 300, width: 1000, x: 0, y: 300 };
const world = (time = 0): BehaviourWorld => ({
  idleDecision: { namespace: "ground:main:0", seed: 31 },
  solids: [floor],
  traversalFrame: {
    bounds: { height: 600, width: 1000, x: 0, y: 0 },
    dtSeconds: 1 / 120,
    platforms: [],
    timeSeconds: time,
  },
  view: { height: 600, width: 1000, x: 0, y: 0 },
});
const bird = () => startBird(BIRD, { x: 500, y: 300 });
const initial = (object: ReturnType<typeof actor>): BehaviourState => ({
  ...startBehaviour(BIRD, object, bird()),
  pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
});

it("resolves one two-dimensional radius and validates explicit uncommitted ground eligibility", () => {
  expect(layoutBehaviour(12, plan).groundReposition).toEqual({
    ...plan.groundReposition,
    distance: 360,
    minDistance: 120,
  });
  for (const patch of [
    { minDistance: 31 },
    { maxAttempts: 1.5 },
    { intervalSeconds: 0 },
    { resume: "vertical" },
  ]) {
    expect(() =>
      layoutBehaviour(1, { ...plan, groundReposition: { ...plan.groundReposition!, ...patch } }),
    ).toThrow("Invalid periodic ground reposition");
  }
  expect(() =>
    layoutBehaviour(1, {
      ...plan,
      states: { ...plan.states, tell: { ...plan.states.tell!, allowGroundReposition: true } },
    }),
  ).toThrow("Invalid periodic ground reposition state");
});
it("periodically varies successful ordinary pursuit with one supported native witness", () => {
  const object = actor();
  let at = object.origin,
    state = initial(object);
  for (let tick = 0; tick < 30 && !state.groundReposition?.recovery; tick++) {
    const step = stepBehaviour(BIRD, object, world(tick / 120), 1 / 120, bird(), at, state);
    at = step.at;
    state = step.state;
  }
  expect(at.x).toBeGreaterThan(object.origin.x);
  expect(
    state.groundReposition?.recovery?.kind,
    JSON.stringify({
      periodic: state.groundReposition,
      results: vi.mocked(findTraversal).mock.results.map((item) => item.value),
    }),
  ).toBe("ground");
  const selected = state.groundReposition;
  const calls = vi.mocked(findTraversal).mock.calls.length;
  const origin = selected!.anchor;
  for (let tick = 0; tick < 150 && state.groundReposition?.recovery; tick++) {
    const step = stepBehaviour(BIRD, object, world((tick + 30) / 120), 1 / 120, bird(), at, state);
    expect(step.actions).toEqual([]);
    at = step.at;
    state = step.state;
  }
  expect(state.groundReposition?.status).toBe("found");
  expect(state.groundReposition?.recovery).toBeUndefined();
  expect(state.groundReposition?.seconds).toBe(0);
  expect(Math.abs(at.x - origin.x)).toBeGreaterThanOrEqual(plan.groundReposition!.minDistance);
  expect(supportedLanding(object, world(), at)).toBe(true);
  expect(vi.mocked(findTraversal).mock.calls.length).toBe(calls);
});
it("takes an actual attack opportunity before a due reposition and retains the due clock through the tell", () => {
  const profile = {
    ...plan,
    idleWatchdog: {
      distance: 30,
      maxAttempts: 2,
      minMovement: 10,
      resume: "pursuit",
      seconds: 0.2,
    },
    states: {
      ...plan.states,
      pursuit: {
        ...plan.states.pursuit!,
        allowIdleReposition: true,
        transitions: [
          {
            to: "tell",
            when: [{ kind: "attack-ready" as const }, { kind: "nearby" as const, range: 1000 }],
          },
        ],
      },
    },
  };
  const object = actor(profile),
    start = {
      ...initial(object),
      groundReposition: { anchor: object.origin, seconds: 1 },
      idleWatchdog: { anchor: object.origin, seconds: 1 },
    };
  const step = stepBehaviour(BIRD, object, world(), 1 / 120, bird(), object.origin, start);
  expect(step.state.stateKey).toBe("tell");
  expect(step.state.activeAttack?.phase).toBe("tell");
  expect(step.state.groundReposition?.recovery).toBeUndefined();
  expect(vi.mocked(findTraversal)).not.toHaveBeenCalled();
  expect(step.state.groundReposition?.seconds).toBe(plan.groundReposition!.intervalSeconds);
});
it.each(["tell", "committed", "vertical"])(
  "never interrupts protected %s while preserving its due clock",
  (key) => {
    const object = actor({ ...plan, initial: key }),
      start = {
        ...initial(object),
        groundReposition: { anchor: object.origin, seconds: 1 },
        ...(key === "committed" && {
          activeAttack: { id: "attack", phase: "committed" as const },
          pendingEntry: false,
        }),
      };
    const step = stepBehaviour(BIRD, object, world(), 1 / 120, bird(), object.origin, start);
    expect(step.state.stateKey).toBe(key);
    expect(step.state.groundReposition?.recovery).toBeUndefined();
    expect(vi.mocked(findTraversal)).not.toHaveBeenCalled();
  },
);
it("does not advance inactive or zero-time clocks and resets the attempt interval after unknown proofs", () => {
  const object = actor(),
    start = { ...initial(object), groundReposition: { anchor: object.origin, seconds: 0.1 } };
  expect(stepBehaviour(BIRD, object, world(), 0, bird(), object.origin, start).state).toBe(start);
  const inactive = stepBehaviour(BIRD, object, world(), 1 / 120, bird(), object.origin, {
    ...start,
    active: false,
  });
  expect(inactive.state.groundReposition?.seconds).toBe(0.1);
  search.unknown = true;
  const first = stepBehaviour(BIRD, object, world(), 1 / 120, bird(), object.origin, {
    ...start,
    groundReposition: { ...start.groundReposition, seconds: 1 },
  });
  expect(first.state.groundReposition).toMatchObject({
    seconds: 0,
    status: "geometry-unavailable",
  });
  expect(first.state.groundReposition?.recovery).toBeUndefined();
  const calls = vi.mocked(findTraversal).mock.calls.length;
  stepBehaviour(BIRD, object, world(), 1 / 120, bird(), first.at, first.state);
  expect(vi.mocked(findTraversal).mock.calls.length).toBe(calls);
});
it("replays object-local target decisions independently of world time", () => {
  const object = actor(),
    start = { ...initial(object), groundReposition: { anchor: object.origin, seconds: 1 } };
  const first = stepBehaviour(BIRD, object, world(), 1 / 120, bird(), object.origin, start);
  const later = stepBehaviour(BIRD, object, world(50), 1 / 120, bird(), object.origin, start);
  expect(
    first.state.groundReposition?.recovery,
    JSON.stringify({
      periodic: first.state.groundReposition,
      results: vi.mocked(findTraversal).mock.results.map((item) => item.value),
    }),
  ).toMatchObject({ kind: "ground" });
  const goal = (state: BehaviourState) =>
    state.groundReposition?.recovery?.kind === "ground"
      ? state.groundReposition.recovery.traversal.target
      : undefined;
  expect(goal(later.state)).toEqual(goal(first.state));
  const other = stepBehaviour(
    BIRD,
    object,
    { ...world(), idleDecision: { namespace: "ground:main:1", seed: 31 } },
    1 / 120,
    bird(),
    object.origin,
    start,
  );
  expect(goal(other.state)).toBeDefined();
  const replay = stepBehaviour(BIRD, object, world(), 1 / 120, bird(), object.origin, start);
  expect(goal(replay.state)).toEqual(goal(first.state));
});

it("invalidates a previously safe witness when a real hazard blocks its next step", () => {
  const object = actor();
  const start = { ...initial(object), groundReposition: { anchor: object.origin, seconds: 1 } };
  const first = stepBehaviour(BIRD, object, world(), 1 / 120, bird(), object.origin, start);
  const recovery = first.state.groundReposition?.recovery;
  expect(recovery?.kind).toBe("ground");
  if (recovery?.kind !== "ground") {
    throw Error("Expected real ground witness");
  }
  const direction = recovery.traversal.inputs[0]!.move;
  expect(direction).not.toBe(0);
  const hazard = {
    height: 10,
    width: 1,
    x: direction === 1 ? first.at.x + object.width + 0.1 : first.at.x - 1.1,
    y: first.at.y,
  };
  const physical = { ...world(1 / 120), hazards: [{ owner: { ...object }, rect: hazard }] };
  const calls = vi.mocked(findTraversal).mock.calls.length;
  const blocked = stepBehaviour(BIRD, object, physical, 1 / 120, bird(), first.at, first.state);
  expect(blocked.at).toEqual(first.at);
  expect(blocked.state.groundReposition?.status).toBe("invalidated");
  expect(blocked.state.groundReposition?.recovery).toBeUndefined();
  expect(blocked.state.groundReposition?.seconds).toBe(0);
  expect(supportedLanding(object, physical, blocked.at)).toBe(true);
  expect(vi.mocked(findTraversal).mock.calls.length).toBe(calls);
});
it("retains real falling recovery after support loss until it settles on actual lower terrain", () => {
  const object = actor();
  const first = stepBehaviour(BIRD, object, world(), 1 / 120, bird(), object.origin, {
    ...initial(object),
    groundReposition: { anchor: object.origin, seconds: 1 },
  });
  expect(first.state.groundReposition?.recovery?.kind).toBe("ground");
  const physical = { ...world(1 / 120), solids: [{ ...floor, y: floor.y + 30 }] };
  let at = first.at,
    state = first.state,
    fell = false;
  for (let tick = 0; tick < 150 && state.groundReposition?.recovery; tick++) {
    const step = stepBehaviour(
      BIRD,
      object,
      {
        ...physical,
        traversalFrame: { ...physical.traversalFrame!, timeSeconds: (tick + 1) / 120 },
      },
      1 / 120,
      bird(),
      at,
      state,
    );
    if (!supportedLanding(object, physical, step.at)) {
      expect(step.state.groundReposition?.recovery?.kind).toBe("ground");
      fell ||= step.at.y > first.at.y;
    }
    at = step.at;
    state = step.state;
  }
  expect(fell).toBe(true);
  expect(state.groundReposition?.recovery).toBeUndefined();
  expect(state.groundReposition?.status).toBe("invalidated");
  expect(state.groundReposition?.seconds).toBe(0);
  expect(at.y + object.height).toBe(physical.solids[0]!.y);
  expect(supportedLanding(object, physical, at)).toBe(true);
});

it.each([
  "dog-antagonist",
  "ferret-antagonist",
  "goose-antagonist",
  "bear-antagonist",
  "raccoon-antagonist",
])(
  "physically completes a periodic supported route with the actual %s production profile",
  (character) => {
    const object = objectLayout(
      TILE,
      CATALOGUE,
      HITBOXES,
      TILESETS["tiles-street"],
      {},
      { character, col: 20, row: 20 },
    );
    const config = object.behaviour!.groundReposition!;
    expect(config).toBeDefined();
    expect(
      Object.entries(object.behaviour!.states)
        .filter(([, node]) => node.allowGroundReposition)
        .map(([key]) => key),
    ).toEqual([config.resume]);
    const support = { height: 600, width: 4000, x: 0, y: object.origin.y + object.height };
    const target = startBird(BIRD, { x: object.origin.x + 500, y: support.y });
    const component = { ...object, behaviour: { ...object.behaviour!, initial: config.resume } };
    let at = object.origin,
      state: BehaviourState = {
        ...startBehaviour(BIRD, component, target),
        attackCooldownRemainingSeconds: 0.75,
        groundReposition: { anchor: at, seconds: config.intervalSeconds },
        pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
      };
    let began = false,
      ticks = 0,
      chosenGoal: Rect | undefined;
    const physical = (time: number): BehaviourWorld => ({
      idleDecision: { namespace: `production:${character}`, seed: 31 },
      solids: [support],
      traversalFrame: {
        bounds: { height: 1200, width: 4000, x: 0, y: 0 },
        dtSeconds: 1 / 120,
        platforms: [],
        timeSeconds: time,
      },
      view: { height: 1200, width: 4000, x: 0, y: 0 },
    });
    for (; ticks < 180 && (!began || state.groundReposition?.recovery); ticks++) {
      const step = stepBehaviour(BIRD, object, physical(ticks / 120), 1 / 120, target, at, state);
      expect(step.actions).toEqual([]);
      expect(step.state.activeAttack).toBeUndefined();
      began ||= step.state.groundReposition?.recovery?.kind === "ground";
      const recovery = step.state.groundReposition?.recovery;
      if (recovery?.kind === "ground") {
        chosenGoal ??= recovery.traversal.target;
      }
      at = step.at;
      state = step.state;
    }
    expect(began, JSON.stringify(state.groundReposition)).toBe(true);
    expect(state.groundReposition?.recovery).toBeUndefined();
    expect(
      state.groundReposition?.status,
      JSON.stringify({
        at,
        goal: chosenGoal,
        hitbox: object.hitbox,
        periodic: state.groundReposition,
      }),
    ).toBe("found");
    expect(Math.abs(at.x - object.origin.x)).toBeGreaterThanOrEqual(config.minDistance - 1e-6);
    expect(Math.hypot(at.x - object.origin.x, at.y - object.origin.y)).toBeLessThanOrEqual(
      config.distance + 1e-6,
    );
    expect(supportedLanding(object, physical(ticks / 120), at)).toBe(true);
    expect(state.stateKey).toBe(config.resume);
    expect(state.attackCooldownRemainingSeconds).toBeCloseTo(Math.max(0, 0.75 - ticks / 120));
  },
);
