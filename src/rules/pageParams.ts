// The recipe ?zone=<key> names, when key is one of keys.
export function askedRecipe(keys: readonly string[], search: string): string | undefined {
  const asked = new URLSearchParams(search).get("zone");
  return asked !== null && keys.includes(asked) ? asked : undefined;
}

// The assembly seed ?assembly=<n> fixes, when n is a whole number in [0, 2^32).
export function askedAssemblySeed(search: string): number | undefined {
  const asked = new URLSearchParams(search).get("assembly");
  const seed = asked === null || asked === "" ? NaN : Number(asked);
  return Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32 ? seed : undefined;
}
