import { pathOrNearest, pathTo } from "@andornaut/game-kit/terrain/movementMap";
import { findTraversal } from "@andornaut/game-kit/terrain/traversal";
import { expect, it, vi } from "vitest";

import { namedStreams } from "../ai/randomStreams.ts";
import { traceRecorder } from "../ai/trace.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import { TILE } from "../data/screen.ts";
import type { BehaviourCondition, BehaviourPlan, ObjectLayout, Rect } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { zoneTraceLine } from "../sim/zoneTrace.ts";
import { createBehaviourObservations } from "../testing/behaviourObservations.ts";
import { chunksLayout, ORDINARY } from "../testing/encounterLayouts.ts";
import { type BehaviourState, startBehaviour, stepBehaviour } from "./behaviour.ts";
import { mapReachable, mapRecoveryGoal, planMapLeg } from "./behaviourMapPursuit.ts";
import {
  type BehaviourObservation,
  type BehaviourPursuitObservation,
  createBehaviourObserver,
} from "./behaviourObserver.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { probeRearm, traversalGoal } from "./behaviourTraversal.ts";
import { startBird } from "./bird.ts";
import { pursuitGroundMap } from "./movementMaps.ts";
import { objectLayout } from "./tiles.ts";
import { startZone, stepZone, stepZoneObserved } from "./zone.ts";

vi.mock("@andornaut/game-kit/terrain/movementMap", async (original) => {
  const actual = await original<typeof import("@andornaut/game-kit/terrain/movementMap")>();
  return { ...actual, pathOrNearest: vi.fn(actual.pathOrNearest), pathTo: vi.fn(actual.pathTo) };
});
vi.mock("@andornaut/game-kit/terrain/traversal", async (original) => {
  const actual = await original<typeof import("@andornaut/game-kit/terrain/traversal")>();
  return { ...actual, findTraversal: vi.fn(actual.findTraversal) };
});

const pursuit = (): BehaviourPursuitObservation => ({
  at: { x: 3, y: 4 },
  from: "pursuit",
  grace: {
    status: "captured",
    value: { reachable: { status: "unknown" }, unreachableSeconds: 2 },
  },
  kind: "pursuit",
  metadata: { objectIndex: 1, tick: 7 },
  scorer: { status: "not_evaluated" },
  target: { status: "captured", value: { height: 10, width: 12, x: 20, y: 30 } },
  to: "pursuit",
  traversal: {
    status: "captured",
    value: {
      preparing: false,
      status: "budget-exhausted",
      target: { height: 8, width: 8, x: 2, y: 3 },
    },
  },
});

it("detaches and freezes nested diagnostic facts without changing their source", () => {
  const source = pursuit();
  const received: BehaviourObservation[] = [];
  const observer = createBehaviourObserver((observation) => received.push(observation));
  observer.record(source);
  const captured = received[0] as BehaviourPursuitObservation;
  expect(captured).toEqual(source);
  expect(captured).not.toBe(source);
  if (source.target.status !== "captured" || captured.target.status !== "captured") {
    throw new Error("Expected a captured target");
  }
  const capturedTarget = captured.target.value;
  Object.assign(source.target.value, { x: 99 });
  expect(capturedTarget.x).toBe(20);
  expect(() => Object.assign(capturedTarget, { x: 40 })).toThrow(TypeError);
  expect(() => Object.assign(captured.grace, { status: "not_evaluated" })).toThrow(TypeError);
  if (captured.traversal.status !== "captured") {
    throw new Error("Expected captured traversal");
  }
  expect(Object.isFrozen(captured.traversal.value.target)).toBe(true);
  expect(Object.isFrozen(captured.metadata)).toBe(true);
  expect(observer.failures()).toEqual([]);
});

it("reports delivery failures without throwing into rules or disabling later observations", () => {
  let calls = 0;
  const observer = createBehaviourObserver(() => {
    if (calls++ === 0) {
      throw new Error("Diagnostic receiver unavailable");
    }
  });
  expect(() => observer.record(pursuit())).not.toThrow();
  const first = observer.failures();
  observer.record({ amount: 1, kind: "work", metric: "transitions" });
  expect(calls).toBe(2);
  expect(first).toEqual([
    {
      eventKind: "pursuit",
      message: "Diagnostic receiver unavailable",
      metadata: { objectIndex: 1, tick: 7 },
    },
  ]);
  expect(Object.isFrozen(first)).toBe(true);
  expect(observer.failures()).toEqual(first);
});

