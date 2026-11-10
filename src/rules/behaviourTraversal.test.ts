import {
  findTraversal,
  stepTraversal,
  type TraversalContext,
  type TraversalRequest,
  type TraversalState,
} from "@andornaut/game-kit/terrain/traversal";
import { expect, it, vi } from "vitest";

import { namedStreams } from "../ai/randomStreams";
import { BIRD_FRAME } from "../assets";
import { contactFrameAt, STEP_SECONDS } from "../core";
import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours";
import { BIRD } from "../data/bird";
import { blueVerticalId } from "../data/chunks";
import { TILE } from "../data/screen";
import type { Archetype, BehaviourPlan, Rect } from "../data/types";
import { behaviourPose } from "../presentation";
import { SKILL_PROFILES } from "../progress";
import { withAnticipationContact } from "../testing/behaviours";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { zonePlanOf } from "./assemble";
import { type BehaviourState, layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import type { BehaviourPlatformFrame, BehaviourWorld } from "./behaviourReach";
import { moveIntent, openingScorerState } from "./behaviourScorer";
import {
  advanceTraversal,
  type BehaviourTraversalState,
  preferredAscentInputs,
  preferredDescentInputs,
  probeRearm,
  traversalContext,
  traversalGoal,
} from "./behaviourTraversal";
import { birdBox, startBird } from "./bird";
import { supportContact } from "./flyLanding";
import { objectLayout, zoneLayout } from "./tiles";
import { activateBehaviour, startZone, stepZone } from "./zone";
import { CHUNK_LIBRARY } from "./zonePlans";

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
        traversal: { gravity: 1000, jumpSpeed: 300, maxFallSpeed: 500, prepSeconds: 0, speed: 120 },
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

function partialFallback() {
  const object = objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character: "ferret-antagonist", col: 44, row: 46 },
  );
  const at = { x: 311, y: 504 };
  const floor: Rect = { height: 240, width: 720, x: 0, y: 600 };
  const solids = [
    floor,
    { height: 48, width: 12, x: 312, y: 552 },
    { height: 12, width: 120, x: 192, y: 384 },
    { height: 12, width: 72, x: 168, y: 528 },
  ];
  const target = { ...startBird(BIRD, { x: 215, y: 384 }), grounded: true };
  const stale = startBird(BIRD, { x: 332.4, y: 384 });
  const scorer = object.behaviour!.scorer!;
  const chase = scorer.moves.find(({ move }) => move.kind === "chase")!.move;
  const relief = object.behaviour!.pursuit!.relief!;
  const state: BehaviourState = {
    ...startBehaviour(BIRD, object, target),
    active: true,
    intent: {
      ...moveIntent(BIRD, stale, chase, scorer.decisionSeconds.min, -1, object, at),
      remainingSeconds: 0,
    },
    pendingEntry: false,
    pursuit: {
      engagedSeconds: relief.giveUp.seconds.max + 1,
      giveUpSeconds: relief.giveUp.seconds.max,
      phase: "engaged",
      settled: false,
      unreachableSeconds: 0,
    },
    scorer: {
      ...openingScorerState(scorer),
      chaseSeconds: relief.pause.afterSeconds.max + 1,
      sinceAttackSeconds: relief.pause.tellClearanceSeconds + 1,
    },
    stateKey: scorer.engaged,
    traversal: {
      geometry: "",
      inputs: [],
      physical: { ...at, fallFromY: 552, grounded: false, vy: 0 },
      status: "geometry-unavailable",
      target: birdBox(BIRD, stale),
    },
  };
  const decisions = namedStreams(1, "partial-fallback:main:0");
  const geometry = (time: number): BehaviourWorld => {
    const base = world(solids, time);
    return {
      ...base,
      decisions,
      traversalFrame: { ...base.traversalFrame!, bounds: { height: 840, width: 720, x: 0, y: 0 } },
      view: { height: 840, width: 720, x: 0, y: 0 },
    };
  };
  return { at, floor, geometry, object, state, target };
}

