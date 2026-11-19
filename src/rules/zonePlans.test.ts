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
      "blue-city-lift-climb--city-gap-high",
      "blue-city-hazard-descent--city-gap-climb",
      "blue-city-low-descent--city-ground-hazard",
      "blue-city-lift-climb--city-hazard-descent",
      "blue-city-ferry--city-lift-climb",
      "blue-city-lift-descent--city-lift-climb",
      "blue-city-low-descent--city-vent-deck",
      "arena-dog-city-boundary",
      "blue-city-ledge-pit--city-lift-climb",
      "blue-city-low-descent--city-gap",
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
      "industrial-tunnel-city-boundary-gaps",
      "industrial-tunnel-compound-double-lift",
      "industrial-tunnel-compound-return-high",
      "industrial-tunnel-city-boundary-steps",
      "industrial-tunnel-horizontal-platform-orbit",
      "industrial-tunnel-city-boundary-shuttle",
      "industrial-tunnel-city-boundary-lift",
      "industrial-tunnel-compound-return-high",
      "arena-pigeon-freight-terminal",
      "industrial-industrial-double-step--industrial-vent-stair",
      "industrial-tunnel-city-boundary-jumps",
      "industrial-tunnel-compound-return-terrace",
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
      "countryside-windmill-lookout--windmill",
      "countryside-vertical-city-boundary-upper-climb",
      "countryside-vertical-compound-return-high",
      "countryside-vertical-city-boundary-steps",
      "countryside-vertical-horizontal-platform-orbit",
      "countryside-vertical-city-boundary-upper-climb",
      "countryside-vertical-compound-return-high",
      "countryside-vertical-compound-low-ceiling-shuttle",
      "countryside-countryside-recovery-trench--countryside-terrace-spine",
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
