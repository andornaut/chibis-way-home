import {
  BEAR_BEHAVIOUR,
  DOG_BEHAVIOUR,
  FERRET_BEHAVIOUR,
  GOOSE_BEHAVIOUR,
  PIGEON_BEHAVIOUR,
  RACCOON_BEHAVIOUR,
} from "./behaviours";
import type { BehaviourPlan, DialoguePlan, DialogueSpeaker, ZoneDialoguePlan } from "./types";

function maximumMovementSpeed(plan: BehaviourPlan): number {
  return Math.max(
    ...Object.values(plan.states).map(({ motion }) => (motion.kind === "wait" ? 0 : motion.speed)),
  );
}

export const BARK_BACKGROUND_ALPHA = 0.75;

// Default for transient barks; conversations advance only through player input.
export const BARK_DURATION_SECONDS = 5;

// Linear conversations, with paragraph text in TEXT.lines.
export const DIALOGUES: Readonly<Record<string, DialoguePlan>> = {
  "archie-foreshadow": {
    lines: [
      { line: "archie-foreshadow-1", speaker: "dog" },
      { line: "archie-foreshadow-2", speaker: "bird" },
      { line: "archie-foreshadow-3", speaker: "dog" },
    ],
  },
  "archie-outro": {
    lines: [
      { line: "archie-outro-1", speaker: "dog" },
      { line: "archie-outro-2", speaker: "bird" },
    ],
  },
  "bini-foreshadow": {
    lines: [
      { line: "bini-foreshadow-1", speaker: "bear" },
      { line: "bini-foreshadow-2", speaker: "bird" },
      { line: "bini-foreshadow-3", speaker: "bear" },
    ],
  },
  "bini-intro": {
    lines: [
      { line: "bini-intro-1", speaker: "bear" },
      { line: "bini-intro-2", speaker: "bird" },
      { line: "bini-intro-3", speaker: "bear" },
    ],
  },
  "bini-outro": {
    lines: [
      { line: "bini-outro-1", speaker: "bear" },
      { line: "bini-outro-2", speaker: "bird" },
    ],
  },
  "dash-gift": {
    lines: [{ line: "dash-gift", speaker: "room-helper" }],
  },
  "depot-dog-intro": {
    lines: [
      { line: "depot-dog-intro-1", speaker: "dog" },
      { line: "depot-dog-intro-2", speaker: "bird" },
      { line: "depot-dog-intro-3", speaker: "dog" },
    ],
  },
  "double-jump-gift": {
    lines: [{ line: "double-jump-gift", speaker: "room-helper" }],
  },
  "furt-foreshadow": {
    lines: [
      { line: "furt-foreshadow-1", speaker: "ferret" },
      { line: "furt-foreshadow-2", speaker: "bird" },
      { line: "furt-foreshadow-3", speaker: "ferret" },
    ],
  },
  "furt-intro": {
    lines: [
      { line: "furt-intro-1", speaker: "ferret" },
      { line: "furt-intro-2", speaker: "bird" },
      { line: "furt-intro-3", speaker: "ferret" },
    ],
  },
  "furt-outro": {
    lines: [
      { line: "furt-outro-1", speaker: "ferret" },
      { line: "furt-outro-2", speaker: "bird" },
    ],
  },
  "kiwi-foreshadow": {
    lines: [
      { line: "kiwi-foreshadow-1", speaker: "raccoon" },
      { line: "kiwi-foreshadow-2", speaker: "bird" },
      { line: "kiwi-foreshadow-3", speaker: "raccoon" },
    ],
  },
  "kiwi-intro": {
    lines: [
      { line: "kiwi-intro-1", speaker: "raccoon" },
      { line: "kiwi-intro-2", speaker: "bird" },
      { line: "kiwi-intro-3", speaker: "raccoon" },
    ],
  },
  "kiwi-outro": {
    lines: [
      { line: "kiwi-outro-1", speaker: "raccoon" },
      { line: "kiwi-outro-2", speaker: "bird" },
    ],
  },
  "pebble-foreshadow": {
    lines: [
      { line: "pebble-foreshadow-1", speaker: "pigeon" },
      { line: "pebble-foreshadow-2", speaker: "bird" },
      { line: "pebble-foreshadow-3", speaker: "pigeon" },
    ],
  },
  "pebble-intro": {
    lines: [
      { line: "pebble-intro-1", speaker: "pigeon" },
      { line: "pebble-intro-2", speaker: "bird" },
      { line: "pebble-intro-3", speaker: "pigeon" },
    ],
  },
  "pebble-outro": {
    lines: [
      { line: "pebble-outro-1", speaker: "pigeon" },
      { line: "pebble-outro-2", speaker: "bird" },
    ],
  },
  "speedy-gift": {
    lines: [{ line: "speedy-gift", speaker: "room-helper" }],
  },
  "trixi-foreshadow": {
    lines: [
      { line: "trixi-foreshadow-1", speaker: "goose" },
      { line: "trixi-foreshadow-2", speaker: "bird" },
      { line: "trixi-foreshadow-3", speaker: "goose" },
    ],
  },
  "trixi-intro": {
    lines: [
      { line: "trixi-intro-1", speaker: "goose" },
      { line: "trixi-intro-2", speaker: "bird" },
      { line: "trixi-intro-3", speaker: "goose" },
    ],
  },
  "trixi-outro": {
    lines: [
      { line: "trixi-outro-1", speaker: "goose" },
      { line: "trixi-outro-2", speaker: "bird" },
    ],
  },
};