it("keeps computed unknown distinct from a fact the pursuit update did not evaluate", () => {
  let received: BehaviourObservation | undefined;
  const observer = createBehaviourObserver((observation) => {
    received = observation;
  });
  observer.record(pursuit());
  const captured = received as BehaviourPursuitObservation;
  expect(captured.grace).toEqual({
    status: "captured",
    value: { reachable: { status: "unknown" }, unreachableSeconds: 2 },
  });
  expect(captured.scorer).toEqual({ status: "not_evaluated" });
});

it("counts actual map queries and explicit route reuse without changing the route", () => {
  const area = chunksLayout("city-boundary", ["arena-dog-city-boundary"]).areas.main!;
  const actor = area.objects.find(({ character }) => character === "dog-antagonist")!;
  const entry = pursuitGroundMap(area, actor)!;
  const world = { ...entry.terrain.world, groundMap: () => entry };
  const pace = actor.behaviour!.pursuit!.pace!;
  const target: Rect = {
    height: BIRD.height,
    width: BIRD.width,
    x: 43 * TILE,
    y: 74 * TILE - BIRD.height,
  };
  const expected = planMapLeg(world, actor, entry, pace, 1, undefined, actor.origin, target);
  vi.mocked(pathOrNearest).mockClear();
  vi.mocked(pathTo).mockClear();
  const observations = createBehaviourObservations();
  const observed = { ...world, observation: { observer: observations.observer } };
  const first = planMapLeg(observed, actor, entry, pace, 1, undefined, actor.origin, target);
  expect(first).toEqual(expected);
  expect(first).toBeDefined();
  const reused = planMapLeg(observed, actor, entry, pace, 1, first!.state, actor.origin, target);
  expect(reused).toEqual(first);
  expect(observations.report().work).toMatchObject({
    map_search_calls: { status: "captured", value: 1 },
    route_cache_hits: { status: "captured", value: 1 },
  });
  mapReachable(observed, actor, entry, actor.origin, target);
  mapRecoveryGoal(observed, actor, entry, { distance: TILE, minMovement: 1 }, actor.origin, target);
  const calls = vi.mocked(pathOrNearest).mock.calls.length + vi.mocked(pathTo).mock.calls.length;
  expect(calls).toBe(3);
  expect(observations.report().work.map_search_calls).toEqual({ status: "captured", value: calls });
  expect(observations.report().work.traversal_steps).toEqual({ status: "not_evaluated" });
});

function rearmFixture() {
  const area = chunksLayout("city-boundary", ["arena-dog-city-boundary"]).areas.main!;
  const actor = area.objects.find(({ character }) => character === "dog-antagonist")!;
  const motion = actor.behaviour!.states.pursuit!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground" || !motion.traversal) {
    throw new Error("Expected Archie's actual traversal pursuit");
  }
  const floor = { height: TILE, width: area.width, x: 0, y: actor.origin.y + actor.height };
  const world: BehaviourWorld = {
    solids: [floor],
    traversalFrame: {
      bounds: { height: area.height, width: area.width, x: 0, y: 0 },
      dtSeconds: STEP_SECONDS,
      platforms: [],
      timeSeconds: 0,
    },
  };
  const target = {
    height: BIRD.height,
    width: BIRD.width,
    x: actor.origin.x - 3 * actor.width,
    y: floor.y - BIRD.height,
  };
  return { actor, area, motion, target, world };
}

it("records an actual native traversal query's returned work without changing its result", () => {
  const { actor, motion, target, world } = rearmFixture();
  const expected = probeRearm(
    world,
    STEP_SECONDS,
    actor,
    motion,
    actor.origin,
    "wait",
    true,
    undefined,
    actor.origin,
    target,
  );
  expect(expected.rearm.status).toBe("found");
  vi.mocked(findTraversal).mockClear();
  const observations = createBehaviourObservations();
  const actual = probeRearm(
    { ...world, observation: { observer: observations.observer } },
    STEP_SECONDS,
    actor,
    motion,
    actor.origin,
    "wait",
    true,
    undefined,
    actor.origin,
    target,
  );
  expect(actual).toEqual(expected);
  expect(vi.mocked(findTraversal)).toHaveBeenCalledTimes(1);
  const result = vi.mocked(findTraversal).mock.results[0]!;
  if (result.type !== "return") {
    throw new Error("Expected a completed native query");
  }
  expect(observations.report().work).toMatchObject({
    traversal_search_calls: { status: "captured", value: 1 },
    traversal_states: { status: "captured", value: result.value.work.states },
    traversal_steps: { status: "captured", value: result.value.work.steps },
  });
});

