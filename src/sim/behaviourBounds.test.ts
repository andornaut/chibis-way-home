import { describe, expect, it } from "vitest";

import type { BehaviourMotion, BehaviourPlan } from "../data/types";
import { behaviourCycleSeconds, hasDynamicBehaviour, sweptBehaviourRect } from "./behaviourBounds";

function pattern(motions: readonly BehaviourMotion[]): BehaviourPlan {
  return {
    axis: "x",
    distance: 0,
    initial: "0",
    states: Object.fromEntries(
      motions.map((motion, i) => [String(i), { animation: null, motion, transitions: [] }]),
    ),
  };
}

describe("behaviour phase bounds", () => {
  it("classifies a stationary emitter as dynamic without inventing movement", () => {
    const graph = pattern([{ kind: "wait" }]);
    const active = graph.states["0"]!;
    expect(hasDynamicBehaviour(graph)).toBe(false);
    const emitter: BehaviourPlan = {
      ...graph,
      states: {
        "0": {
          ...active,
          onEnter: [
            { height: 8, kind: "force-pulse", range: 12, seconds: 0.3, velocity: { x: 20, y: 0 } },
          ],
          transitions: [{ to: "0", when: [{ kind: "elapsed", seconds: 0.8 }] }],
        },
      },
    };
    expect(hasDynamicBehaviour(emitter)).toBe(true);
    expect(behaviourCycleSeconds(emitter)).toBeCloseTo(0.8);
  });

  it("bounds mixed-axis tracks and locked-target flight without a fixed target point", () => {
    const graph: BehaviourPlan = {
      axis: "y",
      distance: -60,
      initial: "charge",
      states: {
        charge: {
          animation: null,
          motion: { direction: 1, kind: "move", speed: 30 },
          track: { axis: "x", distance: 90 },
          transitions: [],
        },
        swoop: {
          animation: null,
          motion: {
            bounds: { height: 30, width: 40, x: -20, y: -10 },
            kind: "fly",
            speed: 20,
            to: "target",
          },
          transitions: [],
        },
      },
    };
    expect(sweptBehaviourRect(graph, { height: 8, width: 12, x: 10, y: 20 })).toEqual({
      height: 88,
      width: 122,
      x: -10,
      y: -40,
    });
    expect(behaviourCycleSeconds(graph)).toBeCloseTo(3 + Math.hypot(110, 20) / 20);
  });

  it.each([
    { bounds: { height: 8, width: 12, x: 10, y: 20 }, motions: [{ kind: "wait" }], seconds: 0 },
    {
      bounds: { height: 68, width: 42, x: 10, y: 0 },
      motions: [
        { kind: "fly", speed: 10, to: { x: 30, y: 40 } },
        { kind: "fly", speed: 20, to: { x: 30, y: -20 } },
      ],
      seconds: 9,
    },
    {
      bounds: { height: 25, width: 27, x: -5, y: 3 },
      motions: [
        { kind: "fly", speed: 0, to: { x: -15, y: -10 } },
        { direction: 1, hopHeight: 7, hopSeconds: 0.4, kind: "hop", speed: 0 },
      ],
      seconds: 0.4,
    },
  ] satisfies readonly {
    motions: readonly BehaviourMotion[];
    bounds: { x: number; y: number; width: number; height: number };
    seconds: number;
  }[])("covers graph $motions and its travel time", ({ bounds, motions, seconds }) => {
    const graph = pattern(motions);
    expect(sweptBehaviourRect(graph, { height: 8, width: 12, x: 10, y: 20 })).toEqual(bounds);
    expect(behaviourCycleSeconds(graph)).toBeCloseTo(seconds);
  });
});
