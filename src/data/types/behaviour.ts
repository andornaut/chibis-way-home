// How objects move, react and behave, and the characters and archetypes that carry them.

import type { Direction, Point, Rect } from "./geometry";
import type { DialogueLine } from "./text";

export type Collision = "hazard" | "ledge" | "none" | "solid" | "use";
type MotionAlgorithm = "ease" | "hop" | "linear" | "static" | "wander";
type ReactionKind = "approach" | "avoid" | "none";

// How an object moves from where it is placed, in tiles and seconds (pixels in a layout). Its far
// end is distance away in direction. linear: there at speed, pause, back, pause. ease: the same
// legs, easing in and out (speed is the leg's average). hop: linear, plus an upward arc
// hopHeight high on each leg. wander: each leg goes to a random point between the placed spot
// and the far end. variance (0 to 1): each leg's speed, distance and pause vary by up to that
// fraction.
export interface Motion {
  // Scenery-only first leg, activated once by viewport intersection; phase and pause must be zero.
  readonly playback?: "once-visible";
  readonly algorithm: MotionAlgorithm;
  readonly direction: Direction;
  readonly distance: number;
  readonly hopHeight: number;
  readonly pause: number;
  readonly speed: number;
  readonly variance: number;
}

// Within range of him (centre to centre), an "avoid" object moves away from him and an
// "approach" one toward him, along its motion's axis, at speed. Out of range, it goes back to its
// path at that speed and follows it again. In tiles (pixels in a layout).
export interface Reaction {
  readonly kind: ReactionKind;
  readonly range: number;
  readonly speed: number;
}

export type BehaviourCondition =
  | { readonly kind: "attack-ready" }
  | { readonly kind: "targeted-attack-allowed" }
  | { readonly kind: "pursuit-ended" }
  | { readonly kind: "visible" }
  | { readonly kind: "line-of-sight" }
  | { readonly kind: "alignment-blocked" }
  | { readonly kind: "flight-approach-direction"; readonly direction: -1 | 1 }
  | { readonly kind: "boundary" }
  // The current track travel cannot advance toward its endpoint before reaching it.
  | { readonly kind: "blocked" }
  // The named track state's travel, entered from here, reaches its endpoint unobstructed.
  | { readonly kind: "track-clear"; readonly state: string }
  // The current track travel, turned toward Chibi, can advance at least distance tiles before
  // its end, terrain or the edge of its support stops it.
  | { readonly kind: "track-room"; readonly distance: number }
  // The inner condition does not hold; its placement rules still apply.
  | { readonly kind: "not"; readonly condition: BehaviourCondition }
  | {
      readonly kind: "arrived";
      readonly target?: "live" | "intent";
      readonly tolerance: number;
    }
  | { readonly kind: "elapsed"; readonly seconds: number }
  | { readonly kind: "nearby"; readonly range: number }
  | {
      readonly kind: "horizontal-gap";
      readonly comparison: "at-least" | "below";
      // Tiles between the current opaque boss body and Chibi's collision box, ignoring Y.
      readonly distance: number;
    }
  | { readonly kind: "same-ground"; readonly tolerance: number }
  | { readonly kind: "reachable" | "lost-target"; readonly tolerance: number };

// Ground pursuit physics: authored gravity in tiles/second squared and speeds in tiles/second.
// The resolver scales all three spatial values to pixels without changing time units.
interface BehaviourTraversal {
  readonly prepSeconds: number;
  // A pursuit takeoff preparation starts at most once per this many seconds; a takeoff sooner
  // launches without one.
  readonly prepIntervalSeconds?: number;
  readonly gravity: number;
  readonly jumpSpeed: number;
  readonly maxFallSpeed: number;
}

export interface BehaviourPursuitIntent {
  // Active seconds per decision.
  readonly decisionSeconds: { readonly min: number; readonly max: number };
  // Signed horizontal world-X offset: tiles in authored data, pixels in a resolved plan.
  readonly offset: { readonly min: number; readonly max: number };
}

