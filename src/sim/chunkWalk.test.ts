import { isDeepStrictEqual } from "node:util";

import { describe, expect, it } from "vitest";

import { TILE } from "../data/screen";
import type { ChunkPlan, SlotKind, ZonePlan } from "../data/types";
import { type ChunkLibrary, themesOf, zonePlanOf } from "../rules/assemble";
import { ALL_CHUNKS } from "../testing/chunks";
import { CHUNK_WALK_EQUIVALENTS, chunkWalkPhysics } from "../testing/chunkWalkCases";
import { FILLED_CHUNK_SLOTS, REQUIRED_CHUNK_ROUTES } from "../testing/requiredRoutes";
import { requiredWalkSuite, walkSuite } from "../testing/walkSuite";

type SlotFills = Readonly<Record<SlotKind, readonly string[]>>;
const EMPTY_SLOTS: SlotFills = { door: [], event: [] };

function alone(fills: SlotFills, library: ChunkLibrary, chunk: ChunkPlan): ZonePlan {
  const only = { ...library, chunks: { chunk } };
  return zonePlanOf(only, () => 0, fills, themesOf(chunk)[0] ?? "", 2, ["chunk"]);
}

const byName = new Map(ALL_CHUNKS.map((entry) => [entry[0], entry]));
for (const name of [...Object.keys(REQUIRED_CHUNK_ROUTES), ...Object.keys(FILLED_CHUNK_SLOTS)]) {
  if (!byName.has(name)) {
    throw new Error(`Unknown required-route chunk ${name}`);
  }
}

describe.each(ALL_CHUNKS)("chunk %s required routes", (name, library, chunk) => {
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
  const register = (slots: SlotFills) => {
    const plan = alone(slots, library, chunk);
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
    describe("slots empty", () => register(EMPTY_SLOTS));
  }
  if (fills) {
    describe("slots filled", () => register(fills));
  }
});
