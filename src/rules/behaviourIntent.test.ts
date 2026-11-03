import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { Archetype, BehaviourPlan, BehaviourPursuitIntent } from "../data/types";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { type BehaviourState, layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import { capturePursuitIntent, safeIntentHover } from "./behaviourIntent";
import type { BehaviourWorld } from "./behaviourReach";
import { startBird } from "./bird";
import { objectLayout } from "./tiles";

const intent: BehaviourPursuitIntent = {
  decisionSeconds: { max: 0.2, min: 0.2 },
  offset: { max: 0, min: 0 },
  pauseChance: 0,
  pauseSeconds: { max: 0.1, min: 0.1 },
};
const plan: BehaviourPlan = {
  attackCooldownSeconds: 2.5,
  axis: "x",
  distance: 500,
  initial: "pursuit",
  pursuit: {
    distance: 1000,
    escapeDistance: 2000,
    escaped: { line: "escaped", speaker: "fixture" },
    unreachableGraceSeconds: null,
  },
  states: {
    committed: {
      animation: null,
      attack: { id: "test", phase: "committed" },
      motion: { kind: "wait" },
      transitions: [],
    },
    pursuit: {
      animation: null,
      motion: {
        intent,
        kind: "pursue",
        mode: "ground",
        speed: 100,
        traversal: { gravity: 200, jumpSpeed: 80, maxFallSpeed: 200, prepSeconds: 0.2 },
      },
      transitions: [
        { to: "tell", when: [{ kind: "nearby", range: 30 }, { kind: "attack-ready" }] },
      ],
    },
    tell: {
      animation: null,
      attack: { id: "test", phase: "tell" },
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [{ to: "committed", when: [{ kind: "elapsed", seconds: 0.6 }] }],
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
        actor: { archetype: "actor", art: "actor", behaviour: profile, cols: 20, rows: 20 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 100, row: 480 },
  );
const bird = (x = 300, vx = 100) => ({ ...startBird(BIRD, { x, y: 500 }), vx });
const floor = { height: 100, width: 1000, x: 0, y: 500 };
const world = (): BehaviourWorld => ({
  idleDecision: { namespace: "intent:main:0", seed: 31 },
  solids: [floor],
  traversalFrame: {
    bounds: { height: 600, width: 1000, x: 0, y: 0 },
    dtSeconds: 0.1,
    platforms: [],
    timeSeconds: 0,
  },
  view: { height: 600, width: 1000, x: 0, y: 0 },
});
const initial = (object: ReturnType<typeof actor>): BehaviourState => ({
  ...startBehaviour(BIRD, object, bird()),
  pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
});

it("resolves only signed offset distance and rejects intent on marked or actionful nodes", () => {
  const motion = plan.states.pursuit!.motion;
  if (motion.kind !== "pursue") {
    throw Error("Expected pursuit");
  }
  const profile = {
    ...plan,
    states: {
      ...plan.states,
      pursuit: {
        ...plan.states.pursuit!,
        motion: { ...motion, intent: { ...intent, offset: { max: 2, min: -2 } } },
      },
    },
  };
  expect(layoutBehaviour(12, profile).states.pursuit!.motion).toMatchObject({
    intent: { ...intent, offset: { max: 24, min: -24 } },
  });
  for (const patch of [
    { pauseChance: 2 },
    { decisionSeconds: { max: 0, min: 0 } },
    { offset: { max: -1, min: 1 } },
  ]) {
    expect(() =>
      layoutBehaviour(1, {
        ...profile,
        states: {
          ...profile.states,
          pursuit: {
            ...profile.states.pursuit,
            motion: { ...motion, intent: { ...intent, ...patch } },
          },
        },
      }),
    ).toThrow("Invalid sampled pursuit intent");
  }
  expect(() =>
    layoutBehaviour(1, {
      ...plan,
      states: { ...plan.states, tell: { ...plan.states.tell!, motion } },
    }),
  ).toThrow("Invalid sampled pursuit intent");
  expect(() =>
    layoutBehaviour(1, {
      ...plan,
      states: {
        ...plan.states,
        pursuit: {
          ...plan.states.pursuit!,
          onEnter: [
            { height: 1, kind: "force-pulse", range: 1, seconds: 1, velocity: { x: 1, y: 0 } },
          ],
        },
      },
    }),
  ).toThrow("Invalid sampled pursuit intent");
});
it("holds its own movement and facing through a reversal then corrects once at the next decision", () => {
  const object = actor(),
    physical = world();
  const first = stepBehaviour(BIRD, object, physical, 0.1, bird(), object.origin, initial(object));
  const reversed = bird(10, -100);
  const second = stepBehaviour(BIRD, object, physical, 0.1, reversed, first.at, first.state);
  expect(second.at.x).toBeGreaterThan(first.at.x);
  expect(second.state.facing).toBe(first.state.facing);
  expect(second.state.intentDecision).toBe(1);
  expect(second.state.intent?.target).toEqual(first.state.intent?.target);
  const corrected = stepBehaviour(BIRD, object, physical, 0.1, reversed, second.at, second.state);
  expect(corrected.state.intentDecision).toBe(2);
  expect(corrected.at.x).toBeLessThan(second.at.x);
  expect(corrected.state.facing).toBe(-1);
});
it("uses live position for attack entry and escape while a movement snapshot is held", () => {
  const object = actor(),
    physical = world();
  const first = stepBehaviour(BIRD, object, physical, 0.1, bird(), object.origin, initial(object));
  const near = bird(first.at.x - 5, -100);
  const tell = stepBehaviour(BIRD, object, physical, 0.1, near, first.at, first.state);
  expect(tell.state.stateKey).toBe("tell");
  expect(tell.state.activeAttack?.phase).toBe("tell");
  expect(tell.state.facing).toBe(-1);
  expect(tell.state.intent).toBeUndefined();
  const escaped = stepBehaviour(BIRD, object, physical, 0.1, bird(5000), first.at, first.state);
  expect(escaped.state.pursuit?.phase).toBe("escaped");
  expect(escaped.escaped).toEqual(plan.pursuit!.escaped);
});
it("uses native support carry during a sampled grounded pause", () => {
  const motion = plan.states.pursuit!.motion;
  if (motion.kind !== "pursue") {
    throw Error("Expected pursuit");
  }
  const profile = {
    ...plan,
    states: {
      ...plan.states,
      pursuit: {
        ...plan.states.pursuit!,
        motion: { ...motion, intent: { ...intent, pauseChance: 1 } },
      },
    },
  };
  const object = actor(profile),
    owner = { ...object, collision: "ledge" as const },
    before = { height: 10, width: 100, x: 90, y: 500 },
    after = { ...before, x: 95 };
  const physical: BehaviourWorld = {
    ...world(),
    platforms: [{ collision: "ledge", owner, rect: before }],
    solids: [],
    traversalFrame: {
      ...world().traversalFrame!,
      platforms: [{ after, before, collision: "ledge", owner }],
    },
  };
  const step = stepBehaviour(BIRD, object, physical, 0.1, bird(), object.origin, initial(object));
  expect(step.at.x).toBeCloseTo(object.origin.x + 5);
  expect(step.at.y).toBe(object.origin.y);
  expect(step.state.traversal?.physical.supportId).toBe(owner);
  expect(step.state.intent?.remainingSeconds).toBeCloseTo(0.1);
});
it("does not resample an expired intent during a native airborne leg", () => {
  const object = actor(),
    physical = world(),
    at = { x: 100, y: 430 };
  const held = capturePursuitIntent(physical, intent, BIRD, bird(), 0, 1, object, at);
  const state: BehaviourState = {
    ...initial(object),
    intent: { ...held, remainingSeconds: 0 },
    intentDecision: 1,
    pendingEntry: false,
    traversal: {
      geometry: "",
      inputs: [],
      physical: { ...at, fallFromY: at.y + object.height, grounded: false, vy: 0 },
      status: "found",
      target: { height: 20, width: 100, x: 200, y: 480 },
    },
  };
  const step = stepBehaviour(BIRD, object, physical, 0.1, bird(900, -100), at, state);
  expect(step.state.intentDecision).toBe(1);
  expect(step.state.intent?.remainingSeconds).toBe(0);
  expect(step.at.y).toBeGreaterThan(at.y);
});
it("replays object-local decisions without consuming a shared random stream", () => {
  const object = actor(),
    physical = world(),
    config = { ...intent, offset: { max: 20, min: -20 } };
  const first = capturePursuitIntent(physical, config, BIRD, bird(), 0, 1, object, object.origin);
  capturePursuitIntent(
    { ...physical, idleDecision: { namespace: "other", seed: 31 } },
    config,
    BIRD,
    bird(),
    8,
    1,
    object,
    object.origin,
  );
  expect(capturePursuitIntent(physical, config, BIRD, bird(), 0, 1, object, object.origin)).toEqual(
    first,
  );
  expect(
    capturePursuitIntent(physical, config, BIRD, bird(), 1, 1, object, object.origin).offset,
  ).not.toBe(first.offset);
});
it("defers overhead resampling until the safe ascent boundary, then captures the new travel side", () => {
  const profile: BehaviourPlan = {
    ...plan,
    states: {
      ...plan.states,
      pursuit: {
        animation: null,
        motion: {
          intent,
          kind: "pursue",
          mode: "fly",
          overhead: { ahead: 20, clearance: 10 },
          speed: 100,
        },
        transitions: [],
      },
    },
  };
  const object = actor(profile),
    physical = world();
  let at = object.origin,
    state = initial(object);
  for (let tick = 0; tick < 4; tick++) {
    const step = stepBehaviour(
      BIRD,
      object,
      physical,
      0.1,
      tick === 0 ? bird() : bird(100, -100),
      at,
      state,
    );
    expect(step.state.intentDecision).toBe(1);
    at = step.at;
    state = step.state;
  }
  const corrected = stepBehaviour(BIRD, object, physical, 0.1, bird(100, -100), at, state);
  expect(corrected.state.intentDecision).toBe(2);
  expect(corrected.state.flightApproachDirection).toBe(-1);
  expect(corrected.state.facing).toBe(-1);
  expect(corrected.state.intent?.travelDirection).toBe(-1);
});
it("rejects an unsafe flying pause and preserves the actual collision-checked ascent", () => {
  const profile: BehaviourPlan = {
    ...plan,
    states: {
      ...plan.states,
      pursuit: {
        animation: null,
        motion: {
          intent: { ...intent, pauseChance: 1 },
          kind: "pursue",
          mode: "fly",
          overhead: { ahead: 20, clearance: 10 },
          speed: 100,
        },
        transitions: [],
      },
    },
  };
  const object = actor(profile),
    hazard = { ...object },
    physical = {
      ...world(),
      hazards: [{ owner: hazard, rect: { height: 20, width: 20, x: 900, y: 450 } }],
    };
  expect(safeIntentHover(physical, 0.1, object, object.origin)).toBe(false);
  const step = stepBehaviour(BIRD, object, physical, 0.1, bird(), object.origin, initial(object));
  expect(step.at.y).toBeLessThan(object.origin.y);
});

it("uses live sight through actual walls instead of the held movement rect", () => {
  const profile: BehaviourPlan = {
    ...plan,
    states: {
      ...plan.states,
      pursuit: {
        ...plan.states.pursuit!,
        transitions: [
          {
            to: "tell",
            when: [
              { kind: "attack-ready" },
              { kind: "nearby", range: 1000 },
              { kind: "line-of-sight" },
            ],
          },
        ],
      },
    },
  };
  const object = actor(profile),
    physical = world();
  const first = stepBehaviour(BIRD, object, physical, 0.1, bird(), object.origin, {
    ...initial(object),
    attackCooldownRemainingSeconds: 0.2,
  });
  expect(first.state.stateKey).toBe("pursuit");
  const blocked = { ...physical, solids: [floor, { height: 100, width: 10, x: 70, y: 400 }] };
  const step = stepBehaviour(BIRD, object, blocked, 0.1, bird(50, -100), first.at, first.state);
  expect(step.state.intent?.target).toEqual(first.state.intent?.target);
  expect(step.state.stateKey).toBe("pursuit");
  expect(step.state.activeAttack).toBeUndefined();
  expect(step.actions).toEqual([]);
});
it("keeps inactive and zero-time intent clocks unchanged", () => {
  const object = actor(),
    physical = world();
  const held = capturePursuitIntent(physical, intent, BIRD, bird(), 0, 1, object, object.origin);
  const state = { ...initial(object), intent: held, intentDecision: 1, pendingEntry: false };
  expect(stepBehaviour(BIRD, object, physical, 0, bird(), object.origin, state).state).toBe(state);
  const inactive = stepBehaviour(BIRD, object, physical, 1, bird(), object.origin, {
    ...state,
    active: false,
  });
  expect(inactive.state.intent).toEqual(held);
  expect(inactive.state.intentDecision).toBe(1);
});

it.each([
  ["dog-antagonist", "pursuit"],
  ["dog-antagonist", "pursuit-pounce"],
  ["ferret-antagonist", "pursuit"],
  ["ferret-antagonist", "pursuit-throw"],
  ["goose-antagonist", "pursuit"],
  ["goose-antagonist", "pursuit-trap"],
  ["bear-antagonist", "pursuit"],
  ["bear-antagonist", "pursuit-growl"],
  ["bear-antagonist", "pursuit-maul"],
  ["raccoon-antagonist", "pursuit"],
  ["raccoon-antagonist", "pursuit-drop"],
  ["pigeon-antagonist", "pursuit"],
  ["pigeon-antagonist", "pursuit-burst-right"],
  ["pigeon-antagonist", "pursuit-swoop-left"],
  ["pigeon-antagonist", "pursuit-swoop-right"],
] as const)(
  "holds an actual %s/%s movement snapshot while leaving marked states untouched",
  (character, entry) => {
    const object = objectLayout(
      TILE,
      CATALOGUE,
      HITBOXES,
      TILESETS["tiles-street"],
      {},
      { character, col: 20, row: 20 },
    );
    const node = object.behaviour!.states[entry]!;
    if (node.motion.kind !== "pursue" || !node.motion.intent) {
      throw Error("Expected opted-in production pursuit");
    }
    for (const candidate of Object.values(object.behaviour!.states)) {
      if (candidate.attack || candidate.onEnter?.length) {
        expect(
          candidate.motion.kind === "pursue" ? candidate.motion.intent : undefined,
        ).toBeUndefined();
      }
    }
    const support = { height: 600, width: 4000, x: 0, y: object.origin.y + object.height };
    const target = {
      ...startBird(BIRD, { x: object.origin.x + 500, y: support.y }),
      vx: BIRD.walkSpeed,
    };
    const physical: BehaviourWorld = {
      idleDecision: { namespace: `actual:${character}:${entry}`, seed: 31 },
      solids: [support],
      traversalFrame: {
        bounds: { height: 1200, width: 4000, x: 0, y: 0 },
        dtSeconds: 1 / 120,
        platforms: [],
        timeSeconds: 0,
      },
      view: { height: 1200, width: 4000, x: 0, y: 0 },
    };
    const component = { ...object, behaviour: { ...object.behaviour!, initial: entry } };
    const start: BehaviourState = {
      ...startBehaviour(BIRD, component, target),
      attackCooldownRemainingSeconds: 0.75,
      pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    };
    const first = stepBehaviour(BIRD, object, physical, 1 / 120, target, object.origin, start);
    expect(first.state.intentDecision).toBe(1);
    expect(first.state.intent?.travelDirection).toBe(1);
    expect(first.state.intent!.offset).toBeGreaterThanOrEqual(node.motion.intent.offset.min);
    expect(first.state.intent!.offset).toBeLessThanOrEqual(node.motion.intent.offset.max);
    const reversed = { ...target, vx: -BIRD.walkSpeed, x: target.x - 50 };
    const next = stepBehaviour(
      BIRD,
      object,
      { ...physical, traversalFrame: { ...physical.traversalFrame!, timeSeconds: 1 / 120 } },
      1 / 120,
      reversed,
      first.at,
      first.state,
    );
    expect(next.state.intentDecision).toBe(1);
    expect(next.state.intent?.target).toEqual(first.state.intent?.target);
    expect(next.state.intent?.travelDirection).toBe(1);
    expect(next.state.facing).toBe(first.state.facing);
    expect(next.actions).toEqual([]);
    if (node.motion.mode === "fly") {
      expect(next.state.flightApproachDirection).toBe(1);
    }
  },
);

it.each([false, true])(
  "observes a real live-arrival crossing without homing or bypassing blocked sight=%s",
  (blocked) => {
    const motion = {
      intent: { ...intent, decisionSeconds: { max: 1, min: 1 }, offset: { max: 2, min: 2 } },
      kind: "pursue",
      mode: "fly",
      overhead: { ahead: 20, clearance: 10 },
      speed: 384,
    } as const;
    const profile: BehaviourPlan = {
      ...plan,
      states: {
        ...plan.states,
        pursuit: {
          animation: null,
          motion,
          transitions: [
            {
              to: "tell",
              when: [
                { kind: "arrived", tolerance: 1.2 },
                { kind: "line-of-sight" },
                { kind: "attack-ready" },
              ],
            },
          ],
        },
      },
    };
    const object = actor(profile),
      target = bird(135),
      physical = {
        ...world(),
        solids: [floor, ...(blocked ? [{ height: 4, width: 30, x: 125, y: 457 }] : [])],
        traversalFrame: { ...world().traversalFrame!, dtSeconds: 1 / 120 },
      };
    let at = object.origin,
      state = initial(object),
      crossed = false;
    const liveX = target.x + BIRD.width / 2 + motion.overhead.ahead - object.width / 2;
    for (let tick = 0; tick < 60 && state.stateKey !== "tell"; tick++) {
      const step = stepBehaviour(BIRD, object, physical, 1 / 120, target, at, state);
      expect(
        step.segments.reduce((sum, segment) => sum + segment.end - segment.start, 0),
      ).toBeCloseTo(1 / 120, 10);
      crossed ||= step.segments.some(
        (segment) =>
          segment.to.x === liveX && segment.from.x < liveX && segment.end > segment.start,
      );
      expect(step.actions).toEqual([]);
      at = step.at;
      state = step.state;
    }
    if (blocked) {
      expect(state.stateKey).toBe("pursuit");
      expect(state.activeAttack).toBeUndefined();
      expect(at.x).toBeCloseTo(liveX + motion.intent.offset.max);
    } else {
      expect(crossed).toBe(true);
      expect(state.stateKey).toBe("tell");
      expect(at.x).toBeCloseTo(liveX);
      expect(state.activeAttack?.phase).toBe("tell");
      expect(state.elapsed).toBeGreaterThan(0);
      expect(state.elapsed).toBeLessThan(1 / 120);
    }
  },
);
