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
      "blue-city-red-face-climb--city-lift-descent",
      "blue-city-ledge-climb--archie-yard-high",
      "blue-city-gap-high--city-lift-descent",
      "blue-city-lift-climb--city-ferry-high",
      "blue-city-tap-strip-high--city-gap-high",
      "blue-city-tap-strip-high--archie-yard-descent",
      "blue-city-ferry--city-vent-climb",
      "blue-city-lift-descent--city-gap",
      "blue-city-gap-climb--city-low-descent",
      "blue-city-ledge-pit--archie-yard",
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
      "industrial-tunnel-compound-return-terrace",
      "industrial-tunnel-broad-mesa",
      "industrial-tunnel-dry-underground-gallery-encounter",
      "industrial-tunnel-compound-compact-ascent",
      "industrial-tunnel-compound-compact-climb",
      "industrial-tunnel-compound-return-high",
      "industrial-tunnel-flyer-shelter-middle",
      "industrial-tunnel-city-boundary-low-ceiling",
      "industrial-tunnel-horizontal-platform-orbit",
      "industrial-tunnel-compound-return-terrace",
      "industrial-tunnel-flyer-shelter-early",
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
      "countryside-vertical-compound-low-ceiling-shuttle",
      "countryside-vertical-city-boundary-climb-yard",
      "countryside-vertical-city-boundary-shuttle",
      "countryside-vertical-city-boundary-upper-climb",
      "countryside-vertical-compound-return-high",
      "countryside-vertical-patrol-cover-middle",
      "countryside-vertical-broad-mesa",
      "countryside-vertical-overjump-low-roof",
      "countryside-vertical-crumbling-support-crossing",
      "countryside-vertical-patrol-cover-late",
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
