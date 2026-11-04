// The zone a page starts on: ?zone=<n> names it, counting from 1; anything else, or a zone
// past the last, starts on the first. Returns its index.
export function startZoneIndex(search: string, count: number): number {
  const asked = Number(new URLSearchParams(search).get("zone"));
  return Number.isInteger(asked) && asked >= 1 && asked <= count ? asked - 1 : 0;
}

// The recipe ?zone=<key> names, when key is one of keys.
export function askedRecipe(search: string, keys: readonly string[]): string | undefined {
  const asked = new URLSearchParams(search).get("zone");
  return asked !== null && keys.includes(asked) ? asked : undefined;
}

// The assembly seed ?assembly=<n> fixes, when n is a whole number in [0, 2^32).
export function askedAssemblySeed(search: string): number | undefined {
  const asked = new URLSearchParams(search).get("assembly");
  const seed = asked === null || asked === "" ? NaN : Number(asked);
  return Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32 ? seed : undefined;
}

// The zone after the one at index: the next, or after the last, the first.
export function nextZoneIndex(index: number, count: number): number {
  return (index + 1) % count;
}
