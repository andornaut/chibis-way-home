import { describe, expect, it } from "vitest";

import { STATIC_MOTION } from "../data/archetypes";
import { BIRD } from "../data/bird";
import type { ObjectLayout, Rect, ZoneLayout } from "../data/types";
import { STEP_SECONDS } from "../rules/step";
import { retryZone, startZone, stepZone } from "../rules/zone";
import { BIRD_FRAME } from "../view/bird";
import { botInput, DIAGNOSTIC_SKILL, navigationCounters, newBot, prepareSensors } from "./bot";
import {
  NAVIGATION_DEFAULTS,
  NAVIGATION_VALIDATION,
  plannedInput,
  rememberNavigationFailure,
  restoreNavigationMemory,
  validateNavigation,
} from "./navigation";
function movingObject(
  collision: ObjectLayout["collision"],
  origin: {
    x: number;
    y: number;
  },
): ObjectLayout {
  return {
    animations: {
      idle: undefined,
      move: undefined,
      open: undefined,
      react: undefined,
      talk: undefined,
    },
    art: "fixture",
    character: "fixture",
    collision,
    height: 12,
    hitbox: undefined,
    interaction: { kind: "none", range: 0 },
    lines: [],
    motion: {
      algorithm: "linear",
      direction: "down",
      distance: 144,
      hopHeight: 0,
      pause: 1,
      speed: 120,
      variance: 0,
    },
    origin,
    phase: 0,
    quips: [],
    quirks: [],
    reaction: { kind: "none", range: 0, speed: 0 },
    room: undefined,
    scene: undefined,
    width: 72,
  };
}
function fixture(solids: readonly Rect[]): ZoneLayout {
  return {
    areas: {
      main: {
        backX: 0,
        chunks: [],
        entries: { start: { x: 60, y: 240 } },
        exitX: 350,
        height: 300,
        objects: [],
        solids,
        terrain: [],
        tileset: undefined,
        width: 400,
      },
    },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
}
function traverse(layout: ZoneLayout, maxTicks = 300) {
  const bot = newBot(1),
    sensors = prepareSensors(layout);
  let zone = startZone(BIRD, layout, 1);
  let ticks = 0;
  const landings: number[] = [];
  for (; ticks < maxTicks && !zone.cleared && !zone.death; ticks++) {
    const input = botInput(
      BIRD,
      sensors,
      layout,
      DIAGNOSTIC_SKILL,
      { jump: "planned", move: 1 },
      zone,
      bot,
    );
    zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    if (zone.bird.grounded) {
      landings.push(zone.bird.y + BIRD.height);
    }
  }
  return { bot, landings, ticks, zone };
}
describe("bounded real-rule navigation", () => {
  it("climbs successive five and six tile faces with deliberate full holds", () => {
    const result = traverse(
      fixture([
        { height: 60, width: 144, x: 0, y: 240 },
        { height: 120, width: 96, x: 144, y: 180 },
        { height: 192, width: 160, x: 240, y: 108 },
      ]),
    );
    expect(result.zone.death).toBeUndefined();
    expect(
      result.zone.cleared,
      JSON.stringify({ bird: result.zone.bird, navigation: result.bot.navigation }),
    ).toBe(true);
    expect(navigationCounters(result.bot).physicsSteps).toBeLessThanOrEqual(200000);
  });
  it("uses a short hop under a roof and crosses a gap without changing the real state during planning", () => {
    const base = fixture([
      { height: 60, width: 144, x: 0, y: 240 },
      { height: 96, width: 96, x: 144, y: 204 },
      { height: 12, width: 120, x: 120, y: 148 },
      { height: 60, width: 100, x: 300, y: 240 },
    ]);
    const ceiling: ObjectLayout = {
      ...movingObject("hazard", { x: 120, y: 160 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 120,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: { main: { ...base.areas.main!, objects: [ceiling] } },
    };
    const initial = startZone(BIRD, layout, 1),
      snapshot = JSON.stringify(initial);
    plannedInput(BIRD, layout, undefined, 1, initial, newBot(1));
    expect(JSON.stringify(initial)).toBe(snapshot);
    const result = traverse(layout);
    expect(result.zone.death).toBeUndefined();
    expect(
      result.zone.cleared,
      JSON.stringify({ bird: result.zone.bird, navigation: result.bot.navigation }),
    ).toBe(true);
  });
  it("waits for a late lift then boards and transfers to a higher landing", () => {
    const base = fixture([
      { height: 60, width: 120, x: 0, y: 240 },
      { height: 204, width: 160, x: 240, y: 96 },
    ]);
    const lift = {
      ...movingObject("ledge", { x: 132, y: 96 }),
      motion: { ...movingObject("ledge", { x: 132, y: 96 }).motion, pause: 8 },
    };
    const layout: ZoneLayout = {
      ...base,
      areas: { main: { ...base.areas.main!, objects: [lift] } },
    };
    const result = traverse(layout, 1800);
    expect(result.zone.death).toBeUndefined();
    expect(
      result.zone.cleared,
      JSON.stringify({ bird: result.zone.bird, navigation: result.bot.navigation }),
    ).toBe(true);
  });
  it("uses real hazard timing to wait for a blocked corridor to open", () => {
    const base = fixture([{ height: 60, width: 400, x: 0, y: 240 }]);
    const hazard: ObjectLayout = {
      ...movingObject("hazard", { x: 156, y: 120 }),
      height: 120,
      motion: {
        ...movingObject("hazard", { x: 156, y: 120 }).motion,
        direction: "up",
        distance: 180,
        pause: 1,
      },
      width: 24,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: { main: { ...base.areas.main!, objects: [hazard] } },
    };
    const result = traverse(layout, 450);
    expect(result.zone.death).toBeUndefined();
    expect(
      result.zone.cleared,
      JSON.stringify({ bird: result.zone.bird, navigation: result.bot.navigation }),
    ).toBe(true);
  });
  it("clears queued decisions on linked-area changes and never predicts after exhausting its budget", () => {
    const layout = fixture([{ height: 60, width: 400, x: 0, y: 240 }]);
    const main = layout.areas.main!;
    const linked: ZoneLayout = {
      ...layout,
      areas: {
        main: { ...main, exitX: 180, walkLinks: { right: { area: "upper", entry: "start" } } },
        upper: {
          ...main,
          entries: { start: { x: 24, y: 240 } },
          walkLinks: { left: { area: "main", entry: "start" } },
        },
      },
    };
    const result = traverse(linked);
    expect(
      result.zone.cleared,
      JSON.stringify({
        area: result.zone.area,
        bird: result.zone.bird,
        navigation: result.bot.navigation,
      }),
    ).toBe(true);
    const bot = newBot(1),
      state = startZone(BIRD, layout, 1);
    expect(plannedInput(BIRD, layout, { maxPhysicsSteps: 0 }, 1, state, bot).move).toBe(0);
    expect(bot.navigation?.status).toBe("budget-exhausted");
    expect(navigationCounters(bot).physicsSteps).toBe(0);
    expect(() => validateNavigation({ horizonTicks: 91 })).toThrow("horizonTicks");
  });
  it("reuses validated flat-ground actions instead of repeating every candidate at every replan", () => {
    const result = traverse(fixture([{ height: 60, width: 400, x: 0, y: 240 }]));
    expect(result.zone.cleared).toBe(true);
    const counters = navigationCounters(result.bot);
    expect(counters.decisions).toBeLessThan(result.ticks / NAVIGATION_DEFAULTS.replanTicks / 2);
    expect(counters.physicsSteps).toBeLessThanOrEqual(NAVIGATION_DEFAULTS.maxPhysicsSteps);
  });
  it("invalidates a cached rollout when actual state diverges", () => {
    const layout = fixture([{ height: 60, width: 400, x: 0, y: 240 }]),
      bot = newBot(1);
    let zone = startZone(BIRD, layout, 1);
    zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      plannedInput(BIRD, layout, undefined, 1, zone, bot),
      zone,
    );
    const input = plannedInput(BIRD, layout, undefined, 1, zone, bot);
    zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    const decisions = navigationCounters(bot).decisions;
    plannedInput(
      BIRD,
      layout,
      undefined,
      1,
      { ...zone, bird: { ...zone.bird, x: zone.bird.x + 1 } },
      bot,
    );
    expect(navigationCounters(bot).decisions).toBeGreaterThan(decisions);
  });
  it("retains only bounded actual-death memory across a reseeded retry bot", () => {
    const base = fixture([{ height: 60, width: 400, x: 0, y: 240 }]);
    const hazard = {
      ...movingObject("hazard", { x: 72, y: 204 }),
      height: 36,
      motion: STATIC_MOTION,
      width: 24,
    };
    const layout = { ...base, areas: { main: { ...base.areas.main!, objects: [hazard] } } };
    const bot = newBot(1);
    let zone = startZone(BIRD, layout, 1);
    expect(rememberNavigationFailure(zone, bot).deaths).toHaveLength(0);
    for (let count = 0; count < 17; count++) {
      zone = stepZone(
        BIRD,
        layout,
        STEP_SECONDS,
        { jumpHeld: false, move: 1, useHeld: false },
        zone,
      );
      expect(zone.death?.reason).toBe("hazard");
      rememberNavigationFailure(zone, bot);
      zone = retryZone(BIRD, layout, zone);
    }
    const retry = newBot(2);
    restoreNavigationMemory(bot.navigationMemory!, retry);
    expect(retry.navigationMemory?.deaths).toHaveLength(16);
    expect(navigationCounters(retry).physicsSteps).toBe(0);
    expect(newBot(1).navigationMemory).toBeUndefined();
  });
  it("takes a refuge above a periodically charging ground hazard", () => {
    const base = fixture([{ height: 60, width: 400, x: 0, y: 240 }]);
    const refuge = { ...movingObject("ledge", { x: 96, y: 180 }), motion: STATIC_MOTION };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 240, y: 200 }),
      behaviour: {
        axis: "x",
        distance: -144,
        initial: "warn",
        states: {
          rest: {
            animation: "rest",
            motion: { kind: "wait" },
            transitions: [{ to: "return", when: [{ kind: "elapsed", seconds: 0.5 }] }],
          },
          return: {
            animation: "walk",
            motion: { direction: 1, kind: "move", speed: 300 },
            transitions: [{ to: "warn", when: [{ kind: "boundary" }] }],
          },
          rush: {
            animation: "rush",
            motion: { direction: -1, kind: "move", speed: 300 },
            transitions: [{ to: "rest", when: [{ kind: "boundary" }] }],
          },
          warn: {
            animation: "warn",
            motion: { kind: "wait" },
            transitions: [{ to: "rush", when: [{ kind: "elapsed", seconds: 0.35 }] }],
          },
        },
      },
      height: 40,
      motion: STATIC_MOTION,
      width: 60,
    };
    const layout = { ...base, areas: { main: { ...base.areas.main!, objects: [refuge, actor] } } };
    const result = traverse(layout, 600);
    expect(result.zone.death).toBeUndefined();
    expect(result.zone.cleared).toBe(true);
    expect(result.landings).toContain(refuge.origin.y);
  });
  it("requires explicit validation profile for larger work while preserving every other hard cap", () => {
    expect(validateNavigation()).toEqual(NAVIGATION_DEFAULTS);
    expect(() =>
      validateNavigation({ maxPhysicsSteps: NAVIGATION_VALIDATION.maxPhysicsSteps }),
    ).toThrow("maxPhysicsSteps");
    expect(validateNavigation({ profile: "validation" })).toEqual(NAVIGATION_VALIDATION);
    expect(() =>
      validateNavigation({
        horizonTicks: NAVIGATION_DEFAULTS.horizonTicks + 1,
        profile: "validation",
      }),
    ).toThrow("horizonTicks");
    expect(() =>
      validateNavigation({
        maxPhysicsSteps: NAVIGATION_VALIDATION.maxPhysicsSteps + 1,
        profile: "validation",
      }),
    ).toThrow("maxPhysicsSteps");
    expect(() => validateNavigation({ profile: "unknown" as "quick" })).toThrow("profile");
  });
});
