// The words the player reads, dialogue and the opening.

import type { InstallStepsKind } from "@andornaut/game-kit/web/pwa/installState";

import type { AchievementsText } from "./achievements.ts";
import type { SkillId } from "./bird.ts";
import type { Point } from "./geometry.ts";
import type { ControlAction } from "./ui.ts";

export interface DeathText {
  // The death card's accessible name, with the zone's name as {zone}.
  readonly label: string;
  readonly progress: string;
  readonly retry: string;
  readonly stage: string;
  readonly time: string;
  readonly title: string;
}

export interface StatsScopeText {
  readonly aggregate: string;
  readonly stageTotal: string;
  readonly zoneTotal: string;
}

export interface StatsText {
  readonly attempts: string;
  readonly best: string;
  readonly lastAttempt: string;
  readonly notCleared: string;
  readonly partial: string;
  readonly runTotal: string;
}

export interface SkillText {
  readonly description: string;
  readonly title: string;
}

// The words the player reads.
export interface GameText {
  readonly achievements: AchievementsText;
  // Each control's help illustration, by its accessible name.
  readonly actionIcons: Readonly<Record<ControlAction, string>>;
  // The skill details card's close X and its skill disc, by their accessible names; the disc's
  // has the skill's title as {skill}.
  readonly skillDetails: {
    readonly close: string;
    readonly disc: string;
  };
  // The skill HUD's description of the selected skill's readiness, and the tip a new grant shows,
  // with the skill's title as {skill}. Each skill button is named by its skill's title.
  readonly skillHud: {
    readonly enableTip: string;
    readonly ready: string;
    readonly recharging: string;
  };
  readonly skills: Readonly<Record<SkillId, SkillText>>;
  readonly stats: StatsText;
  readonly update: {
    readonly accept: string;
    readonly cancel: string;
    // The close X's accessible name.
    readonly close: string;
    // The message shown when a newer version wrote the save and none can be downloaded.
    readonly connect: string;
    readonly title: string;
  };
  readonly death: DeathText;
  // Dialogue controls and speaker names; paragraph text lives in lines.
  readonly dialogue: {
    readonly continue: string;
    // The conversation's accessible name, which a screen reader announces as it opens.
    readonly label: string;
    readonly skip: string;
    readonly speakers: Readonly<Record<string, string>>;
  };
  readonly homePage: {
    readonly description: string;
    readonly instructions: readonly string[];
    readonly play: string;
    readonly subline: string;
  };
  // What characters say in dialogue, by key.
  readonly lines: Readonly<Record<string, string>>;
  // Map destination and stage names, indexed separately by catalogue and stage-node id.
  readonly map: {
    readonly continue: string;
    // The stage picker's close X, by its accessible name.
    readonly stageClose: string;
    // A locked stage's accessible description in the stage picker.
    readonly stageLocked: string;
    readonly stageNumber: string;
    readonly stagePages: {
      readonly next: string;
      readonly page: string;
      readonly previous: string;
    };
    readonly stages: Readonly<Record<string, string>>;
    readonly title: string;
    readonly zones: Readonly<Record<string, string>>;
  };
  // Canonical action names used by control help and the touch buttons.
  readonly buttons: {
    readonly jump: string;
    readonly move: string;
    readonly use: string;
  };
  // What characters say in passing, by key.
  readonly quips: Readonly<Record<string, string>>;
  // A room's Leave button, which returns him to its door.
  readonly room: {
    readonly leave: string;
  };
  // Each room's name, by its key in ROOMS, shown in the room.
  readonly rooms: Readonly<Record<string, { readonly name: string }>>;
  // The celebration screen after the last zone: its title and message, Continue back to the map,
  // and Restart.
  readonly celebration: {
    readonly continue: string;
    readonly message: string;
    readonly restart: string;
    readonly title: string;
  };
  // The card that asks before Restart clears progress: its title, the question, Restart, which
  // confirms, and Cancel.
  readonly restart: {
    readonly cancel: string;
    readonly question: string;
    readonly restart: string;
    readonly title: string;
  };
  // The screen over the page when the game stops on an error.
  readonly crash: {
    readonly body: string;
    readonly reload: string;
    readonly title: string;
  };
  // The pause card: its title, the Settings and Back to title rows, and Resume; and the
  // accessible names of the pause button that opens it and its close X.
  readonly pause: {
    readonly button: string;
    readonly close: string;
    readonly home: string;
    readonly resume: string;
    readonly settings: string;
    readonly title: string;
  };
  // The start screen: Start without saved progress, or Continue and Restart with it, and the nav
  // bar's Achievements, Settings and Exit buttons.
  readonly start: {
    readonly achievements: string;
    readonly continue: string;
    readonly exit: string;
    readonly restart: string;
    readonly settings: string;
    readonly start: string;
  };
  // The settings card: its title, the Move controls, Action buttons and Reduced motion rows and
  // the touch rows' note, the Install row and its button, and the install steps for each kind of browser, shown on the
  // settings card's steps card and in the home page's steps dialog where the browser holds no
  // install prompt.
  readonly settings: {
    readonly actionButtons: string;
    // The close X's accessible name, on the settings card and the install steps card.
    readonly close: string;
    readonly install: string;
    readonly installButton: string;
    readonly installSteps: Readonly<Record<InstallStepsKind, InstallSteps>>;
    readonly moveControls: string;
    readonly reducedMotion: string;
    readonly title: string;
    // The note under the Move controls and Action buttons rows' names: hiding either hides only
    // its drawing.
    readonly touchStillWorks: string;
  };
}

