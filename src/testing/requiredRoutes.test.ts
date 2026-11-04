import { afterEach, expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import { CHUNKS } from "../data/chunks";
import { TILE } from "../data/screen";
import type { Instance } from "../data/types";
import { zoneLayout } from "../rules/tiles";
import { surfaceAt, zoneSurfaces } from "../sim/zoneWalk";
import { BIRD_FRAME } from "../view/bird";
import { ALL_CHUNKS } from "./chunks";
import { chunkWalkPlan } from "./chunkWalkCases";
import { REQUIRED_CHUNK_ROUTES } from "./requiredRoutes";
import { CATALOGUE, HITBOXES, TILESETS } from "./walkSuite";
afterEach(() => {
  vi.doUnmock("../data/archetypes");
  vi.doUnmock("../data/chunks");
  vi.resetModules();
});
const base = CHUNKS["compound-vertical-yard"]!;
const red = base.objects.find(
  ({ col, role, row }) => col === 44 && role === "edge-top" && row === 29,
)!;
const floor = base.solids.find(
  ({ col, cols, row }) => col === red.col && cols === red.cols && row === red.row + 1,
)!;
it.each(["compound-vertical-yard", "home-vertical-compound-vertical-yard"])(
  "%s retains its safe bank goals without requiring the lethal valley base",
  (name) => {
    const tuple = ALL_CHUNKS.find(([id]) => id === name)!;
    const offset = tuple[2].entry.row - base.entry.row;
    const plan = chunkWalkPlan({ door: [], event: [] }, tuple);
    const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
    const surfaces = zoneSurfaces(BIRD, layout);
    const lethal = { col: floor.col + floor.cols / 2, row: floor.row + offset };
    expect(surfaceAt(TILE, surfaces, plan.start.area, lethal)).toBeUndefined();
    expect(REQUIRED_CHUNK_ROUTES[name]).not.toContainEqual({ at: lethal });
    const banks = base.solids.filter((solid) => solid !== floor && solid.row === floor.row);
    expect(banks).toHaveLength(2);
    for (const bank of banks) {
      const at = { col: bank.col + bank.cols / 2, row: bank.row + offset };
      expect(surfaceAt(TILE, surfaces, plan.start.area, at)).toBeDefined();
      expect(REQUIRED_CHUNK_ROUTES[name]).toContainEqual({ at });
    }
    expect(tuple[2].solids).toContainEqual(
      expect.objectContaining({ col: floor.col, cols: floor.cols, row: floor.row + offset }),
    );
  },
);
async function modifiedRoutes(changes: Partial<Instance>, lethal = true) {
  vi.resetModules();
  vi.doMock("../data/chunks", async (original) => {
    const actual = await original<typeof import("../data/chunks")>();
    const source = actual.CHUNKS["compound-vertical-yard"]!;
    return {
      ...actual,
      CHUNKS: {
        ...actual.CHUNKS,
        "compound-vertical-yard": {
          ...source,
          objects: source.objects.map((object) =>
            object.col === red.col && object.row === red.row && object.role === "edge-top"
              ? { ...object, ...changes }
              : object,
          ),
        },
      },
    };
  });
  if (!lethal) {
    vi.doMock("../data/archetypes", async (original) => {
      const actual = await original<typeof import("../data/archetypes")>();
      return {
        ...actual,
        ARCHETYPES: {
          ...actual.ARCHETYPES,
          hazard: { ...actual.ARCHETYPES.hazard, collision: "none" },
        },
      };
    });
  }
  return (await import("./requiredRoutes")).REQUIRED_CHUNK_ROUTES["compound-vertical-yard"];
}
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
  const targets = await modifiedRoutes(changes, lethal);
  expect(targets).toContainEqual({ at: { col: floor.col + floor.cols / 2, row: floor.row } });
});