it("refreshes an expired unproved chase from real partial contact without changing support physics", () => {
  const fixture = partialFallback();
  expect(supportContact(fixture.object, fixture.geometry(0), fixture.at)).toBe(true);
  let at = fixture.at;
  let state = fixture.state;
  const trace: number[] = [];
  let first: BehaviourState | undefined;
  let landed = false;
  for (let tick = 0; tick < 120; tick++) {
    const next = stepBehaviour(
      BIRD,
      fixture.object,
      fixture.geometry(tick * STEP_SECONDS),
      STEP_SECONDS,
      fixture.target,
      at,
      state,
    );
    trace.push(next.at.x);
    first ??= next.state;
    at = next.at;
    state = next.state;
    if (
      state.traversal?.physical.grounded &&
      state.traversal.physical.supportId === fixture.floor
    ) {
      landed = true;
      break;
    }
  }
  expect(landed, JSON.stringify({ at, trace: trace.slice(0, 8), traversal: state.traversal })).toBe(
    true,
  );
  expect(first!.intent!.target).toEqual(birdBox(BIRD, fixture.target));
  expect(first!.traversal?.physical.grounded).toBe(false);
  expect(first!.traversal?.status).toBe("geometry-unavailable");
  expect(first!.pursuit).toMatchObject({ phase: "engaged", unreachableSeconds: 0 });
  expect(first!.pursuit?.giveUp).toBeUndefined();
  expect(first!.chasePause).toBeUndefined();
});

it("keeps an unproved unsupported fall on its protected intent", () => {
  const fixture = partialFallback();
  const at = { ...fixture.at, y: 480 };
  const state = {
    ...fixture.state,
    traversal: {
      ...fixture.state.traversal!,
      physical: { ...fixture.state.traversal!.physical, ...at },
    },
  };
  expect(supportContact(fixture.object, fixture.geometry(0), at)).toBe(false);
  const next = stepBehaviour(
    BIRD,
    fixture.object,
    fixture.geometry(0),
    STEP_SECONDS,
    fixture.target,
    at,
    state,
  );
  expect(next.state.intent).toEqual(expect.objectContaining({ target: state.intent!.target }));
  expect(next.state.scorer?.decision).toBe(state.scorer?.decision);
  expect(next.at.y).toBeGreaterThan(at.y);
});

function descentFixture(move: -1 | 1 = 1, offset = { x: 2, y: 2 }) {
  const mirror = (rect: Rect): Rect =>
    move === 1 ? rect : { ...rect, x: 6000 - rect.x - rect.width };
  const support = mirror({ height: 552, width: 48, x: 2544, y: 888 });
  const landing = mirror({ height: 480, width: 288, x: 2592, y: 960 });
  const solids = [support, landing];
  const context: TraversalContext<Rect> = {
    body: { height: 46, offset, width: 44 },
    bounds: { height: 1440, width: 6840, x: 0, y: 0 },
    dtSeconds: STEP_SECONDS,
    epsilon: 1e-6,
    maxCollisionSteps: BEHAVIOUR_TRAVERSAL_SEARCH.maxCollisionSteps,
    maxDrop: 1440,
    profile: { gravity: 1780, jumpSpeed: 535, maxFallSpeed: 275, walkSpeed: 336 },
    safe: () => true,
    sampleColliders: () => ({
      colliders: solids.map((rect) => ({
        after: rect,
        before: rect,
        kind: "solid",
        supportId: rect,
      })),
      complete: true,
    }),
  };
  const body = mirror({ height: 46, width: 44, x: 2547.600000000003, y: 842 });
  const start: TraversalState<Rect> = {
    fallFromY: 888,
    grounded: true,
    supportId: support,
    vy: 0,
    x: body.x - offset.x,
    y: body.y - offset.y,
  };
  const goal = mirror({
    height: 48.000002,
    width: 286.3999999999969,
    x: 2593.600000000003,
    y: 911.999999,
  });
  const direct = stepTraversal(
    context,
    { jump: false, move, timeSeconds: 2.341666666666661 },
    start,
  );
  const request: TraversalRequest<Rect> = {
    ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
    goal,
    start,
    timeSeconds: 2.341666666666661,
  };
  return { context, direct, goal, landing, request, start, support, world: world(solids, 0) };
}

