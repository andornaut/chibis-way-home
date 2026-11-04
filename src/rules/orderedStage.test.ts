import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import type { AreaLayout, ZoneLayout } from "../data/types";
import { stageProgress } from "./stageProgress";
import { enterArea, retryZone, startZone, stepZone } from "./zone";
import { validateZoneLinks } from "./zoneLinks";

const STILL = { jumpHeld: false, move: 0 as const, useHeld: false };
function area(width: number, walkLinks: AreaLayout["walkLinks"]): AreaLayout {
  return {
    backX: 12,
    chunks: [],
    entries: { return: { x: width - 24, y: 200 }, start: { x: 36, y: 200 } },
    exitX: width - 12,
    height: 240,
    objects: [],
    solids: [{ height: 40, width, x: 0, y: 200 }],
    terrain: [],
    tileset: undefined,
    width,
    ...(walkLinks && { walkLinks }),
  };
}
const layout: ZoneLayout = {
  areaOrder: ["first", "middle", "last"],
  areas: {
    first: area(300, { right: { area: "middle", entry: "start" } }),
    last: area(450, { left: { area: "middle", entry: "return" } }),
    middle: area(600, {
      left: { area: "first", entry: "return" },
      right: { area: "last", entry: "start" },
    }),
  },
  birdFrame: BIRD_FRAME,
  start: { area: "first", entry: "start" },
};

describe("ordered stage core", () => {
  it.each([
    ["first", "right", "middle", false, false],
    ["middle", "left", "first", false, false],
    ["first", "left", "first", false, true],
    ["last", "right", "last", true, false],
  ] as const)(
    "crosses %s %s with only whole-stage end conditions",
    (id, side, target, cleared, turnedBack) => {
      const zone = enterArea(
        BIRD,
        layout,
        { area: id, entry: "start" },
        { attempt: 2, restarts: 2, seed: 42, steps: 17 },
      );
      const source = layout.areas[id];
      if (!source) {
        throw new Error("Missing fixture area");
      }
      const x = side === "left" ? source.backX - 1 : source.exitX - BIRD.width + 1;
      const next = stepZone(
        BIRD,
        layout,
        STEP_SECONDS,
        { ...STILL, jumpHeld: true, useHeld: true },
        { ...zone, bird: { ...zone.bird, x } },
      );
      expect(next).toMatchObject({
        area: target,
        attempt: 2,
        cleared,
        restarts: 2,
        seed: 42,
        steps: 18,
        turnedBack,
      });
      if (target !== id) {
        expect(next.seconds).toBe(0);
        expect(next.bird.jumpHeld).toBe(true);
        expect(next.useHeld).toBe(true);
        expect(stepZone(BIRD, layout, STEP_SECONDS, STILL, next).area).toBe(target);
      }
    },
  );
  it("retries from the stage checkpoint after a later section death", () => {
    const zone = enterArea(
      BIRD,
      layout,
      { area: "last", entry: "start" },
      { attempt: 0, restarts: 0, seed: 42, steps: 30 },
    );
    const retry = retryZone(BIRD, layout, {
      ...zone,
      death: { position: zone.bird, reason: "fall", support: undefined, velocity: { x: 0, y: 0 } },
    });
    expect(retry).toMatchObject({
      area: "first",
      attempt: 1,
      death: undefined,
      restarts: 1,
      seed: 42,
      steps: 30,
    });
    expect(retry.bird.x + BIRD.width / 2).toBe(36);
  });
  it("weights centre-based progress by traversable section width independently of simulation checkpoints", () => {
    const zone = startZone(BIRD, layout, 42);
    const total = 288 - 36 + (588 - 36) + (438 - 36);
    const middle = { ...zone, area: "middle", bird: { ...zone.bird, x: 36 - BIRD.width / 2 } };
    expect(stageProgress(BIRD, layout, middle)).toBeCloseTo(252 / total);
    expect(
      stageProgress(BIRD, { ...layout, start: { area: "last", entry: "return" } }, middle),
    ).toBeCloseTo(252 / total);
    expect(
      stageProgress(BIRD, layout, { ...middle, bird: { ...middle.bird, x: 588 - BIRD.width / 2 } }),
    ).toBeCloseTo((252 + 552) / total);
    expect(stageProgress(BIRD, layout, { ...middle, cleared: true })).toBe(1);
    const legacy: ZoneLayout = {
      areas: layout.areas,
      birdFrame: layout.birdFrame,
      start: layout.start,
    };
    expect(
      stageProgress(BIRD, legacy, {
        ...zone,
        bird: { ...zone.bird, x: (36 + 288) / 2 - BIRD.width / 2 },
      }),
    ).toBe(0.5);
  });
  it("validates named targets, complete unique order and safe arrivals before stepping", () => {
    expect(() => validateZoneLinks({ ...layout, areaOrder: ["first", "first", "last"] })).toThrow(
      "Area order",
    );
    const middle = layout.areas.middle;
    if (!middle) {
      throw new Error("Missing fixture area");
    }
    expect(() =>
      validateZoneLinks({
        ...layout,
        areas: {
          ...layout.areas,
          middle: { ...middle, walkLinks: { right: { area: "last", entry: "missing" } } },
        },
      }),
    ).toThrow("walk target");
    expect(() =>
      startZone(
        BIRD,
        {
          ...layout,
          areas: {
            ...layout.areas,
            middle: { ...middle, entries: { ...middle.entries, start: { x: 12, y: 200 } } },
          },
        },
        42,
      ),
    ).toThrow("edge trigger");
  });
});
