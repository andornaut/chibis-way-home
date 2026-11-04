import { expect, it } from "vitest";

import { bossRemovalView } from "./bossRemoval";

it.each([
  ["fades the boss without the puff texture", 0.25, false, false, { alpha: 0.75, kind: "fade" }],
  ["plays the puff once its texture exists", 0.25, true, false, { kind: "puff", play: true }],
  [
    "holds the puff's first frame with reduced motion",
    0.25,
    true,
    true,
    { kind: "puff", play: false },
  ],
  ["removes the boss when the removal ends", 1, true, false, { kind: "removed" }],
  ["removes the fading boss when the removal ends", 1, false, false, { kind: "removed" }],
] as const)("%s", (_, progress, loaded, reduced, view) => {
  expect(bossRemovalView(progress, loaded, reduced)).toEqual(view);
});
