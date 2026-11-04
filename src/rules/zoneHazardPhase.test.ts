import { expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { WARNED_VENT_BEHAVIOUR, WARNED_VENT_SECONDS } from "../data/obstacleBehaviours";
import type { Archetype, ZoneLayout } from "../data/types";
import { stepBehaviour } from "./behaviour";
import { effectiveHazardPhase } from "./effectiveCollision";
import { objectLayout } from "./tiles";
import { retryZone, startZone, stepZone } from "./zone";

const floor = { height: 40, width: 600, x: 0, y: 300 };
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
const vent = objectLayout(
  1,
  {
    archetypes: { obstacle: archetype },
    characters: {
      obstacle: {
        archetype: "obstacle",
        art: "placeholder-obstacle",
        behaviour: WARNED_VENT_BEHAVIOUR,
        cols: 48,
        rows: 36,
      },
    },
  },
  {
    "placeholder-obstacle": {
      frame: { height: 36, width: 48 },
      hitbox: { height: 1, width: 1, x: 47, y: 0 },
    },
  },
  undefined,
  {},
  { character: "obstacle", col: 100, row: floor.y - BIRD.height },
);
const layout: ZoneLayout = {
  areas: {
    main: {
      backX: 0,
      chunks: [],
      entries: { start: { x: 100, y: floor.y } },
      exitX: 590,
      height: 360,
      objects: [vent],
      solids: [floor],
      terrain: [],
      tileset: undefined,
      width: 600,
    },
  },
  birdFrame: BIRD_FRAME,
  start: { area: "main", entry: "start" },
};
const still = { jumpHeld: false, move: 0 as const, useHeld: false };

it.each([
  ["warning remains nonlethal", "warning", WARNED_VENT_SECONDS.warning / 2, false],
  [
    "exact activation endpoint is lethal",
    "warning",
    WARNED_VENT_SECONDS.warning - STEP_SECONDS,
    true,
  ],
  [
    "activation within a tick is lethal",
    "warning",
    WARNED_VENT_SECONDS.warning - STEP_SECONDS / 2,
    true,
  ],
  [
    "active slice remains lethal when the endpoint has recovered",
    "active",
    WARNED_VENT_SECONDS.active - STEP_SECONDS / 2,
    true,
  ],
] as const)("stepZone: %s", (_, stateKey, elapsed, lethal) => {
  const start = startZone(BIRD, layout, 1);
  const seconds =
    WARNED_VENT_SECONDS.inactive +
    elapsed +
    (stateKey === "active" ? WARNED_VENT_SECONDS.warning : 0);
  const clock = stepBehaviour(
    BIRD,
    vent,
    [],
    seconds,
    start.bird,
    vent.origin,
    start.behaviours[0]!,
  ).state;
  const state = { ...start, behaviours: [clock], seconds };
  const next = stepZone(BIRD, layout, STEP_SECONDS, still, state);
  expect(next.death !== undefined).toBe(lethal);
  if (lethal) {
    expect(next.death?.contact).toEqual({ index: 0, kind: "object" });
  }
  if (stateKey === "active") {
    expect(effectiveHazardPhase(vent, next.behaviours[0])).toBe("inactive");
  }
});

it("retries the same layout with its nonlethal initial clock and freezes a dead world", () => {
  const start = startZone(BIRD, layout, 1);
  const active = {
    ...start,
    behaviours: [{ ...start.behaviours[0]!, elapsed: 0, stateKey: "active" }],
  };
  const dead = stepZone(BIRD, layout, STEP_SECONDS, still, active);
  expect(dead.death).toBeDefined();
  expect(stepZone(BIRD, layout, STEP_SECONDS, still, dead)).toBe(dead);
  const retry = retryZone(BIRD, layout, dead);
  expect(effectiveHazardPhase(vent, retry.behaviours[0])).toBe("inactive");
  expect(retry.behaviours[0]?.elapsed).toBe(0);
  expect(stepZone(BIRD, layout, STEP_SECONDS, still, retry).death).toBeUndefined();
});
