import { describe, expect, it, vi } from "vitest";

import { checkProperties } from "../ai/agentProperties.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { BOSS_SCENARIOS } from "../testing/bossScenarios.ts";
import { ORDINARY } from "../testing/encounterLayouts.ts";
import { bossProperties, leavesSpawn } from "./bossProperties.ts";
import { simulateBosses } from "./bossSimulator.ts";

// The draw that seeds each boss's first wander interval, fixed so the interval is at either end of
// its range.
const first = vi.hoisted(() => ({ draw: 0 }));
vi.mock("../ai/randomStreams.ts", async (original) => {
  const actual = await original<typeof import("../ai/randomStreams.ts")>();
  return {
    ...actual,
    namedStreams: (seed: number, namespace: string) => {
      const streams = actual.namedStreams(seed, namespace);
      return (key: string) => (key === "wander:0" ? () => first.draw : streams(key));
    },
  };
});

const WANDER = "wander arena-pigeon-sample loading-yards seed 1";
const { scenario } = BOSS_SCENARIOS.find((group) => group.scenario.name === WANDER)!;

// Pebble hops every seeded 3 to 5 seconds, his flight counting in the interval, and an unengaged
// boss moves at least a tile horizontally within every 5 seconds.
describe("Pebble's first wander hop", () => {
  const run = (draw: number) => {
    first.draw = draw;
    return simulateBosses(ORDINARY, scenario).ticks;
  };

  it("clears a tile from his spawn within 5 s when his first interval is its longest", () => {
    const layout = scenario.layout();
    const properties = [
      ...bossProperties(layout).filter(({ id }) => id === "wander"),
      leavesSpawn(),
    ];
    expect(
      checkProperties(properties, run(0.9999)).flatMap(({ violations }) => violations),
    ).toEqual([]);
  });

  it("lands no sooner than 3 s after his spawn when his first interval is its shortest", () => {
    const ticks = run(0);
    const landed = ticks.findIndex(
      (tick, index) =>
        index > 0 &&
        ticks[index - 1]!.agents.some(({ state }) => state === "wander-hop") &&
        tick.agents.every(({ state }) => state !== "wander-hop"),
    );
    expect(landed).toBeGreaterThan(0);
    // Each sample follows its tick's step.
    expect((landed + 1) * STEP_SECONDS).toBeGreaterThanOrEqual(3 - 1e-9);
  });
});
