import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { traceRecorder } from "../ai/trace.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { RACCOON_BEHAVIOUR } from "../data/behaviours.ts";
import { TILE } from "../data/screen.ts";
import type { BehaviourCondition, BehaviourPlan, ZoneLayout } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { layoutBehaviour } from "../rules/behaviour.ts";
import { retryZone, stepZone } from "../rules/zone.ts";
import { CHUNK_LIBRARY } from "../rules/zonePlans.ts";
import { BOSS_SCENARIOS } from "../testing/bossScenarios.ts";
import {
  chunkLayout,
  ENCOUNTER_SCRIPTS,
  ENCOUNTER_TICKS,
  ORDINARY,
  withInstances,
} from "../testing/encounterLayouts.ts";
import {
  activateAll,
  areaExit,
  bossModel,
  bossSample,
  type BossScenario,
  bossStart,
  type BossTick,
  placeChibi,
  scriptedChibi,
  simulateBosses,
} from "./bossSimulator.ts";
import { zoneTraceLine } from "./zoneTrace.ts";

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
    const next = placeChibi(
      ORDINARY,
      scenario.place,
      tick + 1,
      stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, controller(tick, zone), zone),
    );
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
  const model = bossModel(ORDINARY, layout, scenario.place);
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

describe("Kiwi under a low ceiling", () => {
  const CHUNK = "arena-raccoon-familiar-neighbourhood";
  const THEME = "familiar-neighbourhood";
  type Kind = BehaviourCondition["kind"];
  // Kiwi's plan without the named counter conditions, negated or not; a transition left with
  // no conditions is dropped.
  const without = (...kinds: readonly Kind[]): BehaviourPlan["states"] =>
    Object.fromEntries(
      Object.entries(RACCOON_BEHAVIOUR.states).map(([key, node]) => [
        key,
        {
          ...node,
          transitions: node.transitions.flatMap((transition) => {
            const when = transition.when.filter(
              (condition) =>
                !kinds.includes(
                  condition.kind === "not" ? condition.condition.kind : condition.kind,
                ),
            );
            return when.length > 0 ? [{ ...transition, when }] : [];
          }),
        },
      ]),
    );
  // Kiwi's arena with a one-tile slab two tiles above her head. Each attempt starts engaged with
  // the climb as her only attack, so her first attack decision is whether to climb.
  function layout(states: BehaviourPlan["states"]): ZoneLayout {
    const kiwi = CHUNK_LIBRARY.chunks[CHUNK]!.objects.find(
      ({ character }) => character === "raccoon-antagonist",
    )!;
    const ceiling = {
      character: "red-edge-support",
      col: kiwi.col - 4,
      cols: 8,
      row: kiwi.row - 3,
      rows: 1,
    };
    const base = chunkLayout(THEME, CHUNK, withInstances(CHUNK, [ceiling]));
    // Without her charge, the climb is her only attack.
    const pursuit = states.pursuit!;
    const behaviour = layoutBehaviour(TILE, {
      ...RACCOON_BEHAVIOUR,
      initial: "pursuit",
      states: {
        ...states,
        pursuit: {
          ...pursuit,
          transitions: pursuit.transitions.filter(({ to }) => to !== "prepare-charge"),
        },
      },
    });
    const main = base.areas.main!;
    const objects = main.objects.map((object) =>
      object.character === "raccoon-antagonist" ? { ...object, behaviour } : object,
    );
    return { ...base, areas: { ...base.areas, main: { ...main, objects } } };
  }

  // Chibi stands at the entry, away from the slab: Kiwi chases to line up with him, and the
  // variants without the guards exercise the slab.
  it.each([
    {
      climbs: true,
      name: "without alignment, the climb guard or the blocked exit",
      stalls: true,
      states: without("horizontal-gap", "track-clear", "blocked"),
    },
    {
      climbs: true,
      name: "without alignment or the climb guard",
      stalls: false,
      states: without("horizontal-gap", "track-clear"),
    },
    // With the climb guard she climbs only once she has chased clear of the slab.
    { climbs: true, name: "without alignment", stalls: false, states: without("horizontal-gap") },
    { climbs: true, name: "data graph", stalls: false, states: RACCOON_BEHAVIOUR.states },
  ])("$name: climbs=$climbs, stalls=$stalls", ({ climbs, stalls, states }) => {
    const { ticks } = simulateBosses(ORDINARY, {
      controller: () => scriptedChibi(ENCOUNTER_SCRIPTS.still!),
      layout: () => layout(states),
      name: "kiwi low ceiling",
      seed: 1,
      ticks: ENCOUNTER_TICKS,
    });
    const kiwi = ticks.flatMap(({ agents }) =>
      agents.filter(({ kind }) => kind === "raccoon-antagonist"),
    );
    // Half a second in climb without moving is a stall.
    let still = 0;
    let longest = 0;
    kiwi.forEach((agent, index) => {
      const previous = kiwi[index - 1];
      still =
        agent.state === "climb" &&
        previous?.state === "climb" &&
        previous.at.x === agent.at.x &&
        previous.at.y === agent.at.y
          ? still + 1
          : 0;
      longest = Math.max(longest, still);
    });
    expect(kiwi.some(({ state }) => state === "climb")).toBe(climbs);
    expect(longest >= 0.5 / STEP_SECONDS).toBe(stalls);
    expect(kiwi.some(({ motion }) => motion === "pursue-ground")).toBe(!stalls);
  });
});
