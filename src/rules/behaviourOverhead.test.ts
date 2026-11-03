import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, BehaviourPlan, Character, Rect } from "../data/types";
import { sweptBehaviourRect } from "../sim/behaviourBounds";
import { type BehaviourState, layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import type { BehaviourWorld } from "./behaviourReach";
import { startBird } from "./bird";
import { supportedLanding } from "./flyLanding";
import { objectLayout } from "./tiles";

const plan: BehaviourPlan = {
  attackCooldownSeconds: 0.5,
  axis: "x",
  distance: 40,
  initial: "approach",
  pursuit: {
    distance: 800,
    escapeDistance: 1000,
    escaped: { line: "unused", speaker: "fixture" },
    unreachableGraceSeconds: null,
  },
  states: {
    align: {
      animation: null,
      attack: { id: "burst", phase: "committed" },
      motion: {
        ahead: 20,
        bounds: { height: 500, width: 1000, x: -500, y: -250 },
        kind: "fly",
        leadSeconds: 0,
        maxLead: 0,
        speed: 100,
        to: "target-x",
      },
      transitions: [],
    },
    approach: {
      animation: null,
      motion: { kind: "pursue", mode: "fly", overhead: { ahead: 20, clearance: 10 }, speed: 100 },
      transitions: [
        {
          to: "tell",
          when: [
            { kind: "arrived", tolerance: 0.01 },
            { direction: 1, kind: "flight-approach-direction" },
          ],
        },
      ],
    },
    tell: {
      animation: null,
      attack: { id: "burst", phase: "tell" },
      motion: { kind: "pursue", mode: "fly", overhead: { ahead: 20, clearance: 10 }, speed: 100 },
      transitions: [
        {
          to: "align",
          when: [
            { kind: "elapsed", seconds: 0.2 },
            { kind: "arrived", tolerance: 0.01 },
          ],
        },
      ],
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
const character: Character = {
  archetype: "actor",
  art: "fixture",
  behaviour: plan,
  cols: 20,
  rows: 20,
};
const actor = (profile = plan) =>
  objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: { actor: { ...character, behaviour: profile } },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 100, row: 480 },
  );
const target = (vx = 100) => ({ ...startBird(BIRD, { x: 300, y: 500 }), grounded: true, vx });
const geometry = (solids: readonly Rect[] = []): BehaviourWorld => ({
  solids,
  traversalFrame: {
    bounds: { height: 600, width: 1000, x: 0, y: 0 },
    dtSeconds: 0.1,
    platforms: [],
    timeSeconds: 0,
  },
  view: { height: 600, width: 1000, x: 0, y: 0 },
});
const initial = (object: ReturnType<typeof actor>, bird: ReturnType<typeof target>) => ({
  ...startBehaviour(BIRD, object, bird),
  pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
});

describe("overhead flying pursuit", () => {
  it("resolves each overhead and ahead distance once and rejects invalid profiles", () => {
    const resolved = layoutBehaviour(12, plan);
    expect(resolved.states.approach!.motion).toMatchObject({
      overhead: { ahead: 240, clearance: 120 },
      speed: 1200,
    });
    expect(resolved.states.align!.motion).toMatchObject({ ahead: 240, leadSeconds: 0, maxLead: 0 });
    const invalid = {
      ...plan,
      states: {
        ...plan.states,
        approach: {
          ...plan.states.approach!,
          motion: {
            kind: "pursue" as const,
            mode: "fly" as const,
            overhead: { ahead: NaN, clearance: 10 },
            speed: 100,
          },
        },
      },
    };
    expect(() => layoutBehaviour(12, invalid)).toThrow("Invalid overhead pursuit");
  });

  it("ascends before crossing the target and retains Chibi's captured travel side through alignment", () => {
    const object = actor();
    let bird = target(),
      at = object.origin;
    let state: BehaviourState = initial(object, bird);
    const bounds = sweptBehaviourRect(
      { areaBounds: geometry().traversalFrame!.bounds, maximumRise: 0, targetHeight: BIRD.height },
      object.behaviour!,
      { ...object.origin, height: object.height, width: object.width },
    );
    let crossed = false;
    for (let tick = 0; tick < 40 && state.stateKey !== "align"; tick++) {
      const step = stepBehaviour(BIRD, object, geometry(), 0.1, bird, at, state);
      for (const segment of step.segments) {
        expect(segment.from.x === segment.to.x || segment.from.y === segment.to.y).toBe(true);
      }
      if (step.at.x !== at.x) {
        expect(step.at.y + object.height).toBeLessThanOrEqual(bird.y - 10);
      }
      at = step.at;
      expect(at.x).toBeGreaterThanOrEqual(bounds.x);
      expect(at.x + object.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(at.y).toBeGreaterThanOrEqual(bounds.y);
      expect(at.y + object.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      state = step.state;
      if (tick === 0) {
        bird = { ...bird, facing: -1, vx: -100 };
      }
      if (at.x + object.width / 2 > bird.x + BIRD.width / 2) {
        crossed = true;
      }
      if (state.stateKey !== "approach") {
        expect(crossed).toBe(true);
        expect(at.x + object.width / 2).toBeGreaterThanOrEqual(bird.x + BIRD.width / 2 + 20);
      }
    }
    expect(state.stateKey).toBe("align");
    expect(state.flightApproachDirection).toBe(1);
    const aligned = stepBehaviour(BIRD, object, geometry(), 0.1, bird, at, state);
    expect(aligned.at.x + object.width / 2).toBeCloseTo(bird.x + BIRD.width / 2 + 20);
    expect(aligned.at.y).toBe(at.y);
  });

  it("captures facing only for a stationary target and does not silently guess missing alignment context", () => {
    const object = actor(),
      bird = { ...target(0), facing: -1 as const };
    const step = stepBehaviour(
      BIRD,
      object,
      geometry(),
      0.1,
      bird,
      object.origin,
      initial(object, bird),
    );
    expect(step.state.flightApproachDirection).toBe(-1);
    const missing = {
      ...initial(object, bird),
      activeAttack: { id: "burst", phase: "committed" as const },
      stateKey: "align",
    };
    delete missing.flightApproachDirection;
    expect(() =>
      stepBehaviour(BIRD, object, geometry(), 0.1, bird, object.origin, missing),
    ).toThrow("committed overhead approach direction");
  });

  it("tracks a moving tell for its full duration before freezing the actual alignment anchor", () => {
    const object = actor();
    let bird = target(),
      at = object.origin;
    let state: BehaviourState = initial(object, bird);
    for (let tick = 0; tick < 40 && state.stateKey !== "tell"; tick++) {
      const step = stepBehaviour(BIRD, object, geometry(), 0.1, bird, at, state);
      at = step.at;
      state = step.state;
    }
    expect(state.stateKey).toBe("tell");
    const started = state.elapsed;
    const tellStart = at;
    bird = { ...bird, x: bird.x + 5 };
    let step = stepBehaviour(BIRD, object, geometry(), 0.1, bird, at, state);
    expect(started + 0.1).toBeLessThan(0.2);
    expect(step.state.stateKey).toBe("tell");
    expect(step.actions).toEqual([]);
    expect(step.at.x).toBeGreaterThan(tellStart.x);
    at = step.at;
    state = step.state;
    bird = { ...bird, x: bird.x + 5 };
    step = stepBehaviour(BIRD, object, geometry(), 0.1, bird, at, state);
    expect(step.state.stateKey).toBe("align");
    expect(step.state.anchor).toEqual(step.at);
    expect(step.state.flightTarget?.y).toBe(step.at.y);
  });

  it("cancels a stale ground-height idle flight when overhead pursuit engages", () => {
    const profile = {
      ...plan,
      idleWatchdog: {
        distance: 100,
        maxAttempts: 1,
        minMovement: 10,
        resume: "approach",
        seconds: 1,
      },
    };
    const object = actor(profile),
      bird = target();
    const state = {
      ...initial(object, bird),
      idleWatchdog: {
        anchor: object.origin,
        recovery: { kind: "fly" as const, origin: object.origin, target: { x: 150, y: 480 } },
        seconds: 2,
      },
    };
    const step = stepBehaviour(BIRD, object, geometry(), 0.1, bird, object.origin, state);
    expect(step.state.idleWatchdog?.recovery).toBeUndefined();
    expect(step.at.x).toBe(object.origin.x);
    expect(step.at.y).toBeLessThan(object.origin.y);
  });

  it.each([
    {
      name: "solid ceiling",
      profile: plan,
      world: geometry([{ height: 10, width: 400, x: 80, y: 450 }]),
    },
    {
      name: "original leash",
      profile: { ...plan, pursuit: { ...plan.pursuit!, distance: 50 } },
      world: geometry(),
    },
    { name: "missing area geometry", profile: plan, world: { solids: [] } },
  ])(
    "never clamps a blocked $name goal into an arrival or ground-level chase",
    ({ profile, world }) => {
      const object = actor(profile),
        bird = target();
      const step = stepBehaviour(
        BIRD,
        object,
        world,
        0.1,
        bird,
        object.origin,
        initial(object, bird),
      );
      expect(step.at).toEqual(object.origin);
      expect(step.state.stateKey).toBe("approach");
    },
  );
});

it.each([
  { bird: { ...target(), x: 970 }, name: "ahead beyond the area edge" },
  { bird: { ...target(), y: 5 }, name: "clearance above the area top" },
])(
  "recovers an uncommitted tell through real support after $name, then starts a fresh approach",
  ({ bird: blocked }) => {
    const profile: BehaviourPlan = {
      ...plan,
      states: {
        ...plan.states,
        "abort-land": {
          animation: null,
          motion: { kind: "fly", speed: 100, to: "support" },
          transitions: [{ to: "abort-rest", when: [{ kind: "arrived", tolerance: 0.01 }] }],
        },
        "abort-rest": {
          animation: null,
          motion: { kind: "wait", support: "required" },
          transitions: [{ to: "approach", when: [{ kind: "elapsed", seconds: 0.1 }] }],
        },
        approach: {
          ...plan.states.approach!,
          transitions: [
            { to: "abort-land", when: [{ kind: "alignment-blocked" }] },
            ...plan.states.approach!.transitions,
          ],
        },
        tell: {
          ...plan.states.tell!,
          transitions: [
            { to: "abort-land", when: [{ kind: "alignment-blocked" }] },
            ...plan.states.tell!.transitions,
          ],
        },
      },
    };
    const object = actor(profile),
      bird = target(),
      world = geometry([{ height: 100, width: 1000, x: 0, y: 500 }]);
    let at = object.origin,
      state: BehaviourState = initial(object, bird);
    for (let tick = 0; tick < 40 && state.stateKey !== "tell"; tick++) {
      const step = stepBehaviour(BIRD, object, world, 0.1, bird, at, state);
      at = step.at;
      state = step.state;
    }
    expect(state.stateKey).toBe("tell");
    expect(state.activeAttack?.phase).toBe("tell");
    let step = stepBehaviour(BIRD, object, world, 0.1, blocked, at, state);
    expect(step.state.stateKey).toBe("abort-land");
    expect(step.state.activeAttack).toBeUndefined();
    expect(step.state.attackCooldownRemainingSeconds ?? 0).toBe(0);
    at = step.at;
    state = step.state;
    for (let tick = 0; tick < 20 && state.stateKey !== "abort-rest"; tick++) {
      step = stepBehaviour(BIRD, object, world, 0.1, blocked, at, state);
      expect(step.state.stateKey).not.toBe("align");
      at = step.at;
      state = step.state;
    }
    expect(state.stateKey).toBe("abort-rest");
    expect(supportedLanding(object, world, at)).toBe(true);
    let approached = false;
    for (let tick = 0; tick < 40 && state.stateKey !== "tell"; tick++) {
      step = stepBehaviour(BIRD, object, world, 0.1, bird, at, state);
      expect(step.state.stateKey).not.toBe("align");
      approached ||= step.state.stateKey === "approach";
      at = step.at;
      state = step.state;
    }
    expect(approached).toBe(true);
    expect(state.stateKey).toBe("tell");
    expect(state.elapsed).toBeLessThan(0.1);
    expect(state.activeAttack?.phase).toBe("tell");
  },
);

function gapProfile(distance: number): BehaviourPlan {
  return {
    ...plan,
    initial: "check",
    states: {
      check: {
        animation: "pose",
        motion: { kind: "wait" },
        transitions: [
          { to: "close", when: [{ comparison: "below", distance, kind: "horizontal-gap" }] },
          { to: "far", when: [{ comparison: "at-least", distance, kind: "horizontal-gap" }] },
        ],
      },
      close: { animation: "pose", motion: { kind: "wait" }, transitions: [] },
      far: { animation: "pose", motion: { kind: "wait" }, transitions: [] },
    },
  };
}

describe("physical horizontal gap", () => {
  it("resolves the authored gap once and rejects nonfinite distance", () => {
    const resolved = layoutBehaviour(12, gapProfile(2.5));
    expect(resolved.states.check!.transitions[0]!.when).toEqual([
      { comparison: "below", distance: 30, kind: "horizontal-gap" },
    ]);
    expect(() => layoutBehaviour(12, gapProfile(NaN))).toThrow("Invalid horizontal gap");
  });

  it.each([
    {
      birdX: 140,
      distance: 30,
      expected: "far",
      facing: 1,
      name: "exact opaque threshold",
      seconds: 0,
      silhouette: true,
    },
    {
      birdX: 140,
      distance: 30,
      expected: "close",
      facing: -1,
      name: "mirrored asymmetric body",
      seconds: 0,
      silhouette: true,
    },
    {
      birdX: 140,
      distance: 30,
      expected: "close",
      facing: 1,
      name: "current wider animation frame",
      seconds: 0.11,
      silhouette: true,
    },
    {
      birdX: 60,
      distance: 18,
      expected: "far",
      facing: 1,
      name: "target on the left",
      seconds: 0,
      silhouette: true,
    },
    {
      birdX: 105,
      distance: 1,
      expected: "close",
      facing: 1,
      name: "overlapping horizontal projections",
      seconds: 0,
      silhouette: true,
    },
    {
      birdX: 140,
      distance: 30,
      expected: "far",
      facing: 1,
      name: "resolved nonsilhouette contact box",
      seconds: 0,
      silhouette: false,
    },
  ] as const)(
    "compares $name without transparent frame or vertical padding",
    ({ birdX, distance, expected, facing, seconds, silhouette }) => {
      const object = {
        ...actor(gapProfile(distance)),
        ...(silhouette
          ? {
              contact: {
                frame: { height: 20, width: 20 },
                frames: { narrow: [[1, 2, 10]], wide: [[1, 1, 19]] },
                tags: {
                  pose: {
                    frames: [
                      { frame: "narrow", seconds: 0.1 },
                      { frame: "wide", seconds: 0.1 },
                    ],
                    once: false,
                  },
                },
              } as const,
            }
          : { hitbox: { height: 10, width: 8, x: 2, y: 5 } }),
      };
      const bird = { ...target(0), x: birdX };
      const state = {
        ...initial(object, bird),
        animationSeconds: seconds,
        facing,
        pendingEntry: false,
      };
      const result = stepBehaviour(BIRD, object, geometry(), 0.001, bird, object.origin, state);
      expect(result.state.stateKey).toBe(expected);
    },
  );
});
