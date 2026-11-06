import { expect, it } from "vitest";

import { proveArena } from "./arenaCertify";
import { gameArenaCase } from "./arenas";
import { ARENA_SAMPLES } from "./arenaSamples";

// Each sample's arena proof: static checks, required route, path out and every evade run, with
// its hash over the evade trace hashes.
const HASHES: Readonly<Record<string, string>> = {};

it.each(ARENA_SAMPLES.map((arena) => [arena.id, arena] as const))(
  "%s passes the arena proof",
  (id, arena) => {
    const proof = proveArena(gameArenaCase(arena));
    expect(proof.problems).toEqual([]);
    expect(proof.hash).toBe(HASHES[id]);
  },
  600_000,
);