it("preserves a real in-flight descent witness despite expired intent and partial contact", () => {
  const base = descentFixture();
  const fixture = partialFallback();
  const object = fixture.object;
  const motion = object.behaviour!.states[object.behaviour!.scorer!.engaged]!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw new Error("Expected ground pursuit");
  }
  const geometry: BehaviourWorld = {
    ...base.world,
    decisions: namedStreams(1, "descent-control:main:0"),
    traversalFrame: {
      ...base.world.traversalFrame!,
      bounds: base.context.bounds,
      timeSeconds: base.request.timeSeconds,
    },
    view: { height: 720, width: 720, x: base.start.x - 360, y: 600 },
  };
  const context = traversalContext(geometry, STEP_SECONDS, object, motion)!;
  const direct = stepTraversal(
    context,
    { jump: false, move: 1, timeSeconds: base.request.timeSeconds },
    base.start,
  );
  const preferredInputs = preferredDescentInputs(geometry, context, base.request, direct);
  const proof = findTraversal(context, {
    ...base.request,
    ...(preferredInputs && { preferredInputs }),
  });
  expect(proof.status).toBe("found");
  if (proof.status !== "found") {
    throw new Error("Expected a real descent witness");
  }
  let physical: BehaviourTraversalState["physical"] = base.start;
  let consumed = 0;
  while (consumed < proof.inputs.length) {
    const advanced = stepTraversal(context, proof.inputs[consumed]!, physical);
    expect(advanced.status).toBe("ok");
    physical = advanced.state;
    consumed++;
    if (!physical.grounded && physical.vy === 0 && supportContact(object, geometry, physical)) {
      break;
    }
  }
  expect(physical.grounded).toBe(false);
  expect(physical.vy).toBe(0);
  expect(supportContact(object, geometry, physical)).toBe(true);
  const inputs = proof.inputs.slice(consumed);
  expect(inputs.length).toBeGreaterThan(0);
  const oldTarget = { ...startBird(BIRD, { x: 2812, y: 960 }), grounded: true };
  const current = startBird(BIRD, { x: physical.x - 144, y: 888 });
  const chase = object.behaviour!.scorer!.moves.find(({ move }) => move.kind === "chase")!.move;
  const state: BehaviourState = {
    ...fixture.state,
    intent: {
      ...moveIntent(
        BIRD,
        oldTarget,
        chase,
        object.behaviour!.scorer!.decisionSeconds.min,
        1,
        object,
        physical,
      ),
      remainingSeconds: 0,
    },
    traversal: { geometry: "", inputs, physical, status: "found", target: base.goal },
  };
  const timeSeconds = base.request.timeSeconds + consumed * STEP_SECONDS;
  const live: BehaviourWorld = {
    ...geometry,
    traversalFrame: { ...geometry.traversalFrame!, timeSeconds },
  };
  const expected = stepTraversal(
    traversalContext(live, STEP_SECONDS, object, motion)!,
    inputs[0]!,
    physical,
  );
  expect(expected.status).toBe("ok");
  const next = stepBehaviour(BIRD, object, live, STEP_SECONDS, current, physical, state);
  expect(next.state.intent!.target).toEqual(state.intent!.target);
  expect(next.state.scorer?.decision).toBe(state.scorer?.decision);
  expect(next.state.traversal?.physical).toEqual(expected.state);
});

it.each([
  { move: 1 as const, offset: { x: 2, y: 2 } },
  { move: -1 as const, offset: { x: 2, y: 2 } },
  { move: 1 as const, offset: { x: 7, y: 5 } },
])(
  "selects command-only descent inputs for the static bank, move=$move offset=$offset",
  ({ move, offset }) => {
    const fixture = descentFixture(move, offset);
    expect(fixture.direct.status).toBe("ok");
    expect(fixture.direct.state.grounded).toBe(false);
    vi.mocked(stepTraversal).mockClear();
    const inputs = preferredDescentInputs(
      fixture.world,
      fixture.context,
      fixture.request,
      fixture.direct,
    );
    expect(inputs).toHaveLength(BEHAVIOUR_TRAVERSAL_SEARCH.budget.horizonSteps);
    expect(inputs?.[0]).toEqual({ jump: false, move });
    expect(inputs?.every((input) => !input.jump && (input.move === move || input.move === 0))).toBe(
      true,
    );
    expect(stepTraversal).not.toHaveBeenCalled();
    expect(
      preferredDescentInputs(
        fixture.world,
        fixture.context,
        { ...fixture.request, horizonSteps: 1 },
        fixture.direct,
      ),
    ).toEqual([{ jump: false, move }]);
  },
);

