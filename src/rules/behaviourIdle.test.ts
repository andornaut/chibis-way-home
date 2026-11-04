import { findTraversal } from "@andornaut/game-kit/terrain/traversal";
import { afterEach, expect, it, vi } from "vitest";

import { namedStreams } from "../ai/randomStreams";
import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import {
  BEAR_BEHAVIOUR,
  DOG_BEHAVIOUR,
  FERRET_BEHAVIOUR,
  GOOSE_BEHAVIOUR,
  PIGEON_BEHAVIOUR,
  RACCOON_BEHAVIOUR,
} from "../data/behaviours";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { Archetype, BehaviourPlan, Rect, ZoneLayout } from "../data/types";
import { behaviourPose } from "../presentation";
import { withAnticipationContact } from "../testing/behaviours";
import { type BehaviourState, layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import { advanceIdleRecovery, observeIdle, planIdleRecovery } from "./behaviourIdle";
import type { BehaviourWorld } from "./behaviourReach";
import { startBird } from "./bird";
import { supportedLanding } from "./flyLanding";
import { objectLayout } from "./tiles";
import { retryZone, startZone, stepZone } from "./zone";

const plan: BehaviourPlan = {
  axis: "x",
  distance: 8,
  idleWatchdog: { distance: 2, maxAttempts: 3, minMovement: 0.5, resume: "pursue", seconds: 0.25 },
  initial: "watch",
  pursuit: {
    distance: 100,
    escaped: { line: "escaped", speaker: "speaker" },
    unreachableGraceSeconds: 1,
  },
  states: {
    pursue: {
      animation: "walk",
      motion: {
        kind: "pursue",
        mode: "ground",
        speed: 10,
        traversal: { gravity: 100, jumpSpeed: 20, maxFallSpeed: 100, prepSeconds: 0 },
      },
      transitions: [],
    },
    watch: {
      allowIdleReposition: true,
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [],
    },
  },
};

it("scales watchdog distances while preserving active time, attempt budget and graph identities", () => {
  const resolved = layoutBehaviour(12, plan);
  expect(resolved.idleWatchdog).toEqual({
    distance: 24,
    maxAttempts: 3,
    minMovement: 6,
    resume: "pursue",
    seconds: 0.25,
  });
  expect(resolved.states.watch?.allowIdleReposition).toBe(true);
});
it.each([
  { name: "empty attempt budget", patch: { maxAttempts: 0 } },
  { name: "missing recovery state", patch: { resume: "absent" } },
  { name: "nonmoving recovery state", patch: { resume: "watch" } },
])("rejects $name before an actor enters the stage", ({ patch }) => {
  expect(() =>
    layoutBehaviour(1, { ...plan, idleWatchdog: { ...plan.idleWatchdog!, ...patch } }),
  ).toThrow("Invalid idle watchdog");
});

const search = vi.hoisted(() => ({
  status: undefined as "budget-exhausted" | "geometry-unavailable" | "unreachable" | undefined,
}));
vi.mock("@andornaut/game-kit/terrain/traversal", async (original) => {
  const actual = await original<typeof import("@andornaut/game-kit/terrain/traversal")>();
  return {
    ...actual,
    findTraversal: vi.fn((...args: Parameters<typeof actual.findTraversal>) =>
      search.status
        ? {
            status: search.status,
            ...(search.status === "budget-exhausted" && { reason: "states" as const }),
            ...(search.status === "unreachable" && { horizonSteps: args[1].horizonSteps }),
            work: { states: 0, steps: 0 },
          }
        : actual.findTraversal(...args),
    ),
  };
});
afterEach(() => {
  search.status = undefined;
  vi.mocked(findTraversal).mockClear();
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
const floor: Rect = { height: 20, width: 240, x: 0, y: 100 };
const dt = 0.05;
const target = { ...startBird(BIRD, { x: 140, y: 100 }), grounded: true };
function actor(behaviour: BehaviourPlan = plan) {
  return objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: {
        actor: { archetype: "actor", art: "actor", behaviour, cols: 10, rows: 10 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 60, row: 90 },
  );
}
function world(solids: readonly Rect[] = [floor], timeSeconds = 0): BehaviourWorld {
  return {
    chunks: [{ width: 720, x: 0 }],
    solids,
    traversalFrame: {
      bounds: { height: 360, width: 720, x: 0, y: 0 },
      dtSeconds: dt,
      platforms: [],
      timeSeconds,
    },
    view: { height: 360, width: 720, x: 0, y: 0 },
  };
}
function expired(object = actor()): BehaviourState {
  return {
    ...startBehaviour(BIRD, object, target),
    idleWatchdog: { anchor: object.origin, seconds: object.behaviour!.idleWatchdog!.seconds },
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
  };
}

it("retains actual idle time across graph transitions and then physically reaches supported recovery", () => {
  const object = actor({
    ...plan,
    states: {
      ...plan.states,
      other: {
        ...plan.states.watch!,
        transitions: [{ to: "watch", when: [{ kind: "elapsed", seconds: dt }] }],
      },
      watch: {
        ...plan.states.watch!,
        transitions: [{ to: "other", when: [{ kind: "elapsed", seconds: dt }] }],
      },
    },
  });
  let state = startBehaviour(BIRD, object, target),
    at = object.origin;
  for (let tick = 0; tick < 5; tick++) {
    const result = stepBehaviour(BIRD, object, world([floor], tick * dt), dt, target, at, state);
    state = result.state;
    at = result.at;
  }
  expect(at).toEqual(object.origin);
  expect(state.elapsed).toBeLessThan(plan.idleWatchdog!.seconds);
  expect(state.idleWatchdog!.seconds).toBeCloseTo(plan.idleWatchdog!.seconds);
  const recovered = stepBehaviour(
    BIRD,
    object,
    world([floor], 5 * dt),
    dt,
    { ...target, x: 300 },
    at,
    state,
  );
  expect(recovered.at.x).toBeLessThan(at.x);
  expect(supportedLanding(object, world(), recovered.at)).toBe(true);
  expect(recovered.actions).toEqual([]);
  expect(recovered.state.pursuit!.phase).toBe("escaped");
  expect(recovered.escaped).toEqual(plan.pursuit!.escaped);
  expect(recovered.state.idleWatchdog!.seconds).toBeCloseTo(0);
});
it("uses a verified opposite route when an eligible patrol is blocked by a wall", () => {
  const object = actor({
    ...plan,
    states: {
      ...plan.states,
      watch: {
        allowIdleReposition: true,
        animation: "walk",
        motion: { direction: 1, kind: "move", speed: 10 },
        transitions: [],
      },
    },
  });
  const geometry = world([floor, { height: 30, width: 10, x: 70, y: 70 }]);
  const moved = stepBehaviour(BIRD, object, geometry, dt, target, object.origin, expired(object));
  expect(moved.at.x).toBeLessThan(object.origin.x);
  expect(moved.at.y).toBe(object.origin.y);
  expect(moved.actions).toEqual([]);
});
it("does not interrupt a committed state or an unfinished airborne hop", () => {
  const committed = actor({
    ...plan,
    states: { ...plan.states, watch: { ...plan.states.watch!, allowIdleReposition: false } },
  });
  const stayed = stepBehaviour(
    BIRD,
    committed,
    world(),
    dt,
    target,
    committed.origin,
    expired(committed),
  );
  expect(stayed.at).toEqual(committed.origin);
  expect(stayed.state.idleWatchdog!.recovery).toBeUndefined();
  const hopping = actor({
    ...plan,
    idleWatchdog: { ...plan.idleWatchdog!, distance: 4, minMovement: 3 },
    states: {
      ...plan.states,
      watch: {
        allowIdleReposition: true,
        animation: "hop",
        motion: { direction: 1, hopHeight: 2, hopSeconds: 0.5, kind: "hop", speed: 0 },
        transitions: [],
      },
    },
  });
  let state = startBehaviour(BIRD, hopping, target),
    at = hopping.origin;
  for (let tick = 0; tick < 6; tick++) {
    const next = stepBehaviour(BIRD, hopping, world([floor], tick * dt), dt, target, at, state);
    state = next.state;
    at = next.at;
  }
  expect(at.y).toBeLessThan(hopping.origin.y);
  expect(state.hop).toBeDefined();
  expect(state.idleWatchdog!.recovery).toBeUndefined();
});
it("preserves zero-time, inactive and initially unacquired lifetimes", () => {
  const object = actor(),
    state = expired(object);
  expect(stepBehaviour(BIRD, object, world(), 0, target, object.origin, state).state).toBe(state);
  const inactive = stepBehaviour(BIRD, object, world(), 1, target, object.origin, {
    ...state,
    active: false,
  });
  expect(inactive.state.idleWatchdog).toEqual(state.idleWatchdog);
  const unseen = stepBehaviour(
    BIRD,
    object,
    {
      ...world(),
      chunks: [
        { width: 100, x: 0 },
        { width: 140, x: 100 },
      ],
      view: { height: 120, width: 100, x: 0, y: 0 },
    },
    1,
    target,
    object.origin,
    startBehaviour(BIRD, object, target),
  );
  expect(unseen.state.pursuit).toBeUndefined();
  expect(unseen.state.idleWatchdog).toBeUndefined();
});
it.each(["budget-exhausted", "geometry-unavailable"] as const)(
  "keeps %s distinct from proven blockage",
  (status) => {
    const object = actor();
    search.status = status;
    const result = stepBehaviour(BIRD, object, world(), dt, target, object.origin, expired(object));
    expect(result.at).toEqual(object.origin);
    expect(result.state.idleWatchdog!.status).toBe(status);
    expect(result.state.idleWatchdog!.recovery).toBeUndefined();
    expect(result.state.idleWatchdog!.seconds).toBeGreaterThanOrEqual(plan.idleWatchdog!.seconds);
  },
);
it("keeps a truly blocked support stationary without resetting its idle record", () => {
  const object = actor(),
    geometry = world([{ ...floor, width: object.width, x: object.origin.x }]);
  const result = stepBehaviour(BIRD, object, geometry, dt, target, object.origin, expired(object));
  expect(result.at).toEqual(object.origin);
  expect(result.state.idleWatchdog!.status).toBe("unreachable");
  expect(result.state.idleWatchdog!.seconds).toBeGreaterThan(plan.idleWatchdog!.seconds);
  stepBehaviour(BIRD, object, geometry, dt, target, result.at, result.state);
  expect(findTraversal).not.toHaveBeenCalled();
});
it("flies the authored profile to a real supported perch while keeping the eligible graph state held", () => {
  const object = actor({
    ...plan,
    states: {
      ...plan.states,
      pursue: {
        animation: "fly",
        motion: { kind: "pursue", mode: "fly", speed: 10 },
        transitions: [],
      },
    },
  });
  let state = expired(object),
    at = object.origin;
  const first = stepBehaviour(BIRD, object, world(), dt, target, at, state);
  // A flyer on support lifts off before any horizontal travel.
  expect(first.at.x).toBe(at.x);
  expect(first.at.y).toBeLessThan(at.y);
  expect(first.state.stateKey).toBe("watch");
  expect(behaviourPose(object, first.state).animation).toBe("fly");
  state = first.state;
  at = first.at;
  for (let tick = 1; tick < 100 && state.idleWatchdog!.recovery; tick++) {
    const result = stepBehaviour(BIRD, object, world([floor], tick * dt), dt, target, at, state);
    state = result.state;
    at = result.at;
  }
  expect(supportedLanding(object, world(), at)).toBe(true);
  expect(state.stateKey).toBe("pursue");
  expect(state.idleWatchdog!.recovery).toBeUndefined();
});

it("clears the active watchdog and verified route on a real death retry", () => {
  const object = actor({
    ...plan,
    states: {
      ...plan.states,
      pursue: {
        animation: "fly",
        motion: { kind: "pursue", mode: "fly", speed: 10 },
        transitions: [],
      },
    },
  });
  const layout: ZoneLayout = {
    areas: {
      main: {
        backX: 0,
        chunks: [],
        entries: { start: { x: 140, y: 100 } },
        exitX: 240,
        height: 360,
        objects: [object],
        solids: [floor],
        terrain: [],
        tileset: undefined,
        width: 240,
      },
    },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
  const initial = startZone(BIRD, layout, 1);
  const dead = stepZone(
    BIRD,
    layout,
    dt,
    { jumpHeld: false, move: 0, useHeld: false },
    {
      ...initial,
      behaviours: [expired(object)],
      bird: { ...initial.bird, x: object.origin.x, y: object.origin.y },
    },
  );
  expect(dead.death?.reason).toBe("hazard");
  expect(dead.behaviours[0]!.idleWatchdog).toBeDefined();
  const retry = retryZone(BIRD, layout, dead);
  expect(retry.behaviours[0]!.idleWatchdog).toBeUndefined();
  expect(retry.behaviours[0]!.pursuit).toBeUndefined();
  expect(retry.attempt).toBe(initial.attempt + 1);
});

it("treats missing future mover geometry as unknown when no current refuge exists", () => {
  const object = actor(),
    mover = actor();
  const geometry = world([{ ...floor, width: object.width, x: object.origin.x }]);
  const rect = { height: 4, width: 10, x: 200, y: 100 };
  const result = stepBehaviour(
    BIRD,
    object,
    {
      ...geometry,
      traversalFrame: {
        ...geometry.traversalFrame!,
        platforms: [{ after: rect, before: rect, collision: "ledge", owner: mover }],
      },
    },
    dt,
    target,
    object.origin,
    expired(object),
  );
  expect(result.at).toEqual(object.origin);
  expect(result.state.idleWatchdog!.status).toBe("geometry-unavailable");
});
it("caps candidate proofs without classifying an untried alternative as unreachable", () => {
  const object = actor({
    ...plan,
    idleWatchdog: { ...plan.idleWatchdog!, distance: 24, maxAttempts: 1 },
  });
  search.status = "unreachable";
  const result = stepBehaviour(BIRD, object, world(), dt, target, object.origin, expired(object));
  expect(findTraversal).toHaveBeenCalledOnce();
  expect(result.state.idleWatchdog!.status).toBe("budget-exhausted");
  expect(result.at).toEqual(object.origin);
});
it("uses the safe side of a perch instead of flying through a red hazard", () => {
  const object = actor({
    ...plan,
    states: {
      ...plan.states,
      pursue: {
        animation: "fly",
        motion: { kind: "pursue", mode: "fly", speed: 10 },
        transitions: [],
      },
    },
  });
  const hazard = actor();
  const result = stepBehaviour(
    BIRD,
    object,
    { ...world(), hazards: [{ owner: hazard, rect: { height: 10, width: 2, x: 57, y: 90 } }] },
    dt,
    target,
    object.origin,
    expired(object),
  );
  const recovery = result.state.idleWatchdog!.recovery;
  expect(recovery?.kind === "fly" && recovery.target.x).toBeGreaterThan(object.origin.x);
  expect(result.at).toEqual({ x: object.origin.x, y: object.origin.y - 0.5 });
  expect(result.actions).toEqual([]);
});

it("intercepts an eligible instant state at an exact tick boundary before another tell", () => {
  const object = actor({
    ...plan,
    initial: "tell",
    states: {
      ...plan.states,
      tell: {
        animation: "prepare",
        motion: { kind: "wait" },
        transitions: [{ to: "watch", when: [{ kind: "elapsed", seconds: dt }] }],
      },
      watch: { ...plan.states.watch!, transitions: [{ to: "tell", when: [{ kind: "visible" }] }] },
    },
  });
  let state = startBehaviour(BIRD, object, target),
    at = object.origin;
  for (let tick = 0; tick < 5; tick++) {
    const next = stepBehaviour(BIRD, object, world([floor], tick * dt), dt, target, at, state);
    state = next.state;
    at = next.at;
  }
  expect(at).toEqual(object.origin);
  expect(state.stateKey).toBe("watch");
  expect(state.idleWatchdog!.seconds).toBeGreaterThanOrEqual(plan.idleWatchdog!.seconds);
  const next = stepBehaviour(BIRD, object, world([floor], 5 * dt), dt, target, at, state);
  expect(next.at.x).toBeLessThan(object.origin.x);
  expect(next.actions).toEqual([]);
});

it.each(
  Object.entries({
    BEAR_BEHAVIOUR,
    DOG_BEHAVIOUR,
    FERRET_BEHAVIOUR,
    GOOSE_BEHAVIOUR,
    PIGEON_BEHAVIOUR,
    RACCOON_BEHAVIOUR,
  }),
)("resolves the authored watchdog and protected phases in %s", (_name, behaviour) => {
  expect(() => layoutBehaviour(TILE, behaviour)).not.toThrow();
});

it.each(["tell", "committed"] as const)(
  "protects %s phases from an expired watchdog even with an unsafe allow flag",
  (phase) => {
    const object = actor({
      ...plan,
      attackCooldownSeconds: 0.5,
      states: { ...plan.states, watch: { ...plan.states.watch!, attack: { id: "attack", phase } } },
    });
    const state = { ...expired(object), activeAttack: { id: "attack", phase } };
    const result = stepBehaviour(BIRD, object, world(), dt, target, object.origin, state);
    expect(findTraversal).not.toHaveBeenCalled();
    expect(result.state.stateKey).toBe("watch");
    expect(result.state.idleWatchdog?.recovery).toBeUndefined();
    expect(result.at).toEqual(object.origin);
  },
);

it("counts vertical flight as horizontal idleness and retains its decision sequence", () => {
  const config = plan.idleWatchdog!;
  const prior = { anchor: { x: 60, y: 10 }, decision: 4, seconds: 0.2 };
  const vertical = observeIdle(
    config,
    dt,
    [{ end: dt, from: prior.anchor, start: 0, to: { x: 60, y: 90 } }],
    prior,
  );
  expect(vertical.seconds).toBeCloseTo(0.25);
  expect(vertical.anchor).toEqual(prior.anchor);
  const horizontal = observeIdle(
    config,
    dt,
    [{ end: dt, from: { x: 60, y: 90 }, start: 0, to: { x: 61, y: 90 } }],
    vertical,
  );
  expect(horizontal.seconds).toBe(0);
  expect(horizontal.decision).toBe(4);
});

it("recovers an eligible flying hover onto a horizontally different perch below its ground radius", () => {
  const object = actor({
    ...plan,
    states: {
      ...plan.states,
      pursue: {
        animation: "fly",
        motion: { kind: "pursue", mode: "fly", speed: 10 },
        transitions: [],
      },
    },
  });
  const hover = { x: object.origin.x, y: 10 };
  const geometry = world([floor, { height: 10, width: 2, x: 58, y: 10 }]);
  let state = {
    ...expired(object),
    idleWatchdog: { anchor: hover, seconds: plan.idleWatchdog!.seconds },
  } as BehaviourState;
  let at = hover;
  const first = stepBehaviour(BIRD, object, geometry, dt, target, at, state);
  expect(first.state.idleWatchdog!.recovery?.kind).toBe("fly");
  expect(first.at.y).toBeGreaterThan(at.y);
  expect(first.state.idleWatchdog!.seconds).toBeGreaterThan(plan.idleWatchdog!.seconds);
  state = first.state;
  at = first.at;
  for (let tick = 1; tick < 200 && state.idleWatchdog!.recovery; tick++) {
    const next = stepBehaviour(BIRD, object, geometry, dt, target, at, state);
    state = next.state;
    at = next.at;
  }
  expect(supportedLanding(object, geometry, at)).toBe(true);
  expect(Math.abs(at.x - hover.x)).toBeGreaterThanOrEqual(plan.idleWatchdog!.minMovement);
  expect(state.idleWatchdog!.status).toBe("found");
  expect(state.idleWatchdog!.recovery).toBeUndefined();
});

it("does not report a vertical failsafe landing as a successful horizontal recovery", () => {
  const object = actor();
  const at = { x: 60, y: 10 };
  const hazard = actor();
  const geometry = {
    ...world(),
    hazards: [{ owner: hazard, rect: { height: 10, width: 1, x: 58, y: 90 } }],
  };
  const motion = { kind: "pursue", mode: "fly", speed: 10 } as const;
  const result = advanceIdleRecovery(
    geometry,
    object,
    motion,
    10,
    { anchor: at, recovery: { kind: "fly", origin: at, target: { x: 58, y: 90 } }, seconds: 1 },
    at,
  );
  expect(result.at).toEqual({ x: 60, y: 90 });
  expect(result.finished).toBe(true);
  expect(result.idle.status).toBe("invalidated");
});

it("replays namespaced choices while varying eligible decisions independently of world time", () => {
  const object = actor();
  const motion = { kind: "pursue", mode: "fly", speed: 10 } as const;
  const prior = { anchor: object.origin, seconds: 1 };
  const geometry = { ...world(), decisions: namedStreams(37, "idle-roam:main:0") };
  const choose = (
    context: BehaviourWorld,
    decision: import("./behaviourIdle").BehaviourIdleState = prior,
  ) => planIdleRecovery(context, object, motion, dt, 1, decision, object.origin);
  const first = choose(geometry);
  expect(first).toEqual(
    choose({ ...geometry, traversalFrame: { ...geometry.traversalFrame!, timeSeconds: 50 } }),
  );
  expect(first.recovery).toBeDefined();
  expect(choose(geometry, { ...prior, decision: first.decision! }).recovery).not.toEqual(
    first.recovery,
  );
  expect(
    choose({ ...geometry, decisions: namedStreams(37, "idle-roam:main:1") }).recovery,
  ).not.toEqual(first.recovery);
});

function idleJumpFixture(contact = false) {
  const physical = actor({
    ...plan,
    idleWatchdog: { ...plan.idleWatchdog!, distance: 24 },
    states: {
      ...plan.states,
      pursue: {
        animation: "walk",
        motion: {
          kind: "pursue",
          mode: "ground",
          speed: 40,
          traversal: { gravity: 100, jumpSpeed: 40, maxFallSpeed: 100, prepSeconds: 0.6 },
        },
        transitions: [],
      },
    },
  });
  const object = contact ? withAnticipationContact(physical) : physical;
  const solids = [
    { height: 20, width: 10, x: 60, y: 100 },
    { height: 24, width: 80, x: 80, y: 96 },
  ];
  const motion = object.behaviour!.states.pursue!.motion;
  if (motion.kind !== "pursue") {
    throw new Error("Expected pursuit fixture");
  }
  const idle = planIdleRecovery(
    world(solids),
    object,
    motion,
    STEP_SECONDS,
    1,
    expired(object).idleWatchdog!,
    object.origin,
  );
  expect(idle.recovery?.kind).toBe("ground");
  return { idle, object, solids };
}

it("uses the shared visible takeoff preparation for a verified idle-recovery jump", () => {
  const fixture = idleJumpFixture(true);
  let state = { ...expired(fixture.object), idleWatchdog: fixture.idle };
  let at = fixture.object.origin;
  let preparedAt: number | undefined;
  let jumpedAt: number | undefined;
  let resting: typeof at | undefined;
  for (let tick = 0; tick < 240 && state.idleWatchdog.recovery; tick++) {
    const next = stepBehaviour(
      BIRD,
      fixture.object,
      world(fixture.solids, tick * STEP_SECONDS),
      STEP_SECONDS,
      target,
      at,
      state,
    );
    if (next.state.traversal?.preparation) {
      preparedAt ??= tick;
      expect(next.state.animationTag).toBe("anticipate-lift");
      expect(next.state.animationSeconds).toBeCloseTo(
        (tick + 1) * STEP_SECONDS - next.state.traversal.preparation.startedAtSeconds,
      );
      expect(behaviourPose(fixture.object, next.state).animation).toBe("anticipate-lift");
      resting ??= next.at;
      expect(next.at).toEqual(resting);
      const recovery = next.state.idleWatchdog!.recovery;
      expect(recovery?.kind).toBe("ground");
      if (recovery?.kind === "ground") {
        expect(next.state.traversal).toBe(recovery.traversal);
      }
    }
    if (
      preparedAt !== undefined &&
      next.state.traversal &&
      !next.state.traversal.physical.grounded
    ) {
      jumpedAt ??= tick;
    }
    at = next.at;
    state = next.state as typeof state;
  }
  expect(preparedAt).toBeDefined();
  expect(jumpedAt).toBeDefined();
  expect((jumpedAt! - preparedAt!) * STEP_SECONDS).toBeGreaterThanOrEqual(0.6 - STEP_SECONDS);
  expect(supportedLanding(fixture.object, world(fixture.solids), at)).toBe(true);
  expect(at.x).toBeCloseTo(80, 6);
  expect(state.idleWatchdog.recovery).toBeUndefined();
  expect(state.activeAttack).toBeUndefined();
  expect(state.attackCooldownRemainingSeconds).toBeUndefined();
});

it("cancels an idle jump tell on lost support through the same physical executor", () => {
  const fixture = idleJumpFixture();
  const motion = fixture.object.behaviour!.states.pursue!.motion;
  if (motion.kind !== "pursue") {
    throw new Error("Expected pursuit fixture");
  }
  let idle = fixture.idle;
  let at = fixture.object.origin;
  for (let tick = 0; tick < 60; tick++) {
    const next = advanceIdleRecovery(
      world(fixture.solids, tick * STEP_SECONDS),
      fixture.object,
      motion,
      STEP_SECONDS,
      idle,
      at,
    );
    idle = next.idle;
    at = next.at;
    if (idle.recovery?.kind === "ground" && idle.recovery.traversal.preparation) {
      break;
    }
  }
  expect(idle.recovery?.kind).toBe("ground");
  const next = advanceIdleRecovery(world([], 1), fixture.object, motion, STEP_SECONDS, idle, at);
  expect(next.at.y).toBeGreaterThan(at.y);
  expect(next.idle.recovery?.kind).toBe("ground");
  if (next.idle.recovery?.kind === "ground") {
    expect(next.idle.recovery.traversal.preparation).toBeUndefined();
    expect(next.idle.recovery.traversal.physical.grounded).toBe(false);
  }
});

it.each([
  ["recovers from a perch that allows idle reposition", true],
  ["holds a perch that does not", false],
] as const)("engaged overhead flyer: %s", (_, allowIdleReposition) => {
  const object = actor({
    ...plan,
    initial: "rest",
    states: {
      pursue: {
        animation: "fly",
        motion: {
          kind: "pursue",
          mode: "fly",
          overhead: { ahead: 8, clearance: 6 },
          speed: 10,
        },
        transitions: [],
      },
      rest: {
        ...(allowIdleReposition && { allowIdleReposition }),
        animation: "rest",
        motion: { kind: "wait", support: "required" },
        transitions: [],
      },
    },
  });
  const geometry = world();
  let state = expired(object);
  let at = object.origin;
  // One recovery lifts off, crosses and lands back in the perch's own dwell.
  let started = false;
  for (let tick = 0; tick < 200 && !(started && !state.idleWatchdog!.recovery); tick++) {
    const next = stepBehaviour(BIRD, object, geometry, dt, target, at, state);
    state = next.state;
    at = next.at;
    started ||= state.idleWatchdog!.recovery !== undefined;
  }
  expect(state.stateKey).toBe("rest");
  expect(supportedLanding(object, geometry, at)).toBe(true);
  expect(Math.abs(at.x - object.origin.x) >= plan.idleWatchdog!.minMovement).toBe(
    allowIdleReposition,
  );
});
