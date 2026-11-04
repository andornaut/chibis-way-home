// The page parameters that pick what the zone scene plays.

// Each seeded draw takes a whole number in [0, 2^32), the seeded generator's state.
export const SEED_LIMIT = 2 ** 32;

// The recipe ?zone=<key> names, when key is one of keys.
export function askedRecipe(keys: readonly string[], search: string): string | undefined {
  const asked = new URLSearchParams(search).get("zone");
  return asked !== null && keys.includes(asked) ? asked : undefined;
}

// The seed ?<name>=<n> fixes, when n is a whole number in [0, SEED_LIMIT): ?assembly= for the
// zone's assembly, ?seed= for its objects' random motion.
export function askedSeed(name: "assembly" | "seed", search: string): number | undefined {
  const asked = new URLSearchParams(search).get(name);
  const seed = asked === null || asked === "" ? NaN : Number(asked);
  return Number.isInteger(seed) && seed >= 0 && seed < SEED_LIMIT ? seed : undefined;
}
