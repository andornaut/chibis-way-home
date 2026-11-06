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
      "blue-city-red-face-climb--city-tap-strip-high",
      "blue-city-crumbling-descent--city-ledge-pit",
      "blue-city-tap-strip--city-vent-climb",
      "blue-city-ledge-descent--city-lift-climb",
      "blue-city-ledge-descent--city-red-face-climb",
      "blue-archie-lane-descent--city-gap",
      "blue-vertical-broad-mesa",
      "blue-city-tap-strip--city-gap-climb",
      "blue-city-vent-deck-high--city-ferry-high",
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
      "industrial-tunnel-compound-return-terrace",
      "industrial-tunnel-broad-mesa",
      "industrial-tunnel-low-central-crossing",
      "industrial-tunnel-crumbling-support-crossing",
      "industrial-tunnel-compound-ascent",
      "industrial-tunnel-compound-compact-climb",
      "industrial-tunnel-compound-return-high",
      "industrial-tunnel-compound-lift-shuttle",
      "industrial-tunnel-compound-return-high",
      "industrial-tunnel-flyer-shelter-early",
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
      "countryside-vertical-compound-low-ceiling-shuttle",
      "countryside-vertical-city-boundary-climb-yard",
      "countryside-vertical-city-boundary-shuttle",
      "countryside-vertical-city-boundary-upper-climb",
      "countryside-vertical-compound-return-high",
      "countryside-vertical-low-central-crossing",
      "countryside-vertical-compound-low-ceiling-shuttle",
      "countryside-vertical-compound-transfer-gate",
      "countryside-vertical-compound-low-ceiling-shuttle",
      "countryside-vertical-compound-transfer-gate",
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
