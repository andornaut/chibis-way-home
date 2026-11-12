import { afterEach, expect, it, vi } from "vitest";

import type { ChunkPlan, Instance } from "../data/types/index.ts";
import { CHUNK_LIBRARY } from "../rules/zonePlans.ts";

afterEach(() => {
  vi.doUnmock("../data/archetypes.ts");
  vi.resetModules();
});

// The broad mesa under the encounter profile: its mesa top (cols 20 to 40, row 42) is a raised
// refuge unless a static red edge across it makes it a lethal valley base.
const MESA = { col: 20, cols: 20, row: 42 } as const;
const target = { at: { col: MESA.col + MESA.cols / 2, row: MESA.row } };
const red: Instance = {
  character: "red-edge-top",
  col: MESA.col,
  cols: MESA.cols,
  role: "edge-top",
  row: MESA.row - 1,
};

async function encounterTargets(changes: Partial<Instance> | undefined, lethal = true) {
  vi.resetModules();
  if (!lethal) {
    vi.doMock("../data/archetypes.ts", async (original) => {
      const actual = await original<typeof import("../data/archetypes.ts")>();
      return {
        ...actual,
        ARCHETYPES: {
          ...actual.ARCHETYPES,
          hazard: { ...actual.ARCHETYPES.hazard, collision: "none" },
        },
      };
    });
  }
  const { moduleRouteTargets } = await import("./requiredRoutes.ts");
  const mesa = CHUNK_LIBRARY.chunks["broad-mesa"]!;
  const chunk: ChunkPlan = {
    ...mesa,
    objects: [...mesa.objects, ...(changes ? [{ ...red, ...changes }] : [])],
  };
  return moduleRouteTargets(CHUNK_LIBRARY, { profile: "encounter", targets: [] }, chunk);
}

it("requires a raised refuge without a red edge", async () => {
  expect(await encounterTargets(undefined)).toContainEqual(target);
});

it("does not require a lethal valley base", async () => {
  expect(await encounterTargets({})).not.toContainEqual(target);
});

it.each<{ changes: Partial<Instance>; lethal: boolean; name: string }>([
  {
    changes: { cols: 1 },
    lethal: true,
    name: "a static red edge covers only part of its terrain top",
  },
  {
    changes: { overrides: { motion: { algorithm: "linear", distance: 1, speed: 1 } } },
    lethal: true,
    name: "a red edge moves",
  },
  {
    changes: {},
    lethal: false,
    name: "an edge-top role does not resolve to a lethal collider",
  },
])("retains the safe terrain target when $name", async ({ changes, lethal }) => {
  expect(await encounterTargets(changes, lethal)).toContainEqual(target);
});
