// CLEANUP (added 2026-11-25): golden digests for the cwh-0315 identical-output refactor of stage
// planning and the encounter step. Remove in the refactor's last commit; nothing else reads them.
import { createHash } from "node:crypto";

import { expect, it } from "vitest";

import { STEP_SECONDS } from "../core/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { type BehaviourObservation, createBehaviourObserver } from "../rules/boss/index.ts";
import { planStage, requirePlanned } from "../rules/stage/stagePlans.ts";
import { STAGE_CONTEXT } from "../rules/stage/zonePlans.ts";
import {
  preparedZone,
  retryZone,
  stepZone,
  stepZoneObserved,
  type ZoneState,
} from "../rules/zone/zone.ts";
import { activateAll, type BossScenario, bossStart, placeChibi } from "../sim/bossSimulator.ts";
import { BOSS_SCENARIOS } from "./bossScenarios.ts";
import { ORDINARY } from "./encounterLayouts.ts";

const PLAN_SEEDS = [0, 1, 2, 3];

// JSON with sorted keys, so a refactor that reorders keys keeps its digest.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, (item as Record<string, unknown>)[key]]),
        )
      : item,
  );
}

const digest = (parts: readonly string[]) => {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\n");
  }
  return hash.digest("hex").slice(0, 16);
};

function planDigest(): string {
  const parts: string[] = [];
  for (const key of Object.keys(STAGE_CONTEXT.recipes).sort()) {
    for (const seed of PLAN_SEEDS) {
      const target = { recipe: key };
      const fresh = requirePlanned(planStage(STAGE_CONTEXT, { avoid: [], seed, target }));
      const avoiding = requirePlanned(
        planStage(STAGE_CONTEXT, { avoid: [fresh.middle], seed, target }),
      );
      for (const { avoidance, middle, plan } of [fresh, avoiding]) {
        parts.push(canonical({ avoidance, key, middle, plan, seed }));
      }
    }
  }
  return digest(parts);
}

// The encounter trace loop of the simulator equivalence test, stepping the zone directly or
// observed, digesting every zone after a step and every observation.
function encounterDigest(scenario: BossScenario, observed: boolean): string {
  const layout = scenario.layout();
  const controller = scenario.controller(ORDINARY, layout);
  const parts: string[] = [];
  const observer = createBehaviourObserver((observation: BehaviourObservation) => {
    parts.push(canonical(observation));
  });
  let zone: ZoneState = bossStart(ORDINARY, layout, scenario);
  for (let tick = 0; tick < scenario.ticks && !zone.cleared; tick++) {
    zone = zone.death ? activateAll(retryZone(ORDINARY, layout, zone)) : zone;
    const input = controller(tick, zone);
    const stepped = observed
      ? stepZoneObserved(
          observer,
          preparedZone(layout),
          SKILL_PROFILES,
          ORDINARY,
          layout,
          STEP_SECONDS,
          input,
          zone,
        )
      : stepZone(preparedZone(layout), SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, input, zone);
    zone = placeChibi(ORDINARY, scenario.place, tick + 1, stepped);
    parts.push(canonical({ ...zone, tracks: undefined }));
  }
  expect(observer.failures()).toEqual([]);
  return digest(parts);
}

const GOLDEN = {
  encounters: "3631094378033921",
  observed: "b341539e9d6208c0",
  plans: "91e34709b9d1d889",
};

it("plans every recipe as before the refactor", () => {
  const plans = planDigest();
  expect(plans).toBe(GOLDEN.plans);
}, 600_000);

it.each([
  ["encounters", false],
  ["observed", true],
] as const)(
  "steps the encounter scenarios as before the refactor: %s",
  (name, observed) => {
    const each = BOSS_SCENARIOS.map(({ scenario }) => encounterDigest(scenario, observed));
    const all = digest(each);
    expect(all).toBe(GOLDEN[name]);
  },
  600_000,
);
