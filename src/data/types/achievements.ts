// The achievement catalogue's shapes. src/data/achievements.ts fills them; the words are in
// TEXT.achievements, by achievement id.

import type { AchievementDef, Threshold } from "@andornaut/game-kit/achievements";

export type BossId = "archie" | "bini" | "fert" | "kiwi" | "pebble" | "trixi";

export type AchievementTier = "easy" | "medium" | "hard";

export type AchievementId =
  | "clear-apartment"
  | "clear-blue-cityscape"
  | "clear-countryside"
  | "clear-home-city"
  | "clear-industrial"
  | "clear-woodland"
  | "escape-archie"
  | "escape-bini"
  | "escape-fert"
  | "escape-kiwi"
  | "escape-pebble"
  | "escape-trixi"
  | "first-try-archie"
  | "first-try-bini"
  | "first-try-fert"
  | "first-try-kiwi"
  | "first-try-pebble"
  | "first-try-trixi"
  | "gift-rooms"
  | "home-without-skills"
  | "no-death-apartment"
  | "no-death-blue-cityscape"
  | "no-death-countryside"
  | "no-death-home-city"
  | "no-death-industrial"
  | "no-death-woodland";

// What earns an achievement. Stages and zones are map stage-node and destination ids.
export type AchievementCondition =
  // The first escape from that boss's pursuit.
  | { readonly kind: "boss-escaped"; readonly boss: BossId }
  // Finishing the map's last stage with no skill used since the last confirmed Restart.
  | { readonly kind: "journey-without-skills" }
  // Owning count of the gift-room skills.
  | { readonly kind: "skills-owned"; readonly count: Threshold }
  // Clearing the stage on its first attempt after entry.
  | { readonly kind: "stage-first-try"; readonly stage: string }
  // Clearing the zone's last stage.
  | { readonly kind: "zone-cleared"; readonly zone: string }
  // Clearing every stage of the zone, each on its first attempt, in one continuous visit.
  | { readonly kind: "zone-no-death"; readonly zone: string };

export type ChibiAchievement = AchievementDef<AchievementId, AchievementCondition, AchievementTier>;

export interface AchievementText {
  readonly description: string;
  readonly title: string;
}

// The achievements card and the unlock notice.
export interface AchievementsText {
  // The Achievements card's title.
  readonly cardTitle: string;
  // Each achievement's title and description.
  readonly entries: Readonly<Record<AchievementId, AchievementText>>;
  // The unlock notice: {title} is the achievement's title.
  readonly notice: string;
  // The card's pager, as the stage chooser's.
  readonly pages: {
    readonly next: string;
    readonly page: string;
    readonly previous: string;
  };
  // A locked no-death zone's current sequence, as {have}/{need}.
  readonly progress: string;
}
