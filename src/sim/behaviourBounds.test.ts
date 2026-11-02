import { describe, expect, it } from "vitest";

import platforming from "../../public/art/tilesets/tiles-platforming.json";
import { ARCHETYPES } from "../data/archetypes";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { createOrbitHazardChunks } from "../data/orbitHazardChunks";
import { TILE } from "../data/screen";
import type { BehaviourMotion, BehaviourPlan } from "../data/types";
import { startBehaviour, stepBehaviour } from "../rules/behaviour";
import { startBird } from "../rules/bird";
import { orbitBounds } from "../rules/orbit";
import { STEP_SECONDS } from "../rules/step";
import { areaLayout, objectLayout } from "../rules/tiles";
import { startZone, stepZone } from "../rules/zone";
import { BIRD_FRAME } from "../view/bird";
import type { Tileset } from "../view/tiles";
import {
  behaviourCycleSeconds,
  hasDynamicBehaviour,
  hasDynamicMotion,
  objectCycleSeconds,
  sweptBehaviourRect,
} from "./behaviourBounds";

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

  it("does not invent a finite period for persistent target-driven pursuit", () => {
    const graph: BehaviourPlan = {
      ...pattern([{ kind: "pursue", mode: "ground", speed: 30 }]),
      pursuit: {
        distance: 200,
        escaped: { line: "escaped", speaker: "actor" },
        unreachableGraceSeconds: 1,
      },
    };
    expect(hasDynamicBehaviour(graph)).toBe(true);
    expect(behaviourCycleSeconds(graph)).toBe(Infinity);
  });

  it.each(["ground", "fly"] as const)(
    "bounds actual %s pursuit and its reanchored committed attack",
    (mode) => {
      const areaBounds = { height: 600, width: 1000, x: 0, y: 0 };
      const graph: BehaviourPlan = {
        axis: "x",
        distance: 100,
        initial: "chase",
        pursuit: {
          distance: 300,
          escaped: { line: "escaped", speaker: "actor" },
          unreachableGraceSeconds: 1,
        },
        states: {
          attack: {
            animation: null,
            motion: { direction: 1, kind: "move", speed: 100 },
            transitions: [],
          },
          chase: {
            animation: null,
            motion: { kind: "pursue", mode, speed: 100 },
            transitions: [{ to: "attack", when: [{ kind: "nearby", range: BIRD.height }] }],
          },
        },
      };
      const object = objectLayout(
        1,
        {
          archetypes: { actor: ARCHETYPES.hazard! },
          characters: {
            actor: { archetype: "actor", art: "fixture", behaviour: graph, cols: 20, rows: 20 },
          },
        },
        {},
        undefined,
        {},
        { character: "actor", col: 100, row: mode === "ground" ? 280 : 30 },
      );
      const target = startBird(BIRD, {
        x: 400,
        y: mode === "ground" ? 300 : areaBounds.height - 1 + BIRD.height,
      });
      const world = {
        solids: mode === "ground" ? [{ height: 100, width: areaBounds.width, x: 0, y: 300 }] : [],
        view: { ...areaBounds, height: areaBounds.height + BIRD.height },
      };
      const first = stepBehaviour(
        BIRD,
        object,
        world,
        20,
        target,
        object.origin,
        startBehaviour(BIRD, object, target),
      );
      const attack = stepBehaviour(BIRD, object, world, 2, target, first.at, first.state);
      expect(attack.at.x).toBeGreaterThan(object.origin.x + graph.pursuit!.distance);
      if (mode === "fly") {
        expect(attack.at.y + object.height).toBeGreaterThan(areaBounds.height);
      }
      const bounds = sweptBehaviourRect(
        { areaBounds, maximumRise: 80, targetHeight: BIRD.height },
        graph,
        { ...object.origin, height: object.height, width: object.width },
      );
      for (const at of [first.at, attack.at]) {
        expect(bounds.x).toBeLessThanOrEqual(at.x);
        expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(at.x + object.width);
        expect(bounds.y).toBeLessThanOrEqual(at.y);
        expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(at.y + object.height);
      }
      expect(() =>
        sweptBehaviourRect(undefined, graph, {
          ...object.origin,
          height: object.height,
          width: object.width,
        }),
      ).toThrow("context");
    },
  );

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
        climb: {
          animation: null,
          motion: { direction: -1, kind: "move", speed: 30 },
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
    expect(sweptBehaviourRect(undefined, graph, { height: 8, width: 12, x: 10, y: 20 })).toEqual({
      height: 88,
      width: 122,
      x: -10,
      y: -40,
    });
    expect(behaviourCycleSeconds(graph)).toBeCloseTo(5 + Math.hypot(110, 20) / 20);
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
    expect(sweptBehaviourRect(undefined, graph, { height: 8, width: 12, x: 10, y: 20 })).toEqual(
      bounds,
    );
    expect(behaviourCycleSeconds(graph)).toBeCloseTo(seconds);
  });
});