it.each([
  "upward",
  "same level",
  "airborne",
  "gap",
  "moving support",
  "moving landing",
  "partial support",
  "still supported",
])("does not prefer a descent with %s", (kind) => {
  const fixture = descentFixture();
  const { context, landing, support } = fixture;
  let { direct, goal, start } = fixture;
  let geometry = fixture.world;
  if (kind === "upward" || kind === "same level") {
    const lower = { ...landing, y: support.y - (kind === "upward" ? 72 : 0) };
    geometry = { ...geometry, solids: [support, lower] };
    goal = { ...goal, y: lower.y - goal.height + context.epsilon };
  } else if (kind === "airborne") {
    start = { ...start, grounded: false };
  } else if (kind === "gap") {
    geometry = {
      ...geometry,
      solids: [support, { ...landing, width: landing.width - 12, x: landing.x + 12 }],
    };
    goal = { ...goal, width: goal.width - 12, x: goal.x + 12 };
  } else if (kind === "moving support") {
    geometry = {
      ...geometry,
      platforms: [{ collision: "solid", owner: actor(), rect: support }],
      solids: [landing],
    };
  } else if (kind === "moving landing") {
    geometry = {
      ...geometry,
      platforms: [{ collision: "solid", owner: actor(), rect: landing }],
      solids: [support],
    };
  } else if (kind === "partial support") {
    start = { ...start, x: start.x - support.width };
  } else {
    direct = { ...direct, state: { ...direct.state, grounded: true } };
  }
  expect(
    preferredDescentInputs(geometry, context, { ...fixture.request, goal, start }, direct),
  ).toBeUndefined();
});

function descentActorFixture(move: -1 | 1 = 1) {
  const fixture = descentFixture(move);
  const motion = {
    kind: "pursue",
    mode: "ground",
    speed: fixture.context.profile.walkSpeed,
    traversal: {
      ...fixture.context.profile,
      prepSeconds: 0.6,
      speed: fixture.context.profile.walkSpeed,
    },
  } as const;
  const object = {
    ...actor(),
    behaviour: {
      ...plan,
      pursuit: { ...plan.pursuit!, distance: 4320 },
      states: { chase: { ...plan.states.chase!, motion } },
    },
    height: 48,
    hitbox: { height: 46, width: 44, x: 2, y: 2 },
    origin: { x: move === 1 ? 2472 : 6000 - 2472 - 48, y: 912 },
    width: 48,
  };
  const geometry = {
    ...fixture.world,
    traversalFrame: {
      ...fixture.world.traversalFrame!,
      bounds: fixture.context.bounds,
      timeSeconds: fixture.request.timeSeconds,
    },
  };
  const target = {
    height: BIRD.height,
    width: BIRD.width,
    x: move === 1 ? 2800 : 6000 - 2800 - BIRD.width,
    y: fixture.landing.y - BIRD.height,
  };
  const prior: BehaviourTraversalState = {
    geometry: "",
    inputs: [],
    physical: fixture.start,
    status: "found",
    target: fixture.goal,
  };
  return { ...fixture, geometry, motion, object, prior, target };
}

