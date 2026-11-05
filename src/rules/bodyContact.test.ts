import { expect, it } from "vitest";

import { contactFrameAt, silhouetteContact, spriteFrameOrigin } from "../core";
import { BIRD } from "../data/bird";
import type { Archetype, BehaviourPlan, SpriteContact, ZoneLayout } from "../data/types";
import { SKILL_PROFILES } from "../progress";
import { startBehaviour, stepBehaviour } from "./behaviour";
import { startBird } from "./bird";
import { objectLayout } from "./tiles";
import { startZone, stepZone } from "./zone";

const contact: SpriteContact = {
  frame: { height: 4, width: 8 },
  frames: {
    empty: [],
    left: [
      [0, 0, 2],
      [1, 0, 2],
    ],
    open: [
      [0, 0, 2],
      [0, 6, 8],
      [1, 0, 2],
      [1, 6, 8],
    ],
  },
  tags: {
    idle: {
      frames: [
        { frame: "left", seconds: 0.1 },
        { frame: "empty", seconds: 0.1 },
      ],
      once: false,
    },
    once: {
      frames: [
        { frame: "left", seconds: 0.1 },
        { frame: "empty", seconds: 0.1 },
      ],
      once: true,
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
const plan: BehaviourPlan = {
  axis: "x",
  distance: 40,
  initial: "first",
  states: {
    first: {
      animation: "idle",
      motion: { direction: 1, kind: "move", speed: 100 },
      transitions: [{ to: "second", when: [{ kind: "elapsed", seconds: 0.05 }] }],
    },
    second: {
      animation: "idle",
      motion: { direction: 1, kind: "move", speed: 100 },
      transitions: [],
    },
  },
};
const actor = objectLayout(
  1,
  {
    archetypes: { actor: archetype },
    characters: {
      actor: {
        animations: { idle: "idle" },
        archetype: "actor",
        art: "actor",
        behaviour: plan,
        cols: 8,
        rows: 4,
      },
    },
  },
  { actor: { contact, frame: contact.frame, hitbox: { height: 1, width: 1, x: 3, y: 2 } } },
  undefined,
  {},
  { character: "actor", col: 0, row: 0 },
);

it.each([
  { expected: false, flip: false, frame: "open", x: 3 },
  { expected: true, flip: false, frame: "open", x: 0 },
  { expected: false, flip: true, frame: "left", x: 0 },
  { expected: true, flip: true, frame: "left", x: 6 },
  { expected: false, flip: false, frame: "empty", x: 0 },
])(
  "uses opaque pixels, full-frame padding and exact horizontal reflection: %j",
  ({ expected, flip, frame, x }) => {
    const target = { height: 1, width: 1, x, y: 0 };
    expect(
      silhouetteContact(actor, frame, flip, { x: 0, y: 0 }, { x: 0, y: 0 }, target, target),
    ).toBe(expected);
  },
);

it("shares rounded bottom-centred frame origin and scaling with rendering", () => {
  const size = { height: 8, width: 12 };
  expect(spriteFrameOrigin(contact.frame, size, { x: 10.4, y: 20.4 })).toEqual({ x: 12, y: 24 });
  const scaled = { ...actor, ...size };
  const target = { height: 1, width: 1, x: 10, y: 20 };
  expect(
    silhouetteContact(scaled, "left", false, { x: 10, y: 20 }, { x: 10, y: 20 }, target, target, {
      x: 2,
      y: 2,
    }),
  ).toBe(true);
});

it.each([
  { expected: true, y: 0 },
  { expected: false, y: 3 },
])("sweeps opaque runs without union-padding collisions: %j", ({ expected, y }) => {
  const target = { height: 1, width: 1, x: 10, y };
  expect(
    silhouetteContact(actor, "left", false, { x: 0, y: 0 }, { x: 20, y: 0 }, target, target),
  ).toBe(expected);
});

it("splits movement at exact pose changes and keeps the clock across same-tag states", () => {
  const bird = startBird(BIRD, { x: 100, y: 100 });
  const initial = startBehaviour(BIRD, actor, bird);
  const stepped = stepBehaviour(BIRD, actor, [], 0.2, bird, actor.origin, initial);
  expect(stepped.segments.map((segment) => [segment.start, segment.end, segment.frame])).toEqual([
    [0, 0.05, "left"],
    [0.05, 0.1, "left"],
    [0.1, 0.2, "empty"],
  ]);
  const target = { height: 1, width: 1, x: 16, y: 0 };
  expect(
    stepped.segments.some((segment) =>
      silhouetteContact(
        actor,
        segment.frame as string,
        false,
        segment.from,
        segment.to,
        target,
        target,
      ),
    ),
  ).toBe(false);
  expect(silhouetteContact(actor, "left", false, actor.origin, stepped.at, target, target)).toBe(
    true,
  );
  expect(stepped.state.animationSeconds).toBeCloseTo(0.2);
  expect(contactFrameAt(contact, "idle", 0.1).frame).toBe("empty");
  expect(contactFrameAt(contact, "once", 1)).toEqual({ frame: "empty", remaining: Infinity });
});

it("advances inactive visible frames but freezes them when no world step runs", () => {
  const waiting = { ...actor, scene: "intro" };
  const bird = startBird(BIRD, { x: 100, y: 100 });
  const initial = startBehaviour(BIRD, waiting, bird);
  const next = stepBehaviour(BIRD, waiting, [], 0.15, bird, waiting.origin, initial);
  expect(next.state.active).toBe(false);
  expect(next.actions).toEqual([]);
  expect(next.at).toEqual(waiting.origin);
  expect(
    contactFrameAt(
      contact,
      next.state.animationTag as string,
      next.state.animationSeconds as number,
    ).frame,
  ).toBe("empty");
  expect(stepBehaviour(BIRD, waiting, [], 0, bird, waiting.origin, next.state).state).toBe(
    next.state,
  );
});

it.each([
  { lethal: true, x: 200 },
  { lethal: false, x: 224 },
])("uses silhouettes in real zone death resolution at x=$x", ({ lethal, x }) => {
  const body = {
    ...actor,
    contact: { ...contact, frame: { height: 40, width: 64 } },
    height: 40,
    hitbox: { height: 40, width: 64, x: 0, y: 0 },
    origin: { x: 200, y: 200 },
    width: 64,
  };
  const layout: ZoneLayout = {
    areas: {
      main: {
        backX: 0,
        chunks: [],
        entries: { start: { x: 100, y: 200 } },
        exitX: 900,
        height: 360,
        objects: [body],
        solids: [],
        terrain: [],
        tileset: undefined,
        width: 1000,
      },
    },
    birdFrame: { height: 42, width: 48 },
    start: { area: "main", entry: "start" },
  };
  const initial = startZone(BIRD, layout, 1);
  const next = stepZone(
    SKILL_PROFILES,
    BIRD,
    layout,
    1 / 120,
    { jumpHeld: false, move: 0, useHeld: false },
    { ...initial, bird: { ...initial.bird, x, y: 200 } },
  );
  expect(next.death !== undefined).toBe(lethal);
});
