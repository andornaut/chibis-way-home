import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, BehaviourPlan, Rect } from "../data/types";
import { layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import { startBird } from "./bird";
import { objectLayout } from "./tiles";

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
function fixture(width = 500) {
  const behaviour: BehaviourPlan = {
    axis: "x",
    distance: 500,
    initial: "align",
    pursuit: {
      distance: 1000,
      escaped: { line: "escaped", speaker: "fixture" },
      unreachableGraceSeconds: 3,
    },
    states: {
      align: {
        animation: null,
        motion: {
          bounds: { height: 200, width, x: -20, y: -100 },
          kind: "fly",
          leadSeconds: 0.1,
          maxLead: 12,
          speed: 200,
          to: "target-x",
        },
        transitions: [
          { to: "pursuit", when: [{ kind: "alignment-blocked" }] },
          { to: "drop", when: [{ kind: "arrived", tolerance: 0.001 }, { kind: "line-of-sight" }] },
          { to: "pursuit", when: [{ kind: "arrived", tolerance: 0.001 }] },
        ],
      },
      drop: {
        animation: null,
        motion: { kind: "wait" },
        onEnter: [
          {
            armSeconds: 0,
            character: "projectile",
            gravity: 100,
            kind: "spawn",
            lifeSeconds: 1,
            maxAlive: 1,
            offset: { x: 9, y: 20 },
            velocity: { x: 0, y: 100 },
          },
        ],
        transitions: [],
      },
      pursuit: { animation: null, motion: { kind: "wait" }, transitions: [] },
    },
  };
  const object = objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: {
        actor: { archetype: "actor", art: "actor", behaviour, cols: 20, rows: 20 },
        projectile: { archetype: "actor", art: "projectile", cols: 2, rows: 2 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 100, row: 100 },
  );
  return { behaviour, object };
}
const target = (x: number, y = 300, vx = 0) => ({
  ...startBird(BIRD, { x, y }),
  grounded: true,
  vx,
});
const world = (solids: readonly Rect[] = []) => ({
  solids,
  view: { height: 360, width: 720, x: 0, y: 0 },
});
it("resolves explicit lead distance while preserving seconds", () => {
  const { behaviour } = fixture();
  expect(layoutBehaviour(12, behaviour).states.align!.motion).toMatchObject({
    leadSeconds: 0.1,
    maxLead: 144,
    speed: 2400,
    to: "target-x",
  });
});
it("follows current horizontal movement with clamped lead while retaining entry height", () => {
  const { object } = fixture();
  const first = target(150, 300, 500);
  const state = {
    ...startBehaviour(BIRD, object, first),
    pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
  };
  const moved = stepBehaviour(BIRD, object, world(), 0.1, first, object.origin, state);
  expect(moved.at).toEqual({ x: 120, y: 100 });
  const current = target(250, 240, 500);
  const followed = stepBehaviour(BIRD, object, world(), 0.1, current, moved.at, moved.state);
  expect(followed.at).toEqual({ x: 140, y: 100 });
  expect(followed.actions).toEqual([]);
  const arrived = stepBehaviour(BIRD, object, world(), 1, current, followed.at, followed.state);
  expect(arrived.at).toEqual({ x: 252, y: 100 });
  expect(arrived.actions).toHaveLength(1);
  expect(arrived.actions[0]!.action).toMatchObject({ kind: "spawn", velocity: { x: 0, y: 100 } });
});
it.each(["outside", "solid"] as const)(
  "returns to pursuit instead of firing at a %s-clipped alignment",
  (kind) => {
    const { object } = fixture(kind === "outside" ? 80 : 500);
    const current = target(250, 300, 500);
    const state = {
      ...startBehaviour(BIRD, object, current),
      pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
    };
    const solids = kind === "solid" ? [{ height: 80, width: 20, x: 170, y: 80 }] : [];
    const result = stepBehaviour(BIRD, object, world(solids), 1, current, object.origin, state);
    expect(result.state.stateKey).toBe("pursuit");
    expect(result.actions).toEqual([]);
    expect(result.at).toEqual(object.origin);
  },
);
it("requires fresh line of sight before a vertically aligned drop despite engaged acquisition", () => {
  const { object } = fixture();
  const current = target(110);
  const state = {
    ...startBehaviour(BIRD, object, current),
    pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
  };
  const result = stepBehaviour(
    BIRD,
    object,
    world([{ height: 12, width: 100, x: 80, y: 200 }]),
    0.1,
    current,
    object.origin,
    state,
  );
  expect(result.state.stateKey).toBe("pursuit");
  expect(result.actions).toEqual([]);
});
