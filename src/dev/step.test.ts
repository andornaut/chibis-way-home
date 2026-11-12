import { describe, expect, it } from "vitest";

import type { ZoneState } from "../rules/zone.ts";
import { developmentStep } from "./step.ts";

describe("developer contact protection", () => {
  it.each(["hazard", "crush", "fall"] as const)(
    "preserves physics while treating %s death explicitly",
    (reason) => {
      const state = {
        bird: { x: 20, y: 80 },
        death: { reason },
        seconds: 3,
        steps: 360,
      } as unknown as ZoneState;
      expect(developmentStep(false, state)).toBe(state);
      const next = developmentStep(true, state);
      expect(next.bird).toBe(state.bird);
      expect(next.steps).toBe(state.steps);
      expect(next.death).toBe(reason === "fall" ? state.death : undefined);
    },
  );
});
