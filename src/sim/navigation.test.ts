import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Rect, ZoneLayout } from "../data/types";
import { STEP_SECONDS } from "../rules/step";
import { startZone, stepZone } from "../rules/zone";
import { BIRD_FRAME } from "../view/bird";
import { botInput, DIAGNOSTIC_SKILL, navigationCounters, newBot, prepareSensors } from "./bot";
import { plannedInput, validateNavigation } from "./navigation";

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
  for (let tick = 0; tick < maxTicks && !zone.cleared && !zone.death; tick++) {
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
  }
  return { bot, zone };
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
    const layout = fixture([
      { height: 60, width: 144, x: 0, y: 240 },
      { height: 96, width: 96, x: 144, y: 204 },
      { height: 12, width: 120, x: 120, y: 148 },
      { height: 60, width: 100, x: 300, y: 240 },
    ]);
    const initial = startZone(BIRD, layout, 1),
      snapshot = structuredClone(initial);
    plannedInput(BIRD, layout, undefined, 1, initial, newBot(1));
    expect(initial).toEqual(snapshot);
    const result = traverse(layout);
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
});
