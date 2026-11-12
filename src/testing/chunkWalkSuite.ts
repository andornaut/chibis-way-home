import { isDeepStrictEqual } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TILE } from "../data/screen.ts";
import type { SlotKind } from "../data/types/index.ts";
import { ALL_CHUNKS } from "./chunks.ts";
import { CHUNK_WALK_EQUIVALENTS, chunkWalkPhysics, chunkWalkPlan } from "./chunkWalkCases.ts";
import { chunkWalkPartitions } from "./chunkWalkPartitions.ts";
import { FILLED_CHUNK_SLOTS, REQUIRED_CHUNK_ROUTES } from "./requiredRoutes.ts";
import { requiredWalkSuite, walkSuite } from "./walkSuite.ts";

type SlotFills = Readonly<Record<SlotKind, readonly string[]>>;
const EMPTY_SLOTS: SlotFills = { door: [], event: [] };

const byName = new Map(ALL_CHUNKS.map((entry) => [entry[0], entry]));
for (const name of [...Object.keys(REQUIRED_CHUNK_ROUTES), ...Object.keys(FILLED_CHUNK_SLOTS)]) {
  if (!byName.has(name)) {
    throw new Error(`Unknown required-route chunk ${name}`);
  }
}

export function registerChunkWalkPartition(index: number): void {
  const partitions = chunkWalkPartitions(ALL_CHUNKS);
  const partition = partitions[index];
  if (!partition) {
    throw new Error(`Unknown chunk walk partition ${index}`);
  }
  describe.each(partition)("chunk %s required routes", (name, library, chunk) => {
    const targets = REQUIRED_CHUNK_ROUTES[name];
    if (targets === undefined) {
      throw new Error(`Missing required route profile for ${name}`);
    }
    const fills = FILLED_CHUNK_SLOTS[name];
    const hasSlots = (chunk.slots?.length ?? 0) > 0;
    if (hasSlots !== (fills !== undefined)) {
      throw new Error(`Filled slot profile does not match ${name}`);
    }
    if (fills) {
      for (const kind of ["door", "event"] as const) {
        const count = chunk.slots!.filter((slot) => slot.kind === kind).length;
        if (fills[kind].length !== count) {
          throw new Error(`Filled ${kind} slot count does not match ${name}`);
        }
      }
    }
    const exhaustive = name.startsWith("fixture ");
    const register = (profile: "empty" | "filled", slots: SlotFills) => {
      let started = 0;
      beforeAll(() => {
        started = performance.now();
      });
      afterAll(() => {
        console.info(
          "Chunk walk profile",
          JSON.stringify({
            chunk: name,
            elapsedMs: Math.round(performance.now() - started),
            profile,
          }),
        );
      });
      const plan = chunkWalkPlan(slots, [name, library, chunk]);
      if (exhaustive) {
        walkSuite(plan);
      } else {
        requiredWalkSuite(
          { targets: targets.map((target) => ({ ...target, area: plan.start.area })), tile: TILE },
          plan,
        );
      }
    };
    const representative = CHUNK_WALK_EQUIVALENTS[name];
    let shareEmpty = false;
    if (representative !== undefined) {
      const original = byName.get(representative);
      if (!original || CHUNK_WALK_EQUIVALENTS[representative] !== undefined) {
        throw new Error(`Missing independent walk representative for ${name}`);
      }
      const sameProfile =
        exhaustive === representative.startsWith("fixture ") &&
        isDeepStrictEqual(targets, REQUIRED_CHUNK_ROUTES[representative]) &&
        isDeepStrictEqual(fills, FILLED_CHUNK_SLOTS[representative]);
      if (sameProfile) {
        const physical = chunkWalkPhysics([name, library, chunk]);
        const originalPhysical = chunkWalkPhysics(original);
        it(`retains the empty traversal contract of ${representative}`, () => {
          expect(physical).toEqual(originalPhysical);
        });
        shareEmpty = isDeepStrictEqual(physical, originalPhysical);
      }
    }
    if (!shareEmpty) {
      describe("slots empty", () => register("empty", EMPTY_SLOTS));
    }
    if (fills) {
      describe("slots filled", () => register("filled", fills));
    }
  });
}
