import {
  earnedFormat,
  type EarnedRecord,
  type EarnedStore,
  earnedStore,
} from "@andornaut/game-kit/achievements";
import type { SaveStorage } from "@andornaut/game-kit/save/storage";
import type { SaveFormat } from "@andornaut/game-kit/save/versionedSave";

import type { AchievementId } from "../../data/types";
import { ACHIEVEMENT_IDS } from "../achievements";

// The earned record's version, apart from progress and statistics, so Restart keeps it. Loading
// drops unknown ids instead of resetting.
export const ACHIEVEMENTS_VERSION = 1;

export const ACHIEVEMENT_KEYS = {
  backup: "chibis-way-home.achievements-backup",
  save: "chibis-way-home.achievements",
} as const;

export const ACHIEVEMENTS_FORMAT: SaveFormat<EarnedRecord<AchievementId>> = earnedFormat(
  ACHIEVEMENTS_VERSION,
  ACHIEVEMENT_IDS,
);

export function achievementsStore(storage: SaveStorage): EarnedStore<AchievementId> {
  return earnedStore(storage, ACHIEVEMENT_KEYS, ACHIEVEMENTS_FORMAT);
}
