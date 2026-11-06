import { expect, it } from "vitest";

import { proveArena } from "./arenaCertify";
import { gameArenaCase } from "./arenas";
import { ARENA_SAMPLES } from "./arenaSamples";

// Each sample's arena proof: static checks, required route, path out and every evade run, with
// its hash over the evade trace hashes.
const HASHES: Readonly<Record<string, string>> = {
  "arena-bear-sample": "c5dc91ed3dd36df5",
  "arena-dog-sample": "36363d3cd5276d21",
  "arena-ferret-sample": "e8ecb9c1dbbc1fd7",
  "arena-goose-sample": "5e550f988f0af666",
  "arena-pigeon-sample": "4d12f06e3efb8af1",
  "arena-raccoon-sample": "f7bfb27074293b29",
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
