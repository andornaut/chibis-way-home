import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ALL_CHUNKS } from "./chunks.ts";
import {
  assertChunkWalkCoverage,
  CHUNK_WALK_PARTITIONS,
  chunkWalkPartitions,
} from "./chunkWalkPartitions.ts";
import { FILLED_CHUNK_SLOTS } from "./requiredRoutes.ts";

describe("chunk walk partitions", () => {
  it("registers every partition exactly once through the actual test entrypoints", () => {
    const partitions = chunkWalkPartitions(ALL_CHUNKS);
    const registered = Array.from({ length: CHUNK_WALK_PARTITIONS }, (_, index) => {
      const suffix = index === 0 ? "" : `.${index}`;
      const source = readFileSync(
        new URL(`../sim/chunkWalk${suffix}.test.ts`, import.meta.url),
        "utf8",
      );
      const calls = [...source.matchAll(/registerChunkWalkPartition\((\d+)\);/g)];
      expect(calls).toHaveLength(1);
      const partition = partitions[Number(calls[0]![1])];
      expect(partition).toBeDefined();
      return partition!;
    });
    assertChunkWalkCoverage(ALL_CHUNKS, registered);
  });

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

  it("puts measured expensive chunks first and assigns new chunks to the lightest file", () => {
    const cases = [
      ["new chunk"],
      ["apartment-tall-compound-lift-shuttle"],
      ["compound-lift-shuttle"],
      ["industrial-tunnel-compound-lift-shuttle"],
      ["park-pond"],
    ] as const;
    expect(chunkWalkPartitions(cases)).toEqual([
      [cases[2]],
      [cases[1]],
      [cases[4]],
      [cases[3], cases[0]],
    ]);
  });

  it("uses positive equal costs and lexical ties for unmeasured chunks", () => {
    const cases = [["new-f"], ["new-c"], ["new-e"], ["new-a"], ["new-d"], ["new-b"]] as const;
    expect(chunkWalkPartitions(cases)).toEqual([
      [cases[3], cases[2]],
      [cases[5], cases[0]],
      [cases[1]],
      [cases[4]],
    ]);
  });

  it.each([
    ["missing", [[["a"]]]],
    ["duplicate", [[["a"], ["b"]], [["a"]]]],
  ] as const)("rejects %s case assignments", (_name, partitions) => {
    expect(() => assertChunkWalkCoverage([["a"], ["b"]], partitions)).toThrow();
  });
});
