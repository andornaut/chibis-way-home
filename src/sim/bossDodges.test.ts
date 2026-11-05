import { describe, expect, it } from "vitest";

import { BOSS_FAIRNESS } from "../data/bossFairness";
import { dodgeForks } from "../testing/bossDodges";
import { BOSS_SCENARIOS } from "../testing/bossScenarios";
import { ORDINARY } from "../testing/encounterLayouts";

const fairness = (kind: string) => BOSS_FAIRNESS[kind]!;
const FORKS = BOSS_SCENARIOS.map(({ scenario }) => ({
  forks: dodgeForks(ORDINARY, fairness, scenario),
  name: scenario.name,
}));

describe.each(FORKS.map(({ forks, name }) => [name, forks] as const))(
  "dodge witness %s",
  (_, forks) => {
    it("survives every tell start with one of the attack's named dodges", () => {
      for (const { attack, kind, outcomes, tick } of forks) {
        expect(
          Object.values(outcomes).some((death) => death === undefined),
          `${kind} ${attack} at tick ${tick}: ${JSON.stringify(outcomes)}`,
        ).toBe(true);
      }
    });
  },
);

it("witnesses every named dodge of a told attack surviving", () => {
  const survived = new Set(
    FORKS.flatMap(({ forks }) =>
      forks.flatMap(({ attack, kind, outcomes }) =>
        Object.entries(outcomes).flatMap(([dodge, death]) =>
          death === undefined ? [`${kind} ${attack} ${dodge}`] : [],
        ),
      ),
    ),
  );
  const told = new Set(
    FORKS.flatMap(({ forks }) => forks.map(({ attack, kind }) => `${kind} ${attack}`)),
  );
  for (const key of told) {
    const [kind, attack] = key.split(" ");
    for (const dodge of fairness(kind!).dodges[attack!]!) {
      expect(survived, `${key} ${dodge}`).toContain(`${key} ${dodge}`);
    }
  }
});
