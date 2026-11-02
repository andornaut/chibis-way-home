import { describe, expect, it } from "vitest";

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
import type {
  Archetype,
  BehaviourPlan,
  ObjectLayout,
  Point,
  Rect,
  ZoneLayout,
} from "../data/types";
import { BIRD_FRAME } from "../view/bird";
import {
  type BehaviourState,
  contactBox,
  layoutBehaviour,
  startBehaviour,
  stepBehaviour,
} from "./behaviour";
import { type BehaviourWorld, flightContactApproach } from "./behaviourReach";
import { startBird } from "./bird";
import { STEP_SECONDS } from "./step";
import { objectLayout } from "./tiles";
import { retryZone, startZone, stepZone } from "./zone";

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
const escaped = { line: "escaped", speaker: "actor" };
const floor: Rect = { height: 100, width: 4000, x: -1000, y: 300 };
const world: BehaviourWorld = {
  chunks: [{ width: 4000, x: -1000 }],
  solids: [floor],
  view: { height: 360, width: 720, x: 0, y: 0 },
};
const bird = (x: number, y = floor.y - BIRD.height) => ({
  ...startBird(BIRD, { x: x + BIRD.width / 2, y: y + BIRD.height }),
  grounded: y === floor.y - BIRD.height,
});
function plan(mode: "ground" | "fly" = "ground"): BehaviourPlan {
  return {
    axis: "x",
    distance: -20,
    initial: "watch",
    pursuit: { distance: 2160, escaped, unreachableGraceSeconds: 3 },
    states: {
      chase: { animation: "walk", motion: { kind: "pursue", mode, speed: 100 }, transitions: [] },
      watch: {
        animation: "idle",
        motion: { kind: "wait" },
        transitions: [{ to: "chase", when: [{ kind: "visible" }] }],
      },
    },
  };
}
function actor(behaviour = plan()): ObjectLayout {
  const projectiles = Object.fromEntries(
    Object.values(behaviour.states).flatMap((node) =>
      (node.onEnter ?? []).flatMap((action) =>
        action.kind === "spawn"
          ? [[action.character, { archetype: "actor", art: "projectile", cols: 1, rows: 1 }]]
          : [],
      ),
    ),
  );
  return objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: {
        ...projectiles,
        actor: { archetype: "actor", art: "actor", behaviour, cols: 20, rows: 20 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 100, row: 280 },
  );
}
function advance(
  object: ObjectLayout,
  target: ReturnType<typeof bird>,
  seconds: number,
  at = object.origin,
  state = startBehaviour(BIRD, object, target),
  geometry = world,
) {
  return stepBehaviour(BIRD, object, geometry, seconds, target, at, state);
}

