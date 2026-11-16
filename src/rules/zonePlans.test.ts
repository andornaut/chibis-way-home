import { describe, expect, it } from "vitest";

import { CHUNK_LIBRARY, STAGE_RECIPES, zonePlanFor } from "./zonePlans.ts";

// Seeds whose assembly backtracks through many states. A change to the search must keep these
// runs; update them only with a deliberate change to the chunks or recipes.
const PINNED: readonly (readonly [string, number, readonly string[]])[] = [
  [
    "city-boundary",
    3,
    [
      "blue-vertical-city-boundary-start",
      "outdoor-descent",
      "blue-city-lift-climb--city-ledge-descent",
      "blue-city-gap--city-red-face-climb",
      "blue-city-gap-high--city-hazard-descent",
      "blue-city-tap-strip--city-gap-climb",
      "blue-vertical-compound-compact-climb",
      "blue-vertical-city-boundary-return-gap",
      "blue-city-vent-climb--city-ledge-descent",
      "arena-dog-city-boundary",
      "blue-city-gap--city-ledge-climb",
      "blue-city-crumbling-descent--city-ferry",
      "outdoor-lift-ascent",
      "outdoor-upper-ascent",
      "outdoor-surface-return",
      "blue-vertical-city-boundary-finish",
    ],
  ],
  [
    "freight-terminal",
    7,
    [
      "industrial-tall-freight-terminal-start",
      "industrial-descent",
      "industrial-industrial-low-roof-strip--industrial-low-roof-strip",
      "industrial-tunnel-crumbling-support-crossing",
      "industrial-tunnel-compound-ascent",
      "industrial-tunnel-city-boundary-lift",
      "industrial-tunnel-city-boundary-return-gap",
      "industrial-tunnel-city-boundary-steps",
      "industrial-tunnel-city-boundary-ground-hazard",
      "industrial-tunnel-compound-return-terrace",
      "arena-pigeon-freight-terminal",
      "industrial-tunnel-compound-low-ceiling-shuttle",
      "industrial-industrial-vent-stair--industrial-vent-stair",
      "industrial-tunnel-crumbling-support-crossing",
      "industrial-ascent",
      "industrial-tall-freight-terminal-finish",
    ],
  ],
  [
    "river-crossing",
    5,
    [
      "countryside-vertical-river-crossing-start",
      "outdoor-descent",
      "countryside-vertical-city-boundary-edge-yard",
      "countryside-vertical-city-boundary-ground-hazard",
      "countryside-vertical-city-boundary-shuttle",
      "countryside-vertical-city-boundary-upper-climb",
      "countryside-vertical-compound-return-high",
      "countryside-countryside-raised-red-channel--countryside-raised-red-channel",
      "countryside-vertical-compound-transfer-gate",
      "countryside-vertical-compound-compact-ascent",
      "countryside-vertical-compound-return-terrace",
      "arena-goose-river-crossing",
      "outdoor-terrace-ascent",
      "outdoor-ferry-ascent",
      "outdoor-surface-return",
      "countryside-vertical-river-crossing-finish",
    ],
  ],
];

describe("zonePlanFor", () => {
  it("keeps City seed 2's assigned gift in its declared fixed start door", () => {
    const recipe = STAGE_RECIPES["city-boundary"]!;
    if ("sections" in recipe) {
      throw new Error("City has no flat start recipe");
    }
    const room = recipe.doors[0]!.room;
    expect(recipe.startDoors).toEqual([room]);
    const area = zonePlanFor(2, "city-boundary").areas.main!;
    const start = area.chunks![0]!;
    expect(start.chunk).toBe(recipe.start);
    const declaredSlot = CHUNK_LIBRARY.chunks[recipe.start]!.slots!.find(
      ({ kind }) => kind === "door",
    )!;
    const filled = area.slots!.filter(({ fill }) => fill === room);
    expect(filled).toHaveLength(1);
    expect(filled[0]).toMatchObject({ chunk: 0, id: declaredSlot.id });
    const doors = area.objects.filter((object) => object.room === room);
    expect(doors).toHaveLength(1);
    expect(doors[0]!.col).toBeLessThan(start.cols);
  });

  it("retains the lobby's single assigned room without adding a start placement policy", () => {
    const recipe = STAGE_RECIPES.lobby!;
    if ("sections" in recipe) {
      throw new Error("Lobby has no flat recipe");
    }
    const room = recipe.doors[0]!.room;
    const area = zonePlanFor(1, "lobby").areas.main!;
    expect(area.slots!.filter(({ fill }) => fill === room)).toHaveLength(1);
    expect(area.objects.filter((object) => object.room === room)).toHaveLength(1);
  });
  it.each(PINNED)("assembles %s seed %i from its pinned chunks", (key, seed, chunks) => {
    expect(zonePlanFor(seed, key).areas.main?.chunks?.map(({ chunk }) => chunk)).toEqual(chunks);
  });
});
