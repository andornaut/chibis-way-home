import { describe, expect, it } from "vitest";

import { ALL_CHUNKS } from "./chunks";
import { assertChunkWalkCoverage, chunkWalkPartitions } from "./chunkWalkPartitions";
import { FILLED_CHUNK_SLOTS } from "./requiredRoutes";

describe("chunk walk partitions", () => {
  it("assigns every catalogue and filled-slot profile to exactly one file", () => {
    const partitions = chunkWalkPartitions(ALL_CHUNKS);
    const names = partitions.flat().map(([name]) => name);
    expect([...names].sort()).toEqual(ALL_CHUNKS.map(([name]) => name).sort());
    expect(new Set(names).size).toBe(names.length);
    for (const name of Object.keys(FILLED_CHUNK_SLOTS)) {
      expect(partitions.filter((partition) => partition.some(([id]) => id === name))).toHaveLength(
        1,
      );
    }
    expect(partitions.every((partition) => partition.length > 0)).toBe(true);
    expect(chunkWalkPartitions([...ALL_CHUNKS].reverse())).toEqual(partitions);
  });

  it.each([
    ["missing", [[["a"]]]],
    ["duplicate", [[["a"], ["b"]], [["a"]]]],
  ] as const)("rejects %s case assignments", (_name, partitions) => {
    expect(() => assertChunkWalkCoverage([["a"], ["b"]], partitions)).toThrow();
  });
});