it.each([-1, 1] as const)("executes a proved static bank descent with move=%s", (move) => {
  const fixture = descentActorFixture(move);
  let at = { x: fixture.start.x, y: fixture.start.y };
  let prior: BehaviourTraversalState | undefined = fixture.prior;
  vi.mocked(findTraversal).mockClear();
  let landed = false;
  for (let tick = 0; tick < fixture.request.horizonSteps; tick++) {
    const next = advanceTraversal(
      {
        ...fixture.geometry,
        traversalFrame: {
          ...fixture.geometry.traversalFrame,
          timeSeconds: fixture.request.timeSeconds + tick * STEP_SECONDS,
        },
      },
      fixture.object,
      fixture.motion,
      STEP_SECONDS,
      prior,
      at,
      fixture.target,
    );
    expect(Math.abs(next.at.x - at.x)).toBeCloseTo(fixture.motion.speed * STEP_SECONDS);
    expect(next.traversal?.preparation).toBeUndefined();
    at = next.at;
    prior = next.traversal;
    if (prior?.physical.grounded && at.y > fixture.start.y) {
      landed = true;
      break;
    }
  }
  expect(landed).toBe(true);
  expect(at.y).toBeCloseTo(fixture.landing.y - fixture.object.height);
  expect(at.x).toBeCloseTo(fixture.start.x + move * fixture.motion.speed * STEP_SECONDS * 57);
  expect(prior?.physical.supportId).toBe(fixture.landing);
  expect(findTraversal).toHaveBeenCalledOnce();
  const request = vi.mocked(findTraversal).mock.calls[0]![1];
  expect(request).toMatchObject(BEHAVIOUR_TRAVERSAL_SEARCH.budget);
  expect(request.preferredInputs).toHaveLength(request.horizonSteps);
  expect(
    vi
      .mocked(findTraversal)
      .mock.results[0]!.value.inputs.every(
        (input: { jump: boolean; move: number }) => input.move === move && !input.jump,
      ),
  ).toBe(true);
  expect(vi.mocked(findTraversal).mock.results[0]!.value).toMatchObject({
    status: "found",
    work: { states: 58, steps: 57 },
  });
  const proof = vi.mocked(findTraversal).mock.results[0]!.value;
  if (proof.status !== "found") {
    throw new Error("Expected a proved descent");
  }
  expect(prior?.physical).toEqual(proof.state);
});

function fragmentedDescentFixture(bank: number, extension: number, move: -1 | 1) {
  const base = descentActorFixture(move);
  const mirror = (rect: Rect): Rect =>
    move === 1 ? rect : { ...rect, x: 11520 - rect.x - rect.width };
  const support = mirror({ height: 552, width: 48, x: bank, y: 888 });
  const first = mirror({ height: 480, width: 96, x: bank + 48, y: 960 });
  const second = mirror({ height: 480, width: extension, x: bank + 144, y: 960 });
  const wallY = extension === 48 ? 924 : 900;
  const wall = mirror({
    height: 1440 - wallY,
    width: extension === 48 ? 48 : 72,
    x: bank + 144 + extension,
    y: wallY,
  });
  const originalX = bank === 8496 ? 8497.599999999988 : 5617.600000000003;
  const body = mirror({ height: 46, width: 44, x: originalX + 2, y: 842 });
  const start = {
    ...base.start,
    supportId: support,
    x: body.x - 2,
    y: body.y - 2,
  };
  const origin = mirror({ height: 48, width: 48, x: bank - 72, y: 912 });
  const object = { ...base.object, origin: { x: origin.x, y: origin.y } };
  const geometry = {
    ...base.geometry,
    // Rectangle order does not define the connected support interval.
    solids: [wall, second, support, first],
    traversalFrame: {
      ...base.geometry.traversalFrame,
      bounds: { height: 1440, width: 11520, x: 0, y: 0 },
      timeSeconds: 5.791666666666744,
    },
  };
  const target = mirror({ height: BIRD.height, width: BIRD.width, x: bank + 133, y: 924 });
  return {
    ...base,
    first,
    geometry,
    object,
    prior: { ...base.prior, physical: start },
    second,
    start,
    support,
    target,
  };
}

