import { CHUNK_WALK_COSTS } from "./chunkWalkCosts.ts";

export const CHUNK_WALK_PARTITIONS = 4;

type NamedCase = readonly [string, ...unknown[]];

export function assertChunkWalkCoverage<T extends NamedCase>(
  cases: readonly T[],
  partitions: readonly (readonly T[])[],
): void {
  const expected = new Set(cases.map(([name]) => name));
  const seen = new Set<string>();
  for (const partition of partitions) {
    for (const [name] of partition) {
      if (!expected.has(name) || seen.has(name)) {
        throw new Error(`Unexpected or repeated chunk walk case ${name}`);
      }
      seen.add(name);
    }
  }
  if (expected.size !== cases.length || seen.size !== expected.size) {
    throw new Error("Incomplete chunk walk partitions");
  }
}

export function chunkWalkPartitions<T extends NamedCase>(cases: readonly T[]): T[][] {
  const partitions = Array.from({ length: CHUNK_WALK_PARTITIONS }, (): T[] => []);
  const costs = Array<number>(CHUNK_WALK_PARTITIONS).fill(0);
  const cost = ([name]: T) => CHUNK_WALK_COSTS[name] ?? 1;
  const ordered = [...cases].sort(
    (a, b) => cost(b) - cost(a) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
  for (const entry of ordered) {
    let lightest = 0;
    for (let index = 1; index < CHUNK_WALK_PARTITIONS; index++) {
      if (costs[index]! < costs[lightest]!) {
        lightest = index;
      }
    }
    partitions[lightest]!.push(entry);
    costs[lightest]! += cost(entry);
  }
  assertChunkWalkCoverage(cases, partitions);
  return partitions;
}
