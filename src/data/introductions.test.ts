import { describe, expect, it } from "vitest";

import { ZONE_DIALOGUES } from "./dialogues";
import { ZONE_MAP } from "./map";
import { ROOMS } from "./rooms";
import { RECIPES } from "./zones";

describe.each(ZONE_MAP.destinations)("boss schedule $id", (destination) => {
  it("assigns the approved whole-stage encounter quotas", () => {
    const expected = destination.id === "apartment" ? [0, 0, 0, 0, 1, 1] : [0, 0, 1];
    expect(destination.stages.map((stage) => RECIPES[stage]!.encounters)).toEqual(expected);
  });

  it("explicitly places the introduction on a zero-encounter stage", () => {
    const story = ZONE_DIALOGUES[destination.id]!;
    const expected = destination.stages[destination.id === "apartment" ? 3 : 0];
    expect(story.introStage).toBe(expected);
    expect(destination.stages).toContain(story.introStage);
    expect(story.entry).toBeDefined();
    expect(RECIPES[story.introStage!]!.encounters).toBe(0);
  });
});

it("preserves one existing gift door per stage and seven grants per skill", () => {
  const grants = { dash: 0, doubleJump: 0, speedy: 0 };
  for (const stage of ZONE_MAP.destinations.flatMap(({ stages }) => stages)) {
    const recipe = RECIPES[stage]!;
    const doors =
      "sections" in recipe ? recipe.sections.flatMap(({ doors }) => doors) : recipe.doors;
    expect(doors, stage).toHaveLength(1);
    for (const door of doors) {
      expect(door.count, stage).toBe(1);
      const grant = ROOMS[door.room]?.grant;
      expect(grant, stage).toBeDefined();
      if (grant) {
        grants[grant] += door.count;
      }
    }
  }
  expect(grants).toEqual({ dash: 7, doubleJump: 7, speedy: 7 });
});