describe("persistent pursuit", () => {
  it("resolves distance and speed but retains authored seconds", () => {
    const resolved = layoutBehaviour(12, plan());
    expect(resolved.pursuit).toEqual({ distance: 25920, escaped, unreachableGraceSeconds: 3 });
    expect(resolved.states.chase!.motion).toEqual({ kind: "pursue", mode: "ground", speed: 1200 });
    expect(() =>
      layoutBehaviour(12, {
        ...plan(),
        pursuit: { distance: 0, escaped, unreachableGraceSeconds: 3 },
      }),
    ).toThrow("Invalid pursuit");
  });
  it.each(["ground", "fly"] as const)(
    "actually chases beyond the old local track in %s mode",
    (mode) => {
      const object = actor(plan(mode));
      const first = advance(object, bird(450), 0.5);
      expect(first.at.x).toBeGreaterThan(object.origin.x);
      const second = advance(object, bird(900), 1, first.at, first.state, {
        ...world,
        view: { ...world.view!, x: 1000 },
      });
      expect(second.at.x).toBeGreaterThan(first.at.x);
      expect(second.state.pursuit?.phase).toBe("engaged");
      expect(second.escaped).toBeUndefined();
      expect(object.origin).toEqual({ x: 100, y: 280 });
    },
  );
  it("acquires without reachability and measures continuous unreachable time, resetting on recovery", () => {
    const object = actor();
    const high = { ...bird(400, 100), grounded: true };
    const geometry: BehaviourWorld = {
      ...world,
      platforms: [
        {
          collision: "ledge",
          owner: { ...object },
          rect: { height: 20, width: 200, x: 350, y: 136 },
        },
      ],
    };
    let result = advance(object, high, 1, object.origin, undefined, geometry);
    expect(result.state.pursuit?.phase).toBe("engaged");
    expect(result.escaped).toBeUndefined();
    result = advance(object, bird(400), 0.1, result.at, result.state, geometry);
    expect(result.state.pursuit?.unreachableSeconds).toBe(0);
    result = advance(object, high, 2.9, result.at, result.state, geometry);
    expect(result.escaped).toBeUndefined();
    result = advance(object, high, 0.1, result.at, result.state, geometry);
    expect(result.escaped).toEqual(escaped);
    expect(result.state.pursuit?.phase).toBe("escaped");
    expect(advance(object, high, 4, result.at, result.state, geometry).escaped).toBeUndefined();
  });
  it("does not rearm while visibly unreachable, but reengages on reachable return inside the original leash", () => {
    const object = actor();
    const high = { ...bird(400, 100), grounded: true };
    const geometry: BehaviourWorld = {
      ...world,
      platforms: [
        {
          collision: "ledge",
          owner: { ...object },
          rect: { height: 20, width: 200, x: 350, y: 136 },
        },
      ],
    };
    const first = advance(object, high, 3, object.origin, undefined, geometry);
    const held = advance(object, high, 4, first.at, first.state, geometry);
    expect(held.state.pursuit?.phase).toBe("escaped");
    expect(held.escaped).toBeUndefined();
    const restored = advance(object, bird(500), 0.1, held.at, held.state, geometry);
    expect(restored.state.pursuit?.phase).toBe("engaged");
    expect(restored.at.x).toBeGreaterThan(held.at.x);
  });
  it("rearms a settled boss only in its current chunk without requiring a camera view", () => {
    const object = actor();
    const target = bird(400);
    const state = {
      ...startBehaviour(BIRD, object, target),
      pursuit: { phase: "escaped" as const, settled: true, unreachableSeconds: 3 },
    };
    const different = advance(object, target, 0.1, object.origin, state, {
      chunks: [
        { width: 200, x: 0 },
        { width: 600, x: 200 },
      ],
      solids: [floor],
    });
    expect(different.state.pursuit?.phase).toBe("escaped");
    const same = advance(object, target, 0.1, object.origin, state, {
      chunks: [{ width: 800, x: 0 }],
      solids: [floor],
    });
    expect(same.state.pursuit?.phase).toBe("engaged");
    expect(same.at.x).toBeGreaterThan(object.origin.x);
  });
  it("keeps an airborne bird reachable over the same support and ignores a brief occlusion", () => {
    const object = actor();
    const seen = advance(object, bird(400), 0.1);
    const jumped = advance(object, bird(400, 200), 0.5, seen.at, seen.state);
    expect(jumped.state.pursuit?.unreachableSeconds).toBe(0);
    const wall = { height: 100, width: 20, x: 300, y: 200 };
    const hidden = advance(object, bird(400), 0.5, jumped.at, jumped.state, {
      ...world,
      solids: [floor, wall],
    });
    expect(hidden.state.pursuit?.phase).toBe("engaged");
    expect(hidden.escaped).toBeUndefined();
  });
  it("never walks across unsupported gaps or through solid objects", () => {
    const object = actor();
    const left = { ...floor, width: 120, x: 0 };
    const right = { ...floor, width: 500, x: 200 };
    const gap = advance(object, bird(400), 0.5, object.origin, undefined, {
      ...world,
      solids: [left, right],
    });
    expect(gap.at.x).toBe(100);
    const obstruction = { height: 100, width: 20, x: 150, y: 200 };
    const seen = advance(object, bird(400), 0.1);
    const blocked = advance(object, bird(400), 0.5, seen.at, seen.state, {
      ...world,
      platforms: [
        { collision: "solid", owner: { ...object, character: "block" }, rect: obstruction },
      ],
    });
    expect(blocked.at.x + object.width).toBeLessThanOrEqual(obstruction.x);
  });
  it("captures a local attack anchor at the actual chase departure", () => {
    const base = plan("fly");
    const object = actor({
      ...base,
      states: {
        ...base.states,
        attack: {
          animation: "fly",
          motion: { kind: "fly", speed: 100, to: { x: 0, y: -50 } },
          transitions: [],
        },
        chase: {
          ...base.states.chase!,
          transitions: [{ to: "attack", when: [{ kind: "nearby", range: 30 }] }],
        },
      },
    });
    const chase = advance(object, bird(500), 1);
    expect(chase.at.x).toBeGreaterThan(object.origin.x);
    const attack = advance(object, bird(chase.at.x), 0.1, chase.at, chase.state);
    expect(attack.state.stateKey).toBe("attack");
    expect(attack.state.anchor).toEqual(chase.at);
    expect(attack.at.x).toBe(chase.at.x);
    expect(attack.at.y).toBeCloseTo(chase.at.y - 10);
  });
  it("freezes the attack anchor through committed motion then resumes near the actual stop", () => {
    const base = plan("fly");
    const object = actor({
      ...base,
      states: {
        ...base.states,
        attack: {
          animation: "fly",
          motion: { kind: "fly", speed: 100, to: { x: 0, y: -50 } },
          transitions: [{ to: "return", when: [{ kind: "arrived", tolerance: 0 }] }],
        },
        return: {
          animation: "fly",
          motion: { kind: "fly", speed: 100, to: { x: 0, y: 0 } },
          transitions: [{ to: "chase", when: [{ kind: "arrived", tolerance: 0 }] }],
        },
      },
    });
    const anchor: Point = { x: 250, y: 280 };
    const committed: BehaviourState = {
      ...startBehaviour(BIRD, object, bird(400)),
      anchor,
      elapsed: 0,
      pendingEntry: false,
      pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
      stateKey: "attack",
    };
    const first = advance(object, bird(3000), 0.25, anchor, committed);
    expect(first.escaped).toEqual(escaped);
    expect(first.at).toEqual({ x: 250, y: 255 });
    expect(first.state.anchor).toEqual(anchor);
    const landed = advance(object, bird(3000), 1, first.at, first.state);
    expect(landed.at).toEqual(anchor);
    expect(landed.state.pursuit).toMatchObject({ phase: "escaped", settled: true });
    expect(landed.state.anchor).toEqual(anchor);
  });
  it("emits escape through the shared zone engine only once and resets on retry", () => {
    const base = plan();
    const object = actor({
      ...base,
      pursuit: { ...base.pursuit!, unreachableGraceSeconds: STEP_SECONDS * 2 },
      spotted: { line: "spotted", speaker: "actor" },
    });
    const physical = { ...object };
    delete physical.behaviour;
    const refuge: ObjectLayout = {
      ...physical,
      character: "refuge",
      collision: "ledge",
      height: 20,
      origin: { x: 350, y: 136 },
      width: 200,
    };
    const layout: ZoneLayout = {
      areas: {
        main: {
          backX: -1000,
          chunks: world.chunks!,
          entries: { start: { x: 400, y: 136 } },
          exitX: 3000,
          height: 720,
          objects: [refuge, object],
          solids: [floor],
          terrain: [],
          tileset: undefined,
          width: 4000,
        },
      },
      birdFrame: BIRD_FRAME,
      start: { area: "main", entry: "start" },
    };
    const input = { jumpHeld: false, move: 0, useHeld: false } as const;
    const start = startZone(BIRD, layout, 1);
    const seen = stepZone(BIRD, layout, STEP_SECONDS, input, start);
    expect(seen.barks).toEqual([
      { ...object.behaviour!.spotted, owner: { area: "main", attempt: 0, objectIndex: 1 } },
    ]);
    const fled = stepZone(BIRD, layout, STEP_SECONDS, input, seen);
    expect(fled.barks).toEqual([
      { ...escaped, owner: { area: "main", attempt: 0, objectIndex: 1 } },
    ]);
    expect(stepZone(BIRD, layout, STEP_SECONDS, input, fled).barks).toEqual([]);
    const retry = retryZone(BIRD, layout, {
      ...fled,
      death: {
        position: { x: 400, y: 100 },
        reason: "hazard",
        support: undefined,
        velocity: { x: 0, y: 0 },
      },
    });
    expect(retry.behaviours[1]?.pursuit).toBeUndefined();
    expect(stepZone(BIRD, layout, STEP_SECONDS, input, retry).barks).toEqual([
      { ...object.behaviour!.spotted, owner: { area: "main", attempt: 1, objectIndex: 1 } },
    ]);
  });
  it.each([
    { attacks: 1, configured: true, phase: undefined, settled: false },
    { attacks: 1, configured: true, phase: "engaged" as const, settled: false },
    { attacks: 1, configured: false, phase: "escaped" as const, settled: false },
    { attacks: 1, configured: true, phase: "escaped" as const, settled: true },
    { attacks: 0, configured: true, phase: "escaped" as const, settled: false },
  ])(
    "uses authored terminal branches only during opted-in escape winddown: %j",
    ({ attacks, configured, phase, settled }) => {
      const base = plan();
      const graph = {
        ...base,
        states: {
          ...base.states,
          boundary: {
            animation: "idle",
            motion: { kind: "wait" as const },
            transitions: [
              { to: "chase", when: [{ kind: "pursuit-ended" as const }] },
              { to: "offense", when: [{ kind: "elapsed" as const, seconds: 0 }] },
            ],
          },
          chase: base.states.chase!,
          offense: {
            animation: "attack",
            motion: { kind: "wait" as const },
            onEnter: [
              {
                height: 1,
                kind: "force-pulse" as const,
                range: 10,
                seconds: 1,
                velocity: { x: 1, y: 0 },
              },
            ],
            transitions: [],
          },
        },
      };
      if (!configured) {
        delete graph.pursuit;
        // A non-pursuit graph cannot contain a pursuit movement primitive.
        graph.states.chase = { ...graph.states.chase!, motion: { kind: "wait" } };
      }
      const object = actor(graph);
      const state: BehaviourState = {
        ...startBehaviour(BIRD, object, bird(400)),
        pendingEntry: false,
        stateKey: "boundary",
        ...(phase && { pursuit: { phase, settled, unreachableSeconds: 0 } }),
      };
      const result = advance(object, bird(400), 0.1, object.origin, state, { solids: [floor] });
      expect(result.actions).toHaveLength(attacks);
      if (attacks === 0) {
        expect(result.state.stateKey).toBe(graph.initial);
        expect(result.state.pursuit).toMatchObject({ phase: "escaped", settled: true });
      }
    },
  );
  it("does not complete an initial escaped flying state in unsupported air", () => {
    const object = actor(plan("fly"));
    const at = { x: 300, y: 100 };
    const state: BehaviourState = {
      ...startBehaviour(BIRD, object, bird(3000)),
      pendingEntry: false,
      pursuit: { phase: "escaped", settled: false, unreachableSeconds: 0 },
    };
    const moving = advance(object, bird(3000), 0.25, at, state);
    expect(moving.at).toEqual({ x: 300, y: 125 });
    expect(moving.state.pursuit?.settled).toBe(false);
  });
  it("physically lands an escaped flyer before completing near-stop settlement", () => {
    const object = actor(plan("fly"));
    const at = { x: 300, y: 100 };
    const state: BehaviourState = {
      ...startBehaviour(BIRD, object, bird(3000)),
      pendingEntry: false,
      pursuit: { phase: "escaped", settled: false, unreachableSeconds: 0 },
      stateKey: "chase",
    };
    const moving = advance(object, bird(3000), 0.25, at, state);
    expect(moving.at).toEqual({ x: 300, y: 125 });
    expect(moving.state.pursuit?.settled).toBe(false);
    const landed = advance(object, bird(3000), 2, moving.at, moving.state);
    expect(landed.at).toEqual({ x: 300, y: 280 });
    expect(landed.state.anchor).toEqual(landed.at);
    expect(landed.state.pursuit?.settled).toBe(true);
    expect(landed.at.y + object.height).toBe(floor.y);
    expect(object.origin).toEqual({ x: 100, y: 280 });
  });
  it.each([
    { label: "absent support", solids: [] },
    { label: "blocked support", solids: [{ height: 40, width: 600, x: 0, y: 50 }] },
  ])("keeps an unavailable landing incomplete: $label", ({ solids }) => {
    const object = actor(plan("fly"));
    const at = { x: 300, y: 100 };
    const state: BehaviourState = {
      ...startBehaviour(BIRD, object, bird(3000)),
      pendingEntry: false,
      pursuit: { phase: "escaped", settled: false, unreachableSeconds: 0 },
      stateKey: "chase",
    };
    const result = advance(object, bird(3000), 1, at, state, { solids });
    expect(result.at).toEqual(at);
    expect(result.state.pursuit?.settled).toBe(false);
    expect(result.actions).toEqual([]);
    const available = advance(object, bird(3000), 2, result.at, result.state);
    expect(available.state.pursuit?.settled).toBe(true);
  });
  it("revalidates a moving perch and excludes its own object identity", () => {
    const object = actor(plan("fly"));
    const at = { x: 300, y: 100 };
    const state: BehaviourState = {
      ...startBehaviour(BIRD, object, bird(3000)),
      pendingEntry: false,
      pursuit: { phase: "escaped", settled: false, unreachableSeconds: 0 },
      stateKey: "chase",
    };
    const self = {
      collision: "ledge" as const,
      owner: object,
      rect: { height: 20, width: 100, x: 300, y: 200 },
    };
    const own = advance(object, bird(3000), 1, at, state, { platforms: [self], solids: [] });
    expect(own.at).toEqual(at);
    expect(own.state.pursuit?.settled).toBe(false);
    const perch = { ...self, owner: { ...object, character: "perch" } };
    const first = advance(object, bird(3000), 0.25, at, state, { platforms: [perch], solids: [] });
    expect(first.at.y).toBe(125);
    const moved = { ...perch, rect: { ...perch.rect, x: 700 } };
    const second = advance(object, bird(3000), 0.25, first.at, first.state, {
      platforms: [moved],
      solids: [],
    });
    expect(second.state.pursuit?.settled).toBe(false);
    const landed = advance(object, bird(3000), 10, second.at, second.state, {
      platforms: [moved],
      solids: [],
    });
    expect(landed.at).toEqual({ x: 700, y: 180 });
    expect(landed.state.pursuit?.settled).toBe(true);
  });
  it("selects real support clear of red contact rectangles", () => {
    const object = actor(plan("fly"));
    const at = { x: 300, y: 100 };
    const state: BehaviourState = {
      ...startBehaviour(BIRD, object, bird(3000)),
      pendingEntry: false,
      pursuit: { phase: "escaped", settled: false, unreachableSeconds: 0 },
      stateKey: "chase",
    };
    const hazard = {
      owner: { ...object, character: "red-strip" },
      rect: { height: 3, width: 50, x: 290, y: 297 },
    };
    const landed = advance(object, bird(3000), 3, at, state, { ...world, hazards: [hazard] });
    expect(landed.at).toEqual({ x: 270, y: 280 });
    expect(landed.state.pursuit?.settled).toBe(true);
  });
  it.each([
    { boundary: "prepare-pounce", graph: DOG_BEHAVIOUR, raised: false },
    { boundary: "prepare-growl", graph: BEAR_BEHAVIOUR, raised: false },
    { boundary: "prepare-throw", graph: FERRET_BEHAVIOUR, raised: false },
    { boundary: "prepare", graph: RACCOON_BEHAVIOUR, raised: true },
    { boundary: "prepare-drop-right", graph: PIGEON_BEHAVIOUR, raised: true },
    { boundary: "set-trap", graph: GOOSE_BEHAVIOUR, raised: false },
  ])(
    "completes the actual $graph.spotted.line winddown without a new attack",
    ({ boundary, graph, raised }) => {
      const resolved = layoutBehaviour(TILE, graph);
      const object = actor(resolved);
      const returnMotion = resolved.states["return-high"]?.motion;
      const offset = !raised
        ? 0
        : resolved.axis === "y"
          ? resolved.distance
          : returnMotion?.kind === "fly" && typeof returnMotion.to !== "string"
            ? returnMotion.to.y
            : 0;
      if (raised) {
        expect(offset).toBeLessThan(0);
      }
      const anchor = { x: 400, y: 280 };
      const at = { x: anchor.x, y: anchor.y + offset };
      const state: BehaviourState = {
        ...startBehaviour(BIRD, object, bird(3000)),
        anchor,
        elapsed: 0,
        pendingEntry: false,
        pursuit: { phase: "escaped", settled: false, unreachableSeconds: 0 },
        stateKey: boundary,
      };
      const result = advance(object, bird(3000), 4, at, state);
      expect(result.actions).toEqual([]);
      expect(result.state.pursuit).toMatchObject({ phase: "escaped", settled: true });
      expect(result.state.anchor).toEqual(anchor);
      expect(result.at.y + object.height).toBe(floor.y);
      expect(object.origin).toEqual({ x: 100, y: 280 });
    },
  );
});

