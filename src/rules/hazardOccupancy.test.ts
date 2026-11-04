import { expect, it } from "vitest";

import { EDGE, prepareSpriteContact, spriteFrameOrigin, STEP_SECONDS } from "../core";
import { BEAR_BEHAVIOUR } from "../data/behaviours";
import { BIRD } from "../data/bird";
import type { BehaviourPlan, ObjectLayout, Rect } from "../data/types";
import { layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import { traversalContext } from "./behaviourTraversal";
import { startBird } from "./bird";
import { hazardBoundsAt } from "./hazardOccupancy";
import { objectLayout } from "./tiles";
const target = startBird(BIRD, { x: 200, y: 300 });
const wait = { animation: null, motion: { kind: "wait" }, transitions: [] } as const;
const chase = {
  kind: "pursue",
  mode: "ground",
  speed: 100,
  traversal: { gravity: 1000, jumpSpeed: 300, maxFallSpeed: 500, prepSeconds: 0 },
} as const;
const pursuit = {
  distance: 10000,
  escaped: { line: "escaped", speaker: "fixture" },
  unreachableGraceSeconds: null,
} as const;
function actor(plan: BehaviourPlan, x = 100): ObjectLayout {
  return objectLayout(
    1,
    {
      archetypes: {
        hazard: {
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
        },
      },
      characters: {
        fixture: {
          archetype: "hazard",
          art: "placeholder-fixture",
          cols: 1,
          rows: 1,
        },
        hazard: {
          archetype: "hazard",
          art: "placeholder-hazard",
          behaviour: plan,
          cols: 48,
          rows: 48,
        },
      },
    },
    {},
    undefined,
    {},
    { character: "hazard", col: x, row: 100 },
  );
}
const waitingPlan = (): BehaviourPlan => ({
  axis: "x",
  distance: 300,
  initial: "wait",
  states: { wait },
});
const body = (object: ObjectLayout): Rect => ({
  ...object.origin,
  height: object.height,
  width: object.width,
});
const certify = (object: ObjectLayout) =>
  hazardBoundsAt(
    [object],
    startBehaviour(BIRD, object, target),
    object.origin,
    body(object),
    10,
    object,
  );
it("uses actual elapsed time and the maximum AND guard before a pursuit transition", () => {
  const object = actor({
    ...waitingPlan(),
    pursuit,
    states: {
      chase: { ...wait, motion: chase },
      wait: {
        ...wait,
        transitions: [
          {
            to: "chase",
            when: [
              { kind: "elapsed", seconds: 0.5 },
              { kind: "elapsed", seconds: 1 },
              { kind: "visible" },
            ],
          },
        ],
      },
    },
  });
  const bounds = hazardBoundsAt(
    [object],
    { ...startBehaviour(BIRD, object, target), elapsed: 0.6 },
    object.origin,
    body(object),
    10,
    object,
  );
  expect(bounds(10.39)).toEqual(body(object));
  expect(bounds(10.4)).toBeUndefined();
  expect(bounds(9)).toBeUndefined();
  expect(bounds(Infinity)).toBeUndefined();
});
it("checks every alternative transition even when a later branch can move sooner", () => {
  const object = actor({
    ...waitingPlan(),
    pursuit,
    states: {
      chase: { ...wait, motion: chase },
      safe: wait,
      wait: {
        ...wait,
        transitions: [
          { to: "safe", when: [{ kind: "elapsed", seconds: 10 }] },
          { to: "chase", when: [{ kind: "elapsed", seconds: 0.25 }] },
        ],
      },
    },
  });
  expect(certify(object)(10.24)).toBeDefined();
  expect(certify(object)(10.25)).toBeUndefined();
});
it("retains unknown for instantaneous cycles and certificates exceeding their resource bound", () => {
  const cyclic = actor({
    ...waitingPlan(),
    states: {
      again: { ...wait, transitions: [{ to: "wait", when: [{ kind: "elapsed", seconds: 0 }] }] },
      wait: { ...wait, transitions: [{ to: "again", when: [{ kind: "visible" }] }] },
    },
  });
  expect(certify(cyclic)(11)).toBeUndefined();
  const states = Object.fromEntries(
    Array.from({ length: 130 }, (_, index) => [
      String(index),
      {
        ...wait,
        transitions:
          index < 129
            ? [{ to: String(index + 1), when: [{ kind: "elapsed" as const, seconds: 0 }] }]
            : [],
      },
    ]),
  );
  expect(certify(actor({ ...waitingPlan(), initial: "0", states }))(11)).toBeUndefined();
});
it("includes full anchored endpoints and current position instead of guessing a speed bound", () => {
  const object = actor({
    ...waitingPlan(),
    initial: "move",
    states: {
      move: { ...wait, motion: { direction: 1, kind: "move", speed: 1 } },
    },
  });
  const at = { x: -500, y: 100 };
  const state = { ...startBehaviour(BIRD, object, target), anchor: { x: 1000, y: 100 } };
  const bounds = hazardBoundsAt([object], state, at, { ...body(object), ...at }, 10, object);
  expect(bounds(10 + STEP_SECONDS)).toEqual({ height: 48, width: 1848, x: -500, y: 100 });
  at.x = 9999;
  state.anchor.x = 9999;
  state.elapsed = 9999;
  expect(bounds(10.5)).toEqual({ height: 48, width: 1848, x: -500, y: 100 });
});
it("contains whole-pixel silhouette frames when a fractional endpoint rounds outward", () => {
  const base = actor(
    {
      ...waitingPlan(),
      distance: 0.5,
      initial: "move",
      states: {
        move: { ...wait, animation: "idle", motion: { direction: 1, kind: "move", speed: 1 } },
      },
    },
    0.1,
  );
  const contact = prepareSpriteContact({
    frame: { height: 48, width: 48 },
    frames: { frame: [[0, 0, 1]] },
    tags: { idle: { frames: [{ frame: "frame", seconds: 1 }], once: false } },
  });
  const object = { ...base, contact };
  const current = { ...spriteFrameOrigin(contact.frame, object, object.origin), ...contact.frame };
  const future = spriteFrameOrigin(contact.frame, object, { ...object.origin, x: 0.6 });
  const bounds = hazardBoundsAt(
    [object],
    startBehaviour(BIRD, object, target),
    object.origin,
    current,
    10,
    object,
  )(10.1)!;
  expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(future.x + contact.frame.width);
  expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(future.y + contact.frame.height);
});
it("certifies only the waiting prefix of the actual bear graph, including pulse range", () => {
  const object = actor(layoutBehaviour(12, BEAR_BEHAVIOUR), 8424);
  const bounds = hazardBoundsAt(
    [object],
    { ...startBehaviour(BIRD, object, target), elapsed: 20 },
    object.origin,
    body(object),
    10,
    object,
  );
  expect(bounds(11)).toEqual({ height: 1056, width: 1056, x: 7920, y: -404 });
  expect(bounds(11.34)).toBeDefined();
  expect(bounds(11.35)).toBeUndefined();
  expect(
    hazardBoundsAt(
      [object],
      { ...startBehaviour(BIRD, object, target), stateKey: "prepare-growl" },
      object.origin,
      body(object),
      10,
      object,
    )(10.1),
  ).toBeUndefined();
});
it("explores movement after an escape reset and earliest reacquisition within the horizon", () => {
  const object = actor({
    ...waitingPlan(),
    initial: "reset",
    pursuit,
    states: {
      escaped: { ...wait, motion: chase },
      move: { ...wait, motion: { direction: 1, kind: "move", speed: 60 } },
      reset: { ...wait, transitions: [{ to: "move", when: [{ kind: "elapsed", seconds: 0.2 }] }] },
      tell: { ...wait, transitions: [{ to: "escaped", when: [{ kind: "pursuit-ended" }] }] },
    },
  });
  const snapshot = { ...startBehaviour(BIRD, object, target), elapsed: 0.8, stateKey: "tell" };
  const bounds = hazardBoundsAt([object], snapshot, object.origin, body(object), 10, object);
  expect(bounds(10.19)).toEqual(body(object));
  expect(bounds(10.2)).toBeUndefined();
});
it("retains unknown for an actual escaped actor that resets and moves after reacquisition", () => {
  const object = actor({
    ...waitingPlan(),
    initial: "reset",
    pursuit,
    states: {
      chase: { ...wait, motion: chase },
      move: { ...wait, motion: { direction: 1, kind: "move", speed: 60 } },
      reset: { ...wait, transitions: [{ to: "move", when: [{ kind: "visible" }] }] },
    },
  });
  const bird = startBird(BIRD, { x: 200, y: 148 });
  const escaped = {
    ...startBehaviour(BIRD, object, bird),
    elapsed: 10,
    pursuit: { phase: "escaped" as const, settled: false, unreachableSeconds: 0 },
  };
  const world = {
    chunks: [{ width: 1000, x: 0 }],
    solids: [{ height: 100, width: 1000, x: 0, y: 148 }],
    traversalFrame: {
      bounds: { height: 400, width: 1000, x: 0, y: 0 },
      dtSeconds: STEP_SECONDS,
      platforms: [],
      timeSeconds: 10,
    },
    view: { height: 400, width: 1000, x: 0, y: 0 },
  };
  const reset = stepBehaviour(BIRD, object, world, STEP_SECONDS, bird, object.origin, escaped);
  expect(reset.at).toEqual(object.origin);
  expect(reset.state.stateKey).toBe("reset");
  expect(reset.state.elapsed).toBe(STEP_SECONDS);
  expect(reset.state.anchor).toEqual(object.origin);
  expect(reset.state.pursuit?.settled).toBe(true);
  const engaged = stepBehaviour(BIRD, object, world, STEP_SECONDS, bird, reset.at, reset.state);
  expect(engaged.state.pursuit?.phase).toBe("engaged");
  expect(engaged.at.x).toBeGreaterThan(reset.at.x);
  expect(
    hazardBoundsAt(
      [object],
      escaped,
      object.origin,
      body(object),
      10,
      object,
    )(10 + 2 * STEP_SECONDS),
  ).toBeUndefined();
});
it("preserves earlier possible movement before a guaranteed escaped guard", () => {
  const object = actor({
    ...waitingPlan(),
    initial: "reset",
    pursuit,
    states: {
      escaped: {
        ...wait,
        motion: chase,
        transitions: [
          { to: "move", when: [{ kind: "nearby", range: 100 }] },
          { to: "reset", when: [{ kind: "pursuit-ended" }] },
        ],
      },
      move: { ...wait, motion: { direction: 1, kind: "move", speed: 60 } },
      reset: wait,
      tell: { ...wait, transitions: [{ to: "escaped", when: [{ kind: "pursuit-ended" }] }] },
    },
  });
  const state = { ...startBehaviour(BIRD, object, target), stateKey: "tell" };
  expect(
    hazardBoundsAt([object], state, object.origin, body(object), 10, object)(10.1),
  ).toBeUndefined();
});
it("does not certify active pursuit, carried traversal or a watchdog that could become eligible", () => {
  const object = actor({
    ...waitingPlan(),
    idleWatchdog: {
      distance: 100,
      maxAttempts: 2,
      minMovement: 2,
      resume: "chase",
      seconds: 2,
    },
    pursuit,
    states: { chase: { ...wait, motion: chase }, wait },
  });
  const state = startBehaviour(BIRD, object, target);
  const bounds = (next: typeof state) =>
    hazardBoundsAt([object], next, object.origin, body(object), 10, object);
  expect(
    bounds({ ...state, pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 } })(
      10.1,
    ),
  ).toBeUndefined();
  expect(
    bounds({
      ...state,
      traversal: {
        geometry: "",
        inputs: [],
        physical: {
          ...object.origin,
          fallFromY: 148,
          grounded: true,
          supportId: object,
          vy: 0,
        },
        status: "found",
        target: body(object),
      },
    })(10.1),
  ).toBeUndefined();
  const idle = bounds({ ...state, idleWatchdog: { anchor: object.origin, seconds: 1.9 } });
  expect(idle(10.09)).toBeDefined();
  expect(idle(10.1)).toBeUndefined();
});
it("includes initial-state escape settling and rejects unsupported entry actions", () => {
  const object = actor({
    ...waitingPlan(),
    initial: "move",
    pursuit,
    states: {
      move: { ...wait, motion: { direction: 1, kind: "move", speed: 100 } },
      wait,
    },
  });
  const state = { ...startBehaviour(BIRD, object, target), stateKey: "wait" };
  expect(
    hazardBoundsAt([object], state, object.origin, body(object), 10, object)(10.1),
  ).toBeUndefined();
  const spawning = actor({
    ...waitingPlan(),
    states: {
      wait: {
        ...wait,
        onEnter: [
          {
            armSeconds: 0,
            character: "fixture",
            gravity: 0,
            kind: "spawn",
            lifeSeconds: 1,
            maxAlive: 1,
            offset: { x: 0, y: 0 },
            velocity: { x: 100, y: 0 },
          },
        ],
      },
    },
  });
  expect(certify(spawning)(10.1)).toBeUndefined();
});
it("requires uncertainty for a mover that can enter the query, despite its current distance", () => {
  const mover = actor(
    {
      ...waitingPlan(),
      initial: "move",
      states: {
        move: { ...wait, motion: { direction: 1, kind: "move", speed: 100 } },
      },
    },
    0,
  );
  const pursuer = actor(
    { ...waitingPlan(), initial: "chase", pursuit, states: { chase: { ...wait, motion: chase } } },
    250,
  );
  const rect = body(mover);
  const context = (boundsAt?: (end: number) => Rect | undefined) =>
    traversalContext(
      {
        hazards: [{ owner: mover, rect, ...(boundsAt && { boundsAt }) }],
        solids: [],
        traversalFrame: {
          bounds: { height: 1000, width: 12000, x: 0, y: 0 },
          dtSeconds: STEP_SECONDS,
          platforms: [],
          timeSeconds: 10,
        },
      },
      STEP_SECONDS,
      pursuer,
      chase,
    )!;
  const query = { height: 48, width: 48, x: 250, y: 100 };
  expect(
    context(certify(mover)).sampleColliders(10 + STEP_SECONDS, STEP_SECONDS, query).complete,
  ).toBe(false);
  const remote = { ...query, x: 1000 };
  expect(context().sampleColliders(10 + STEP_SECONDS, STEP_SECONDS, remote).complete).toBe(false);
  const old = context().sampleColliders(10 + STEP_SECONDS, STEP_SECONDS, remote);
  const certified = context(certify(mover)).sampleColliders(
    10 + STEP_SECONDS,
    STEP_SECONDS,
    remote,
  );
  expect(certified).toEqual({ ...old, complete: true });
  expect(context(certify(mover)).sampleColliders(10, STEP_SECONDS, query).complete).toBe(true);
});
it("keeps inclusive query boundaries uncertain and rejects malformed bounds", () => {
  const mover = actor(waitingPlan(), 0);
  const pursuer = actor({
    ...waitingPlan(),
    initial: "chase",
    pursuit,
    states: { chase: { ...wait, motion: chase } },
  });
  const context = (boundsAt: (end: number) => Rect | undefined) =>
    traversalContext(
      {
        hazards: [{ boundsAt, owner: mover, rect: body(mover) }],
        solids: [],
        traversalFrame: {
          bounds: { height: 1000, width: 12000, x: 0, y: 0 },
          dtSeconds: STEP_SECONDS,
          platforms: [],
          timeSeconds: 10,
        },
      },
      STEP_SECONDS,
      pursuer,
      chase,
    )!;
  const query = { height: 48, width: 48, x: 48 + EDGE / 2, y: 100 };
  expect(context(certify(mover)).sampleColliders(10.1, STEP_SECONDS, query).complete).toBe(false);
  expect(
    context(() => ({ ...body(mover), x: NaN })).sampleColliders(10.1, STEP_SECONDS, query).complete,
  ).toBe(false);
});
it("rejects required support waits reached normally or through an escaped branch", () => {
  const required = { ...wait, motion: { kind: "wait", support: "required" } } as const;
  const object = actor({
    ...waitingPlan(),
    states: {
      required,
      wait: {
        ...wait,
        transitions: [{ to: "required", when: [{ kind: "elapsed", seconds: 0.1 }] }],
      },
    },
  });
  expect(certify(object)(10.09)).toBeDefined();
  expect(certify(object)(10.1)).toBeUndefined();
  const escaping = actor({
    ...waitingPlan(),
    initial: "reset",
    pursuit,
    states: {
      required,
      reset: wait,
      tell: { ...wait, transitions: [{ to: "required", when: [{ kind: "pursuit-ended" }] }] },
    },
  });
  const state = { ...startBehaviour(BIRD, escaping, target), stateKey: "tell" };
  expect(
    hazardBoundsAt([escaping], state, escaping.origin, body(escaping), 10, escaping)(10.1),
  ).toBeUndefined();
});
it("keeps a supported landing unknown when the real carrier moves a waiting body", () => {
  const object = actor({
    ...waitingPlan(),
    states: {
      wait: { ...wait, motion: { kind: "wait", support: "required" } },
    },
  });
  const owner = { ...object, character: "perch", collision: "ledge" as const };
  const before = { height: 10, width: 100, x: 80, y: 148 };
  const after = { ...before, x: 90, y: 138 };
  const state = {
    ...startBehaviour(BIRD, object, target),
    landing: {
      speed: 40,
      status: "supported" as const,
      support: { localX: 20, owner, rect: before },
    },
    pendingEntry: false,
  };
  const world = {
    platforms: [{ collision: "ledge" as const, owner, rect: before }],
    solids: [],
    traversalFrame: {
      bounds: { height: 400, width: 1000, x: 0, y: 0 },
      dtSeconds: 0.1,
      platforms: [{ after, before, collision: "ledge" as const, owner }],
      timeSeconds: 0,
    },
  };
  const carried = stepBehaviour(BIRD, object, world, 0.1, target, object.origin, state);
  expect(carried.at).toEqual({ x: 110, y: 90 });
  expect(
    hazardBoundsAt([object, owner], state, object.origin, body(object), 0, object)(0.1),
  ).toBeUndefined();
});