it("leaves native work unevaluated when no target envelope admits a query", () => {
  const { actor, area, motion, world } = rearmFixture();
  const target = {
    height: BIRD.height,
    width: BIRD.width,
    x: 49 * TILE,
    y: 44 * TILE - BIRD.height,
  };
  const noGoal = { ...world, solids: area.solids };
  expect(traversalGoal(noGoal, actor, actor.origin, target)).toBeUndefined();
  const observations = createBehaviourObservations();
  vi.mocked(findTraversal).mockClear();
  const result = probeRearm(
    { ...noGoal, observation: { observer: observations.observer } },
    STEP_SECONDS,
    actor,
    motion,
    actor.origin,
    "wait",
    true,
    undefined,
    actor.origin,
    target,
  );
  expect(result.rearm.status).toBe("geometry-unavailable");
  expect(result.reachable).toBeUndefined();
  expect(vi.mocked(findTraversal)).not.toHaveBeenCalled();
  expect(observations.report().work).toMatchObject({
    traversal_search_calls: { status: "not_evaluated" },
    traversal_states: { status: "not_evaluated" },
    traversal_steps: { status: "not_evaluated" },
  });
});

it("keeps ordinary and observed short step traces identical, including receiver failures", () => {
  const layout = chunksLayout("city-boundary", ["arena-dog-city-boundary"]);
  const initial = startZone(ORDINARY, layout, 0);
  const input = { jumpHeld: false, move: 0 as const, useHeld: false };
  const plainTrace = traceRecorder({ retain: false });
  const observedTrace = traceRecorder({ retain: false });
  const observations = createBehaviourObservations();
  const failing = createBehaviourObserver(() => {
    throw new Error("Receiver failure");
  });
  let plain = initial;
  let observed = initial;
  let failed = initial;
  for (let tick = 0; tick < 2; tick++) {
    const next = stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, input, plain);
    const captured = stepZoneObserved(
      observations.observer,
      SKILL_PROFILES,
      ORDINARY,
      layout,
      STEP_SECONDS,
      input,
      observed,
    );
    const broken = stepZoneObserved(
      failing,
      SKILL_PROFILES,
      ORDINARY,
      layout,
      STEP_SECONDS,
      input,
      failed,
    );
    plainTrace.record(zoneTraceLine(layout, STEP_SECONDS, plain, next));
    observedTrace.record(zoneTraceLine(layout, STEP_SECONDS, observed, captured));
    expect(captured).toEqual(next);
    expect(broken).toEqual(next);
    plain = next;
    observed = captured;
    failed = broken;
  }
  expect(observedTrace.hash()).toBe(plainTrace.hash());
  expect(observations.report().work.simulation_ticks).toEqual({ status: "captured", value: 2 });
  expect(failing.failures().length).toBeGreaterThanOrEqual(2);
  expect(failing.failures().every(({ message }) => message === "Receiver failure")).toBe(true);
});

it("does not observe a simulation tick when a terminal zone holds", () => {
  const layout = chunksLayout("city-boundary", ["arena-dog-city-boundary"]);
  const zone = { ...startZone(ORDINARY, layout, 0), cleared: true };
  const observations = createBehaviourObservations();
  expect(
    stepZoneObserved(
      observations.observer,
      SKILL_PROFILES,
      ORDINARY,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      zone,
    ),
  ).toBe(zone);
  expect(observations.report().diagnostics.recordedEvents).toBe(0);
  expect(observations.report().work.simulation_ticks).toEqual({ status: "not_evaluated" });
});

it.each(["reachable", "unreachable", "unknown", "skipped"] as const)(
  "records the actual %s pursuit evaluation without changing its result",
  (kind) => {
    const { actor, area, target: flatTarget, world: flatWorld } = rearmFixture();
    const entry = pursuitGroundMap(area, actor)!;
    const roof = { height: TILE, width: 8 * TILE, x: 41 * TILE, y: 20 * TILE };
    const target =
      kind === "reachable"
        ? flatTarget
        : { height: BIRD.height, width: BIRD.width, x: 44 * TILE, y: roof.y - BIRD.height };
    const bird = {
      ...startBird(ORDINARY, { x: target.x + target.width / 2, y: target.y + target.height }),
      grounded: true,
    };
    const world: BehaviourWorld =
      kind === "reachable"
        ? flatWorld
        : kind === "unknown"
          ? { solids: [] }
          : { groundMap: () => entry, solids: [...entry.terrain.world.solids, roof] };
    const before: BehaviourState = {
      ...startBehaviour(ORDINARY, actor, bird),
      active: true,
      pursuit: {
        ...(kind === "skipped" && { endedSeconds: actor.behaviour!.pursuit!.rearmSeconds ?? 0 }),
        phase: kind === "skipped" ? "escaped" : "engaged",
        settled: kind === "skipped",
        unreachableSeconds: 0,
      },
      stateKey: "pursuit",
    };
    const observations = createBehaviourObservations();
    const expected = stepBehaviour(
      ORDINARY,
      actor,
      { ...world, decisions: namedStreams(0, "observer-fact") },
      STEP_SECONDS,
      bird,
      actor.origin,
      before,
    );
    const actual = stepBehaviour(
      ORDINARY,
      actor,
      {
        ...world,
        decisions: namedStreams(0, "observer-fact"),
        observation: { observer: observations.observer },
      },
      STEP_SECONDS,
      bird,
      actor.origin,
      before,
    );
    expect(actual).toEqual(expected);
    const grace = observations.report().lastPursuit?.grace;
    expect(grace?.status).toBe("captured");
    if (grace?.status !== "captured") {
      throw new Error("Expected an observed pursuit grace");
    }
    expect(grace.value.reachable).toEqual(
      kind === "reachable" || kind === "unreachable"
        ? { status: "captured", value: kind === "reachable" }
        : { status: kind === "unknown" ? "unknown" : "not_evaluated" },
    );
    expect(observations.report().diagnostics.deliveryFailures).toEqual([]);
  },
);

