import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { traceRecorder } from "../ai/trace";
import { RACCOON_BEHAVIOUR } from "../data/behaviours";
import { TILE } from "../data/screen";
import type { BehaviourCondition, BehaviourPlan, ZoneLayout } from "../data/types";
import { layoutBehaviour } from "../rules/behaviour";
import { STEP_SECONDS } from "../rules/step";
import { retryZone, stepZone } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { zoneTraceLine } from "../testing/behaviourTraceHook";
import { BOSS_SCENARIOS } from "../testing/bossScenarios";
import {
  chunkLayout,
  ENCOUNTER_SCRIPTS,
  ENCOUNTER_TICKS,
  ORDINARY,
  withInstances,
} from "../testing/encounterLayouts";
import {
  activateAll,
  areaExit,
  bossModel,
  bossSample,
  type BossScenario,
  bossStart,
  type BossTick,
  scriptedChibi,
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

describe("Kiwi under a low ceiling", () => {
  const CHUNK = "vertical-stack-early";
  const CLEAR: BehaviourCondition = { kind: "track-clear", state: "climb" };
  type Edit = (plan: BehaviourPlan) => BehaviourPlan["states"];
  // The proposed counter edits on a test copy of Kiwi's plan.
  const blockedExit: Edit = ({ states }) => ({
    ...states,
    climb: {
      ...states.climb!,
      transitions: [{ to: "pursuit", when: [{ kind: "blocked" }] }, ...states.climb!.transitions],
    },
  });
  const guarded: Edit = (plan) => {
    const states = blockedExit(plan);
    return {
      ...states,
      "pursuit-drop": {
        ...states["pursuit-drop"]!,
        transitions: states["pursuit-drop"]!.transitions.flatMap((transition) =>
          transition.to === "return-ground-staging"
            ? [
                { ...transition, when: [...transition.when, CLEAR] },
                { ...transition, to: "pursuit" },
              ]
            : [transition],
        ),
      },
      "return-ground-staging": {
        ...states["return-ground-staging"]!,
        transitions: [
          { to: "climb", when: [{ kind: "boundary" }, CLEAR] },
          { to: "pursuit", when: [{ kind: "boundary" }] },
        ],
      },
    };
  };
  // Kiwi's yard with a one-tile slab two tiles above her head. Each attempt starts in
  // pursuit-drop, so her first decision is whether to climb.
  function layout(edit?: Edit): ZoneLayout {
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
    const base = chunkLayout("city-outskirts", CHUNK, withInstances(CHUNK, [ceiling]));
    const plan = { ...RACCOON_BEHAVIOUR, initial: "pursuit-drop" };
    const behaviour = layoutBehaviour(TILE, { ...plan, states: edit?.(plan) ?? plan.states });
    const main = base.areas.main!;
    const objects = main.objects.map((object) =>
      object.character === "raccoon-antagonist" ? { ...object, behaviour } : object,
    );
    return { ...base, areas: { ...base.areas, main: { ...main, objects } } };
  }

  it.each([
    { climbs: true, edit: undefined, name: "current graph", stalls: true },
    { climbs: true, edit: blockedExit, name: "blocked exit", stalls: false },
    { climbs: false, edit: guarded, name: "guarded graph", stalls: false },
  ])("$name: climbs=$climbs, stalls=$stalls", ({ climbs, edit, stalls }) => {
    const { ticks } = simulateBosses(ORDINARY, {
      controller: () => scriptedChibi(ENCOUNTER_SCRIPTS.still!),
      layout: () => layout(edit),
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
