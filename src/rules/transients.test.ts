import { describe, expect, it } from "vitest";

import type { Archetype, BehaviourAction, ObjectLayout, Rect } from "../data/types";
import { objectLayout } from "./tiles";
import { type SpawnEvent, stepTransients, type Transient } from "./transients";

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
const template: ObjectLayout = objectLayout(
  1,
  {
    archetypes: { hazard: archetype },
    characters: { block: { archetype: "hazard", art: "block", cols: 10, rows: 10 } },
  },
  {},
  undefined,
  {},
  { character: "block", col: 0, row: 0 },
);
const bounds = { height: 400, width: 300, x: 0, y: 0 };
const spawn: BehaviourAction = {
  armSeconds: 0,
  character: "block",
  gravity: 0,
  kind: "spawn",
  lifeSeconds: 3,
  maxAlive: 1,
  offset: { x: 0, y: 0 },
  velocity: { x: 0, y: 100 },
};
const event: SpawnEvent = {
  action: spawn,
  at: { x: 100, y: 0 },
  emitter: 0,
  emitterWidth: 48,
  facing: 1,
  template,
  time: 0,
};
const bird = { height: 10, width: 10, x: 100, y: 60 };
const run = (
  tops: readonly Rect[],
  target = bird,
  events: readonly SpawnEvent[] = [event],
  existing: readonly Transient[] = [],
  seconds = 1,
) => stepTransients(bounds, [], tops, seconds, target, target, events, existing, 0);

describe("bounded transient hazards", () => {
  it.each([
    { lethal: false, top: 40 },
    { lethal: true, top: 100 },
    { lethal: false, top: 60 },
  ])("orders swept bird contact before landing at $top", ({ lethal, top }) => {
    const result = run([{ height: 12, width: 300, x: 0, y: top }]);
    expect(result.lethal).toBe(lethal);
    expect(result.entities).toEqual([]);
  });

  it.each([false, true])(
    "retains exact contact provenance after a lethal transient is removed, cue=%s",
    (marked) => {
      const source = {
        ...event,
        emitter: 7,
        template: { ...template, ...(marked && { contactCue: "red-hazard" as const }) },
      };
      const result = run([{ height: 12, width: 300, x: 0, y: 100 }], bird, [source]);
      expect(result.lethal).toBe(true);
      expect(result.entities).toEqual([]);
      expect(result.contact).toEqual({
        emitter: 7,
        id: 0,
        kind: "transient",
        ...(marked && { contactCue: "red-hazard" }),
      });
    },
  );

  it("keeps a stationary trap harmless until armed and honours its live cap", () => {
    const trap = {
      ...event,
      action: { ...spawn, armSeconds: 0.5, armingAnimation: "warning", velocity: { x: 0, y: 0 } },
      at: { x: 100, y: 60 },
    };
    const first = run([], bird, [trap, trap], [], 0.25);
    expect(first.entities).toHaveLength(1);
    expect(first.lethal).toBe(false);
    expect(first.entities[0]).toMatchObject({ age: 0.25, armingAnimation: "warning", id: 0 });
    expect(run([], bird, [], first.entities, 0.25).lethal).toBe(true);
    expect(run([], bird, [], first.entities, 4).entities).toEqual([]);
  });

  it("expires out of bounds and preserves stable IDs without spawning on every step", () => {
    const first = run([], { ...bird, x: 200 }, [event], [], 0.1);
    const second = stepTransients(
      bounds,
      [],
      [],
      0.1,
      bird,
      bird,
      [],
      first.entities,
      first.nextId,
    );
    expect(second.entities[0]?.id).toBe(first.entities[0]?.id);
    expect(second.nextId).toBe(1);
    expect(run([], { ...bird, x: 200 }, [{ ...event, at: { x: 301, y: 0 } }]).entities).toEqual([]);
  });
});

it.each([
  { facing: 1 as const, vx: 100, x: 110 },
  { facing: -1 as const, vx: -100, x: 128 },
])("captures optional reflected spawn offset and arc velocity $facing", ({ facing, vx, x }) => {
  const reflected = {
    ...event,
    action: {
      ...spawn,
      gravity: 100,
      mirrorWithFacing: true,
      offset: { x: 10, y: 20 },
      velocity: { x: 100, y: -50 },
    },
    facing,
  };
  const result = stepTransients(
    bounds,
    [],
    [],
    0.1,
    { ...bird, x: 250 },
    { ...bird, x: 250 },
    [{ ...reflected, time: 0.1 }],
    [],
    0,
  );
  expect(result.entities[0]?.at).toEqual({ x, y: 20 });
  expect(result.entities[0]?.velocity.x).toBe(vx);
});

it.each([
  { lethal: false, solid: { height: 100, width: 5, x: 150, y: 0 }, target: { ...bird, x: 170 } },
  { lethal: true, solid: { height: 100, width: 5, x: 150, y: 0 }, target: { ...bird, x: 120 } },
])("orders a thrown hazard against solid side cover: $lethal", ({ lethal, solid, target }) => {
  const thrown = {
    ...event,
    action: { ...spawn, velocity: { x: 100, y: 0 } },
    at: { x: 100, y: 60 },
  };
  const result = stepTransients(bounds, [solid], [], 1, target, target, [thrown], [], 0);
  expect(result.lethal).toBe(lethal);
  expect(result.entities).toEqual([]);
});
