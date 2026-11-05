import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../data/achievements";
import { ZONE_MAP } from "../data/map";
import type { AchievementId } from "../data/types";
import {
  ACHIEVEMENT_IDS,
  achievementEntries,
  type AchievementFacts,
  type AchievementScope,
  earnedAt,
  zoneEndingAt,
} from "./achievements";

const PROFILE: AchievementFacts = { skillUsed: false, skills: [] };
const FIRST = ZONE_MAP.destinations[0]!;
const LAST = ZONE_MAP.destinations[ZONE_MAP.destinations.length - 1]!;

describe("judging each condition kind at its scope", () => {
  it.each<[string, AchievementScope, Partial<AchievementFacts>, AchievementId[]]>([
    ["an escape from Archie", "escape", { escaped: "archie" }, ["escape-archie"]],
    ["an escape outside its scope", "stage-clear", { escaped: "archie" }, []],
    [
      "City boundary cleared first try",
      "stage-clear",
      { stage: { attempts: 1, id: "city-boundary" } },
      ["first-try-archie"],
    ],
    [
      "City boundary cleared on a retry",
      "stage-clear",
      { stage: { attempts: 2, id: "city-boundary" } },
      [],
    ],
    [
      "a first-try stage outside its scope",
      "zone-clear",
      { stage: { attempts: 1, id: "city-boundary" } },
      [],
    ],
    [
      "Blue cityscape's last stage cleared after a retry",
      "zone-clear",
      { visit: { firstTries: 0, zone: FIRST.id }, zone: FIRST.id },
      ["clear-blue-cityscape"],
    ],
    [
      "Blue cityscape cleared first try throughout one visit",
      "zone-clear",
      { visit: { firstTries: FIRST.stages.length, zone: FIRST.id }, zone: FIRST.id },
      ["clear-blue-cityscape", "no-death-blue-cityscape"],
    ],
    [
      "Blue cityscape cleared with another zone's visit",
      "zone-clear",
      { visit: { firstTries: FIRST.stages.length, zone: "industrial" }, zone: FIRST.id },
      ["clear-blue-cityscape"],
    ],
    ["two skills owned", "skill", { skills: ["dash", "speedy"] }, []],
    ["every skill owned", "skill", { skills: ["dash", "doubleJump", "speedy"] }, ["gift-rooms"]],
    [
      "every skill owned outside its scope",
      "escape",
      { skills: ["dash", "doubleJump", "speedy"] },
      [],
    ],
    [
      "the last stage cleared without a skill",
      "stage-clear",
      { stage: { attempts: 3, id: ZONE_MAP.finish } },
      ["home-without-skills"],
    ],
    [
      "the last stage cleared after a skill",
      "stage-clear",
      { skillUsed: true, stage: { attempts: 3, id: ZONE_MAP.finish } },
      [],
    ],
    [
      "the last stage cleared first try without a skill",
      "stage-clear",
      { stage: { attempts: 1, id: ZONE_MAP.finish } },
      ["first-try-fert", "home-without-skills"],
    ],
    [
      "another stage cleared without a skill",
      "stage-clear",
      { stage: { attempts: 1, id: "street" } },
      [],
    ],
  ])("earns %s", (_, scope, facts, earned) => {
    expect(earnedAt([], scope, { ...PROFILE, ...facts })).toEqual(earned);
  });

  it("earns nothing already earned", () => {
    expect(earnedAt(["escape-archie"], "escape", { ...PROFILE, escaped: "archie" })).toEqual([]);
  });
});

describe("the Achievements card's entries", () => {
  it("lists all 26 by tier, catalogue order within each tier, earned or not", () => {
    const entries = achievementEntries(["home-without-skills", "escape-pebble"], PROFILE);
    expect(entries.map(({ id }) => id)).toEqual(ACHIEVEMENT_IDS);
    expect(ACHIEVEMENT_IDS).toEqual(
      ["easy", "medium", "hard"].flatMap((tier) =>
        ACHIEVEMENTS.filter((achievement) => achievement.tier === tier).map(({ id }) => id),
      ),
    );
    expect(entries.filter(({ earned }) => earned).map(({ id }) => id)).toEqual([
      "escape-pebble",
      "home-without-skills",
    ]);
  });

  it("shows a locked no-death zone's current visit count, and none once earned", () => {
    const visit = { firstTries: 2, zone: LAST.id };
    const entries = new Map(
      achievementEntries(["no-death-blue-cityscape"], { ...PROFILE, visit }).map((entry) => [
        entry.id,
        entry,
      ]),
    );
    expect({
      apartment: entries.get("no-death-apartment")?.progress,
      cityscape: entries.get("no-death-blue-cityscape")?.progress,
      escape: entries.get("escape-archie")?.progress,
      industrial: entries.get("no-death-industrial")?.progress,
    }).toEqual({
      apartment: { have: 2, need: LAST.stages.length },
      cityscape: undefined,
      escape: undefined,
      industrial: { have: 0, need: 3 },
    });
  });

  it("finds the destination a stage ends", () => {
    expect([zoneEndingAt(ZONE_MAP, "city-boundary"), zoneEndingAt(ZONE_MAP, "street")]).toEqual([
      FIRST.id,
      undefined,
    ]);
  });
});