it("scales current separation and explicitly disables timed giveup", () => {
  const resolved = layoutBehaviour(12, {
    ...plan(),
    pursuit: { ...plan().pursuit!, escapeDistance: 60, unreachableGraceSeconds: null },
  });
  expect(resolved.pursuit?.escapeDistance).toBe(720);
  expect(resolved.pursuit?.unreachableGraceSeconds).toBeNull();
});
it("stays engaged with a nearby target beyond the original planner boundary", () => {
  const object = actor({
    ...plan(),
    pursuit: {
      ...plan().pursuit!,
      distance: 20,
      escapeDistance: 120,
      unreachableGraceSeconds: null,
    },
  });
  const result = advance(object, bird(150), 0.1);
  expect(result.state.pursuit?.phase).toBe("engaged");
  expect(result.escaped).toBeUndefined();
});
it("counts vertical centre separation and never substitutes a timed unreachable escape", () => {
  const object = actor({
    ...plan(),
    pursuit: { ...plan().pursuit!, escapeDistance: 120, unreachableGraceSeconds: null },
  });
  const high = advance(object, bird(100, 100), 0.1);
  expect(high.escaped).toEqual(escaped);
  const blocked = actor({
    ...plan(),
    pursuit: { ...plan().pursuit!, escapeDistance: 1000, unreachableGraceSeconds: null },
  });
  const result = advance(blocked, bird(400), 10, blocked.origin, undefined, {
    ...world,
    solids: [
      { ...floor, width: 120 },
      { ...floor, x: 200 },
    ],
  });
  expect(result.state.pursuit?.phase).toBe("engaged");
  expect(result.state.pursuit?.unreachableSeconds).toBeGreaterThan(3);
  expect(result.escaped).toBeUndefined();
});

