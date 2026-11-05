import {
  type ConditionKinds,
  type Judge,
  judge,
  newlyEarned,
  orderByTier,
  type Progress as AchievementProgress,
  resolveThreshold,
} from "@andornaut/game-kit/achievements";

import { ACHIEVEMENT_TIERS, ACHIEVEMENTS } from "../data/achievements";
import { ZONE_MAP } from "../data/map";
import type {
  AchievementCondition,
  AchievementId,
  BossId,
  ChibiAchievement,
  SkillId,
  ZoneMap,
} from "../data/types";
import { SKILL_IDS } from "./skills";

export type { AchievementProgress };

// Where achievements are judged: an escape from a boss, a stage cleared, a zone's last stage
// cleared and a skill granted.
export type AchievementScope = "escape" | "skill" | "stage-clear" | "zone-clear";

// The current zone visit: its zone and how many of its stages were cleared on their first attempt,
// 0 once any stage in it took a retry.
export interface VisitFirstTries {
  readonly firstTries: number;
  readonly zone: string;
}

// What a scope knows. Every scope has the owned skills and whether a skill was used since the
// last confirmed Restart.
export interface AchievementFacts {
  // escape: the boss escaped.
  readonly escaped?: BossId;
  readonly skills: readonly SkillId[];
  readonly skillUsed: boolean;
  // stage-clear: the stage cleared and its attempts in this run.
  readonly stage?: { readonly attempts: number; readonly id: string };
  readonly visit?: VisitFirstTries;
  // zone-clear: the destination whose last stage was cleared.
  readonly zone?: string;
}

function stageCount(map: ZoneMap, zone: string): number {
  const destination = map.destinations.find(({ id }) => id === zone);
  if (destination === undefined) {
    throw new RangeError(`No map destination ${zone}`);
  }
  return destination.stages.length;
}

const firstTries = (facts: AchievementFacts, zone: string): number =>
  facts.visit?.zone === zone ? facts.visit.firstTries : 0;

// The evaluators for map's stages and destinations.
export function achievementKinds(
  map: ZoneMap,
): ConditionKinds<AchievementCondition, AchievementScope, AchievementFacts> {
  return {
    "boss-escaped": { holds: (facts, { boss }) => facts.escaped === boss, scopes: ["escape"] },
    "journey-without-skills": {
      holds: (facts) => facts.stage?.id === map.finish && !facts.skillUsed,
      scopes: ["stage-clear"],
    },
    "skills-owned": {
      holds: (facts, { count }) =>
        SKILL_IDS.filter((skill) => facts.skills.includes(skill)).length >=
        resolveThreshold(SKILL_IDS.length, count),
      scopes: ["skill"],
    },
    "stage-first-try": {
      holds: (facts, { stage }) => facts.stage?.id === stage && facts.stage.attempts === 1,
      scopes: ["stage-clear"],
    },
    "zone-cleared": { holds: (facts, { zone }) => facts.zone === zone, scopes: ["zone-clear"] },
    "zone-no-death": {
      holds: (facts, { zone }) =>
        facts.zone === zone && firstTries(facts, zone) >= stageCount(map, zone),
      progress: (facts, { zone }) => ({
        have: firstTries(facts, zone),
        need: stageCount(map, zone),
      }),
      scopes: ["zone-clear"],
    },
  };
}

export const ACHIEVEMENT_JUDGE: Judge<AchievementCondition, AchievementScope, AchievementFacts> =
  judge(achievementKinds(ZONE_MAP));

// The catalogue in card order: by tier, in catalogue order within each.
export const ORDERED_ACHIEVEMENTS: readonly ChibiAchievement[] = orderByTier(
  ACHIEVEMENT_TIERS,
  ACHIEVEMENTS,
);

export const ACHIEVEMENT_IDS: readonly AchievementId[] = ORDERED_ACHIEVEMENTS.map(({ id }) => id);

// The achievements not in earned that facts earn at scope, in card order.
export function earnedAt(
  earned: readonly AchievementId[],
  scope: AchievementScope,
  facts: AchievementFacts,
): AchievementId[] {
  return newlyEarned(ACHIEVEMENT_JUDGE, ORDERED_ACHIEVEMENTS, scope, facts, earned);
}

// The map destination whose last stage stage is, if any.
export function zoneEndingAt(map: ZoneMap, stage: string): string | undefined {
  return map.destinations.find(({ stages }) => stages[stages.length - 1] === stage)?.id;
}

// One entry on the Achievements card: earned or not, and how far a locked one with progress has
// come.
export interface AchievementEntry {
  readonly earned: boolean;
  readonly id: AchievementId;
  readonly progress?: AchievementProgress;
}

// Every achievement in card order, none hidden. facts gives a locked entry's progress.
export function achievementEntries(
  earned: readonly AchievementId[],
  facts: AchievementFacts,
): AchievementEntry[] {
  const held = new Set(earned);
  return ORDERED_ACHIEVEMENTS.map(({ conditions, id }) => {
    if (held.has(id)) {
      return { earned: true, id };
    }
    const progress = ACHIEVEMENT_JUDGE.progress("zone-clear", facts, conditions);
    return { earned: false, id, ...(progress && { progress }) };
  });
}
