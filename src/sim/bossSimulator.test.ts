import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { traceRecorder } from "../ai/trace";
import { STEP_SECONDS } from "../rules/step";
import { retryZone, stepZone } from "../rules/zone";
import { zoneTraceLine } from "../testing/behaviourTraceHook";
import { BOSS_SCENARIOS } from "../testing/bossScenarios";
import { ORDINARY } from "../testing/encounterLayouts";
import {
  activateAll,
  areaExit,
  bossModel,
  bossSample,
  type BossScenario,
  bossStart,
  type BossTick,
  simulateBosses,
} from "./bossSimulator";

const RECORDED: Readonly<Record<string, string>> = JSON.parse(
  readFileSync(new URL("fixtures/behaviourTraces/encounters.json", import.meta.url), "utf8"),
) as Record<string, string>;

// The real zone step under the encounter trace loop: retry with every behaviour active after a
// death, until the zone clears or the budget runs out.
function zoneRun(scenario: BossScenario): BossTick[] {
  const layout = scenario.layout();
  const controller = scenario.controller(ORDINARY, layout);
  const ticks: BossTick[] = [];
  let zone = bossStart(ORDINARY, layout, scenario);
  for (let tick = 0; tick < scenario.ticks && !zone.cleared; tick++) {
    zone = zone.death ? activateAll(retryZone(ORDINARY, layout, zone)) : zone;
    const next = stepZone(ORDINARY, layout, STEP_SECONDS, controller(tick, zone), zone);
    if (next !== zone) {
      ticks.push(bossSample(ORDINARY, layout, tick, next));
    }
    zone = next;
  }
  return ticks;
}

it.each(BOSS_SCENARIOS.map(({ scenario }) => [scenario.name, scenario] as const))(
  "the boss simulator matches the zone step on %s",
  (_, scenario) => {
    expect(simulateBosses(ORDINARY, scenario).ticks).toEqual(zoneRun(scenario));
  },
);

// The recorded encounter hashes cover every behaviour object, transients and Chibi: the
// simulator's states reproduce them exactly, including deaths and retries.
it.each(
  BOSS_SCENARIOS.filter(({ scenario }) => RECORDED[scenario.name] !== undefined).map(
    ({ scenario }) => [scenario.name, scenario] as const,
  ),
)("the boss simulator reproduces the recorded zone trace of %s", (name, scenario) => {
  const layout = scenario.layout();
  const model = bossModel(ORDINARY, layout);
  const controller = scenario.controller(ORDINARY, layout);
  const recorder = traceRecorder({ retain: false });
  let zone = bossStart(ORDINARY, layout, scenario);
  for (let tick = 0; tick < scenario.ticks; tick++) {
    zone = model.begin(zone);
    if (model.finished(zone)) {
      break;
    }
    const next = model.step(STEP_SECONDS, controller(tick, zone), zone);
    const cleared = !next.death && areaExit(ORDINARY, layout, next) === "cleared";
    recorder.record(zoneTraceLine(layout, STEP_SECONDS, zone, { ...next, cleared }));
    zone = next;
  }
  expect(recorder.hash()).toBe(RECORDED[name]);
});

it("replays a bot scenario to the same trace hash", () => {
  const { scenario } = BOSS_SCENARIOS.find(({ scenario }) => scenario.name.startsWith("bot "))!;
  const first = simulateBosses(ORDINARY, scenario);
  expect(first.ticks.length).toBeGreaterThan(0);
  expect(simulateBosses(ORDINARY, scenario).hash).toBe(first.hash);
});