function floorFlightFixture() {
  const chase = plan("fly");
  const object: ObjectLayout = {
    ...actor({
      ...chase,
      states: {
        ...chase.states,
        chase: {
          ...chase.states.chase!,
          transitions: [{ to: "lost", when: [{ kind: "lost-target", tolerance: 0 }] }],
        },
        lost: { animation: "idle", motion: { kind: "wait" }, transitions: [] },
      },
    }),
    height: 48,
    hitbox: { height: 46, width: 44, x: 2, y: 2 },
    origin: { x: 3336, y: 792 },
    width: 48,
  };
  const geometry: BehaviourWorld = {
    chunks: [{ width: 720, x: 2880 }],
    solids: [
      { height: 480, width: 456, x: 2880, y: 960 },
      { height: 600, width: 48, x: 3336, y: 840 },
    ],
    view: { height: 360, width: 720, x: 2880, y: 720 },
  };
  const target = bird(3096, 924);
  return { geometry, object, target };
}

it("accepts contact overlap when terrain clips flight five pixels before centre alignment", () => {
  const { geometry, object, target } = floorFlightFixture();
  const box = { height: BIRD.height, width: BIRD.width, x: target.x, y: target.y };
  const approach = flightContactApproach(
    geometry,
    object,
    object.origin,
    contactBox(object, object.origin, 1),
    box,
  );
  expect(approach).toEqual({ x: 3084, y: 912 });
  expect(approach!.y + object.height).toBe(960);
  const result = advance(object, target, STEP_SECONDS, object.origin, undefined, geometry);
  expect(result.state.stateKey).toBe("chase");
  expect(result.at.x).toBeLessThan(object.origin.x);
});

