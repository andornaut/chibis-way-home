import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { WARNED_VENT_BEHAVIOUR, WARNED_VENT_SECONDS } from "../data/obstacleBehaviours";
import type { Archetype, BehaviourNode, BehaviourPlan, ObjectLayout } from "../data/types";
import { TEST_PURSUER, withAnticipationContact } from "../testing/behaviours";
import { behaviourPose } from "../view/behaviour";
import { startBehaviour, stepBehaviour } from "./behaviour";
import { startBird } from "./bird";
import {
  effectiveCollision,
  effectiveHazardPhase,
  validateHazardPhases,
} from "./effectiveCollision";
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
const node = (
  hazardPhase: NonNullable<BehaviourNode["hazardPhase"]>,
  seconds: number,
  to: string,
): BehaviourNode => ({
  animation: to,
  hazardPhase,
  motion: { kind: "wait" },
  transitions: [{ to, when: [{ kind: "elapsed", seconds }] }],
});
const plan: BehaviourPlan = {
  axis: "x",
  distance: 0,
  initial: "a",
  states: {
    a: node("inactive", 0.2, "b"),
    b: node("warning", 0.1, "c"),
    c: node("active", 0.1, "d"),
    d: node("inactive", 0.2, "a"),
  },
};
function resolve(behaviour = plan): ObjectLayout {
  return objectLayout(
    1,
    {
      archetypes: { hazard: archetype },
      characters: {
        hazard: { archetype: "hazard", art: "placeholder-hazard", behaviour, cols: 2, rows: 3 },
      },
    },
    {},
    undefined,
    {},
    { character: "hazard", col: 10, row: 20 },
  );
}
const object = resolve();
const bird = startBird(BIRD, { x: 0, y: 0 });

it("resolves the actual warned vent cycle with contact only during its active window", () => {
  const vent = resolve(WARNED_VENT_BEHAVIOUR);
  const initial = startBehaviour(BIRD, vent, bird);
  const activeStart = WARNED_VENT_SECONDS.inactive + WARNED_VENT_SECONDS.warning;
  const recoveryStart = activeStart + WARNED_VENT_SECONDS.active;
  const cycle = Object.values(WARNED_VENT_SECONDS).reduce((total, seconds) => total + seconds, 0);
  expect(initial.elapsed).toBe(0);
  expect(effectiveHazardPhase(vent, initial)).toBe("inactive");
  expect(effectiveCollision(vent, initial)).toBe("none");
  for (const [seconds, phase, collision] of [
    [WARNED_VENT_SECONDS.inactive + WARNED_VENT_SECONDS.warning / 2, "warning", "none"],
    [activeStart + WARNED_VENT_SECONDS.active / 2, "active", "hazard"],
    [recoveryStart + WARNED_VENT_SECONDS.recovery / 2, "inactive", "none"],
  ] as const) {
    const result = stepBehaviour(BIRD, vent, [], seconds, bird, vent.origin, initial);
    expect(effectiveHazardPhase(vent, result.state)).toBe(phase);
    expect(effectiveCollision(vent, result.state)).toBe(collision);
    expect(result.at).toEqual(vent.origin);
  }
  const whole = stepBehaviour(BIRD, vent, [], cycle, bird, vent.origin, initial);
  const active = whole.segments.filter(({ hazardPhase }) => hazardPhase === "active");
  expect(active).toHaveLength(1);
  expect(active[0]!.start).toBeCloseTo(activeStart);
  expect(active[0]!.end).toBeCloseTo(recoveryStart);
  expect(effectiveCollision(vent, whole.state)).toBe("none");
  const retry = startBehaviour(BIRD, vent, bird);
  expect(retry.elapsed).toBe(0);
  expect(effectiveHazardPhase(vent, retry)).toBe("inactive");
  expect(effectiveCollision(vent, retry)).toBe("none");
});

it("keeps timed contacts and rendered state on the executor's exact boundaries", () => {
  const start = startBehaviour(BIRD, object, bird);
  const result = stepBehaviour(BIRD, object, [], 0.45, bird, object.origin, start);
  expect(result.segments.map(({ hazardPhase }) => hazardPhase)).toEqual([
    "inactive",
    "warning",
    "active",
    "inactive",
  ]);
  const active = result.segments.find(({ hazardPhase }) => hazardPhase === "active")!;
  expect(active.start).toBeCloseTo(0.3);
  expect(active.end).toBeCloseTo(0.4);
  expect(effectiveCollision(object, result.state)).toBe("none");
  expect(behaviourPose(object, result.state).animation).toBe(plan.states.d!.animation);
  expect(result.at).toEqual(object.origin);
  const exact = stepBehaviour(BIRD, object, [], 0.3, bird, object.origin, start);
  expect(effectiveHazardPhase(object, exact.state)).toBe("active");
  expect(effectiveCollision(object, exact.state)).toBe("hazard");
});

it("resets the phase on a new attempt and preserves legacy lethal contact", () => {
  const start = startBehaviour(BIRD, object, bird);
  const once = stepBehaviour(BIRD, object, [], 0.35, bird, object.origin, start);
  const next = stepBehaviour(BIRD, object, [], 0.05, bird, once.at, once.state);
  const whole = stepBehaviour(BIRD, object, [], 0.4, bird, object.origin, start);
  expect(next.state.stateKey).toBe(whole.state.stateKey);
  expect(next.state.elapsed).toBeCloseTo(whole.state.elapsed);
  expect(effectiveHazardPhase(object, startBehaviour(BIRD, object, bird))).toBe("inactive");
  const legacy = resolve(TEST_PURSUER);
  expect(effectiveCollision(legacy, startBehaviour(BIRD, legacy, bird))).toBe("hazard");
});

it.each([
  ["support", (o: ObjectLayout) => ({ ...o, collision: "ledge" as const })],
  ["silhouette body", (o: ObjectLayout) => withAnticipationContact(o)],
  [
    "pursuit",
    (o: ObjectLayout) => ({
      ...o,
      behaviour: {
        ...o.behaviour!,
        pursuit: {
          distance: 1,
          escaped: { line: "escaped", speaker: "actor" },
          unreachableGraceSeconds: null,
        },
      },
    }),
  ],
  ["scene gating", (o: ObjectLayout) => ({ ...o, scene: "intro" })],
  [
    "moving track",
    (o: ObjectLayout) => ({ ...o, motion: { ...o.motion, algorithm: "linear" as const } }),
  ],
])("rejects phase overrides on %s", (_, change) => {
  expect(() => validateHazardPhases(change(object))).toThrow(/stationary elapsed-only cycle/);
});

const withoutPhase = { ...plan.states.b! };
delete withoutPhase.hazardPhase;

it.each([
  ["missing phase", withoutPhase],
  ["support-dependent wait", { ...plan.states.b!, motion: { kind: "wait", support: "required" } }],
  ["attack tell", { ...plan.states.b!, attack: { id: "attack", phase: "tell" } }],
  ["zero duration", node("warning", 0, "c")],
  ["non-cycle target", node("warning", 0.1, "b")],
  [
    "target-dependent transition",
    { ...plan.states.b!, transitions: [{ to: "c", when: [{ kind: "nearby", range: 1 }] }] },
  ],
] satisfies readonly (readonly [string, BehaviourNode])[])(
  "rejects %s through actual layout resolution",
  (_, changed) => {
    expect(() => resolve({ ...plan, states: { ...plan.states, b: changed } })).toThrow();
  },
);
