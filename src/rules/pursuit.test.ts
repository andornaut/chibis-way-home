import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type {
  Archetype,
  BehaviourPlan,
  ObjectLayout,
  Point,
  Rect,
  ZoneLayout,
} from "../data/types";
import { BIRD_FRAME } from "../view/bird";
import { type BehaviourState, layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import type { BehaviourWorld } from "./behaviourReach";
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
const world: BehaviourWorld = { solids: [floor], view: { height: 360, width: 720, x: 0, y: 0 } };
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
  return objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: { actor: { archetype: "actor", art: "actor", behaviour, cols: 20, rows: 20 } },
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
          chunks: [],
          entries: { start: { x: 400, y: 136 } },
          exitX: 3000,
          height: 720,
          objects: [object, refuge],
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
    expect(seen.barks).toEqual([object.behaviour!.spotted]);
    const fled = stepZone(BIRD, layout, STEP_SECONDS, input, seen);
    expect(fled.barks).toEqual([escaped]);
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
    expect(retry.behaviours[0]?.pursuit).toBeUndefined();
    expect(stepZone(BIRD, layout, STEP_SECONDS, input, retry).barks).toEqual([
      object.behaviour!.spotted,
    ]);
  });
});