export type BehaviourMotion =
  | { readonly kind: "wait"; readonly support?: "required" }
  | {
      readonly kind: "pursue";
      readonly mode: "fly";
      readonly intent?: BehaviourPursuitIntent;
      // Tiles: frame-bottom clearance above the target top, and lead along its captured travel side.
      readonly overhead?: { readonly ahead: number; readonly clearance: number };
      readonly speed: number;
    }
  | {
      readonly kind: "pursue";
      readonly mode: "ground";
      readonly intent?: BehaviourPursuitIntent;
      readonly speed: number;
      readonly traversal?: BehaviourTraversal;
    }
  | { readonly kind: "fly"; readonly to: Point; readonly speed: number }
  | {
      readonly kind: "fly";
      readonly to: "support";
      readonly speed: number;
      readonly selection?: {
        readonly kind: "varied";
        // Horizontal tile displacement; the same support may contain another landing point.
        readonly distance: number;
        readonly minDistance: number;
        // Tiles above both endpoints for the ascent, cruise and supported descent.
        readonly clearance: number;
        readonly maxAttempts: number;
      };
    }
  // Target flight captures contact-centred aim on entry; bounds limit relative top-left positions.
  | { readonly kind: "fly"; readonly to: "target"; readonly bounds: Rect; readonly speed: number }
  // Capture entry Y; track target-centred X with bounded velocity lead. Distances use tiles.
  | {
      readonly kind: "fly";
      readonly to: "target-x";
      // Tiles along the same travel side captured by an overhead pursuit approach.
      readonly ahead?: number;
      readonly bounds: Rect;
      readonly speed: number;
      readonly leadSeconds: number;
      readonly maxLead: number;
    }
  // Distance bounds travel from the state's entry point along its heading: tiles in authored
  // data, pixels in a resolved plan.
  | {
      readonly direction: -1 | 1 | "facing" | "target";
      readonly distance?: number;
      readonly kind: "move";
      readonly speed: number;
    }
  | {
      readonly direction: -1 | 1 | "facing" | "target";
      readonly distance?: number;
      readonly hopHeight: number;
      readonly hopSeconds: number;
      readonly kind: "hop";
      readonly speed: number;
    };

export interface BehaviourTransition {
  readonly to: string;
  // Conditions in one transition must all hold; the first matching transition wins.
  readonly when: readonly BehaviourCondition[];
}

// Entry actions use tiles in authored data and pixels in a resolved layout.
export type BehaviourAction =
  | {
      readonly kind: "spawn";
      readonly mirrorWithFacing?: boolean;
      readonly character: string;
      readonly offset: Point;
      readonly velocity: Point;
      readonly gravity: number;
      readonly lifeSeconds: number;
      readonly armSeconds: number;
      readonly armingAnimation?: string;
      readonly maxAlive: number;
    }
  | {
      readonly kind: "force-pulse";
      readonly visual?: {
        readonly art: string;
        readonly animation: string;
        readonly offset: Point;
      };
      readonly range: number;
      readonly height: number;
      readonly velocity: Point;
      readonly seconds: number;
    };

export interface BehaviourIdleWatchdog {
  readonly distance: number;
  readonly maxAttempts: number;
  readonly minMovement: number;
  readonly resume: string;
  readonly seconds: number;
}

export interface BehaviourGroundReposition {
  readonly intervalSeconds: number;
  // Maximum two-dimensional displacement radius and minimum horizontal displacement, in tiles.
  readonly distance: number;
  readonly minDistance: number;
  readonly maxAttempts: number;
  readonly resume: string;
}

export type HazardPhase = "inactive" | "warning" | "active";

export interface BehaviourNode {
  // Stationary timed hazards label every state; recovery uses inactive.
  readonly hazardPhase?: HazardPhase;
  // Tell starts one attack; committed includes its recovery; completed begins the actor cooldown.
  // A continuing tell re-tells inside its committed attack, before a further committed action.
  readonly attack?: {
    readonly continues?: true;
    readonly id: string;
    readonly phase: "tell" | "committed" | "completed";
  };
  // Only these uncommitted states may yield to a verified idle reposition.
  readonly allowIdleReposition?: boolean;
  // Periodic variation is permitted only in explicitly eligible uncommitted ground states.
  readonly allowGroundReposition?: boolean;
  // Override this state's axis and signed placed-origin extent.
  readonly track?: { readonly axis: "x" | "y"; readonly distance: number };
  readonly onEnter?: readonly BehaviourAction[];
  readonly animation: string | null;
  readonly enter?: "face-target";
  readonly motion: BehaviourMotion;
  readonly transitions: readonly BehaviourTransition[];
}

