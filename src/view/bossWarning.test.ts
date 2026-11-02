import { expect, it } from "vitest";

import { BOSS_WARNING } from "../data/bossWarning";
import { bossWarning } from "./bossWarning";

const tell = { active: true, activeAttack: { id: "attack", phase: "tell" as const } };
it.each([
  { height: 48, radius: 40, width: 48 },
  { height: 80, radius: 58, width: 64 },
])("surrounds every corner of the full $width x $height frame", ({ height, radius, width }) => {
  const frame = { height, width, x: 100, y: 80 };
  const circle = bossWarning(BOSS_WARNING.clearance, tell, frame)!;
  expect(circle).toEqual({ radius, x: 100 + width / 2, y: 80 + height / 2 });
  for (const x of [frame.x, frame.x + width]) {
    for (const y of [frame.y, frame.y + height]) {
      expect(Math.hypot(x - circle.x, y - circle.y) + BOSS_WARNING.clearance).toBeLessThanOrEqual(
        circle.radius,
      );
    }
  }
});
it("has no cue outside the active tell, including committed attacks and cooldown", () => {
  const frame = { height: 48, width: 48, x: 0, y: 0 };
  for (const state of [
    undefined,
    { active: false, activeAttack: tell.activeAttack },
    { active: true },
    { active: true, activeAttack: { id: "attack", phase: "committed" as const } },
  ]) {
    expect(bossWarning(BOSS_WARNING.clearance, state, frame)).toBeUndefined();
  }
});
