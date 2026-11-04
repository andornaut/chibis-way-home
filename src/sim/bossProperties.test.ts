import { describe, expect, it } from "vitest";

import { checkProperties } from "../ai/agentProperties";
import { CHARACTERS } from "../data/characters";
import { BOSS_SCENARIOS } from "../testing/bossScenarios";
import { ORDINARY } from "../testing/encounterLayouts";
import {
  bossProperties,
  DEFERRED_ATTACKS,
  maximumTellSeconds,
  minimumTellSeconds,
  targetedAttacks,
} from "./bossProperties";
import { BOSSES, observedCoverage, simulateBosses } from "./bossSimulator";

const PLANS = Object.fromEntries(
  Object.keys(BOSSES).map((character) => [character, CHARACTERS[character]!.behaviour!]),
);

// Current behaviour's known failures: the backlog for the behaviour fixes. Each entry names the
// scenario, the property or missing coverage, the first failing tick and what the trace shows.
// A fix that clears one fails its entry, which is then removed.
interface KnownFailure {
  readonly cause: string;
  readonly property: string;
  readonly scenario: string;
  readonly tick: number | undefined;
}
const KNOWN_FAILURES: readonly KnownFailure[] = [
  {
    cause: "Pebble starts no drop or swoop tell in 1500 ticks of engaged pursuit",
    property: "covers tell",
    scenario: "encounter flyer-shelter-early loading-yards still",
    tick: undefined,
  },
  {
    cause: "Pebble commits no attack in 1500 ticks of engaged pursuit",
    property: "covers attack",
    scenario: "encounter flyer-shelter-early loading-yards still",
    tick: undefined,
  },
  {
    cause:
      "Archie stops at the far bank's edge; his traversal search exhausts its budget on the " +
      "12-tile jump to the crumbling ledge, so he never stands on it",
    property: "covers boss-on-crumbling",
    scenario: "crumbling archie far-bank still",
    tick: undefined,
  },
  {
    cause: "Pebble hovers without support in relocate at (109, 360) after resting",
    property: "no-stall",
    scenario: "lift pebble lower-dock board",
    tick: 415,
  },
  {
    cause: "Pebble starts no drop or swoop tell in 1500 ticks of engaged pursuit",
    property: "covers tell",
    scenario: "encounter bounded-flyer-post loading-yards still",
    tick: undefined,
  },
  {
    cause: "Pebble commits no attack in 1500 ticks of engaged pursuit",
    property: "covers attack",
    scenario: "encounter bounded-flyer-post loading-yards still",
    tick: undefined,
  },
  {
    cause: "Pebble hovers without support in relocate at (475, 240)",
    property: "no-stall",
    scenario: "encounter bounded-flyer-post loading-yards still",
    tick: 728,
  },
];

const known = (scenario: string, property: string) =>
  KNOWN_FAILURES.find((entry) => entry.scenario === scenario && entry.property === property);

describe.each(BOSS_SCENARIOS.map((group) => [group.scenario.name, group] as const))(
  "boss scenario %s",
  (name, { covers, scenario }) => {
    const run = simulateBosses(ORDINARY, scenario);
    const layout = scenario.layout();
    const seen = observedCoverage(run.ticks);

    it.each(covers.map((coverage) => [coverage] as const))("covers %s", (coverage) => {
      const entry = known(name, `covers ${coverage}`);
      expect(seen.has(coverage), entry?.cause).toBe(entry === undefined);
    });

    it.each(
      checkProperties(bossProperties(layout), run.ticks).map((result) => [result.id, result]),
    )("%s", (id, { violations }) => {
      const entry = known(name, id);
      expect(violations[0]?.tick, JSON.stringify(violations.slice(0, 3))).toBe(entry?.tick);
    });
  },
);

it("lists known failures only for existing scenarios and checks", () => {
  for (const { property, scenario } of KNOWN_FAILURES) {
    const group = BOSS_SCENARIOS.find((entry) => entry.scenario.name === scenario);
    expect(group, scenario).toBeDefined();
    const checks = [
      ...group!.covers.map((coverage) => `covers ${coverage}`),
      ...bossProperties(group!.scenario.layout()).map(({ id }) => id),
    ];
    expect(checks).toContain(property);
  }
});

it("reads every boss's tells within the shared bounds from its data", () => {
  for (const plan of Object.values(PLANS)) {
    const attacks = new Set(
      Object.values(plan.states).flatMap(({ attack }) =>
        attack?.phase === "tell" ? [attack.id] : [],
      ),
    );
    expect(attacks.size).toBeGreaterThan(0);
    // Attack tells: every shared tell lasts between half a second and one second.
    for (const id of attacks) {
      expect(minimumTellSeconds(plan, id)).toBeGreaterThanOrEqual(0.5);
      expect(maximumTellSeconds(plan, id)).toBeLessThanOrEqual(1);
    }
  }
});

it("gates the deferred attacks on the targeted-attack window in data", () => {
  for (const [character, attacks] of Object.entries(DEFERRED_ATTACKS)) {
    expect([...targetedAttacks(PLANS[character]!)].sort()).toEqual([...attacks].sort());
  }
});
