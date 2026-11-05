import type { AchievementTier, BossId, ChibiAchievement, DialogueSpeaker } from "./types";

// The tiers in card order.
export const ACHIEVEMENT_TIERS: readonly AchievementTier[] = ["easy", "medium", "hard"];

// Each boss's character, whose escape counts for it.
export const BOSS_CHARACTERS: Readonly<Record<BossId, string>> = {
  archie: "dog-antagonist",
  bini: "bear-antagonist",
  fert: "ferret-antagonist",
  kiwi: "raccoon-antagonist",
  pebble: "pigeon-antagonist",
  trixi: "goose-antagonist",
};

// The map destination each boss chases Chibi through.
export const BOSS_ZONES: Readonly<Record<BossId, string>> = {
  archie: "blue-cityscape",
  bini: "woodland",
  fert: "apartment",
  kiwi: "home-city",
  pebble: "industrial",
  trixi: "countryside",
};

// Seconds an unlock notice shows.
export const ACHIEVEMENT_NOTICE_SECONDS = 3;

// The unlock notice's icon side in the shared dialogue panel.
export const ACHIEVEMENT_NOTICE_SIDE: DialogueSpeaker["side"] = "left";

// The catalogue, in its rules order. The card sorts it by tier, keeping this order within each.
export const ACHIEVEMENTS: readonly ChibiAchievement[] = [
  { conditions: [{ boss: "archie", kind: "boss-escaped" }], id: "escape-archie", tier: "easy" },
  { conditions: [{ boss: "pebble", kind: "boss-escaped" }], id: "escape-pebble", tier: "easy" },
  { conditions: [{ boss: "trixi", kind: "boss-escaped" }], id: "escape-trixi", tier: "easy" },
  { conditions: [{ boss: "bini", kind: "boss-escaped" }], id: "escape-bini", tier: "easy" },
  { conditions: [{ boss: "kiwi", kind: "boss-escaped" }], id: "escape-kiwi", tier: "easy" },
  { conditions: [{ boss: "fert", kind: "boss-escaped" }], id: "escape-fert", tier: "easy" },
  {
    conditions: [{ kind: "zone-cleared", zone: "blue-cityscape" }],
    id: "clear-blue-cityscape",
    tier: "easy",
  },
  {
    conditions: [{ kind: "zone-cleared", zone: "industrial" }],
    id: "clear-industrial",
    tier: "easy",
  },
  {
    conditions: [{ kind: "zone-cleared", zone: "countryside" }],
    id: "clear-countryside",
    tier: "easy",
  },
  {
    conditions: [{ kind: "zone-cleared", zone: "woodland" }],
    id: "clear-woodland",
    tier: "medium",
  },
  {
    conditions: [{ kind: "zone-cleared", zone: "home-city" }],
    id: "clear-home-city",
    tier: "medium",
  },
  {
    conditions: [{ kind: "zone-cleared", zone: "apartment" }],
    id: "clear-apartment",
    tier: "medium",
  },
  { conditions: [{ count: "all", kind: "skills-owned" }], id: "gift-rooms", tier: "medium" },
  {
    conditions: [{ kind: "stage-first-try", stage: "city-boundary" }],
    id: "first-try-archie",
    tier: "medium",
  },
  {
    conditions: [{ kind: "stage-first-try", stage: "freight-terminal" }],
    id: "first-try-pebble",
    tier: "medium",
  },
  {
    conditions: [{ kind: "stage-first-try", stage: "river-crossing" }],
    id: "first-try-trixi",
    tier: "medium",
  },
  {
    conditions: [{ kind: "zone-no-death", zone: "blue-cityscape" }],
    id: "no-death-blue-cityscape",
    tier: "medium",
  },
  {
    conditions: [{ kind: "zone-no-death", zone: "industrial" }],
    id: "no-death-industrial",
    tier: "medium",
  },
  {
    conditions: [{ kind: "stage-first-try", stage: "ravine" }],
    id: "first-try-bini",
    tier: "hard",
  },
  {
    conditions: [{ kind: "stage-first-try", stage: "familiar-neighbourhood" }],
    id: "first-try-kiwi",
    tier: "hard",
  },
  {
    conditions: [{ kind: "stage-first-try", stage: "penthouse" }],
    id: "first-try-fert",
    tier: "hard",
  },
  {
    conditions: [{ kind: "zone-no-death", zone: "countryside" }],
    id: "no-death-countryside",
    tier: "hard",
  },
  {
    conditions: [{ kind: "zone-no-death", zone: "woodland" }],
    id: "no-death-woodland",
    tier: "hard",
  },
  {
    conditions: [{ kind: "zone-no-death", zone: "home-city" }],
    id: "no-death-home-city",
    tier: "hard",
  },
  {
    conditions: [{ kind: "zone-no-death", zone: "apartment" }],
    id: "no-death-apartment",
    tier: "hard",
  },
  {
    conditions: [{ kind: "journey-without-skills" }],
    id: "home-without-skills",
    tier: "hard",
  },
];
