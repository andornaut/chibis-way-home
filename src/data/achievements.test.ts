import { describe, expect, it } from "vitest";

import iconSheet from "../../public/art/sprites/icon-achievement.json";
import { ACHIEVEMENT_TIERS, ACHIEVEMENTS, BOSS_CHARACTERS, BOSS_ZONES } from "./achievements";
import { CHARACTERS } from "./characters";
import { ZONE_MAP } from "./map";
import { TEXT } from "./text";
import type { AchievementCondition, BossId } from "./types";

const BOSS_IDS = Object.keys(BOSS_CHARACTERS) as BossId[];
const withKind = <K extends AchievementCondition["kind"]>(kind: K) =>
  ACHIEVEMENTS.flatMap(({ conditions, id }) =>
    conditions.flatMap((condition) =>
      condition.kind === kind
        ? [{ condition: condition as Extract<AchievementCondition, { kind: K }>, id }]
        : [],
    ),
  );

describe("the achievement catalogue", () => {
  it("holds 26 unique ids, nine easy, nine medium and eight hard, each tier contiguous", () => {
    const ids = ACHIEVEMENTS.map(({ id }) => id);
    const tiers = ACHIEVEMENTS.map(({ tier }) => tier);
    expect({
      count: ids.length,
      ordered: tiers.every(
        (tier, index) =>
          index === 0 ||
          ACHIEVEMENT_TIERS.indexOf(tiers[index - 1]!) <= ACHIEVEMENT_TIERS.indexOf(tier),
      ),
      tiers: ACHIEVEMENT_TIERS.map((tier) => tiers.filter((each) => each === tier).length),
      unique: new Set(ids).size,
    }).toEqual({ count: 26, ordered: true, tiers: [9, 9, 8], unique: 26 });
  });

  it("gives every map destination one zone clear and one no-death zone", () => {
    const zones = ZONE_MAP.destinations.map(({ id }) => id).sort();
    expect(
      withKind("zone-cleared")
        .map(({ condition }) => condition.zone)
        .sort(),
    ).toEqual(zones);
    expect(
      withKind("zone-no-death")
        .map(({ condition }) => condition.zone)
        .sort(),
    ).toEqual(zones);
  });

  it("gives every boss one escape and one first-try clear of its zone's third stage", () => {
    expect(
      withKind("boss-escaped")
        .map(({ condition }) => condition.boss)
        .sort(),
    ).toEqual([...BOSS_IDS].sort());
    const stages = withKind("stage-first-try").map(({ condition, id }) => [id, condition.stage]);
    expect(Object.fromEntries(stages)).toEqual(
      Object.fromEntries(
        BOSS_IDS.map((boss) => {
          const zone = ZONE_MAP.destinations.find(({ id }) => id === BOSS_ZONES[boss])!;
          // Fert's third stage is his zone's last, the Penthouse.
          const third = boss === "fert" ? zone.stages[zone.stages.length - 1] : zone.stages[2];
          return [`first-try-${boss}`, third];
        }),
      ),
    );
  });

  it("names a boss character for every boss and a zone per boss", () => {
    for (const boss of BOSS_IDS) {
      expect(CHARACTERS[BOSS_CHARACTERS[boss]]?.behaviour, boss).toBeDefined();
    }
    expect(new Set(Object.values(BOSS_ZONES)).size).toBe(BOSS_IDS.length);
  });

  it("has a title and description for every id and nothing else", () => {
    expect(Object.keys(TEXT.achievements.entries).sort()).toEqual(
      ACHIEVEMENTS.map(({ id }) => id).sort(),
    );
    for (const { description, title } of Object.values(TEXT.achievements.entries)) {
      expect([description.length > 0, title.length > 0]).toEqual([true, true]);
    }
  });

  it("matches art's icon tags, one per id in catalogue order", () => {
    expect(iconSheet.meta.frameTags.map(({ name }) => name)).toEqual(
      ACHIEVEMENTS.map(({ id }) => id),
    );
  });
});
