import { expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { AreaLayout, ZoneLayout } from "../data/types";
import { SKILL_PROFILES } from "../progress";
import { startZone, stepZone } from "../rules/zone";
import { walkRequiredRoutes } from "./zoneWalk";

const tuning = { ...BIRD, doubleJump: false };
function floor(cols: number, entry: number): AreaLayout {
  return {
    backX: TILE,
    chunks: [],
    entries: { start: { x: entry * TILE, y: 10 * TILE } },
    exitX: (cols - 1) * TILE,
    height: 20 * TILE,
    objects: [],
    solids: [{ height: 10 * TILE, width: cols * TILE, x: 0, y: 10 * TILE }],
    terrain: [],
    tileset: undefined,
    width: cols * TILE,
  };
}
function fork(connected: boolean): ZoneLayout {
  return {
    areas: {
      a: {
        ...floor(10, 4),
        ...(connected && { walkLinks: { right: { area: "b", entry: "start" } } }),
      },
      b: floor(10, 4),
      hub: {
        ...floor(20, 10),
        backX: 8 * TILE,
        walkLinks: { left: { area: "a", entry: "start" }, right: { area: "b", entry: "start" } },
      },
    },
    birdFrame: BIRD_FRAME,
    start: { area: "hub", entry: "start" },
  };
}
function playedAreas(layout: ZoneLayout, direction: -1 | 1): string[] {
  let zone = startZone(tuning, layout, 1);
  const visited = new Set([zone.area]);
  for (let ticks = 0; ticks < 400 && !zone.cleared; ticks++) {
    zone = stepZone(
      SKILL_PROFILES,
      tuning,
      layout,
      STEP_SECONDS,
      {
        jumpHeld: false,
        move: zone.area === "hub" ? direction : 1,
        useHeld: false,
      },
      zone,
    );
    visited.add(zone.area);
  }
  expect(zone.death).toBeUndefined();
  expect(zone.restarts).toBe(0);
  expect(zone.cleared).toBe(true);
  return [...visited];
}

it.each([
  {
    complete: false,
    connected: false,
    interval: false,
    name: "mutually exclusive branch surfaces",
  },
  {
    complete: true,
    connected: true,
    interval: false,
    name: "one connected branch-to-branch clear",
  },
  {
    complete: false,
    connected: false,
    interval: true,
    name: "an interval witnessed only on the other clear branch",
  },
])("requires a single cleared ancestry for $name", ({ complete, connected, interval }) => {
  const layout = fork(connected);
  expect(playedAreas(layout, -1)).toEqual(connected ? ["hub", "a", "b"] : ["hub", "a"]);
  expect(playedAreas(layout, 1)).toEqual(["hub", "b"]);
  const result = walkRequiredRoutes(
    tuning,
    {
      targets: [
        { area: "a", at: { col: 4, row: 10 }, ...(interval && { xRange: { max: 6, min: 4 } }) },
        { area: "b", at: { col: 4, row: 10 } },
      ],
      tile: TILE,
    },
    layout,
  );
  expect(result.cleared).toBe(true);
  expect(result.complete).toBe(complete);
});
