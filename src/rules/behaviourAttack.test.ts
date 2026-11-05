import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, BehaviourNode, BehaviourPlan } from "../data/types";
import { layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import {
  advanceAttackClock,
  attackReady,
  type BehaviourAttackState,
  canEnterAttack,
  clearTellCancels,
  enterAttack,
} from "./behaviourAttack";
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

const PAUSE = { cancels: 2, seconds: 1.5 } as const;
const paused = { ...plan, tellCancelPause: PAUSE };
const tell = { attack: phase("tell") };
type PursuedState = BehaviourAttackState & { readonly pursuit?: { readonly phase: string } };
const engaged: PursuedState = { pursuit: { phase: "engaged" } };
type Move = "cancel" | "commit" | "escape-cancel" | "escape";
const apply = (state: PursuedState, move: Move): PursuedState => {
  if (move === "escape") {
    return clearTellCancels(state);
  }
  const told = enterAttack(paused, tell, state);
  if (move === "commit") {
    return enterAttack(paused, { attack: phase("committed") }, told);
  }
  return enterAttack(
    paused,
    {},
    move === "escape-cancel" ? { ...told, pursuit: { phase: "escaped" } } : told,
  );
};

it.each([
  ["one cancel counts", ["cancel"], { cancelledTells: 1 }],
  ["a second cancel starts the pause and resets the count", ["cancel", "cancel"], { pause: 1.5 }],
  ["a commit resets the count", ["cancel", "commit"], {}],
  ["an escape resets the count and the pause", ["cancel", "cancel", "escape"], {}],
  ["a cancel caused by escape does not count", ["escape-cancel"], {}],
] as const)("tell cancel pause: %s", (_, moves, expected) => {
  let state = engaged;
  for (const move of moves) {
    state = apply(state, move);
  }
  expect(state.cancelledTells).toBe(
    "cancelledTells" in expected ? expected.cancelledTells : undefined,
  );
  expect(state.tellPauseRemainingSeconds).toBe("pause" in expected ? expected.pause : undefined);
  expect(state.attackCooldownRemainingSeconds).toBeUndefined();
});

it("holds tells and not pursuit for the pause, which is not cooldown", () => {
  const state = apply(apply(engaged, "cancel"), "cancel");
  expect(attackReady(state)).toBe(false);
  expect(canEnterAttack(tell, state)).toBe(false);
  expect(canEnterAttack({}, state)).toBe(true);
  expect(attackReady(advanceAttackClock(1.25, state))).toBe(false);
  const ended = advanceAttackClock(0.25, advanceAttackClock(1.25, state));
  expect(ended.tellPauseRemainingSeconds).toBeUndefined();
  expect(attackReady(ended)).toBe(true);
  // The count restarts after the pause: one more cancel does not pause again.
  expect(apply(ended, "cancel")).toMatchObject({ cancelledTells: 1 });
});

it("pursues through the pause and tells again when it ends", () => {
  const { object, target } = fixture({
    ...paused,
    states: {
      ...plan.states,
      tell: {
        ...plan.states.tell!,
        transitions: [{ to: "chase", when: [{ kind: "elapsed", seconds: 0.5 }] }],
      },
    },
  });
  let state = startBehaviour(BIRD, object, target);
  let at = object.origin;
  const telling: boolean[] = [];
  for (let step = 0; step < 10; step++) {
    ({ at, state } = stepBehaviour(BIRD, object, [], 0.25, target, at, state));
    telling.push(state.activeAttack?.phase === "tell");
    if (step === 3) {
      // Tells cancel at 0.5 s and 1 s; the second starts the pause.
      expect(state.tellPauseRemainingSeconds).toBe(1.5);
      expect(state.stateKey).toBe("chase");
    }
  }
  // No tell from 1 s until the pause ends at 2.5 s, when the next tell starts.
  expect(telling).toEqual([true, true, true, false, false, false, false, false, false, true]);
  expect(at.x).toBeGreaterThan(object.origin.x);
});

const retell = (to: string): BehaviourNode => ({
  animation: null,
  attack: { continues: true, id: "burst", phase: "tell" },
  motion: wait,
  transitions: [{ to, when: [{ kind: "elapsed", seconds: 0.3 }] }],
});
const withStates = (states: Record<string, BehaviourNode>) => ({
  ...plan,
  states: { ...plan.states, ...states },
});

it.each([
  [
    "committed to its continuing tell to committed",
    { again: retell("second"), first: shot("again") },
    undefined,
  ],
  [
    "a continuing tell to completion",
    { again: retell("completed"), first: shot("again") },
    undefined,
  ],
  ["committed to a fresh tell", { first: shot("tell") }, /completed boundary/],
  [
    "a continuing tell to no attack",
    { again: retell("chase"), first: shot("again") },
    /continuing tell requires its committed attack or completion/i,
  ],
  [
    "a fresh tell into a continuing tell",
    {
      again: retell("second"),
      tell: { ...plan.states.tell!, transitions: [{ to: "again", when: [] }] },
    },
    /must commit its attack or cancel/,
  ],
  [
    "a tell to another attack",
    {
      other: { ...shot("completed"), attack: { id: "other", phase: "committed" } },
      tell: { ...plan.states.tell!, transitions: [{ to: "other", when: [] }] },
    },
    /must commit its attack or cancel|requires a tell/,
  ],
  [
    "a tell to completion",
    { tell: { ...plan.states.tell!, transitions: [{ to: "completed", when: [] }] } },
    /must commit its attack or cancel/,
  ],
] as const)("attack graph: %s", (_, states, error) => {
  const layout = () => layoutBehaviour(1, withStates(states as Record<string, BehaviourNode>));
  if (error) {
    expect(layout).toThrow(error);
  } else {
    expect(layout).not.toThrow();
  }
});

it.each([
  [{ cancels: 0, seconds: 1 }],
  [{ cancels: 1.5, seconds: 1 }],
  [{ cancels: 2, seconds: -1 }],
])("rejects tell cancel pause %j", (tellCancelPause) => {
  expect(() => layoutBehaviour(1, { ...plan, tellCancelPause })).toThrow(/tell cancel pause/);
});

it("keeps its attack through a continuing tell, then completes into cooldown", () => {
  const start: BehaviourAttackState = {};
  const committed = enterAttack(
    plan,
    { attack: phase("committed") },
    enterAttack(plan, tell, start),
  );
  const continuing = { attack: { continues: true as const, id: "burst", phase: "tell" as const } };
  expect(canEnterAttack(continuing, start)).toBe(false);
  expect(canEnterAttack(continuing, committed)).toBe(true);
  const retold = enterAttack(plan, continuing, committed);
  expect(retold.activeAttack).toEqual({ continues: true, id: "burst", phase: "tell" });
  expect(enterAttack(plan, { attack: phase("committed") }, retold).activeAttack?.phase).toBe(
    "committed",
  );
  expect(enterAttack(plan, { attack: phase("completed") }, retold)).toEqual({
    attackCooldownRemainingSeconds: 0.5,
  });
  expect(() => enterAttack(plan, {}, retold)).toThrow(/continuing tell/i);
});

it.each([
  ["a move state", "return", undefined],
  ["a wait state", "tell", /track room/],
] as const)("track room: accepted only on %s", (_, key, error) => {
  const node = plan.states[key]!;
  const layout = () =>
    layoutBehaviour(
      1,
      withStates({
        [key]: {
          ...node,
          transitions: [
            { to: node.transitions[0]!.to, when: [{ distance: 3, kind: "track-room" }] },
            ...node.transitions,
          ],
        },
      }),
    );
  if (error) {
    expect(layout).toThrow(error);
  } else {
    expect(layout).not.toThrow();
  }
});
