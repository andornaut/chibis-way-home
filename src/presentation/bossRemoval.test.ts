import { expect, it } from "vitest";

import manifest from "../../public/art/manifest.json" with { type: "json" };
import sheet from "../../public/art/sprites/boss-removal.json" with { type: "json" };
import { BOSS_REMOVAL_SECONDS } from "../data/behaviours.ts";
import { BOSS_REMOVAL_ART, bossRemovalView } from "./bossRemoval.ts";

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

it("plays Art's puff over exactly the rules' removal once its texture is built", () => {
  const sprite = manifest.sprites.find(({ key }) => key === BOSS_REMOVAL_ART.key);
  expect(sprite?.once).toContain(BOSS_REMOVAL_ART.tag);
  const tag = sheet.meta.frameTags.find(({ name }) => name === BOSS_REMOVAL_ART.tag)!;
  const frames = Object.values(sheet.frames).slice(tag.from, tag.to + 1);
  expect(frames.map(({ sourceSize }) => sourceSize)).toEqual(frames.map(() => ({ h: 64, w: 64 })));
  expect(frames.reduce((total, { duration }) => total + duration, 0)).toBe(
    BOSS_REMOVAL_SECONDS * 1000,
  );
  expect(bossRemovalView(0, true, false)).toEqual({ kind: "puff", play: true });
});