it("records the actual scorer choice without consuming another decision stream or draw", () => {
  const { actor, target, world } = rearmFixture();
  const bird = {
    ...startBird(ORDINARY, { x: target.x + target.width / 2, y: target.y + target.height }),
    grounded: true,
  };
  const before: BehaviourState = {
    ...startBehaviour(ORDINARY, actor, bird),
    active: true,
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    stateKey: "pursuit",
  };
  const run = (observer?: ReturnType<typeof createBehaviourObserver>) => {
    const streams = namedStreams(0, "observer-choice");
    const keys: string[] = [];
    let draws = 0;
    const result = stepBehaviour(
      ORDINARY,
      actor,
      {
        ...world,
        decisions: (key) => {
          keys.push(key);
          const random = streams(key);
          return () => {
            draws++;
            return random();
          };
        },
        ...(observer && { observation: { observer } }),
      },
      STEP_SECONDS,
      bird,
      actor.origin,
      before,
    );
    return { draws, keys, result };
  };
  const expected = run();
  const observations = createBehaviourObservations();
  const actual = run(observations.observer);
  expect(actual).toEqual(expected);
  expect(actual.draws).toBeGreaterThan(0);
  const choice = observations.report().lastChoice;
  expect(choice).toBeDefined();
  expect(choice?.state).toBe("pursuit");
  const actions = [
    ...actor.behaviour!.scorer!.moves.map(({ id }) => id),
    ...actor
      .behaviour!.states.pursuit!.transitions.filter(({ score }) => score)
      .map(({ to }) => to),
  ];
  expect(actions).toContain(choice?.action);
});

it.each([true, false])("counts only applied graph transitions (applied=%s)", (applied) => {
  const condition: BehaviourCondition = applied
    ? { kind: "elapsed", seconds: 0 }
    : { kind: "track-clear", state: "preview" };
  const plan: BehaviourPlan = {
    axis: "x",
    distance: 100,
    initial: "idle",
    states: {
      idle: {
        animation: null,
        motion: { kind: "wait" },
        transitions: [{ to: "settled", when: [condition] }],
      },
      preview: {
        animation: null,
        motion: { direction: 1, kind: "move", speed: 1 },
        transitions: [],
      },
      settled: { animation: null, motion: { kind: "wait" }, transitions: [] },
    },
  };
  const actor: ObjectLayout = objectLayout(
    1,
    {
      archetypes: {
        actor: {
          collision: "none",
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
        },
      },
      characters: {
        actor: { archetype: "actor", art: "observer-fixture", behaviour: plan, cols: 20, rows: 20 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 20, row: 20 },
  );
  const bird = startBird(ORDINARY, { x: 60, y: 20 });
  const before = { ...startBehaviour(ORDINARY, actor, bird), active: true };
  const observations = createBehaviourObservations();
  const solids = applied ? [] : [{ height: 100, width: 20, x: 60, y: 0 }];
  const expected = stepBehaviour(ORDINARY, actor, solids, STEP_SECONDS, bird, actor.origin, before);
  const actual = stepBehaviour(
    ORDINARY,
    actor,
    { observation: { observer: observations.observer }, solids },
    STEP_SECONDS,
    bird,
    actor.origin,
    before,
  );
  expect(actual).toEqual(expected);
  expect(actual.state.stateKey).toBe(applied ? "settled" : "idle");
  expect(observations.report().work.transitions).toEqual(
    applied ? { status: "captured", value: 1 } : { status: "not_evaluated" },
  );
  expect(observations.report().lastPursuit?.grace).toEqual({ status: "not_evaluated" });
});