it.each([
  { bank: 8496, extension: 96, move: 1 as const },
  { bank: 5616, extension: 48, move: 1 as const },
  { bank: 8496, extension: 96, move: -1 as const },
])(
  "lands across the static support seam bank=$bank extension=$extension move=$move",
  ({ bank, extension, move }) => {
    const fixture = fragmentedDescentFixture(bank, extension, move);
    let at = { x: fixture.start.x, y: fixture.start.y };
    let prior: BehaviourTraversalState | undefined = fixture.prior;
    vi.mocked(findTraversal).mockClear();
    for (let tick = 0; tick < BEHAVIOUR_TRAVERSAL_SEARCH.budget.horizonSteps; tick++) {
      const next = advanceTraversal(
        {
          ...fixture.geometry,
          traversalFrame: {
            ...fixture.geometry.traversalFrame,
            timeSeconds: fixture.geometry.traversalFrame.timeSeconds + tick * STEP_SECONDS,
          },
        },
        fixture.object,
        fixture.motion,
        STEP_SECONDS,
        prior,
        at,
        fixture.target,
      );
      expect(Math.abs(next.at.x - at.x)).toBeLessThanOrEqual(
        fixture.motion.speed * STEP_SECONDS + 1e-8,
      );
      at = next.at;
      prior = next.traversal;
      if (prior?.physical.grounded && at.y > fixture.start.y) {
        break;
      }
    }
    expect(findTraversal).toHaveBeenCalledOnce();
    const request = vi.mocked(findTraversal).mock.calls[0]![1];
    expect(request).toMatchObject(BEHAVIOUR_TRAVERSAL_SEARCH.budget);
    expect(request.preferredInputs).toHaveLength(request.horizonSteps);
    expect(move === 1 ? request.goal.x + request.goal.width : request.goal.x).toBeCloseTo(
      move === 1 ? fixture.second.x + fixture.second.width : fixture.second.x,
    );
    const proof = vi.mocked(findTraversal).mock.results[0]!.value;
    expect(proof).toMatchObject({ status: "found", work: { states: 58, steps: 57 } });
    if (proof.status !== "found") {
      throw new Error("Expected a proved descent across the static seam");
    }
    expect(prior?.physical).toEqual(proof.state);
    expect(prior?.physical.supportId).toBe(fixture.second);
    expect(at.y).toBeCloseTo(912);
    const left = at.x + fixture.object.hitbox.x;
    expect(left).toBeGreaterThanOrEqual(Math.min(fixture.first.x, fixture.second.x));
    expect(left + fixture.object.hitbox.width).toBeLessThanOrEqual(
      Math.max(fixture.first.x + fixture.first.width, fixture.second.x + fixture.second.width),
    );
  },
);

it.each(["gap", "different height", "moving continuation"])(
  "does not merge a static goal across %s",
  (kind) => {
    const fixture = fragmentedDescentFixture(8496, 96, 1);
    const continuation = {
      ...fixture.second,
      x: fixture.second.x + (kind === "gap" ? 1 : 0),
      y: fixture.second.y - (kind === "different height" ? 1 : 0),
    };
    const geometry = {
      ...fixture.geometry,
      platforms:
        kind === "moving continuation"
          ? [{ collision: "solid" as const, owner: actor(), rect: continuation }]
          : [],
      solids: [
        fixture.support,
        fixture.first,
        ...(kind === "moving continuation" ? [] : [continuation]),
      ],
    };
    const goal = traversalGoal(geometry, fixture.object, fixture.start, fixture.target);
    expect(goal).toBeDefined();
    expect(goal!.x + goal!.width).toBeCloseTo(fixture.first.x + fixture.first.width);
  },
);

it("reuses static spans without sharing them with replacement terrain", () => {
  const fixture = fragmentedDescentFixture(8496, 96, 1);
  traversalGoal(fixture.geometry, fixture.object, fixture.start, fixture.target);
  const sort = vi.spyOn(Array.prototype, "sort");
  let calls: number;
  try {
    traversalGoal(fixture.geometry, fixture.object, fixture.start, fixture.target);
    calls = sort.mock.calls.length;
  } finally {
    sort.mockRestore();
  }
  // Target-height ordering still sorts; the cached terrain span adds no sort.
  expect(calls).toBe(1);
  const replaced = traversalGoal(
    { ...fixture.geometry, solids: [fixture.support, fixture.first] },
    fixture.object,
    fixture.start,
    fixture.target,
  );
  expect(replaced!.x + replaced!.width).toBeCloseTo(fixture.first.x + fixture.first.width);
});

