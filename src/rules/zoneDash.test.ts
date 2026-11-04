import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import type { AreaLayout, BirdTuning, ObjectLayout, ZoneLayout } from "../data/types";
import { leaveRoom, retryZone, startZone, stepZone } from "./zone";

const tuning: BirdTuning = BIRD;
const floor = { height: 40, width: 1100, x: 0, y: 300 };
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const use = { ...idle, useHeld: true };
function object(collision: ObjectLayout["collision"], x: number): ObjectLayout {
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
    height: 48,
    hitbox: undefined,
    interaction: { kind: "none", range: 0 },
    lines: [],
    motion: {
      algorithm: "static",
      direction: "right",
      distance: 0,
      hopHeight: 0,
      pause: 0,
      speed: 0,
      variance: 0,
    },
    origin: { x, y: floor.y - 48 },
    phase: 0,
    quips: [],
    quirks: [],
    reaction: { kind: "none", range: 0, speed: 0 },
    room: collision === "use" ? "fixture-room" : undefined,
    scene: undefined,
    width: 3,
  };
}
function area(objects: readonly ObjectLayout[] = []): AreaLayout {
  return {
    backX: 12,
    chunks: [],
    entries: { start: { x: 100, y: floor.y } },
    exitX: 1088,
    height: 360,
    objects,
    solids: [floor],
    terrain: [],
    tileset: undefined,
    width: 1100,
  };
}
function layout(main = area()): ZoneLayout {
  return { areas: { main }, birdFrame: BIRD_FRAME, start: { area: "main", entry: "start" } };
}

describe("fresh Use arbitration", () => {
  it("keeps drawn-frame door priority over dash and freezes its cooldown under a room cover", () => {
    const plan = layout(area([object("use", 114)]));
    let zone = startZone(tuning, plan, 1);
    zone = stepZone(tuning, plan, STEP_SECONDS, idle, zone);
    zone = stepZone(tuning, plan, STEP_SECONDS, use, zone);
    expect(zone.door).toBe(0);
    expect(zone.bird.dash!.remainingSeconds).toBe(0);
    expect(zone.bird.x).toBe(88);
    expect(stepZone(tuning, plan, 1, use, zone)).toBe(zone);
    zone = stepZone(tuning, plan, STEP_SECONDS, use, leaveRoom(zone));
    expect(zone.door).toBeUndefined();
    expect(zone.bird.dash!.remainingSeconds).toBe(0);
  });

  it("ignores inherited and held presses, then requires release before a second dash", () => {
    const plan = layout();
    let zone = startZone(tuning, plan, 1);
    zone = stepZone(tuning, plan, STEP_SECONDS, use, zone);
    expect(zone.bird.dash!.remainingSeconds).toBe(0);
    zone = stepZone(tuning, plan, STEP_SECONDS, idle, zone);
    const start = zone.bird.x;
    for (let tick = 0; tick < 120; tick++) {
      zone = stepZone(tuning, plan, STEP_SECONDS, use, zone);
    }
    expect(zone.bird.x - start).toBeCloseTo(tuning.dash!.speed * tuning.dash!.durationSeconds);
    zone = stepZone(tuning, plan, STEP_SECONDS, idle, zone);
    zone = stepZone(tuning, plan, STEP_SECONDS, use, zone);
    expect(zone.bird.dash!.remainingSeconds).toBeGreaterThan(0);
  });

  it("retains precise lethal red contact across the full dash path", () => {
    const red = {
      ...object("hazard", 140),
      contactCue: "red-hazard" as const,
      hitbox: { height: 3, width: 3, x: 0, y: 45 },
    };
    const plan = layout(area([red]));
    let zone = stepZone(tuning, plan, STEP_SECONDS, idle, startZone(tuning, plan, 1));
    zone = stepZone(tuning, plan, tuning.dash!.durationSeconds, use, zone);
    expect(zone.death).toMatchObject({
      contact: { contactCue: "red-hazard", index: 0, kind: "object" },
      reason: "hazard",
    });
  });

  it("preserves active dash state across linked areas and resets it on retry", () => {
    const main = { ...area(), exitX: 160, walkLinks: { right: { area: "next", entry: "start" } } };
    const plan = { ...layout(main), areas: { main, next: area() } };
    let zone = stepZone(tuning, plan, STEP_SECONDS, idle, startZone(tuning, plan, 1));
    const elapsed = tuning.dash!.durationSeconds / 2;
    zone = stepZone(tuning, plan, elapsed, use, zone);
    expect(zone.area).toBe("next");
    expect(zone.bird.dash!.remainingSeconds).toBeCloseTo(tuning.dash!.durationSeconds - elapsed);
    expect(zone.bird.dash!.cooldownRemainingSeconds).toBeCloseTo(
      tuning.dash!.cooldownSeconds - elapsed,
    );
    const retry = retryZone(tuning, plan, {
      ...zone,
      death: {
        position: { x: zone.bird.x, y: zone.bird.y },
        reason: "fall",
        support: undefined,
        velocity: { x: 0, y: 0 },
      },
    });
    expect(retry.bird.dash).toMatchObject({
      airUsed: false,
      cooldownRemainingSeconds: 0,
      remainingSeconds: 0,
    });
  });
  it("does not restore the air jump at an area boundary, but Retry starts a fresh airtime", () => {
    const profile = { ...tuning, doubleJump: true };
    const main = { ...area(), exitX: 160, walkLinks: { right: { area: "next", entry: "start" } } };
    const plan = { ...layout(main), areas: { main, next: area() } };
    let zone = startZone(profile, plan, 1);
    zone = {
      ...zone,
      bird: { ...zone.bird, airJumpUsed: true, grounded: false, y: 100 },
      useHeld: false,
    };
    zone = stepZone(profile, plan, profile.dash!.durationSeconds / 2, use, zone);
    expect(zone.area).toBe("next");
    expect(zone.bird.airJumpUsed).toBe(true);
    const retry = retryZone(profile, plan, {
      ...zone,
      death: {
        position: { x: zone.bird.x, y: zone.bird.y },
        reason: "fall",
        support: undefined,
        velocity: { x: 0, y: 0 },
      },
    });
    expect(retry.bird.airJumpUsed).toBe(false);
  });
});