// A reusable bounded movement graph. Distance is signed from its placed origin, in tiles in
// data and pixels in a layout. Spatial conditions and speeds use the same units.
export interface BehaviourPlan {
  // Seconds between complete attacks, independent of graph-state changes.
  readonly attackCooldownSeconds?: number;
  // After `cancels` consecutive cancelled tells, no tell starts for `seconds`; this is not
  // cooldown, and pursuit continues.
  readonly tellCancelPause?: { readonly cancels: number; readonly seconds: number };
  readonly idleWatchdog?: BehaviourIdleWatchdog;
  readonly groundReposition?: BehaviourGroundReposition;
  readonly pursuit?: {
    readonly distance: number;
    // Null disables elapsed-time giveup; unknown planner results never establish unreachability.
    readonly unreachableGraceSeconds: number | null;
    // Current physical body-centre separation in both axes: tiles in data, pixels in layouts.
    readonly escapeDistance?: number;
    readonly escaped: DialogueLine;
    // A mapped ground pursuer with no movement-map path to Chibi walks to the reachable spot
    // nearest him and paces there: distance in tiles in data, pixels in layouts, and its speed as
    // a fraction of chase speed.
    readonly pace?: { readonly distance: number; readonly speedScale: number };
  };
  readonly spotted?: DialogueLine;
  readonly axis: "x" | "y";
  readonly distance: number;
  readonly inactiveAnimation?: string;
  readonly takeoffAnimation?: string;
  readonly initial: string;
  readonly states: Readonly<Record<string, BehaviourNode>>;
}

type InteractionKind = "none" | "quip" | "talk";

// How a character interacts with him, within range tiles of him (centre to centre). quip: says
// one of its quips when he comes within range; talk: Use within range opens its dialogue.
export interface Interaction {
  readonly kind: InteractionKind;
  readonly range: number;
}

// The parts of an archetype a character or an instance may override.
export interface Tuning {
  readonly interaction?: Partial<Interaction>;
  readonly motion?: Partial<Motion>;
  readonly reaction?: Partial<Reaction>;
}

// A behaviour (ARCHETYPES by name, in src/data/archetypes.ts): its collision, fixed, and the
// default motion, reaction and interaction its characters tune. collision: solid blocks him from
// every side; ledge only from above; touching a hazard restarts the zone; Use in a use zone, a
// door, opens its room; none is scenery.
export interface Archetype {
  readonly collision: Collision;
  readonly interaction: Interaction;
  readonly motion: Motion;
  readonly reaction: Reaction;
}

// The states an animation tag can play for. open: a door as he uses it, before its room shows.
export type CharacterState = "idle" | "move" | "open" | "react" | "talk";

// An idle tic: tag plays once every `every` seconds, give or take variance (0 to 1) of that,
// rolled fresh each attempt like random motion.
export interface Quirk {
  readonly every: number;
  readonly tag: string;
  readonly variance: number;
}

// Who or what a placed thing is (CHARACTERS by name, in src/data/characters.ts): one archetype
// plus tuning, cols x rows tiles unless a placement sizes it. art: a tile or piece of the area's
// tileset, a backdrop or a sprite, or placeholder-<name>. animations: the sprite tag each state
// plays; a state left out plays idle's, except open, which plays the tag named "open". Its hit
// box comes from art's manifest. lines and quips are keys into TEXT.lines and TEXT.quips; a prop
// has none.
export interface Character {
  readonly contactCue?: "red-hazard";
  readonly behaviour?: BehaviourPlan;
  // A shared tileset for this character's art, otherwise its area's tileset.
  readonly tileset?: string;
  readonly animations?: Readonly<Partial<Record<CharacterState, string>>>;
  readonly archetype: string;
  readonly art: string;
  readonly cols: number;
  readonly lines?: readonly string[];
  readonly quips?: readonly string[];
  readonly quirks?: readonly Quirk[];
  readonly rows: number;
  readonly tuning?: Tuning;
}
