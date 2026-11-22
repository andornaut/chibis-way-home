import { expect, it } from "vitest";

import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "../data/modules/index.ts";
import { ZONE_FRAMES } from "../data/zoneFrames.ts";
import { certifiedChunks } from "../rules/modules.ts";
import { STAGE_RECIPES } from "../rules/zonePlans.ts";
import { certifiedPool, certifiedPoolsPlugin } from "./certifiedPools.ts";

it("keeps runtime pool fields and declared approaches while preserving composition", () => {
  const pools = CERTIFIED_LISTS.map(certifiedPool);
  const keys = new Set(
    pools.flatMap((pool) => [
      ...Object.keys(pool),
      ...(pool.approaches ?? []).flatMap((approach) =>
        Object.keys(approach).map((key) => `approaches.${key}`),
      ),
      ...pool.arenas.flatMap((arena) => Object.keys(arena).map((key) => `arenas.${key}`)),
      ...pool.entries.flatMap((entry) => Object.keys(entry).map((key) => `entries.${key}`)),
    ]),
  );
  expect([...keys].sort()).toEqual([
    ...(CERTIFIED_LISTS.some((list) => list.approaches !== undefined)
      ? [
          "approaches",
          "approaches.arena",
          "approaches.predecessors",
          "approaches.profile",
          "approaches.stage",
        ]
      : []),
    "arenas",
    "arenas.id",
    "entries",
    "entries.id",
    "entries.kind",
    "entries.modules",
    "zone",
  ]);
  for (const [index, pool] of pools.entries()) {
    expect(Object.hasOwn(pool, "approaches")).toBe(
      CERTIFIED_LISTS[index]!.approaches !== undefined,
    );
    for (const approach of pool.approaches ?? []) {
      const recipe = STAGE_RECIPES[approach.stage];
      expect(recipe && !("sections" in recipe) ? recipe.arenaApproach : undefined).toEqual({
        predecessors: approach.predecessors,
        profile: approach.profile,
      });
    }
  }
  const context = {
    frames: ZONE_FRAMES,
    grades: PAIR_GRADES,
    modules: MODULES,
    rules: MODULE_RULES,
  };
  expect(certifiedChunks(context, pools)).toEqual(certifiedChunks(context, CERTIFIED_LISTS));
});

it("loads each list in its directory as its pool, and nothing else", async () => {
  const list = CERTIFIED_LISTS[0]!;
  const context = { fs: { readFile: async () => new TextEncoder().encode(JSON.stringify(list)) } };
  const load = certifiedPoolsPlugin("/repo/src/data/certified").load as unknown as (
    this: typeof context,
    id: string,
  ) => Promise<string | undefined>;
  const loaded = await load.call(context, `/repo/src/data/certified/${list.zone}.json`);
  expect(JSON.parse(loaded!)).toEqual(certifiedPool(list));
  const others = ["/repo/src/data/certified/index.ts", "/repo/src/data/certified/a/b.json"];
  expect(await Promise.all(others.map((id) => load.call(context, id)))).toEqual([
    undefined,
    undefined,
  ]);
});

it("ships only approach eligibility and keeps measured context and audit headers out of the bundle", () => {
  const list = CERTIFIED_LISTS[0]!;
  const relation = {
    arena: "arena",
    evidence: {
      arenaIndex: 1,
      bossIndex: 2,
      plan: "0123456789abcdef",
      retries: 1,
      seed: 2,
      trace: "0123456789abcdef:1",
    },
    inputs: { data: "data", proofs: "proofs" },
    predecessors: ["qualified"],
    profile: "cold-encounter-v1" as const,
    stage: "stage",
  };
  expect(certifiedPool({ ...list, approaches: [relation] }).approaches).toEqual([
    { arena: "arena", predecessors: ["qualified"], profile: "cold-encounter-v1", stage: "stage" },
  ]);
});
