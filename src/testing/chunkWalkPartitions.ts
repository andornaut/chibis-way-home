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
  const ordered = [...cases].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [index, entry] of ordered.entries()) {
    partitions[index % CHUNK_WALK_PARTITIONS]!.push(entry);
  }
  assertChunkWalkCoverage(cases, partitions);
  return partitions;
}
