import { describe, expect, it } from "vitest";

import { ARENAS } from "../data/arenas/index.ts";
import type { ChunkArena } from "../data/types/index.ts";
import { RECIPES } from "../data/zones.ts";
import { assembleZone } from "../rules/assemble.ts";
import { STAGE_RECIPES } from "../rules/zonePlans.ts";
import {
  arenaCoverage,
  arenaLayout,
  arenaProblems,
  encounterStages,
  GAME_ARENA_COVERAGE,
  gameArenaCase,
} from "./arenas.ts";
import { ARENA_SAMPLES } from "./arenaSamples.ts";

const SEEDS = 8;

describe("arena samples", () => {
  it.each(ARENA_SAMPLES.map((arena) => [arena.id, arena] as const))(
    "%s passes the static checks",
    (_, arena) => {
      const found = gameArenaCase(arena);
      expect(arenaProblems(found, arenaLayout(found))).toEqual([]);
    },
    60_000,
  );

  it("reports a wrong boss, one route, no loop and no countering refuge", () => {
    const [sample] = ARENA_SAMPLES;
    const broken: ChunkArena = {
      ...sample!,
      boss: "goose-antagonist",
      refuges: [],
      routes: [sample!.routes[0]!],
    };
    const found = gameArenaCase(broken);
    const problems = arenaProblems(found, arenaLayout(found));
    expect(problems).toEqual(
      expect.arrayContaining([
        "boss goose-antagonist is not city-streets's boss dog-antagonist",
        "needs exactly one antagonist object of kind goose-antagonist",
        "needs at least 2 routes with distinct ids and waypoints",
        "no route closes a loop of 20 or more tiles",
        "no refuge counters goose-antagonist",
      ]),
    );
  }, 60_000);

  // Once per stage, in the second half of its middle chunks, where the stage seed puts it.
  it.each(ARENA_SAMPLES.map((arena) => [arena.id, arena] as const))(
    "%s places once in the second half of its stage",
    (_, arena) => {
      const found = gameArenaCase(arena);
      const recipe = STAGE_RECIPES[arena.stage]!;
      const placements = new Set<string>();
      for (let seed = 0; seed < SEEDS; seed++) {
        const plan = assembleZone(found.library, seed, arena.stage, recipe);
        const ids = plan.areas[plan.start.area]!.chunks!.map(({ chunk }) => chunk).slice(1, -1);
        const at = ids.indexOf(arena.id);
        expect(ids.filter((id) => id === arena.id)).toHaveLength(1);
        expect(at).toBeGreaterThanOrEqual(Math.floor(ids.length / 2));
        expect(ids.filter((id) => found.library.chunks[id]!.encounters > 0)).toEqual([arena.id]);
        expect(assembleZone(found.library, seed, arena.stage, recipe)).toEqual(plan);
        placements.add(`${at}/${ids.length}`);
      }
      expect(placements.size).toBeGreaterThan(1);
    },
    120_000,
  );
});

describe("arena coverage", () => {
  it("has no problem outside the pending stages", () => {
    const { pending, problems } = arenaCoverage(GAME_ARENA_COVERAGE, ARENAS);
    expect(problems).toEqual([]);
    if (pending.length > 0) {
      console.info(`Pending arena stages:\n${pending.join("\n")}`);
    }
  });

  // One encounter, so one arena, on each zone's last stage and on Residential floors and
  // Penthouse.
  it("has the seven arena stages", () => {
    expect(encounterStages(RECIPES)).toEqual([
      "city-boundary",
      "familiar-neighbourhood",
      "freight-terminal",
      "penthouse",
      "ravine",
      "residential-floors",
      "river-crossing",
    ]);
  });

  it("fails every encounter stage without exactly one arena once nothing is pending", () => {
    const ferret = ARENA_SAMPLES.find(({ stage }) => stage === "residential-floors")!;
    const { problems } = arenaCoverage({ pending: [], recipes: RECIPES }, [ferret, ferret]);
    expect(problems).toContain("residential-floors has 2 arenas, not 1");
    for (const stage of encounterStages(RECIPES).filter(
      (stage) => stage !== "residential-floors",
    )) {
      expect(problems).toContain(`${stage} has 0 arenas, not 1`);
    }
  });

  it("fails an arena on a stage without an encounter", () => {
    const dog = ARENA_SAMPLES.find(({ stage }) => stage === "city-streets")!;
    const { problems } = arenaCoverage({ pending: [], recipes: RECIPES }, [dog]);
    expect(problems).toContain("city-streets holds an arena but is no encounter stage");
  });

  it("fails an arena stage whose recipe holds more than one encounter", () => {
    const [sample] = ARENA_SAMPLES;
    const { problems } = arenaCoverage(
      { pending: [], recipes: { "city-streets": { ...RECIPES["city-streets"]!, encounters: 2 } } },
      [sample!],
    );
    expect(problems).toEqual(["city-streets has 2 encounters, not 1"]);
  });
});
