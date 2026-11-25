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
      "outdoor-drop-descent",
      "blue-city-tap-step--city-crossbeam-recovery",
      "blue-city-crumbling-perch--city-crossbeam-recovery",
      "blue-city-crumbling-offset-bridge--city-tap-strip",
      "blue-city-crossbeam-recovery--city-crumbling-pit",
      "blue-city-crossbeam-recovery--city-crumbling-offset-bridge",
      "outdoor-deep-descent",
      "outdoor-deep-ascent",
      "arena-dog-city-boundary",
      "blue-city-crossbeam-recovery--city-pillar-climb",
      "blue-city-drop-gap--city-crumbling-offset-bridge",
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
      "industrial-tunnel-warned-vent-terrace",
      "industrial-industrial-vent-stair--industrial-low-roof-strip",
      "industrial-tunnel-compound-lift-shuttle",
      "industrial-tunnel-city-boundary-return-gap",
      "industrial-tunnel-vertical-platform-orbit",
      "industrial-tunnel-compound-return-high",
      "industrial-deep-descent",
      "industrial-deep-ascent",
      "arena-pigeon-freight-terminal",
      "industrial-industrial-double-step--industrial-staggered-bridge",
      "industrial-crane-lookout--industrial-vent-stair",
      "industrial-industrial-low-roof-strip--industrial-staggered-bridge",
      "industrial-lift-ascent",
      "industrial-tall-freight-terminal-finish",
    ],
  ],
  [
    "river-crossing",
    5,
    [
      "countryside-vertical-river-crossing-start",
      "outdoor-drop-descent",
      "countryside-windmill-lookout--countryside-red-gully",
      "countryside-countryside-raised-red-channel--countryside-red-gully",
      "countryside-vertical-compound-low-ceiling-shuttle",
      "countryside-vertical-compound-compact-ascent",
      "countryside-vertical-city-boundary-ground-hazard",
      "countryside-vertical-compound-compact-climb",
      "countryside-vertical-compound-return-high",
      "countryside-vertical-compound-low-ceiling-shuttle",
      "countryside-vertical-broad-mesa",
      "arena-goose-river-crossing",
      "outdoor-lift-ascent",
      "outdoor-upper-ascent",
      "outdoor-guarded-return",
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
