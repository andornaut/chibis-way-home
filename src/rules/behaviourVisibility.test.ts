import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, BehaviourPlan } from "../data/types";
import { layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import { startBird } from "./bird";
import { STEP_SECONDS } from "./step";
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
it.each([false, true])(
  "gates current line of sight separately from engaged visibility, occluded=%s",
  (occluded) => {
    const plan: BehaviourPlan = {
      axis: "x",
      distance: 500,
      initial: "watch",
      pursuit: {
        distance: 1000,
        escaped: { line: "escaped", speaker: "fixture" },
        unreachableGraceSeconds: 3,
      },
      states: {
        seen: { animation: null, motion: { kind: "wait" }, transitions: [] },
        watch: {
          animation: null,
          motion: { kind: "wait" },
          transitions: [{ to: "seen", when: [{ kind: "line-of-sight" }] }],
        },
      },
    };
    expect(layoutBehaviour(12, plan).states.watch!.transitions[0]!.when).toEqual([
      { kind: "line-of-sight" },
    ]);
    const object = objectLayout(
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
    const target = { ...startBird(BIRD, { x: 200, y: 300 }), grounded: true };
    const state = {
      ...startBehaviour(BIRD, object, target),
      pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
    };
    const world = {
      solids: [
        { height: 60, width: 720, x: 0, y: 300 },
        ...(occluded ? [{ height: 100, width: 20, x: 100, y: 200 }] : []),
      ],
      view: { height: 360, width: 720, x: 0, y: 0 },
    };
    const next = stepBehaviour(BIRD, object, world, STEP_SECONDS, target, object.origin, state);
    expect(next.state.stateKey).toBe(occluded ? "watch" : "seen");
    expect(next.state.pursuit?.phase).toBe("engaged");
  },
);

it.each(["allowed", "deferred", undefined] as const)(
  "admits a targeted sequence only for explicit allowed observation, %s",
  (targetedAttackWindow) => {
    const plan: BehaviourPlan = {
      axis: "x",
      distance: 1,
      initial: "watch",
      states: {
        seen: { animation: null, motion: { kind: "wait" }, transitions: [] },
        watch: {
          animation: null,
          motion: { kind: "wait" },
          transitions: [{ to: "seen", when: [{ kind: "targeted-attack-allowed" }] }],
        },
      },
    };
    expect(layoutBehaviour(12, plan).states.watch!.transitions[0]!.when).toEqual([
      { kind: "targeted-attack-allowed" },
    ]);
    const object = objectLayout(
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
    const target = startBird(BIRD, { x: 200, y: 300 });
    const next = stepBehaviour(
      BIRD,
      object,
      { solids: [], ...(targetedAttackWindow !== undefined && { targetedAttackWindow }) },
      STEP_SECONDS,
      target,
      object.origin,
      startBehaviour(BIRD, object, target),
    );
    expect(next.state.stateKey).toBe(targetedAttackWindow === "allowed" ? "seen" : "watch");
  },
);