it.each(["hazard", "unknown future hazard", "entering mover"])(
  "does not cross an unproved descent with %s",
  (kind) => {
    const fixture = descentActorFixture();
    let geometry: BehaviourWorld = fixture.geometry;
    const owner = actor();
    const staticOwner = { ...owner };
    delete staticOwner.behaviour;
    const barrier = { height: 960, width: 260, x: 2620, y: 0 };
    if (kind === "hazard" || kind === "unknown future hazard") {
      geometry = {
        ...geometry,
        hazards: [
          {
            owner: kind === "hazard" ? staticOwner : owner,
            rect: kind === "hazard" ? barrier : { ...barrier, x: 6000 },
          },
        ],
      };
    } else {
      const initial = { ...barrier, x: 3000 };
      geometry = {
        ...geometry,
        traversalFrame: {
          ...geometry.traversalFrame!,
          platforms: [{ after: initial, before: initial, collision: "solid", owner }],
          sample: (time) => {
            const tick = Math.round((time - fixture.request.timeSeconds) / STEP_SECONDS);
            return [
              {
                after: tick < 1 ? initial : barrier,
                before: tick < 2 ? initial : barrier,
                collision: "solid",
                owner,
              },
            ];
          },
        },
      };
    }
    vi.mocked(findTraversal).mockClear();
    const result = advanceTraversal(
      geometry,
      fixture.object,
      fixture.motion,
      STEP_SECONDS,
      fixture.prior,
      fixture.start,
      fixture.target,
    );
    expect(findTraversal).toHaveBeenCalledOnce();
    expect(vi.mocked(findTraversal).mock.calls[0]![1].preferredInputs).toHaveLength(
      fixture.request.horizonSteps,
    );
    expect(result.at).toEqual(fixture.start);
    expect(result.traversal?.inputs).toEqual([]);
    expect(result.traversal?.status).not.toBe("found");
    if (kind === "unknown future hazard") {
      expect(result.traversal?.status).toBe("geometry-unavailable");
    }
  },
);

