import { expect, it } from "vitest";

import { BIRD_FRAME } from "../../assets/index.ts";
import { ROOM_BUILDINGS } from "../../data/roomBuildings.ts";
import { ROOMS } from "../../data/rooms.ts";
import { TILE } from "../../data/screen.ts";
import type { ZonePlan, ZoneRecipe } from "../../data/types/index.ts";
import { arenaApproachContext, firstArenaEncounter } from "../../testing/arenaApproaches.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/art.ts";
import { hashOf } from "../../testing/pairCertify.ts";
import { planStage, requirePlanned, type StageRequest } from "./stagePlans.ts";
import { zoneLayout } from "./tiles.ts";
import { CHUNK_LIBRARY, STAGE_CONTEXT } from "./zonePlans.ts";

const stage = (key: string, giftRoom?: string | null) =>
  requirePlanned(
    planStage(STAGE_CONTEXT, {
      avoid: [],
      seed: key === "city-boundary" ? 2 : 1,
      target: { recipe: key },
      ...(giftRoom !== undefined && { giftRoom }),
    }),
  );
const rooms = Object.keys(ROOMS).filter((room) => ROOMS[room]?.grant !== undefined);
const buildings = new Set<string>(Object.values(ROOM_BUILDINGS));
function route(plan: ZonePlan) {
  return Object.fromEntries(
    Object.entries(plan.areas).map(([key, area]) => [
      key,
      {
        chunks: area.chunks,
        cols: area.cols,
        entries: area.entries,
        noCross: area.noCross,
        objects: area.objects.filter(
          (object) => object.room === undefined && !buildings.has(object.character),
        ),
        outOfReach: area.outOfReach,
        rows: area.rows,
        solids: area.solids,
      },
    ]),
  );
}
function measured(plan: ZonePlan) {
  const prepared = {
    layout: zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan),
    source: {
      chunkIds: Object.fromEntries(
        Object.entries(plan.areas).map(([key, area]) => [
          key,
          area.chunks!.map((chunk) => chunk.chunk),
        ]),
      ),
    },
  };
  const encounter = firstArenaEncounter(prepared);
  return { context: arenaApproachContext({ encounter, hash: hashOf }, prepared), encounter };
}

it.each(["city-boundary", "lobby"])(
  "binds gift or none in %s after selecting the canonical terrain",
  (key) => {
    const baseline = stage(key);
    const before = JSON.stringify(STAGE_CONTEXT.recipes);
    const door = baseline.plan.areas.main!.objects.find(
      (object) => object.room !== undefined && ROOMS[object.room]?.grant !== undefined,
    )!;
    const alternate = rooms.find((room) => room !== door.room)!;
    for (const room of [alternate, null]) {
      const bound = stage(key, room);
      expect(bound.middle).toEqual(baseline.middle);
      expect(bound.avoidance).toBe(baseline.avoidance);
      expect(route(bound.plan)).toEqual(route(baseline.plan));
      const gifts = bound.plan.areas.main!.objects.filter(
        (object) => object.room !== undefined && ROOMS[object.room]?.grant !== undefined,
      );
      expect(gifts).toEqual(room === null ? [] : [{ ...door, room }]);
      expect(bound.plan.areas.main!.slots?.find((slot) => slot.fill === room)?.chunk).toBe(
        room === null
          ? undefined
          : baseline.plan.areas.main!.slots?.find((slot) => slot.fill === door.room)?.chunk,
      );
    }
    expect(JSON.stringify(STAGE_CONTEXT.recipes)).toBe(before);
  },
);

it("distinguishes City's measured gift variants while retaining the certified arena relation", () => {
  const manifest = JSON.stringify(CHUNK_LIBRARY.approaches);
  const baseline = stage("city-boundary");
  const original = measured(baseline.plan);
  const room = baseline.plan.areas.main!.objects.find((object) => object.room !== undefined)?.room;
  for (const gift of [rooms.find((value) => value !== room)!, null]) {
    const variant = measured(stage("city-boundary", gift).plan);
    expect(variant.encounter).toEqual(original.encounter);
    expect(variant.context.plan).not.toBe(original.context.plan);
    expect(variant.context.arenaIndex).toBe(original.context.arenaIndex);
    expect(variant.context.bossIndex).toBe(original.context.bossIndex);
  }
  expect(JSON.stringify(CHUNK_LIBRARY.approaches)).toBe(manifest);
});

it.each(["test", "missing-room"])("rejects a non-gift request %s", (giftRoom) => {
  expect(() => stage("lobby", giftRoom)).toThrow(/grants no skill/);
});

it("requires an explicit catalogue and exactly one gift reservation", () => {
  const request: StageRequest = { avoid: [], giftRoom: null, seed: 1, target: { recipe: "lobby" } };
  const { rooms: ignored, ...withoutRooms } = STAGE_CONTEXT;
  void ignored;
  expect(() => planStage(withoutRooms, request)).toThrow(/room catalogue/);
  const recipe = STAGE_CONTEXT.recipes.lobby as ZoneRecipe;
  const context = {
    ...STAGE_CONTEXT,
    recipes: { lobby: { ...recipe, doors: [{ count: 2, room: rooms[0]! }] } },
  };
  expect(() => planStage(context, request)).toThrow(/exactly one nominated/);
});
