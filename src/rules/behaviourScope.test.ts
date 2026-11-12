import { expect, it } from "vitest";

import { PIGEON_BEHAVIOUR } from "../data/behaviours.ts";
import type { BehaviourNode, BehaviourPlan } from "../data/types/index.ts";
import { unacquiredBehaviourNodes } from "./behaviourScope.ts";

function graph(): BehaviourPlan {
  return {
    axis: "x",
    distance: 10,
    initial: "autonomous",
    pursuit: {
      distance: 100,
      escaped: { line: "escaped", speaker: "actor" },
      unreachableGraceSeconds: 1,
    },
    states: {
      autonomous: {
        animation: null,
        motion: { kind: "wait" },
        transitions: [
          { to: "landing", when: [{ kind: "visible" }, { kind: "elapsed", seconds: 1 }] },
        ],
      },
      landing: {
        animation: null,
        motion: { kind: "fly", speed: 10, to: "support" },
        transitions: [],
      },
    },
  };
}

it("excludes a reactive support landing behind an acquired-pursuit AND guard", () => {
  const plan = graph();
  expect(unacquiredBehaviourNodes(plan)).toEqual([plan.states.autonomous]);
});

it("retains an entire autonomous coordinate itinerary", () => {
  const plan = graph();
  const autonomous: BehaviourNode = {
    ...plan.states.autonomous!,
    motion: { direction: 1, kind: "move", speed: 10 } as const,
    transitions: [{ to: "landing", when: [{ kind: "elapsed", seconds: 1 }] }] as const,
  };
  const landing: BehaviourNode = {
    ...plan.states.landing!,
    motion: { kind: "fly", speed: 10, to: { x: 5, y: -4 } } as const,
  };
  expect(unacquiredBehaviourNodes({ ...plan, states: { autonomous, landing } })).toEqual([
    autonomous,
    landing,
  ]);
});

function withAutonomousTransitions(transitions: BehaviourNode["transitions"]): BehaviourPlan {
  const plan = graph();
  return {
    ...plan,
    states: { ...plan.states, autonomous: { ...plan.states.autonomous!, transitions } },
  };
}
const pursuing = graph();

it.each<{ name: string; plan: BehaviourPlan }>([
  {
    name: "unresolved autonomous support flight instead of claiming static occupancy",
    plan: withAutonomousTransitions([{ to: "landing", when: [{ kind: "elapsed", seconds: 1 }] }]),
  },
  {
    name: "a nonacquisition alternative to the same reactive destination",
    plan: withAutonomousTransitions([
      ...pursuing.states.autonomous!.transitions,
      { to: "landing", when: [{ kind: "elapsed", seconds: 1 }] },
    ]),
  },
  {
    name: "ordinary visibility branches without persistent pursuit",
    plan: {
      axis: pursuing.axis,
      distance: pursuing.distance,
      initial: pursuing.initial,
      states: {
        ...pursuing.states,
        landing: {
          ...pursuing.states.landing!,
          motion: { kind: "fly", speed: 10, to: { x: 0, y: 0 } },
        },
      },
    },
  },
])("retains $name", ({ plan }) => {
  expect(unacquiredBehaviourNodes(plan)).toContain(plan.states.landing);
});

it("keeps the authored Pebble initial body and excludes its acquired flight graph", () => {
  expect(unacquiredBehaviourNodes(PIGEON_BEHAVIOUR)).toEqual([
    PIGEON_BEHAVIOUR.states[PIGEON_BEHAVIOUR.initial],
  ]);
});
