import { expect, it } from "vitest";

import { STEP_SECONDS } from "../core/index.ts";
import type { BirdTuning, ZoneLayout } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { enterArea, stepZone } from "../rules/zone.ts";
import { newBot } from "../sim/bot.ts";
import capturedDock from "../sim/fixtures/sharedDock.json" with { type: "json" };
import {
  NAVIGATION_DEFAULTS,
  NAVIGATION_VALIDATION,
  navigationSnapshot,
  plannedInput,
} from "../sim/navigation.ts";

export function registerNavigationDockCase(): void {
  it("requires settled static dock landings near moving supports", () => {
    const { layout, tuning } = capturedDock as unknown as {
      layout: ZoneLayout;
      tuning: BirdTuning;
    };
    const link = layout.start;
    expect(link.area).toBe("fire-escape-1");
    let zone = enterArea(tuning, layout, link, {
      attempt: 0,
      restarts: 0,
      seed: 1,
      steps: 5303,
    });
    const approach: readonly (readonly [number, -1 | 0 | 1, boolean])[] = [
      [1, 1, false],
      [36, 0, false],
      [40, 1, true],
      [42, 1, false],
      [1, 0, false],
      [1, 1, true],
      [36, 1, false],
      [12, 0, false],
      [40, 1, true],
      [31, 1, false],
      [12, 0, false],
      [40, 1, true],
      [16, 1, false],
      [12, 0, false],
      [90, 1, false],
      [91, 0, false],
      [40, 1, true],
      [3, 1, false],
      [3, 0, false],
      [1, 1, false],
      [3, 0, false],
      [1, 1, true],
      [86, 1, false],
      [1, 0, false],
      [40, 1, true],
      [42, 1, false],
      [1, 0, false],
      [66, 1, false],
      [25, 0, false],
      [40, 1, true],
      [3, 1, false],
      [3, 0, false],
      [1, 1, false],
      [183, 0, false],
    ];
    for (const [ticks, move, jumpHeld] of approach) {
      for (let tick = 0; tick < ticks; tick++) {
        zone = stepZone(
          SKILL_PROFILES,
          tuning,
          layout,
          STEP_SECONDS,
          { jumpHeld, move, useHeld: false },
          zone,
        );
      }
    }
    expect(zone.steps).toBe(6346);
    expect(zone.bird.x).toBeCloseTo(1307, 8);
    expect(zone.bird.y).toBe(372);
    let unsafe = zone;
    const dockApproach: readonly (readonly [number, -1 | 0 | 1, boolean])[] = [
      [10, 1, false],
      [1, 0, false],
      [1, 1, false],
      [79, 0, false],
      [1, 1, true],
      [86, 1, false],
      [65, 0, false],
    ];
    for (const [ticks, move, jumpHeld] of dockApproach) {
      for (let tick = 0; tick < ticks; tick++) {
        unsafe = stepZone(
          SKILL_PROFILES,
          tuning,
          layout,
          STEP_SECONDS,
          { jumpHeld, move, useHeld: false },
          unsafe,
        );
      }
    }
    expect(unsafe.steps).toBe(6589);
    expect(unsafe.death?.reason).toBe("hazard");
    expect(unsafe.bird.x).toBeCloseTo(1539.6, 8);
    const bot = newBot(1);
    let input = plannedInput(tuning, layout, NAVIGATION_VALIDATION, 1, zone, bot);
    const decision = navigationSnapshot(bot)!;
    const dock = decision.candidates.find((candidate) => candidate.inputLabel === "approach")!;
    expect(dock.predictedEndpoint.grounded).toBe(true);
    expect(dock.predictedEndpoint.x).toBeCloseTo(1530.6, 8);
    expect(dock.rejection).toBe("unsettled-support");
    expect(decision.chosenAction).not.toBe("approach");
    const queued = [input, ...bot.navigation!.queue];
    for (input of queued) {
      zone = stepZone(SKILL_PROFILES, tuning, layout, STEP_SECONDS, input, zone);
    }
    for (let tick = 0; tick < NAVIGATION_DEFAULTS.replanTicks; tick++) {
      zone = stepZone(
        SKILL_PROFILES,
        tuning,
        layout,
        STEP_SECONDS,
        { jumpHeld: false, move: 0, useHeld: false },
        zone,
      );
    }
    expect(zone.death).toBeUndefined();
    expect(zone.bird.grounded).toBe(true);
    expect(zone.bird.vx).toBe(0);
    expect(zone.bird.x).toBeLessThan(1536);
  });
}
