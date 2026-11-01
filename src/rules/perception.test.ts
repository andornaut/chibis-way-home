import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, BehaviourPlan, ObjectLayout, Rect, ZoneLayout } from "../data/types";
import { BIRD_FRAME } from "../view/bird";
import { layoutBehaviour } from "./behaviour";
import { currentScreen, targetVisible } from "./perception";
import { STEP_SECONDS } from "./step";
import { objectLayout } from "./tiles";
import { enterArea, retryZone, startZone, stepZone } from "./zone";

const plan: BehaviourPlan = {
  axis: "x",
  distance: 0,
  initial: "watch",
  spotted: { line: "spotted", speaker: "speaker" },
  states: {
    seen: { animation: "idle", motion: { kind: "wait" }, transitions: [] },
    watch: {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [{ to: "seen", when: [{ kind: "visible" }] }],
    },
  },
};
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
const actor = objectLayout(
  1,
  {
    archetypes: { actor: archetype },
    characters: {
      actor: { archetype: "actor", art: "placeholder-actor", behaviour: plan, cols: 24, rows: 24 },
    },
  },
  {},
  undefined,
  {},
  { character: "actor", col: 300, row: 120 },
);
const STILL = { jumpHeld: false, move: 0, useHeld: false } as const;
function layout(extra: readonly Rect[] = [], object: ObjectLayout = actor): ZoneLayout {
  return {
    areas: {
      main: {
        backX: 0,
        chunks: [],
        entries: { start: { x: 60, y: 300 } },
        exitX: 1100,
        height: 720,
        objects: [object],
        solids: [{ height: 420, width: 1100, x: 0, y: 300 }, ...extra],
        terrain: [],
        tileset: undefined,
        width: 1100,
      },
    },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
}

describe("screen and solid line-of-sight acquisition", () => {
  it("resolves visible conditions without adding spatial values to the graph", () => {
    expect(layoutBehaviour(12, plan).states.watch!.transitions[0]!.when).toEqual([
      { kind: "visible" },
    ]);
  });
  it("acquires across unreachable heights in the shared engine, but not through a solid wall", () => {
    const stage = layout();
    const start = startZone(BIRD, stage, 1);
    expect(currentScreen(BIRD, stage.areas.main!, start.bird)).toEqual({
      height: 360,
      width: 720,
      x: 0,
      y: 60,
    });
    const seen = stepZone(BIRD, stage, STEP_SECONDS, STILL, start);
    expect(seen.behaviours[0]?.stateKey).toBe("seen");
    expect(seen.barks).toEqual([plan.spotted]);
    const blocked = layout([{ height: 200, width: 24, x: 180, y: 100 }]);
    const hidden = stepZone(BIRD, blocked, STEP_SECONDS, STILL, startZone(BIRD, blocked, 1));
    expect(hidden.behaviours[0]?.stateKey).toBe("watch");
    expect(hidden.barks).toEqual([]);
  });
  it("keeps an offscreen hostile idle until the shared current camera includes it", () => {
    const stage = layout([], { ...actor, origin: { x: 900, y: 120 } });
    const start = startZone(BIRD, stage, 1);
    const unseen = stepZone(BIRD, stage, STEP_SECONDS, STILL, start);
    expect(unseen.behaviours[0]?.stateKey).toBe("watch");
    const moved = { ...unseen, bird: { ...unseen.bird, x: 588 } };
    const seen = stepZone(BIRD, stage, STEP_SECONDS, STILL, moved);
    expect(currentScreen(BIRD, stage.areas.main!, moved.bird).x).toBe(240);
    expect(seen.behaviours[0]?.stateKey).toBe("seen");
  });
  it("emits once across area re-entry and emits again only after an actual attempt reset", () => {
    const stage = layout();
    const seen = stepZone(BIRD, stage, STEP_SECONDS, STILL, startZone(BIRD, stage, 1));
    expect(stepZone(BIRD, stage, STEP_SECONDS, STILL, seen).barks).toEqual([]);
    const reentered = enterArea(BIRD, stage, stage.start, seen);
    expect(stepZone(BIRD, stage, STEP_SECONDS, STILL, reentered).barks).toEqual([]);
    const retry = retryZone(BIRD, stage, {
      ...seen,
      death: {
        position: { x: 60, y: 264 },
        reason: "hazard",
        support: undefined,
        velocity: { x: 0, y: 0 },
      },
    });
    expect(stepZone(BIRD, stage, STEP_SECONDS, STILL, retry).barks).toEqual([plan.spotted]);
  });
  it("ignores one-way ledges and self bodies, while solid objects and offscreen centres block sight", () => {
    const observer = { height: 24, width: 24, x: 300, y: 120 };
    const target = { height: 36, width: 24, x: 48, y: 264 };
    const wall = { height: 200, width: 24, x: 180, y: 100 };
    const view = { height: 360, width: 720, x: 0, y: 60 };
    expect(targetVisible({ solids: [], view }, undefined, observer, target)).toBe(true);
    expect(targetVisible({ solids: [] }, undefined, observer, target)).toBe(false);
    expect(targetVisible({ solids: [], view }, undefined, { ...observer, x: 900 }, target)).toBe(
      false,
    );
    expect(
      targetVisible(
        { platforms: [{ collision: "solid", owner: actor, rect: wall }], solids: [], view },
        undefined,
        observer,
        target,
      ),
    ).toBe(false);
    expect(
      targetVisible(
        { platforms: [{ collision: "ledge", owner: actor, rect: wall }], solids: [], view },
        undefined,
        observer,
        target,
      ),
    ).toBe(true);
    expect(
      targetVisible(
        { platforms: [{ collision: "solid", owner: actor, rect: observer }], solids: [], view },
        actor,
        observer,
        target,
      ),
    ).toBe(true);
  });
});