it("does not call a terrain-blocked non-overlapping flight endpoint reachable", () => {
  const { geometry, object, target } = floorFlightFixture();
  const blocked = {
    ...geometry,
    solids: [...geometry.solids, { height: 300, width: 48, x: 3200, y: 700 }],
  };
  expect(
    flightContactApproach(blocked, object, object.origin, contactBox(object, object.origin, 1), {
      height: BIRD.height,
      width: BIRD.width,
      x: target.x,
      y: target.y,
    }),
  ).toBeUndefined();
  const result = advance(object, target, STEP_SECONDS, object.origin, undefined, blocked);
  expect(result.state.stateKey).toBe("lost");
  expect(result.at).toEqual(object.origin);
});

it("retains hazard safety along the real clipped approach sweep", () => {
  const { geometry, object, target } = floorFlightFixture();
  const hazard = { ...object, character: "hazard" };
  expect(
    flightContactApproach(
      {
        ...geometry,
        hazards: [{ owner: hazard, rect: { height: 80, width: 10, x: 3200, y: 780 } }],
      },
      object,
      object.origin,
      contactBox(object, object.origin, 1),
      { height: BIRD.height, width: BIRD.width, x: target.x, y: target.y },
    ),
  ).toBeUndefined();
});

it.each([-1, 1] as const)(
  "uses the already-resolved asymmetric contact offset facing %i without reflecting it twice",
  (facing) => {
    const { geometry, object: base, target } = floorFlightFixture();
    const object = { ...base, hitbox: { ...base.hitbox!, width: 38, x: 4 } };
    const approach = flightContactApproach(
      geometry,
      object,
      object.origin,
      contactBox(object, object.origin, facing),
      { height: BIRD.height, width: BIRD.width, x: target.x, y: target.y },
    );
    expect(approach).toEqual({ x: facing === 1 ? 3085 : 3083, y: 912 });
  },
);
