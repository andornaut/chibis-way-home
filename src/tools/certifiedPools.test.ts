import { expect, it } from "vitest";

import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "../data/modules/index.ts";
import { ZONE_FRAMES } from "../data/zoneFrames.ts";
import { certifiedChunks } from "../rules/modules.ts";
import { certifiedPool, certifiedPoolsPlugin } from "./certifiedPools.ts";

it("keeps only the ids, kinds, modules and zone, which compose the same chunks and pools", () => {
  const pools = CERTIFIED_LISTS.map(certifiedPool);
  const keys = new Set(
    pools.flatMap((pool) => [
      ...Object.keys(pool),
      ...pool.arenas.flatMap((arena) => Object.keys(arena).map((key) => `arenas.${key}`)),
      ...pool.entries.flatMap((entry) => Object.keys(entry).map((key) => `entries.${key}`)),
    ]),
  );
  expect([...keys].sort()).toEqual([
    "arenas",
    "arenas.id",
    "entries",
    "entries.id",
    "entries.kind",
    "entries.modules",
    "zone",
  ]);
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