// Portraits and name-tab colours shared by every line from a speaker.
export const SPEAKERS: Readonly<Record<string, DialogueSpeaker>> = {
  bear: { colour: "tan", portrait: "portrait-bear", side: "right" },
  bird: { colour: "amber", portrait: "portrait-bird", side: "left" },
  dog: { colour: "green", portrait: "portrait-dog", side: "right" },
  ferret: { colour: "tan", portrait: "portrait-ferret", side: "right" },
  goose: { colour: "tan", portrait: "portrait-goose", side: "right" },
  pigeon: { colour: "tan", portrait: "portrait-pigeon", side: "right" },
  raccoon: { colour: "tan", portrait: "portrait-raccoon", side: "right" },
  "room-helper": { colour: "green", portrait: "dog-pug", side: "right" },
};

export const ZONE_DIALOGUES: Readonly<Record<string, ZoneDialoguePlan>> = {
  apartment: {
    entry: {
      character: "ferret-antagonist",
      escapeTilesPerSecond: maximumMovementSpeed(FERRET_BEHAVIOUR),
      idleAnimation: "idle",
      runAnimation: "walk",
    },
    foreshadow: "furt-foreshadow",
    intro: "furt-intro",
    introStage: "spa",
    outro: "furt-outro",
  },
  "blue-cityscape": {
    entry: {
      character: "dog-antagonist",
      escapeTilesPerSecond: maximumMovementSpeed(DOG_BEHAVIOUR),
      idleAnimation: "idle",
      runAnimation: "walk",
    },
    foreshadow: "archie-foreshadow",
    intro: "depot-dog-intro",
    introStage: "street",
    outro: "archie-outro",
  },
  countryside: {
    entry: {
      character: "goose-antagonist",
      escapeTilesPerSecond: maximumMovementSpeed(GOOSE_BEHAVIOUR),
      idleAnimation: "idle",
      runAnimation: "walk",
    },
    foreshadow: "trixi-foreshadow",
    intro: "trixi-intro",
    introStage: "farmland",
    outro: "trixi-outro",
  },
  "home-city": {
    entry: {
      character: "raccoon-antagonist",
      escapeTilesPerSecond: maximumMovementSpeed(RACCOON_BEHAVIOUR),
      idleAnimation: "idle",
      runAnimation: "walk",
    },
    foreshadow: "kiwi-foreshadow",
    intro: "kiwi-intro",
    introStage: "city-outskirts",
    outro: "kiwi-outro",
  },
  industrial: {
    entry: {
      character: "pigeon-antagonist",
      escapeTilesPerSecond: maximumMovementSpeed(PIGEON_BEHAVIOUR),
      idleAnimation: "idle",
      runAnimation: "fly",
    },
    foreshadow: "pebble-foreshadow",
    intro: "pebble-intro",
    introStage: "warehouse-district",
    outro: "pebble-outro",
  },
  woodland: {
    entry: {
      character: "bear-antagonist",
      escapeTilesPerSecond: maximumMovementSpeed(BEAR_BEHAVIOUR),
      idleAnimation: "idle",
      runAnimation: "walk",
    },
    foreshadow: "bini-foreshadow",
    intro: "bini-intro",
    introStage: "forest-paths",
    outro: "bini-outro",
  },
};
