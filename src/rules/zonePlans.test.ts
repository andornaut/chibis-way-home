import { describe, expect, it } from "vitest";

import { zonePlanFor } from "./zonePlans";

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
      "blue-city-ground-hazard--city-ferry",
      "blue-city-ground-hazard--city-ledge-pit",
      "blue-city-vent-climb--city-gap-high",
      "blue-city-crumbling-descent--city-ledge-pit",
      "blue-city-ledge-pit--city-vent-deck",
      "blue-city-ledge-climb--city-ledge-descent",
      "arena-dog-city-boundary",
      "blue-city-gap--city-ground-hazard",
      "blue-city-ground-hazard--city-tap-strip",
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
      "industrial-tunnel-city-boundary-shuttle",
      "industrial-tunnel-compound-double-lift",
      "industrial-tunnel-city-boundary-return-gap",
      "industrial-tunnel-compound-lift-shuttle",
      "industrial-tunnel-compound-return-high",
      "industrial-tunnel-warned-vent-terrace",
      "industrial-tunnel-crumbling-support-crossing",
      "arena-pigeon-freight-terminal",
      "industrial-tunnel-crumbling-support-crossing",
      "industrial-tunnel-broad-mesa",
      "industrial-tunnel-vertical-red-gate",
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
      "countryside-vertical-compound-return-terrace",
      "countryside-vertical-vertical-platform-orbit",
      "countryside-vertical-compound-return-high",
      "countryside-vertical-compound-low-ceiling-shuttle",
      "outdoor-deep-descent",
      "outdoor-deep-ascent",
      "countryside-vertical-compound-transfer-gate",
      "countryside-vertical-compound-low-ceiling-shuttle",
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
