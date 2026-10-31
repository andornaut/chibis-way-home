import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { BehaviourMotion, ObjectLayout, Rect, ZoneLayout } from "../data/types";
import { startZone } from "../rules/zone";
import { BIRD_FRAME } from "../view/bird";
import { botInput, DIAGNOSTIC_SKILL, FORWARD_POLICY, newBot, prepareSensors } from "./bot";

const ground = { height: 20, width: 1100, x: 0, y: 120 };
function fixture(solids: readonly Rect[], objects: readonly ObjectLayout[] = []): ZoneLayout {
  return {
    areas: {
      main: {
        backX: 0,
        chunks: [],
        entries: { start: { x: 60, y: 120 } },
        exitX: 1000,
        height: 200,
        objects,
        solids,
        terrain: [],
        tileset: undefined,
        width: 1100,
      },
    },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
}
const platform: ObjectLayout = {
  animations: {
    idle: undefined,
    move: undefined,
    open: undefined,
    react: undefined,
    talk: undefined,
  },
  art: "platform",
  character: "platform",
  collision: "ledge",
  height: 12,
  hitbox: undefined,
  interaction: { kind: "none", range: 0 },
  lines: [],
  motion: {
    algorithm: "linear",
    direction: "left",
    distance: 60,
    hopHeight: 0,
    pause: 0,
    speed: 30,
    variance: 0,
  },
  origin: { x: 150, y: 120 },
  phase: 0,
  quips: [],
  quirks: [],
  reaction: { kind: "none", range: 0, speed: 0 },
  room: undefined,
  scene: undefined,
  width: 36,
};

describe("local bot decisions", () => {
  it.each([
    { motion: { kind: "wait" }, moving: false },
    {
      motion: { direction: 1, hopHeight: 20, hopSeconds: 0.4, kind: "hop", speed: 0 },
      moving: true,
    },
  ] satisfies readonly { motion: BehaviourMotion; moving: boolean }[])(
    "classifies a $motion.kind graph for live obstacle sensing",
    ({ motion, moving }) => {
      const object: ObjectLayout = {
        ...platform,
        behaviour: {
          axis: "x",
          distance: 0,
          initial: "active",
          states: { active: { animation: null, motion, transitions: [] } },
        },
        motion: { ...platform.motion, algorithm: "static", distance: 0, speed: 0 },
      };
      expect(prepareSensors(fixture([ground], [object])).movers.main?.has(0)).toBe(moving);
    },
  );
  it("walks through a linked exit instead of treating the next floor as a gap", () => {
    const original = fixture([{ ...ground, width: 200 }]);
    const main = original.areas.main;
    if (!main) {
      throw new Error("Missing fixture area");
    }
    const layout = {
      ...original,
      areaOrder: ["main", "upper"],
      areas: {
        main: { ...main, exitX: 188, walkLinks: { right: { area: "upper", entry: "start" } } },
        upper: { ...main, walkLinks: { left: { area: "main", entry: "start" } } },
      },
    };
    const initial = startZone(BIRD, layout, 1);
    const zone = { ...initial, bird: { ...initial.bird, grounded: true, x: 188 - BIRD.width - 1 } };
    expect(
      botInput(
        BIRD,
        prepareSensors(layout),
        layout,
        DIAGNOSTIC_SKILL,
        FORWARD_POLICY,
        zone,
        newBot(1),
      ),
    ).toEqual({ jumpHeld: false, move: 1, useHeld: false });
  });
  it("uses a shorter hold for a low obstacle than for a tall one", () => {
    const holds = [12, 60].map((height) => {
      const layout = fixture([ground, { height, width: 12, x: 100, y: 120 - height }]);
      const initial = startZone(BIRD, layout, 1);
      const zone = { ...initial, bird: { ...initial.bird, grounded: true } };
      const bot = newBot(1);
      expect(
        botInput(BIRD, prepareSensors(layout), layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, zone, bot)
          .jumpHeld,
      ).toBe(true);
      return bot.holding;
    });
    expect(holds[0]).toBeLessThan(holds[1] ?? 0);
  });
  it("waits for live platform alignment, resumes when it arrives, and bounds waiting", () => {
    const layout = fixture([{ ...ground, width: 96 }], [platform]);
    const sensors = prepareSensors(layout);
    const initial = startZone(BIRD, layout, 1);
    const zone = { ...initial, bird: { ...initial.bird, grounded: true } };
    const bot = newBot(1);
    const skill = { ...DIAGNOSTIC_SKILL, maxWaitTicks: 2 };
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, zone, bot).move).toBe(0);
    const aligned = { ...zone, objects: [{ x: 108, y: 120 }] };
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, aligned, bot).move).toBe(1);
    const waiting = newBot(1);
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, zone, waiting).move).toBe(0);
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, zone, waiting).move).toBe(0);
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, zone, waiting).move).toBe(1);
  });
});
