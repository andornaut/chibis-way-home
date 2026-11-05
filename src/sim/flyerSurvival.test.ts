import { expect, it, vi } from "vitest";

import type { ZoneLayout } from "../data/types";
import type * as Zone from "../rules/zone";
import { stageTraceScenarios } from "../testing/behaviourTraceSuite";

// Every flying boss that dies during a stepped tick.
const deaths = vi.hoisted(() => [] as string[]);

vi.mock("../rules/zone", async (original) => {
  const actual = await original<typeof Zone>();
  return {
    ...actual,
    stepZone: (...args: Parameters<typeof actual.stepZone>) => {
      const [, , layout, , , before] = args;
      const after = actual.stepZone(...args);
      const area = (layout as ZoneLayout).areas[after.area]!;
      after.behaviours.forEach((state, index) => {
        const object = area.objects[index]!;
        const flies = Object.values(object.behaviour?.states ?? {}).some(
          ({ motion }) => motion.kind === "pursue" && motion.mode === "fly",
        );
        if (flies && state?.defeat && !before.behaviours[index]?.defeat) {
          deaths.push(`${object.character} at ${after.objects[index]!.x}`);
        }
      });
      return after;
    },
  };
});

// Pebble's planned flight and landings check the hazards he can meet, so a stage run never ends
// with him dying on one.
it("keeps Pebble alive through the loading-yards planned run", () => {
  stageTraceScenarios()
    .find(({ name }) => name === "stage loading-yards seed 3 planned")!
    .run();
  expect(deaths).toEqual([]);
}, 120_000);