it("scales only authored spatial traversal units", () => {
  const resolved = layoutBehaviour(12, plan).states.chase!.motion;
  expect(resolved).toMatchObject({
    speed: 1440,
    traversal: { gravity: 12000, jumpSpeed: 3600, maxFallSpeed: 6000, prepSeconds: 0, speed: 1440 },
  });
});
it("walks grounded at the pursuit speed and jumps at the traversal speed", () => {
  const chase = plan.states.chase!;
  if (chase.motion.kind !== "pursue" || chase.motion.mode !== "ground") {
    throw new Error("Expected ground pursuit");
  }
  const split: BehaviourPlan = {
    ...plan,
    states: {
      chase: {
        ...chase,
        motion: { ...chase.motion, traversal: { ...chase.motion.traversal!, speed: 240 } },
      },
    },
  };
  const object = objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: {
        actor: { archetype: "actor", art: "actor", behaviour: split, cols: 24, rows: 24 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 30, row: 276 },
  );
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
  const grounded: number[] = [];
  const air: number[] = [];
  for (let tick = 0; tick < 480 && at.y + object.height !== 264; tick++) {
    const next = stepBehaviour(
      BIRD,
      object,
      world(solids, tick * STEP_SECONDS),
      STEP_SECONDS,
      target,
      at,
      state,
    );
    const dx = Math.abs(next.at.x - at.x) / STEP_SECONDS;
    (next.at.y === at.y && at.y + object.height === 300 ? grounded : air).push(dx);
    at = next.at;
    state = next.state as typeof state;
  }
  expect(at.y + object.height).toBe(264);
  expect(Math.max(...grounded)).toBeCloseTo(120, 6);
  expect(Math.max(...air)).toBeGreaterThan(120 + 1e-6);
  expect(Math.max(...air)).toBeLessThanOrEqual(240 + 1e-6);
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

it("suggests a proved ascent only at a touching static wall", () => {
  const object = actor();
  const floor = { height: 60, width: 720, x: 0, y: 300 };
  const wall = { height: 96, width: 36, x: 54, y: 264 };
  const geometry = world([floor, wall], 0);
  const motion = plan.states.chase!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground") {
    throw Error("Expected ground pursuit");
  }
  const context = traversalContext(geometry, STEP_SECONDS, object, motion)!;
  const request = {
    ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
    goal: { height: 26, width: 120, x: 90, y: 275 },
    start: { fallFromY: 300, grounded: true, vy: 0, x: 30, y: 276 },
    timeSeconds: 0,
  };
  vi.mocked(stepTraversal).mockClear();
  expect(preferredAscentInputs(geometry, context, request)).toEqual(
    Array.from({ length: request.horizonSteps }, (_, index) => ({ jump: index === 0, move: 1 })),
  );
  expect(stepTraversal).not.toHaveBeenCalled();
  expect(
    preferredAscentInputs(
      {
        ...geometry,
        platforms: [
          {
            collision: "ledge",
            owner: actor(),
            rect: { height: 1, width: 72, x: 90, y: 264 },
          },
        ],
      },
      context,
      request,
    ),
  ).toBeUndefined();
  expect(
    preferredAscentInputs(geometry, context, {
      ...request,
      start: { ...request.start, grounded: false },
    }),
  ).toBeUndefined();
  expect(preferredAscentInputs(world([floor], 0), context, request)).toBeUndefined();
  expect(
    preferredAscentInputs(world([floor, { ...wall, x: 55 }], 0), context, request),
  ).toBeUndefined();
  expect(
    preferredAscentInputs(world([floor, { ...wall, height: 120, y: 240 }], 0), context, request),
  ).toBeUndefined();
});

it("executes a prepared production early-yard escape toward the supported far bank", () => {
  const ordinary = { ...BIRD, doubleJump: false };
  delete ordinary.dash;
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "city-streets", 40, [
    blueVerticalId("patrol-cover-early"),
    "outdoor-deep-descent",
  ]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const index = area.objects.findIndex((object) => object.character === "dog-antagonist");
  const object = area.objects[index]!;
  const wall = area.solids.find(
    (rect) =>
      rect.x > object.origin.x &&
      rect.y < object.origin.y &&
      rect.x - object.origin.x < object.width * 2,
  )!;
  let zone = activateBehaviour(index, startZone(ordinary, layout, 1));
  let crossed = false;
  let jumped = false;
  let preparedAt: number | undefined;
  let launchedAt: number | undefined;
  const trace: unknown[] = [];
  vi.mocked(findTraversal).mockClear();
  for (let tick = 0; tick < 600; tick++) {
    zone = stepZone(
      SKILL_PROFILES,
      ordinary,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      zone,
    );
    const state = zone.behaviours[index]!;
    const at = zone.objects[index]!;
    preparedAt ??= state.traversal?.preparation?.startedAtSeconds;
    if ((state.traversal?.physical.vy ?? 0) < 0) {
      jumped = true;
      launchedAt ??= zone.seconds;
    }
    if (tick % 15 === 0 || zone.death) {
      trace.push({
        at,
        death: zone.death,
        phase: state.stateKey,
        pursuit: state.pursuit,
        tick,
        time: zone.seconds,
        traversal: state.traversal,
      });
    }
    const left = at.x + (object.hitbox?.x ?? 0);
    crossed = left >= wall.x + wall.width - 1e-6;
    if (crossed || zone.death || zone.cleared || zone.turnedBack) {
      break;
    }
  }
  const searches = vi.mocked(findTraversal).mock.results.map(({ value }, index) => ({
    request: vi.mocked(findTraversal).mock.calls[index]![1],
    result: value,
  }));
  const evidence = {
    crossed,
    final: { at: zone.objects[index], death: zone.death, state: zone.behaviours[index] },
    jumped,
    launchedAt,
    object,
    preparedAt,
    searches,
    trace,
    wall,
  };
  expect(crossed, JSON.stringify(evidence)).toBe(true);
  expect(jumped).toBe(true);
  expect(zone.behaviours[index]!.pursuit?.phase).toBe("engaged");
  const motion = object.behaviour!.states.pursuit!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground" || !motion.traversal) {
    throw Error("Expected production ground traversal");
  }
  expect(preparedAt).toBeDefined();
  expect(launchedAt! - preparedAt!).toBeGreaterThanOrEqual(motion.traversal.prepSeconds);
  expect(searches.length).toBeGreaterThanOrEqual(2);
  for (const { request, result } of searches) {
    expect(request).toMatchObject(BEHAVIOUR_TRAVERSAL_SEARCH.budget);
    expect(result.work.states).toBeLessThanOrEqual(request.maxStates);
    expect(result.work.steps).toBeLessThanOrEqual(request.maxSteps);
  }
  expect(
    searches.some(
      ({ request, result }) =>
        request.preferredInputs?.[0]?.jump && result.status === "found" && result.state.grounded,
    ),
  ).toBe(true);
});
