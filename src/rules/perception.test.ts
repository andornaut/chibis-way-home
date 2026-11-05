import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import {
  BEAR_BEHAVIOUR,
  DOG_BEHAVIOUR,
  FERRET_BEHAVIOUR,
  GOOSE_BEHAVIOUR,
  PIGEON_BEHAVIOUR,
  RACCOON_BEHAVIOUR,
} from "../data/behaviours";
import { BIRD } from "../data/bird";
import type { Archetype, BehaviourPlan, ObjectLayout, Rect, ZoneLayout } from "../data/types";
import { SKILL_PROFILES } from "../progress";
import { layoutBehaviour } from "./behaviour";
import { currentScreen, targetInCurrentView, targetInSameChunk, targetVisible } from "./perception";
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
    const seen = stepZone(SKILL_PROFILES, BIRD, stage, STEP_SECONDS, STILL, start);
    expect(seen.behaviours[0]?.stateKey).toBe("seen");
    expect(seen.barks).toEqual([
      { ...plan.spotted, owner: { area: "main", attempt: 0, objectIndex: 0 } },
    ]);
    const blocked = layout([{ height: 200, width: 24, x: 180, y: 100 }]);
    const hidden = stepZone(
      SKILL_PROFILES,
      BIRD,
      blocked,
      STEP_SECONDS,
      STILL,
      startZone(BIRD, blocked, 1),
    );
    expect(hidden.behaviours[0]?.stateKey).toBe("watch");
    expect(hidden.barks).toEqual([]);
  });
  it("keeps an offscreen hostile idle until the shared current camera includes it", () => {
    const stage = layout([], { ...actor, origin: { x: 900, y: 120 } });
    const start = startZone(BIRD, stage, 1);
    const unseen = stepZone(SKILL_PROFILES, BIRD, stage, STEP_SECONDS, STILL, start);
    expect(unseen.behaviours[0]?.stateKey).toBe("watch");
    const moved = { ...unseen, bird: { ...unseen.bird, x: 588 } };
    const seen = stepZone(SKILL_PROFILES, BIRD, stage, STEP_SECONDS, STILL, moved);
    expect(currentScreen(BIRD, stage.areas.main!, moved.bird).x).toBe(240);
    expect(seen.behaviours[0]?.stateKey).toBe("seen");
  });
  it("emits once across area re-entry and emits again only after an actual attempt reset", () => {
    const stage = layout();
    const seen = stepZone(
      SKILL_PROFILES,
      BIRD,
      stage,
      STEP_SECONDS,
      STILL,
      startZone(BIRD, stage, 1),
    );
    expect(stepZone(SKILL_PROFILES, BIRD, stage, STEP_SECONDS, STILL, seen).barks).toEqual([]);
    const reentered = enterArea(BIRD, stage, stage.start, seen);
    expect(stepZone(SKILL_PROFILES, BIRD, stage, STEP_SECONDS, STILL, reentered).barks).toEqual([]);
    const retry = retryZone(BIRD, stage, {
      ...seen,
      death: {
        position: { x: 60, y: 264 },
        reason: "hazard",
        support: undefined,
        velocity: { x: 0, y: 0 },
      },
    });
    expect(stepZone(SKILL_PROFILES, BIRD, stage, STEP_SECONDS, STILL, retry).barks).toEqual([
      { ...plan.spotted, owner: { area: "main", attempt: 1, objectIndex: 0 } },
    ]);
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

describe("current-chunk or current-viewport pursuit awareness", () => {
  describe("current viewport", () => {
    const view = { height: 100, width: 200, x: 100, y: 50 };
    const observer = { height: 20, width: 20, x: 90, y: 40 };
    const target = { ...observer, x: 280, y: 130 };
    const world = { solids: [{ height: 100, width: 10, x: 200, y: 50 }], view };

    it("has no line of sight through the wall between the in-view bodies", () => {
      expect(targetVisible(world, undefined, observer, target)).toBe(false);
    });

    it.each<[string, boolean, Parameters<typeof targetInCurrentView>]>([
      ["both body centres inside it, behind a wall", true, [world, observer, target]],
      ["the target's centre on its right edge", false, [world, observer, { ...target, x: 290 }]],
      ["the target's centre on its bottom edge", false, [world, observer, { ...target, y: 140 }]],
      ["the observer's centre left of it", false, [world, { ...observer, x: 89 }, target]],
      ["the observer's centre above it", false, [world, { ...observer, y: 39 }, target]],
      ["no camera view", false, [{ solids: [] }, observer, target]],
    ])("with %s: in view %s", (_, expected, args) => {
      expect(targetInCurrentView(...args)).toBe(expected);
    });
  });

  describe("current chunk", () => {
    const world = {
      chunks: [
        { width: 120, x: 80 },
        { width: 360, x: 200 },
      ],
      solids: [],
    };
    const observer = { height: 20, width: 20, x: 180, y: 0 };
    const target = { height: 20, width: 20, x: 189, y: 900 };

    it.each<[string, boolean, Parameters<typeof targetInSameChunk>]>([
      ["both centres in the first span, far apart vertically", true, [world, observer, target]],
      [
        "the target's centre on the next span's start",
        false,
        [world, observer, { ...target, x: 190 }],
      ],
      [
        "both centres on the next span's start",
        true,
        [world, { ...observer, x: 190 }, { ...target, x: 190 }],
      ],
      [
        "the target's centre on the last span's end",
        false,
        [world, observer, { ...target, x: 550 }],
      ],
      ["no chunk list", false, [{ solids: [] }, observer, target]],
      ["an empty chunk list", false, [{ ...world, chunks: [] }, observer, target]],
    ])("with %s: in the same chunk %s", (_, expected, args) => {
      expect(targetInSameChunk(...args)).toBe(expected);
    });
  });

  it.each([
    ["Archie", DOG_BEHAVIOUR],
    ["Bini", BEAR_BEHAVIOUR],
    ["Fert", FERRET_BEHAVIOUR],
    ["Kiwi", RACCOON_BEHAVIOUR],
    ["Pebble", PIGEON_BEHAVIOUR],
    ["Trixi", GOOSE_BEHAVIOUR],
  ] as const)(
    "%s acquires across visible chunks through a wall without a spotted bark",
    (_, profile) => {
      const object = {
        ...actor,
        behaviour: layoutBehaviour(12, profile),
        origin: { x: 740, y: 276 },
      };
      const stage = layout([{ height: 300, width: 12, x: 714, y: 0 }], object);
      const area = stage.areas.main!;
      const chunked = {
        ...stage,
        areas: {
          main: {
            ...area,
            chunks: [
              { width: 720, x: 0 },
              { width: 380, x: 720 },
            ],
          },
        },
      };
      let zone = startZone(BIRD, chunked, 1);
      const offscreen = stepZone(SKILL_PROFILES, BIRD, chunked, STEP_SECONDS, STILL, zone);
      expect(offscreen.behaviours[0]?.pursuit).toBeUndefined();
      zone = { ...zone, bird: { ...zone.bird, x: 696 - BIRD.width / 2 } };
      const adjacent = stepZone(SKILL_PROFILES, BIRD, chunked, STEP_SECONDS, STILL, zone);
      expect(adjacent.behaviours[0]?.pursuit?.phase).toBe("engaged");
      expect(adjacent.barks).toEqual([]);
      expect(adjacent.spotted.main ?? []).toEqual([]);
      const entered = {
        ...adjacent,
        bird: { ...adjacent.bird, x: 720 - BIRD.width / 2 },
      };
      const acquired = stepZone(SKILL_PROFILES, BIRD, chunked, STEP_SECONDS, STILL, entered);
      expect(acquired.behaviours[0]?.pursuit?.phase).toBe("engaged");
      expect(acquired.barks).toEqual([]);
      expect(acquired.spotted.main ?? []).toEqual([]);
    },
  );

  it("acquires an offscreen boss in the current chunk without marking its bark heard", () => {
    const object = {
      ...actor,
      behaviour: layoutBehaviour(12, DOG_BEHAVIOUR),
      origin: { x: 300, y: 0 },
    };
    const stage = layout([], object);
    const chunked = {
      ...stage,
      areas: {
        main: {
          ...stage.areas.main!,
          chunks: [{ width: 1100, x: 0 }],
          entries: { start: { x: 60, y: 600 } },
          solids: [{ height: 120, width: 1100, x: 0, y: 600 }],
        },
      },
    };
    const started = startZone(BIRD, chunked, 1);
    expect(currentScreen(BIRD, chunked.areas.main, started.bird).y).toBe(360);
    const next = stepZone(SKILL_PROFILES, BIRD, chunked, STEP_SECONDS, STILL, started);
    expect(next.behaviours[0]?.pursuit?.phase).toBe("engaged");
    expect(next.barks).toEqual([]);
    expect(next.spotted.main ?? []).toEqual([]);
  });

  it("keeps distance escape ahead of same-chunk awareness in tall areas", () => {
    const object = {
      ...actor,
      behaviour: layoutBehaviour(12, DOG_BEHAVIOUR),
      origin: { x: 300, y: 0 },
    };
    const stage = layout([], object);
    const tall = {
      ...stage,
      areas: {
        main: {
          ...stage.areas.main!,
          chunks: [{ width: 1100, x: 0 }],
          entries: { start: { x: 60, y: 1200 } },
          height: 1440,
          solids: [{ height: 240, width: 1100, x: 0, y: 1200 }],
        },
      },
    };
    const next = stepZone(
      SKILL_PROFILES,
      BIRD,
      tall,
      STEP_SECONDS,
      STILL,
      startZone(BIRD, tall, 1),
    );
    expect(next.behaviours[0]?.pursuit?.phase).toBe("escaped");
    expect(next.barks).toEqual([
      { ...DOG_BEHAVIOUR.pursuit!.escaped, owner: { area: "main", attempt: 0, objectIndex: 0 } },
    ]);
  });
});
