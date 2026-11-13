import { describe, expect, it } from "vitest";

import { zonePlanFor } from "./zonePlans.ts";

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
  it.each(PINNED)("assembles %s seed %i from its pinned chunks", (key, seed, chunks) => {
    expect(zonePlanFor(seed, key).areas.main?.chunks?.map(({ chunk }) => chunk)).toEqual(chunks);
  });
});
