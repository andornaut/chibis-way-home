// The page parameters that pick what the zone scene plays. A parameter that is present but
// invalid throws, so the crash screen reports it rather than the scene quietly playing something
// else.

// Each seeded draw takes a whole number in [0, 2^32), the seeded generator's state.
export const SEED_LIMIT = 2 ** 32;

// The recipe ?zone=<key> names. Throws when key is not one of keys.
export function askedRecipe(keys: readonly string[], search: string): string | undefined {
  const asked = new URLSearchParams(search).get("zone");
  if (asked === null) {
    return undefined;
  }
  if (!keys.includes(asked)) {
    throw new Error(`Unknown ?zone=${asked}: expected one of ${keys.join(", ")}`);
  }
  return asked;
}

// The seed ?<name>=<n> fixes: ?assembly= for the zone's assembly, ?seed= for its objects' random
// motion. Throws when n is not a whole number in [0, SEED_LIMIT).
export function askedSeed(name: "assembly" | "seed", search: string): number | undefined {
  const asked = new URLSearchParams(search).get(name);
  if (asked === null) {
    return undefined;
  }
  const seed = asked === "" ? NaN : Number(asked);
  if (!Number.isInteger(seed) || seed < 0 || seed >= SEED_LIMIT) {
    throw new Error(
      `Invalid ?${name}=${asked}: expected a whole number from 0 to ${SEED_LIMIT - 1}`,
    );
  }
  return seed;
}
