import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, BehaviourNode, BehaviourPlan } from "../data/types";
import { layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import { attackReady, type BehaviourAttackState, enterAttack } from "./behaviourAttack";
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
const wait = { kind: "wait" } as const;
const phase = (value: "tell" | "committed" | "completed") => ({ id: "burst", phase: value });
const shot = (to: string): BehaviourNode => ({
  animation: null,
  attack: phase("committed"),
  motion: wait,
  onEnter: [
    {
      armSeconds: 0,
      character: "block",
      gravity: 0,
      kind: "spawn",
      lifeSeconds: 1,
      maxAlive: 3,
      offset: { x: 0, y: 0 },
      velocity: { x: 0, y: 1 },
    },
  ],
  transitions: [{ to, when: [{ kind: "elapsed", seconds: 0.1 }] }],
});
const plan: BehaviourPlan = {
  attackCooldownSeconds: 0.5,
  axis: "x",
  distance: 500,
  initial: "chase",
  states: {
    chase: {
      animation: null,
      motion: { direction: 1, kind: "move", speed: 10 },
      transitions: [{ to: "tell", when: [{ kind: "attack-ready" }] }],
    },
    completed: {
      animation: null,
      attack: phase("completed"),
      motion: wait,
      transitions: [{ to: "chase", when: [{ kind: "elapsed", seconds: 0 }] }],
    },
    first: shot("second"),
    return: {
      animation: null,
      attack: phase("committed"),
      motion: { direction: -1, kind: "move", speed: 10 },
      transitions: [{ to: "completed", when: [{ kind: "elapsed", seconds: 0.2 }] }],
    },
    second: shot("third"),
    tell: {
      animation: null,
      attack: phase("tell"),
      motion: wait,
      transitions: [{ to: "first", when: [{ kind: "elapsed", seconds: 0.5 }] }],
    },
    third: shot("return"),
  },
};
function fixture(behaviour = plan) {
  const object = objectLayout(
    1,
    {
      archetypes: { actor: archetype },
      characters: {
        actor: { archetype: "actor", art: "actor", behaviour, cols: 10, rows: 10 },
        block: { archetype: "actor", art: "block", cols: 1, rows: 1 },
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col: 100, row: 100 },
  );
  const target = startBird(BIRD, { x: 300, y: 110 });
  return { object, target };
}
it("completes one three-shot burst and its return before cooldown, while moving during cooldown", () => {
  const { object, target } = fixture();
  const state = startBehaviour(BIRD, object, target);
  const result = stepBehaviour(BIRD, object, [], 1.25, target, object.origin, state);
  expect(result.actions).toHaveLength(3);
  expect(result.actions.map(({ time }) => time)).toEqual([0.5, 0.6, 0.7]);
  expect(result.state.activeAttack).toBeUndefined();
  expect(result.state.attackCooldownRemainingSeconds).toBeCloseTo(0.25);
  expect(result.state.stateKey).toBe("chase");
  expect(result.at.x).toBeGreaterThan(object.origin.x);
  const tell = stepBehaviour(BIRD, object, [], 0.25, target, result.at, result.state);
  expect(tell.actions).toHaveLength(0);
  expect(tell.state.activeAttack).toEqual({ id: "burst", phase: "tell" });
  const next = stepBehaviour(BIRD, object, [], 0.5, target, tell.at, tell.state);
  expect(next.actions).toHaveLength(1);
});
it("does not advance cooldown during an inactive actor step", () => {
  const { object, target } = fixture();
  const state = {
    ...startBehaviour(BIRD, object, target),
    active: false,
    attackCooldownRemainingSeconds: 0.5,
  };
  expect(
    stepBehaviour(BIRD, object, [], 1, target, object.origin, state).state
      .attackCooldownRemainingSeconds,
  ).toBe(0.5);
});
it("cancels a precommit tell without cooldown and rejects overlapping attacks", () => {
  const telling: BehaviourAttackState = enterAttack(plan, { attack: phase("tell") }, {});
  expect(attackReady(telling)).toBe(false);
  expect(enterAttack(plan, {}, telling).activeAttack).toBeUndefined();
  expect(enterAttack(plan, {}, telling).attackCooldownRemainingSeconds).toBeUndefined();
  expect(() => enterAttack(plan, { attack: { id: "other", phase: "tell" } }, telling)).toThrow(
    /overlap/,
  );
});
it("rejects a committed graph exit that omits its completed boundary", () => {
  expect(() =>
    layoutBehaviour(1, {
      ...plan,
      states: {
        ...plan.states,
        return: {
          ...plan.states.return!,
          transitions: [{ to: "chase", when: [{ kind: "elapsed", seconds: 0.2 }] }],
        },
      },
    }),
  ).toThrow(/completed boundary/);
});

it.each(["tell", "return"] as const)(
  "finishes protected %s before automatic escaped settlement",
  (initial) => {
    const { object, target } = fixture({
      ...plan,
      initial,
      pursuit: {
        distance: 1000,
        escapeDistance: 1,
        escaped: { line: "escaped", speaker: "speaker" },
        unreachableGraceSeconds: null,
      },
      states: {
        ...plan.states,
        flyGateway: {
          animation: null,
          motion: { kind: "pursue", mode: "fly", speed: 10 },
          transitions: [],
        },
      },
    });
    const state = {
      ...startBehaviour(BIRD, object, target),
      activeAttack: {
        id: "burst",
        phase: initial === "tell" ? ("tell" as const) : ("committed" as const),
      },
    };
    const result = stepBehaviour(
      BIRD,
      object,
      { chunks: [{ width: 720, x: 0 }], solids: [], view: { height: 360, width: 720, x: 0, y: 0 } },
      0.1,
      target,
      object.origin,
      state,
    );
    expect(result.state.stateKey).toBe(initial);
    expect(result.state.pursuit?.phase).toBe("escaped");
    expect(result.state.pursuit?.settled).toBe(false);
    expect(result.state.activeAttack?.phase).toBe(state.activeAttack.phase);
  },
);
