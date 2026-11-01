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
  navigationSnapshot,
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
  it.each([
    { name: "open ground", requiredClimb: false },
    { name: "a required elevated ledge", requiredClimb: true },
  ])("clears a periodically charging hazard across $name", ({ requiredClimb }) => {
    const base = fixture([
      { height: 60, width: 400, x: 0, y: 240 },
      ...(requiredClimb ? [{ height: 180, width: 48, x: 168, y: 120 }] : []),
    ]);
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
    if (requiredClimb) {
      expect(result.landings).toContain(refuge.origin.y);
    }
  });
  it("anticipates a warning hazard at the forecast boundary and escapes before contact", () => {
    const base = fixture([{ height: 120, width: 720, x: 0, y: 300 }]);
    const refuge = { ...movingObject("ledge", { x: 96, y: 252 }), motion: STATIC_MOTION };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 350, y: 254 }),
      behaviour: {
        axis: "x",
        distance: -180,
        initial: "warn",
        states: {
          rest: {
            animation: "rest",
            motion: { kind: "wait" },
            transitions: [{ to: "return", when: [{ kind: "elapsed", seconds: 0.5 }] }],
          },
          return: {
            animation: "walk",
            motion: { direction: 1, kind: "move", speed: 120 },
            transitions: [{ to: "warn", when: [{ kind: "boundary" }] }],
          },
          rush: {
            animation: "rush",
            motion: { direction: -1, kind: "move", speed: 262.5 },
            transitions: [{ to: "rest", when: [{ kind: "boundary" }] }],
          },
          warn: {
            animation: "warn",
            motion: { kind: "wait" },
            transitions: [{ to: "rush", when: [{ kind: "elapsed", seconds: 2 }] }],
          },
        },
      },
      height: 46,
      motion: STATIC_MOTION,
      width: 44,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 132, y: 300 } },
          exitX: 660,
          height: 420,
          objects: [refuge, actor],
          width: 720,
        },
      },
    };
    const bot = newBot(1);
    let firstDecision: ReturnType<typeof navigationSnapshot>;
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    for (let tick = 0; tick < 900 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, undefined, 1, zone, bot);
      if (tick === 0) {
        firstDecision = navigationSnapshot(bot);
      }
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    expect(
      firstDecision!.candidates.some((candidate) => candidate.inputLabel === "backward-full"),
    ).toBe(true);
    expect(firstDecision!.chosenAction).not.toBe("backward-full");
  });
  it("retreats on the ground before an overhead interception beyond the first forecast", () => {
    const base = fixture([
      { height: 120, width: 240, x: 0, y: 600 },
      { height: 240, width: 48, x: 240, y: 480 },
      { height: 120, width: 432, x: 288, y: 600 },
    ]);
    const ledge = { ...movingObject("ledge", { x: 168, y: 540 }), motion: STATIC_MOTION };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 180, y: 510 }),
      behaviour: {
        axis: "y",
        distance: 42,
        initial: "warn",
        states: {
          down: {
            animation: "drop",
            motion: { direction: 1, kind: "move", speed: 240 },
            transitions: [{ to: "rest", when: [{ kind: "boundary" }] }],
          },
          rest: {
            animation: "rest",
            motion: { kind: "wait" },
            transitions: [],
          },
          warn: {
            animation: "prepare",
            motion: { kind: "wait" },
            transitions: [{ to: "down", when: [{ kind: "elapsed", seconds: 0.8 }] }],
          },
        },
      },
      height: 48,
      motion: STATIC_MOTION,
      width: 48,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 192, y: 600 } },
          exitX: 660,
          height: 720,
          objects: [ledge, actor],
          width: 720,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    let usedGroundEscape = false;
    let firstDecision: ReturnType<typeof navigationSnapshot>;
    for (let tick = 0; tick < 1200 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      if (tick === 0) {
        firstDecision = navigationSnapshot(bot);
      }
      usedGroundEscape ||= input.move === -1 && !input.jumpHeld && zone.bird.grounded;
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    expect(usedGroundEscape).toBe(true);
    const wait = firstDecision!.candidates.find((candidate) => candidate.inputLabel === "wait")!;
    expect(wait.rejection).toBe("death");
    expect(wait.physicsSteps).toBeGreaterThan(NAVIGATION_VALIDATION.horizonTicks);
    expect(wait.physicsSteps).toBeLessThanOrEqual(NAVIGATION_VALIDATION.horizonTicks * 2);
    expect(firstDecision!.candidates.length).toBeLessThanOrEqual(
      NAVIGATION_VALIDATION.maxCandidates,
    );
    expect(navigationCounters(bot).physicsSteps).toBeLessThanOrEqual(
      NAVIGATION_VALIDATION.maxPhysicsSteps,
    );
  });
  it("sequences a second jump after landing to clear a recurring overhead interceptor", () => {
    const base = fixture([
      { height: 120, width: 312, x: 0, y: 600 },
      { height: 240, width: 48, x: 312, y: 480 },
      { height: 120, width: 360, x: 360, y: 600 },
    ]);
    const ledge = { ...movingObject("ledge", { x: 168, y: 540 }), motion: STATIC_MOTION };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 168, y: 510 }),
      behaviour: {
        axis: "y",
        distance: 42,
        initial: "warn",
        states: {
          down: {
            animation: "drop",
            motion: { direction: 1, kind: "move", speed: 240 },
            transitions: [{ to: "rest", when: [{ kind: "boundary" }] }],
          },
          rest: {
            animation: "rest",
            motion: { kind: "wait" },
            transitions: [{ to: "up", when: [{ kind: "elapsed", seconds: 1 }] }],
          },
          up: {
            animation: "fly",
            motion: { direction: -1, kind: "move", speed: 120 },
            transitions: [{ to: "warn", when: [{ kind: "boundary" }] }],
          },
          warn: {
            animation: "prepare",
            motion: { kind: "wait" },
            transitions: [{ to: "down", when: [{ kind: "elapsed", seconds: 0.8 }] }],
          },
        },
      },
      height: 48,
      motion: STATIC_MOTION,
      width: 132,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 192, y: 600 } },
          exitX: 660,
          height: 720,
          objects: [ledge, actor],
          width: 720,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    let usedGroundEscape = false;
    let followupAt: number | undefined;
    let usedFollowup = false;
    let followupLandingAt: number | undefined;
    let replannedAfterFollowup = false;
    for (let tick = 0; tick < 1200 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      const decision = navigationSnapshot(bot)!;
      replannedAfterFollowup ||=
        followupLandingAt === zone.steps && decision.didReplan && zone.bird.grounded;
      expect(decision.candidates.length).toBeLessThanOrEqual(NAVIGATION_VALIDATION.maxCandidates);
      expect(
        decision.candidates.every(
          (candidate) =>
            candidate.physicsSteps <= NAVIGATION_VALIDATION.horizonTicks * 2 &&
            (candidate.continuationSteps ?? 0) <= NAVIGATION_VALIDATION.horizonTicks,
        ),
      ).toBe(true);
      if (decision.didReplan) {
        const selected = decision.candidates.find(
          (candidate) =>
            candidate.inputLabel === decision.chosenAction &&
            (candidate.executionProgress ?? candidate.forwardProgress) ===
              decision.predictedProgress,
        );
        if (
          selected?.followup &&
          selected.executionSteps !== undefined &&
          selected.executionSteps < selected.physicsSteps
        ) {
          followupLandingAt = zone.steps + selected.executionSteps;
        }
        followupAt =
          selected?.followup === undefined ? undefined : zone.steps + selected.followup.startTick;
      }
      usedFollowup ||= followupAt !== undefined && zone.steps >= followupAt && input.jumpHeld;
      usedGroundEscape ||= input.move === -1 && !input.jumpHeld && zone.bird.grounded;
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    expect(usedGroundEscape).toBe(true);
    expect(usedFollowup).toBe(true);
    expect(replannedAfterFollowup).toBe(true);
  });
  it.each([
    { bump: false, first: 552, floor: 564, name: "walk off a low bump", roof: 480 },
    { bump: true, first: 564, floor: 564, name: "tap over a low bump", roof: 480 },
    {
      bump: false,
      first: 432,
      floor: 432,
      name: "pass under a red-covered refuge roof",
      roof: 372,
    },
  ])("chooses a safe follow-up to $name", ({ bump, first, floor, roof }) => {
    const roofX = roof === 372 ? 144 : 0;
    const base = fixture([
      { height: 720 - first, width: 144, x: 0, y: first },
      ...(bump ? [{ height: 720 - floor + 12, width: 24, x: 144, y: floor - 12 }] : []),
      { height: 720 - floor, width: 576, x: 144, y: floor },
    ]);
    const roofSolid = {
      ...movingObject("solid", { x: roofX, y: roof }),
      height: 3,
      motion: STATIC_MOTION,
      width: 360,
    };
    const edge = {
      ...movingObject("hazard", { x: roofX, y: roof + 3 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 360,
    };
    const top = { ...edge, origin: { x: roofX, y: roof - 3 } };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 300, y: 0 }),
      behaviour: {
        axis: "x",
        distance: 0,
        initial: "wait",
        states: { wait: { animation: "idle", motion: { kind: "wait" }, transitions: [] } },
      },
      motion: STATIC_MOTION,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 60, y: first } },
          exitX: 660,
          height: 720,
          objects: [roofSolid, edge, top, actor],
          width: 720,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    let unsafeRoofTarget = false;
    for (let tick = 0; tick < 900 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      unsafeRoofTarget ||= navigationSnapshot(bot)?.waypoint?.y === roof;
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(unsafeRoofTarget).toBe(false);
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
  });
  it.each([
    {
      floor: 564,
      kind: "drop before climbing a distant refuge",
      roof: 456,
      roofHeight: 24,
      start: 552,
      strip: false,
    },
    {
      floor: 360,
      kind: "tap a floor strip after an intermediate landing",
      roof: 264,
      roofHeight: 3,
      start: 360,
      strip: true,
    },
  ])("resolves follow-up geometry to $kind", ({ floor, roof, roofHeight, start, strip }) => {
    const base = fixture([
      { height: 720 - start, width: 144, x: 0, y: start },
      { height: 720 - floor, width: 576, x: 144, y: floor },
    ]);
    const panel = {
      ...movingObject("solid", { x: 0, y: roof }),
      height: roofHeight,
      motion: STATIC_MOTION,
      width: 336,
    };
    const edge = {
      ...movingObject("hazard", { x: 0, y: roof + roofHeight }),
      height: 3,
      motion: STATIC_MOTION,
      width: 336,
    };
    const marker = strip
      ? {
          ...movingObject("hazard", { x: 192, y: floor - 3 }),
          height: 3,
          motion: STATIC_MOTION,
          width: 48,
        }
      : { ...movingObject("ledge", { x: 336, y: floor - 72 }), motion: STATIC_MOTION, width: 72 };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 300, y: 0 }),
      behaviour: {
        axis: "x",
        distance: 0,
        initial: "wait",
        states: { wait: { animation: "idle", motion: { kind: "wait" }, transitions: [] } },
      },
      motion: STATIC_MOTION,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 60, y: start } },
          exitX: 660,
          height: 720,
          objects: [panel, edge, marker, actor],
          width: 720,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    for (let tick = 0; tick < 1200 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
  });
  it("retains grounded walking when jumping under a roof is lethal", () => {
    const base = fixture([
      { height: 180, width: 144, x: 0, y: 240 },
      { height: 132, width: 576, x: 144, y: 288 },
      { height: 24, width: 180, x: 0, y: 156 },
    ]);
    const roof = {
      ...movingObject("hazard", { x: 0, y: 180 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 180,
    };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 290, y: 242 }),
      behaviour: {
        axis: "x",
        distance: 0,
        initial: "wait",
        states: { wait: { animation: "idle", motion: { kind: "wait" }, transitions: [] } },
      },
      height: 46,
      motion: STATIC_MOTION,
      width: 44,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: { ...base.areas.main!, exitX: 660, height: 420, objects: [roof, actor], width: 720 },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    let first: ReturnType<typeof navigationSnapshot>;
    for (let tick = 0; tick < 900 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      if (tick === 0) {
        first = navigationSnapshot(bot);
      }
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    expect(first!.candidates.some((candidate) => candidate.inputLabel === "walk")).toBe(true);
    expect(
      first!.candidates.some((candidate) => candidate.inputLabel === "retreat-to-support"),
    ).toBe(true);
    expect(first!.candidates.some((candidate) => candidate.inputLabel === "backward-full")).toBe(
      true,
    );
    expect(first!.candidates.length).toBeLessThanOrEqual(NAVIGATION_VALIDATION.maxCandidates);
  });
  it("replans after a late landing before an approaching charger intercepts the idle tail", () => {
    const base = fixture([
      { height: 180, width: 144, x: 0, y: 240 },
      { height: 120, width: 384, x: 336, y: 300 },
    ]);
    const gap = {
      ...movingObject("hazard", { x: 144, y: 357 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 192,
    };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 440, y: 254 }),
      behaviour: {
        axis: "x",
        distance: -104,
        initial: "warn",
        states: {
          rest: { animation: "rest", motion: { kind: "wait" }, transitions: [] },
          rush: {
            animation: "rush",
            motion: { direction: -1, kind: "move", speed: 300 },
            transitions: [{ to: "rest", when: [{ kind: "boundary" }] }],
          },
          warn: {
            animation: "warn",
            motion: { kind: "wait" },
            transitions: [{ to: "rush", when: [{ kind: "elapsed", seconds: 1.55 }] }],
          },
        },
      },
      height: 46,
      motion: STATIC_MOTION,
      width: 44,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 112, y: 240 } },
          exitX: 660,
          height: 420,
          objects: [gap, actor],
          width: 720,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    let sawPrefix = false;
    let prefixAt: number | undefined;
    let usedPrefixReplan = false;
    for (let tick = 0; tick < 900 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      const decision = navigationSnapshot(bot)!;
      usedPrefixReplan ||= prefixAt === zone.steps && decision.didReplan && zone.bird.grounded;
      if (decision.didReplan) {
        const selected = decision.candidates.find(
          (candidate) =>
            candidate.inputLabel === decision.chosenAction &&
            (candidate.executionProgress ?? candidate.forwardProgress) ===
              decision.predictedProgress,
        );
        if (
          selected?.executionSteps !== undefined &&
          selected.executionSteps < selected.physicsSteps
        ) {
          prefixAt = zone.steps + selected.executionSteps;
        }
      }
      sawPrefix ||= decision.candidates.some(
        (candidate) =>
          (candidate.executionSteps ?? candidate.physicsSteps) < candidate.physicsSteps &&
          candidate.rejection === null,
      );
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    expect(sawPrefix).toBe(true);
    expect(usedPrefixReplan).toBe(true);
  });
  it("finishes a reverse flight onto lower ground before completing the forward route", () => {
    const base = fixture([{ height: 180, width: 1200, x: 0, y: 420 }]);
    const ledge = { ...movingObject("ledge", { x: 560, y: 240 }), motion: STATIC_MOTION };
    const actor: ObjectLayout = {
      ...movingObject("hazard", { x: 632, y: 0 }),
      behaviour: {
        axis: "x",
        distance: 0,
        initial: "wait",
        states: { wait: { animation: "idle", motion: { kind: "wait" }, transitions: [] } },
      },
      height: 240,
      motion: STATIC_MOTION,
      width: 48,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 608, y: 240 } },
          exitX: 1100,
          height: 600,
          objects: [ledge, actor],
          width: 1200,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    let reverseLanding = false;
    let first: ReturnType<typeof navigationSnapshot>;
    for (let tick = 0; tick < 1200 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      if (tick === 0) {
        first = navigationSnapshot(bot);
      }
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
      reverseLanding ||=
        zone.bird.grounded && zone.bird.x < 560 && zone.bird.y + BIRD.height === 420;
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    expect(reverseLanding, JSON.stringify(first)).toBe(true);
    const backward = first!.candidates.find(
      (candidate) => candidate.inputLabel === "backward-full",
    )!;
    expect(backward.rejection).toBeNull();
    expect(backward.forwardProgress).toBeLessThan(0);
    expect(backward.predictedEndpoint.grounded).toBe(true);
    expect(backward.physicsSteps).toBeGreaterThan(NAVIGATION_VALIDATION.horizonTicks);
    expect(backward.physicsSteps).toBeLessThanOrEqual(NAVIGATION_VALIDATION.horizonTicks * 2);
  });
  it("waits for a delayed shuttle rather than sliding off a late narrow-post landing", () => {
    const base = fixture([
      { height: 240, width: 264, x: 0, y: 300 },
      { height: 288, width: 48, x: 264, y: 252 },
      { height: 36, width: 528, x: 264, y: 504 },
      { height: 288, width: 408, x: 792, y: 252 },
    ]);
    const red = {
      ...movingObject("hazard", { x: 264, y: 501 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 528,
    };
    const shuttle: ObjectLayout = {
      ...movingObject("ledge", { x: 720, y: 252 }),
      motion: {
        algorithm: "linear",
        direction: "left",
        distance: 408,
        hopHeight: 0,
        pause: 0.5,
        speed: 72,
        variance: 0,
      },
    };
    const lift: ObjectLayout = {
      ...movingObject("ledge", { x: 48, y: 300 }),
      motion: {
        algorithm: "linear",
        direction: "up",
        distance: 120,
        hopHeight: 0,
        pause: 0.5,
        speed: 48,
        variance: 0,
      },
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 181, y: 300 } },
          exitX: 1140,
          height: 540,
          objects: [red, lift, shuttle],
          width: 1200,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    let first: ReturnType<typeof navigationSnapshot>;
    for (let tick = 0; tick < 2400 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      if (tick === 0) {
        first = navigationSnapshot(bot);
      }
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    const unstable = first!.candidates.find(
      (candidate) => candidate.inputLabel === "wait-then-full",
    )!;
    expect(unstable.rejection).toBe("airborne");
    expect(unstable.physicsSteps).toBeGreaterThan(NAVIGATION_VALIDATION.horizonTicks);
    expect(unstable.physicsSteps).toBeLessThanOrEqual(NAVIGATION_VALIDATION.horizonTicks * 2);
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
  it("crosses a short-only one-tile bump when starting flush against its face", () => {
    const base = fixture([
      { height: 60, width: 336, x: 0, y: 240 },
      { height: 72, width: 72, x: 336, y: 228 },
      { height: 60, width: 152, x: 408, y: 240 },
      { height: 24, width: 288, x: 240, y: 132 },
    ]);
    const ceiling = {
      ...movingObject("hazard", { x: 240, y: 156 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 288,
    };
    const layout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 324, y: 240 } },
          exitX: 540,
          objects: [ceiling],
          width: 560,
        },
      },
    };
    const result = traverse(layout, 360);
    expect(result.zone.death).toBeUndefined();
    expect(
      result.zone.cleared,
      JSON.stringify({
        bird: result.zone.bird,
        candidates: result.bot.navigation?.diagnostic?.candidates,
        counters: navigationCounters(result.bot),
        decision: result.bot.navigation?.decision,
        waypoint: result.bot.navigation?.waypoint,
      }),
    ).toBe(true);
  });
  it("approaches a supported takeoff before crossing a long gap above lethal terrain", () => {
    const base = fixture([
      { height: 180, width: 144, x: 0, y: 240 },
      { height: 180, width: 200, x: 336, y: 240 },
    ]);
    const hazard = {
      ...movingObject("hazard", { x: 144, y: 357 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 192,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 107.2, y: 240 } },
          exitX: 480,
          height: 420,
          objects: [hazard],
          width: 536,
        },
      },
    };
    const initial = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    const bot = newBot(1);
    plannedInput(BIRD, layout, undefined, 1, initial, bot);
    const approach = navigationSnapshot(bot)!;
    expect(approach.chosenAction).toBe("approach");
    const endpoint = approach.candidates.find(
      (candidate) => candidate.inputLabel === "approach",
    )!.predictedEndpoint;
    expect(endpoint.grounded).toBe(true);
    expect(endpoint.x).toBeGreaterThan(initial.bird.x);
    expect(endpoint.x + BIRD.width / 2).toBeLessThan(144);
    const result = traverse(layout, 480);
    expect(result.zone.death).toBeUndefined();
    expect(result.zone.cleared, JSON.stringify(navigationSnapshot(result.bot))).toBe(true);
  });
  it("brakes before a floor hazard's physical hitbox then jumps to a grounded safe landing", () => {
    const base = fixture([{ height: 120, width: 600, x: 0, y: 300 }]);
    const strip = {
      ...movingObject("hazard", { x: 204, y: 288 }),
      height: 12,
      hitbox: { height: 3, width: 72, x: 36, y: 9 },
      motion: STATIC_MOTION,
      width: 120,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 134, y: 300 } },
          exitX: 540,
          height: 420,
          objects: [strip],
          width: 600,
        },
      },
    };
    const initial = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    const bot = newBot(1);
    plannedInput(BIRD, layout, undefined, 1, initial, bot);
    const decision = navigationSnapshot(bot)!;
    expect(decision.chosenAction).toBe("approach");
    const endpoint = decision.candidates.find(
      (candidate) => candidate.inputLabel === "approach",
    )!.predictedEndpoint;
    expect(endpoint.grounded).toBe(true);
    expect(endpoint.x + BIRD.width).toBeGreaterThan(strip.origin.x);
    expect(endpoint.x + BIRD.width).toBeLessThan(strip.origin.x + strip.hitbox.x);
    const result = traverse(layout, 480);
    expect(result.zone.death).toBeUndefined();
    expect(result.zone.cleared, JSON.stringify(navigationSnapshot(result.bot))).toBe(true);
    expect(result.zone.bird.grounded).toBe(true);
  });
  it("retreats to an intermediate ledge before climbing a post above full jump height", () => {
    const base = fixture([
      { height: 120, width: 360, x: 0, y: 300 },
      { height: 240, width: 48, x: 360, y: 180 },
      { height: 120, width: 264, x: 408, y: 300 },
    ]);
    const refuge = { ...movingObject("ledge", { x: 216, y: 240 }), motion: STATIC_MOTION };
    const hovering = {
      ...movingObject("hazard", { x: 312, y: 215 }),
      height: 46,
      motion: STATIC_MOTION,
      width: 44,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 348, y: 300 } },
          exitX: 620,
          height: 420,
          objects: [refuge, hovering],
          width: 672,
        },
      },
    };
    const initial = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    const bot = newBot(1);
    const retreat = plannedInput(BIRD, layout, undefined, 1, initial, bot);
    expect(retreat).toEqual({ jumpHeld: false, move: -1, useHeld: false });
    const decision = navigationSnapshot(bot)!;
    expect(decision.chosenAction).toBe("retreat-to-support");
    expect(decision.predictedProgress).toBeLessThan(0);
    const endpoint = decision.candidates.find(
      (candidate) => candidate.inputLabel === "retreat-to-support",
    )!.predictedEndpoint;
    expect(endpoint.grounded).toBe(true);
    expect(endpoint.x).toBeLessThan(initial.bird.x);
    const result = traverse(layout, 600);
    expect(result.zone.death).toBeUndefined();
    expect(result.landings).toContain(240);
    expect(result.landings).toContain(180);
    expect(result.zone.cleared, JSON.stringify(navigationSnapshot(result.bot))).toBe(true);
  });
  it("executes a validated finite wait through stationary rechecks before jumping and clearing", () => {
    const base = fixture([
      { height: 180, width: 144, x: 0, y: 240 },
      { height: 180, width: 200, x: 336, y: 240 },
    ]);
    const hazard = {
      ...movingObject("hazard", { x: 144, y: 357 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 192,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 143, y: 240 } },
          exitX: 480,
          height: 420,
          objects: [hazard],
          width: 536,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    const inputs = [];
    for (let tick = 0; tick < 360 && !zone.cleared && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot);
      if (tick === 0) {
        expect(navigationSnapshot(bot)!.chosenAction).toBe("wait-then-full");
      }
      inputs.push(input);
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    }
    expect(inputs.slice(0, 24).every((input) => input.move === 0 && !input.jumpHeld)).toBe(true);
    expect(inputs[24]!.jumpHeld).toBe(true);
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
  });
  it("holds a full jump against a flush wall and brakes by position on its narrow safe top", () => {
    const base = fixture([
      { height: 180, width: 144, x: 0, y: 240 },
      { height: 228, width: 48, x: 144, y: 192 },
    ]);
    const hazard = {
      ...movingObject("hazard", { x: 192, y: 300 }),
      height: 3,
      motion: STATIC_MOTION,
      width: 368,
    };
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 132, y: 240 } },
          exitX: 520,
          height: 420,
          objects: [hazard],
          width: 560,
        },
      },
    };
    const bot = newBot(1);
    let zone = stepZone(
      BIRD,
      layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 0, useHeld: false },
      startZone(BIRD, layout, 1),
    );
    let landed = false;
    for (let tick = 0; tick < 180 && !zone.death; tick++) {
      const input = plannedInput(BIRD, layout, undefined, 1, zone, bot);
      if (tick === 0) {
        expect(navigationSnapshot(bot)!.chosenAction).toBe("brake-full");
      }
      zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
      if (zone.bird.grounded && zone.bird.y + BIRD.height === 192) {
        landed = true;
        break;
      }
    }
    expect(zone.death).toBeUndefined();
    expect(landed, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    expect(zone.bird.x).toBeGreaterThanOrEqual(144);
    expect(zone.bird.x + BIRD.width).toBeLessThanOrEqual(192);
  });
  it("extends only validation airborne predictions through a bounded safe descent", () => {
    const base = fixture([
      { height: 420, width: 144, x: 0, y: 120 },
      { height: 180, width: 480, x: 240, y: 360 },
    ]);
    const layout: ZoneLayout = {
      ...base,
      areas: {
        main: {
          ...base.areas.main!,
          entries: { start: { x: 72, y: 120 } },
          exitX: 660,
          height: 540,
          width: 720,
        },
      },
    };
    const initial = stepZone(
        BIRD,
        layout,
        STEP_SECONDS,
        { jumpHeld: false, move: 0, useHeld: false },
        startZone(BIRD, layout, 1),
      ),
      quick = newBot(1),
      validation = newBot(1);
    plannedInput(BIRD, layout, undefined, 1, initial, quick);
    expect(
      navigationSnapshot(quick)!.candidates.every((candidate) => candidate.physicsSteps <= 90),
    ).toBe(true);
    expect(
      navigationSnapshot(quick)!.candidates.find((candidate) => candidate.inputLabel === "walk")!
        .rejection,
    ).toBe("airborne");
    plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, initial, validation);
    const decision = navigationSnapshot(validation)!;
    expect(
      decision.candidates.some(
        (candidate) =>
          candidate.physicsSteps > 90 &&
          candidate.rejection === null &&
          candidate.predictedEndpoint.grounded,
      ),
      JSON.stringify(decision),
    ).toBe(true);
    expect(navigationCounters(validation).physicsSteps).toBeLessThanOrEqual(8 * 90 * 2);
    expect(
      decision.candidates.every(
        (candidate) => candidate.continuationSteps! <= 90 && candidate.segmentCount! <= 2,
      ),
    ).toBe(true);
    const limited = newBot(1);
    plannedInput(
      BIRD,
      layout,
      { ...NAVIGATION_VALIDATION, maxPhysicsSteps: 100 },
      1,
      initial,
      limited,
    );
    expect(navigationCounters(limited).physicsSteps).toBe(100);
    expect(
      navigationSnapshot(limited)!.candidates.every((candidate) => candidate.rejection !== null),
    ).toBe(true);
    let zone = initial;
    const bot = newBot(1);
    for (let tick = 0; tick < 600 && !zone.cleared && !zone.death; tick++) {
      zone = stepZone(
        BIRD,
        layout,
        STEP_SECONDS,
        plannedInput(BIRD, layout, NAVIGATION_VALIDATION, 1, zone, bot),
        zone,
      );
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared, JSON.stringify(navigationSnapshot(bot))).toBe(true);
    const lethal = {
      ...movingObject("hazard", { x: 144, y: 300 }),
      height: 12,
      motion: STATIC_MOTION,
      width: 576,
    };
    const blocked: ZoneLayout = {
      ...layout,
      areas: { main: { ...layout.areas.main!, objects: [lethal] } },
    };
    const rejected = newBot(1);
    plannedInput(
      BIRD,
      blocked,
      NAVIGATION_VALIDATION,
      1,
      stepZone(
        BIRD,
        blocked,
        STEP_SECONDS,
        { jumpHeld: false, move: 0, useHeld: false },
        startZone(BIRD, blocked, 1),
      ),
      rejected,
    );
    expect(
      navigationSnapshot(rejected)!.candidates.find((candidate) => candidate.inputLabel === "walk")!
        .rejection,
    ).toBe("death");
    expect(
      navigationSnapshot(rejected)!
        .candidates.filter((candidate) => candidate.rejection === null)
        .every((candidate) => candidate.predictedEndpoint.grounded),
    ).toBe(true);
  });
  it("exposes bounded copied candidate and cache progress diagnostics without predicted states", () => {
    const layout = fixture([{ height: 60, width: 400, x: 0, y: 240 }]),
      bot = newBot(1);
    let zone = startZone(BIRD, layout, 1);
    const input = plannedInput(BIRD, layout, undefined, 1, zone, bot);
    const first = navigationSnapshot(bot)!;
    const saved = JSON.stringify(first);
    expect(first.didReplan).toBe(true);
    expect(first.candidates.length).toBeLessThanOrEqual(NAVIGATION_DEFAULTS.maxCandidates);
    expect(first.chosenAction).toBeTruthy();
    expect(first).not.toHaveProperty("states");
    expect(first).not.toHaveProperty("tuning");
    zone = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    plannedInput(BIRD, layout, undefined, 1, zone, bot);
    const cached = navigationSnapshot(bot)!;
    expect(cached.reason).toBe("cache-reused");
    expect(cached.actualProgress).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(first)).toBe(saved);
    Object.assign(first.origin, { x: -999 });
    Object.assign(first.candidates[0]!.predictedEndpoint, { x: -999 });
    expect(navigationSnapshot(bot)!.origin.x).not.toBe(-999);
    expect(navigationSnapshot(bot)!.candidates[0]!.predictedEndpoint.x).not.toBe(-999);
  });
});
