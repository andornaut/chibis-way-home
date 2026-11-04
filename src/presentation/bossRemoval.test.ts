import { expect, it } from "vitest";

import { bossRemovalView } from "./bossRemoval";

it.each([
  ["fades the boss without the puff texture", 0.25, false, { alpha: 0.75, kind: "fade" }],
  ["plays the puff once its texture exists", 0.25, true, { kind: "puff" }],
  ["removes the boss when the removal ends", 1, true, { kind: "removed" }],
  ["removes the fading boss when the removal ends", 1, false, { kind: "removed" }],
] as const)("%s", (_, progress, loaded, view) => {
  expect(bossRemovalView(progress, loaded)).toEqual(view);
});