describe("orbital motion envelopes", () => {
  it.each(Object.entries(createOrbitHazardChunks("test")))(
    "keeps actual %s hazard contact inside its host-relative envelope",
    (_, chunk) => {
      const area = areaLayout(
        TILE,
        { archetypes: ARCHETYPES, characters: CHARACTERS },
        {},
        { "tiles-platforming": platforming as Tileset },
        new Set(),
        {
          cols: chunk.cols,
          entries: { start: { col: 2, row: chunk.entry.row } },
          objects: chunk.objects,
          rows: 60,
          solids: chunk.solids,
        },
      );
      const layout = {
        areas: { main: area },
        birdFrame: BIRD_FRAME,
        start: { area: "main", entry: "start" },
      };
      const child = area.objects.find((object) => object.orbit)!;
      const index = area.objects.indexOf(child);
      const host = area.objects[child.orbit!.host]!;
      const bounds = orbitBounds(area.objects, child);
      expect(hasDynamicMotion(child)).toBe(true);
      expect(child.motion.algorithm).toBe("static");
      expect(child.hitbox!.height).toBe(platforming.hitboxes["hazard-top"].height);
      expect(objectCycleSeconds(area.objects, child)).toBe(Infinity);
      const hostSeconds = objectCycleSeconds(area.objects, host);
      let zone = startZone(BIRD, layout, 1);
      for (let tick = 0; tick <= Math.ceil(hostSeconds / (2 * STEP_SECONDS)); tick++) {
        const at = zone.objects[index]!;
        expect(at.x).toBeGreaterThanOrEqual(bounds.x - 1e-8);
        expect(at.x + child.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-8);
        expect(at.y).toBeGreaterThanOrEqual(bounds.y - 1e-8);
        expect(at.y + child.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-8);
        zone = stepZone(
          BIRD,
          layout,
          STEP_SECONDS,
          { jumpHeld: false, move: 0, useHeld: false },
          zone,
        );
      }
      expect(zone.death).toBeUndefined();
      const commensurateHost = {
        ...host,
        motion: { ...host.motion, distance: 4, pause: 1, speed: 4 },
      };
      const commensurateChild = {
        ...child,
        orbit: { ...child.orbit!, angularSpeed: Math.PI, host: 0 },
      };
      expect(objectCycleSeconds([commensurateHost, commensurateChild], commensurateChild)).toBe(4);
      const lockedChild = {
        ...commensurateChild,
        orbit: { ...commensurateChild.orbit, angularSpeed: 0 },
      };
      expect(objectCycleSeconds([commensurateHost, lockedChild], lockedChild)).toBe(
        objectCycleSeconds([commensurateHost], commensurateHost),
      );
    },
  );
});

it("includes the authored ground-traversal jump rise in pursuit bounds", () => {
  const graph: BehaviourPlan = {
    ...pattern([
      {
        kind: "pursue",
        mode: "ground",
        speed: 120,
        traversal: { gravity: 1000, jumpSpeed: 300, maxFallSpeed: 500 },
      },
    ]),
    pursuit: {
      distance: 200,
      escaped: { line: "escaped", speaker: "actor" },
      unreachableGraceSeconds: 3,
    },
  };
  const origin = { height: 24, width: 24, x: 100, y: 276 };
  const context = {
    areaBounds: { height: 360, width: 720, x: 0, y: 0 },
    maximumRise: 0,
    targetHeight: 0,
  };
  const legacy = sweptBehaviourRect(
    context,
    { ...graph, states: pattern([{ kind: "pursue", mode: "ground", speed: 120 }]).states },
    origin,
  );
  const physical = sweptBehaviourRect(context, graph, origin);
  expect(physical.y).toBe(legacy.y - 45);
  expect(physical.y + physical.height).toBe(legacy.y + legacy.height);
});
