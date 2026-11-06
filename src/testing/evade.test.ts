import { expect, it } from "vitest";

import { proveArena } from "./arenaCertify";
import { gameArenaCase } from "./arenas";
import { ARENA_SAMPLES } from "./arenaSamples";
import { touchesBoss } from "./evade";

// Each sample's arena proof: static checks, required route, path out and every evade run, with
// its hash over the evade trace hashes.
const HASHES: Readonly<Record<string, string>> = {
  "arena-bear-sample": "8e5fe614899cc306",
  "arena-dog-sample": "7846dcca4f1c606c",
  "arena-ferret-sample": "b6cc489404423b71",
  "arena-goose-sample": "bbc7b8c3a591b5b1",
  "arena-pigeon-sample": "72bc4d7c1b81f420",
  "arena-raccoon-sample": "eaac46142dc48162",
};

it.each(ARENA_SAMPLES.map((arena) => [arena.id, arena] as const))(
  "%s passes the arena proof",
  (id, arena) => {
    const proof = proveArena(gameArenaCase(arena));
    expect(proof.problems).toEqual([]);
    expect(proof.hash).toBe(HASHES[id]);
  },
  600_000,
);

// A boss on a one-row roof masks the open floor beside it, never the nook below the roof.
it("masks only spans Chibi could touch the boss from, not through a roof", () => {
  const tile = 16;
  const roof = { height: tile, width: 10 * tile, x: 0, y: 10 * tile };
  const boss = { height: 4 * tile, width: 3 * tile, x: 3 * tile, y: 6 * tile };
  const nook = { height: 3 * tile, width: 10 * tile, x: 0, y: 11 * tile };
  const beside = { height: 3 * tile, width: 2 * tile, x: 6 * tile, y: 7 * tile };
  expect(touchesBoss([roof], 2 * tile, boss, nook)).toBe(false);
  expect(touchesBoss([], 2 * tile, boss, nook)).toBe(true);
  expect(touchesBoss([roof], 2 * tile, boss, beside)).toBe(true);
});
