import { describe, expect, it } from "vitest";

import { checkProperties } from "../ai/agentProperties.ts";
import { BOSS_FAIRNESS } from "../data/bossFairness.ts";
import { CHARACTERS } from "../data/characters.ts";
import { BOSS_SCENARIOS } from "../testing/bossScenarios.ts";
import { DODGES } from "../testing/dodges.ts";
import { ORDINARY } from "../testing/encounterLayouts.ts";
import {
  bossProperties,
  CHARGE_ATTACKS,
  DEFERRED_ATTACKS,
  maximumTellSeconds,
  minimumTellSeconds,
  reactionSeconds,
  targetedAttacks,
  tellAttacks,
} from "./bossProperties.ts";
import { BOSSES, observedCoverage, simulateBosses } from "./bossSimulator.ts";

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
const KNOWN_FAILURES: readonly KnownFailure[] = [];

const known = (scenario: string, property: string) =>
  KNOWN_FAILURES.find((entry) => entry.scenario === scenario && entry.property === property);

describe.each(BOSS_SCENARIOS.map((group) => [group.scenario.name, group] as const))(
  "boss scenario %s",
  (name, { checks, covers, scenario }) => {
    const run = simulateBosses(ORDINARY, scenario);
    const layout = scenario.layout();
    const seen = observedCoverage(layout, run.ticks);

    it.each(covers.map((coverage) => [coverage] as const))("covers %s", (coverage) => {
      const entry = known(name, `covers ${coverage}`);
      expect(seen.has(coverage), entry?.cause).toBe(entry === undefined);
    });

    it.each(
      checkProperties([...bossProperties(layout), ...(checks?.(layout) ?? [])], run.ticks).map(
        (result) => [result.id, result],
      ),
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
      ...[
        ...bossProperties(group!.scenario.layout()),
        ...(group!.checks?.(group!.scenario.layout()) ?? []),
      ].map(({ id }) => id),
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
    // Attack tells: every shared tell lasts between half a second and 1.2 seconds.
    for (const id of attacks) {
      expect(minimumTellSeconds(plan, id)).toBeGreaterThanOrEqual(0.5);
      expect(maximumTellSeconds(plan, id)).toBeLessThanOrEqual(1.2);
    }
    const retold = Object.values(plan.states).flatMap(({ attack }) =>
      attack?.continues ? [attack.id] : [],
    );
    for (const id of retold) {
      expect(minimumTellSeconds(plan, id, true)).toBeGreaterThanOrEqual(0.5);
    }
  }
});

it("gives every boss a told charge and at least one distinct special", () => {
  for (const [character, plan] of Object.entries(PLANS)) {
    const tells = tellAttacks(plan);
    expect(tells, character).toContain(CHARGE_ATTACKS[character]);
    expect(tells.size, character).toBeGreaterThan(1);
  }
});

it("gates the deferred attacks on the targeted-attack window in data", () => {
  for (const [character, attacks] of Object.entries(DEFERRED_ATTACKS)) {
    expect([...targetedAttacks(PLANS[character]!)].sort()).toEqual([...attacks].sort());
  }
});

it("gives Chibi the minimum reaction time from every tell start to contact", () => {
  for (const [character, plan] of Object.entries(PLANS)) {
    const { minReactionSeconds } = BOSS_FAIRNESS[character]!;
    for (const id of tellAttacks(plan)) {
      expect(reactionSeconds(plan, id), `${character} ${id}`).toBeGreaterThanOrEqual(
        minReactionSeconds,
      );
    }
  }
});

it("names a scripted dodge for every told attack", () => {
  for (const [character, plan] of Object.entries(PLANS)) {
    const { dodges } = BOSS_FAIRNESS[character]!;
    expect(Object.keys(dodges).sort(), character).toEqual([...tellAttacks(plan)].sort());
    for (const names of Object.values(dodges)) {
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(DODGES[name], name).toBeTypeOf("function");
      }
    }
  }
});
