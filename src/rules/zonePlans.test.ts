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
      "industrial-tunnel-city-boundary-gaps",
      "industrial-tunnel-city-boundary-lift",
      "industrial-tunnel-compound-return-high",
      "industrial-tunnel-compound-compact-ascent",
      "industrial-tunnel-horizontal-platform-orbit",
      "industrial-tunnel-compound-double-lift",
      "industrial-tunnel-city-boundary-return-gap",
      "industrial-tunnel-compound-low-ceiling-shuttle",
      "arena-pigeon-freight-terminal",
      "industrial-tunnel-overjump-low-roof",
      "industrial-tunnel-crumbling-support-crossing",
      "industrial-tunnel-compound-low-ceiling-shuttle",
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
      "countryside-vertical-compound-compact-climb",
      "countryside-vertical-city-boundary-return-gap",
      "countryside-vertical-city-boundary-low-ceiling",
      "countryside-vertical-guarded-valley",
      "countryside-vertical-compound-return-terrace",
      "countryside-vertical-compound-compact-ascent",
      "countryside-vertical-compound-return-terrace",
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