// A browser's install steps: the card or dialog title, and the steps as one paragraph.
interface InstallSteps {
  readonly steps: string;
  readonly title: string;
}

// One paragraph in a linear conversation: speaker names a SPEAKERS entry, line a TEXT.lines key.
export interface DialogueLine {
  readonly line: string;
  readonly speaker: string;
}

interface StageBarkEvent {
  readonly atProgress: number;
  readonly id: string;
  readonly line: DialogueLine;
}
export type StageBarkSchedule = Readonly<Record<string, readonly StageBarkEvent[]>>;

// Opening motion uses normalized keyframes from the supplied storybook pose sheets.
export interface OpeningKeyframe {
  // Degrees clockwise; position is the logical viewport location of the layer anchor.
  readonly angle: number;
  readonly pose: string;
  readonly position: Point;
  // Normalized shot progress. Pose and visibility step; transforms interpolate.
  readonly progress: number;
  readonly scale: number;
  readonly visible: boolean;
}
export interface OpeningLayer {
  // Source-frame pixels, normalized by the selected frame dimensions at rendering.
  readonly anchor: Point;
  readonly art: string;
  readonly flipX?: boolean;
  readonly keyframes: readonly OpeningKeyframe[];
}
// Durations advance animation only; the beat always waits for a fresh Continue.
export interface OpeningShot {
  readonly background: string | null;
  readonly layers: readonly OpeningLayer[];
  readonly seconds: number;
}
export interface OpeningBeat {
  readonly shots: readonly OpeningShot[];
  readonly text: string;
}

// A terminal required choice. Prompt and labels are TEXT.lines keys; ids are returned to the
// opener without applying actions, flags or a default answer.
export interface DialogueChoice {
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly prompt: string;
}

// A conversation played one paragraph at a time, optionally ending with a required choice.
export interface ZoneEntryIntroduction {
  readonly character: string;
  readonly escapeTilesPerSecond: number;
  readonly idleAnimation: string;
  readonly runAnimation: string;
}

export interface ZoneDialoguePlan {
  readonly entry?: ZoneEntryIntroduction;
  readonly intro: string;
  readonly introStage?: string;
  readonly outro: string;
}

export interface DialoguePlan {
  readonly choice?: DialogueChoice;
  readonly lines: readonly DialogueLine[];
}

// A dialogue speaker's portrait asset and name-tab palette colour. TEXT.dialogue.speakers owns
// the displayed name under the same speaker key.
export interface DialogueSpeaker {
  readonly side: "left" | "right";
  readonly colour: "amber" | "green" | "pink" | "tan";
  readonly portrait: string | null;
}
