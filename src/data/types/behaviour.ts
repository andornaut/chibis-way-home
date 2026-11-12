// How objects move, react and behave, and the characters and archetypes that carry them.

import type { Consideration, Hysteresis } from "@andornaut/game-kit/ai/utility";

import type { Direction, Point, Rect } from "./geometry.ts";
import type { DialogueLine } from "./text.ts";

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
// The resolver scales all four spatial values to pixels without changing time units. `speed` is
// the horizontal speed of searched and planned traversal (takeoffs, air, map legs and movement
// maps); the pursuit's own `speed` is its grounded walk without planned inputs.
interface BehaviourTraversal {
  readonly prepSeconds: number;
  // A pursuit takeoff preparation starts at most once per this many seconds; a takeoff sooner
  // launches without one.
  readonly prepIntervalSeconds?: number;
  readonly gravity: number;
  readonly jumpSpeed: number;
  readonly maxFallSpeed: number;
  readonly speed: number;
}

export type BehaviourMotion =
  // A wander wait moves by the plan's wander while unengaged after any rearm cooldown, and holds
  // still otherwise.
  | { readonly kind: "wait"; readonly support?: "required"; readonly wander?: true }
  | {
      readonly kind: "pursue";
      readonly mode: "fly";
      // Tiles: frame-bottom clearance above the target top, and lead along its captured travel side.
      readonly overhead?: { readonly ahead: number; readonly clearance: number };
      readonly speed: number;
    }
  | {
      readonly kind: "pursue";
      readonly mode: "ground";
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
        // Horizontal leash around the placed origin; omitted, the pursuit distance.
        readonly home?: number;
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
  // A scored attack of the plan's engaged state: `when` is its gate and the scorer, not order,
  // chooses it.
  readonly score?: BossScoredAttack;
  readonly to: string;
  // Conditions in one transition must all hold; the first matching unscored transition wins.
  readonly when: readonly BehaviourCondition[];
}

// What the boss scorer reads, from the perception snapshot and the boss's own state. Spatial
// inputs (and the curve ranges that read them) are tiles in data and pixels in a layout:
// distance (centre to centre), horizontalGap (opaque body to Chibi's box, ignoring Y), heightGap
// (absolute feet-to-feet height), heightDelta (Chibi's feet above the boss's feet, positive when
// he is higher). lineOfSight is 0 or 1. targetSpeed is Chibi's horizontal speed per second.
// threatSeconds and specialDueSeconds are engaged seconds outside attacks since the scorer last
// chose any attack and a special (from `due.openingSpecialSeconds`).
export type BossScorerInput =
  | "distance"
  | "heightDelta"
  | "heightGap"
  | "horizontalGap"
  | "lineOfSight"
  | "specialDueSeconds"
  | "targetSpeed"
  | "threatSeconds";

interface BossScoredAction {
  readonly base: number;
  readonly considerations: readonly Consideration<BossScorerInput>[];
}

// Special attacks count against the special cadence; the rest against the any-attack cadence.
export interface BossScoredAttack extends BossScoredAction {
  readonly special: boolean;
}

// Where an engaged move aims, as an offset from Chibi's box (tiles in data, pixels in a layout):
// chase aims at him, cut-off at his position after leadSeconds of his current velocity (at most
// maxLead), ahead `distance` along his travel direction, and standoff `distance` out on the
// boss's own side.
export type BossMove =
  | { readonly kind: "chase" }
  | { readonly kind: "cut-off"; readonly leadSeconds: number; readonly maxLead: number }
  | { readonly kind: "ahead"; readonly distance: number }
  | { readonly kind: "standoff"; readonly distance: number };

export interface BossScoredMove extends BossScoredAction {
  readonly id: string;
  readonly move: BossMove;
}

// The engaged state's utility scorer. Each decision scores the scored transitions whose gate
// holds and the moves; the best wins (game-kit ai/utility). Moves are decided at a seeded
// interval; a gated attack is scored as soon as its gate holds, against the held move.
// Pressure ramps attacks and every move but standoff up over threatSeconds:
// p = clamp((threatSeconds - graceSeconds) / rampSeconds, 0, 1), multiplier 1 + weight * p.
// Attacks also gain 1 + due.weight * clamp(due / cadence), where due is threatSeconds against
// anySeconds, or specialDueSeconds against specialSeconds for a special.
export interface BossScorer {
  readonly decisionSeconds: { readonly max: number; readonly min: number };
  readonly due: {
    readonly anySeconds: number;
    // specialDueSeconds when the scorer first runs.
    readonly openingSpecialSeconds: number;
    readonly specialSeconds: number;
    readonly weight: number;
  };
  // The state key the scorer runs in.
  readonly engaged: string;
  readonly hysteresis: Hysteresis;
  readonly moves: readonly BossScoredMove[];
  readonly pressure: {
    readonly graceSeconds: number;
    readonly rampSeconds: number;
    readonly weight: number;
  };
}

// How Chibi gets clear of a told attack, with ordinary skills; each has a script in
// src/testing/dodges.ts.
export type DodgeName = "jump-over" | "retreat" | "under";

// Fairness bounds on one boss's attacks, checked over its data and simulated traces; the runtime
// does not read them. Seconds are active seconds.
export interface BossFairness {
  // Each told attack's dodges, by attack id: from every tell start, at least one of them begun
  // reactionDelaySeconds later keeps Chibi alive through the attack and its recovery.
  readonly dodges: Readonly<Record<string, readonly DodgeName[]>>;
  // Engaged, ready to attack and with a movement-map path to Chibi: the longest time between
  // threats (a tell start, or the boss's body within threatRadius of him).
  readonly maxThreatGapSeconds: number;
  // Tell start to the earliest contact of the committed attack.
  readonly minReactionSeconds: number;
  readonly reactionDelaySeconds: number;
  // Stillness after a committed attack; an authored committed rest holds for its own seconds.
  readonly recoveryMaxSeconds: number;
  // Tiles between the boss's body and Chibi's box that count as a threat.
  readonly threatRadius: number;
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
      // offset places one visual from the actor's frame; span repeats it across the push volume
      // instead, each bottom on the volume's bottom, and ignores offset.
      readonly visual?: {
        readonly art: string;
        readonly animation: string;
        readonly offset: Point;
        readonly span?: true;
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

export type HazardPhase = "inactive" | "warning" | "active";

// Seconds in each state of a warned cycle: inactive, warning, active, then recovery (inactive)
// back to inactive.
export interface WarnedCycleSeconds {
  readonly active: number;
  readonly inactive: number;
  readonly recovery: number;
  readonly warning: number;
}

// A clocked support's presence: it collides while present or warning and not while absent.
export type SupportPhase = "present" | "warning" | "absent";

// Seconds in each state of a clocked support's cycle: out (present), warning, retracted (absent),
// then extending (absent) back to out.
export interface SupportCycleSeconds {
  readonly extending: number;
  readonly out: number;
  readonly retracted: number;
  readonly warning: number;
}

// A gust emitter's phase: calm, warning (the leaf stream starts), then gust, the one state that
// emits its force pulse.
export type GustPhase = "calm" | "warning" | "gust";

// Seconds in each state of a gust emitter's cycle: calm, warning, then gust back to calm.
export interface GustCycleSeconds {
  readonly calm: number;
  readonly gust: number;
  readonly warning: number;
}

export interface BehaviourNode {
  // Stationary gust emitters label every state.
  readonly gustPhase?: GustPhase;
  // Stationary timed hazards label every state; recovery uses inactive.
  readonly hazardPhase?: HazardPhase;
  // Stationary clocked one-way supports label every state.
  readonly supportPhase?: SupportPhase;
  // Tell starts one attack; committed includes its recovery; completed begins the actor cooldown.
  // A continuing tell re-tells inside its committed attack, before a further committed action.
  readonly attack?: {
    readonly continues?: true;
    readonly id: string;
    readonly phase: "tell" | "committed" | "completed";
  };
  // Only these uncommitted states may yield to a verified idle reposition.
  readonly allowIdleReposition?: boolean;
  // Override this state's axis and signed placed-origin extent.
  readonly track?: { readonly axis: "x" | "y"; readonly distance: number };
  readonly onEnter?: readonly BehaviourAction[];
  readonly animation: string | null;
  readonly enter?: "face-target";
  readonly motion: BehaviourMotion;
  readonly transitions: readonly BehaviourTransition[];
}

// Inclusive bounds of a seeded duration.
export interface SecondsRange {
  readonly max: number;
  readonly min: number;
}

// Chase relief for a scored pursuer. After a seeded span of engaged chase outside attacks, the
// boss holds a seeded pause facing Chibi, never within tellClearanceSeconds of a tell, and its
// pressure restarts. Each engagement draws a give-up time in giveUp.seconds; the first pause at or
// after it gives up, as does a pause still running when it passes.
export interface ChaseRelief {
  readonly giveUp: { readonly seconds: SecondsRange };
  readonly pause: {
    readonly afterSeconds: SecondsRange;
    readonly seconds: SecondsRange;
    readonly tellClearanceSeconds: number;
  };
}

// A boss's wander while unengaged, outside any rearm cooldown, in a wander wait state. A move
// starts every seeded everySeconds and is followed by a hold of at least a seeded holdSeconds,
// facing the move's direction. A ground boss walks a seeded distance at speed along supported
// floor within range of its placed origin; a flyer enters its hop state, a supported flight that
// returns to the wander state on landing. Distances and speeds are tiles in data, pixels in a
// layout.
export interface BossWander {
  readonly everySeconds: SecondsRange;
  readonly holdSeconds: SecondsRange;
  readonly range: number;
  readonly walk?: {
    readonly distance: { readonly max: number; readonly min: number };
    readonly speed: number;
  };
  readonly hop?: string;
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
  // Scored decisions in the engaged state.
  readonly scorer?: BossScorer;
  readonly pursuit?: {
    readonly distance: number;
    // Seconds without a movement path before the boss gives up; null disables it. Unknown
    // planner results never establish unreachability.
    readonly unreachableGraceSeconds: number | null;
    // Current physical body-centre separation in both axes: tiles in data, pixels in layouts.
    readonly escapeDistance?: number;
    readonly escaped: DialogueLine;
    // A mapped ground pursuer with no movement-map path to Chibi walks to the reachable spot
    // nearest him and paces there. distance is the whole pace span and speed its walk: tiles in
    // data, pixels in layouts. The pace starts, and every turn holds, for a seeded pause facing
    // Chibi.
    readonly pace?: {
      readonly distance: number;
      readonly pauseSeconds: SecondsRange;
      readonly speed: number;
    };
    // Seconds after any ended chase before awareness can engage again.
    readonly rearmSeconds?: number;
    // Until the rearm cooldown ends, the boss never moves toward Chibi within its escape distance.
    readonly keepClear?: boolean;
    readonly relief?: ChaseRelief;
    // Chibi's screen: width wide about his centre at decision time, inset by margin, in tiles in
    // data and pixels in layouts. A chosen wander, hop, relocation or home-walk destination keeps
    // the body inside it; a body already outside never moves farther out, except an unengaged
    // wander, which keeps only its range.
    readonly screen?: { readonly margin: number; readonly width: number };
  };
  readonly spotted?: DialogueLine;
  readonly wander?: BossWander;
  readonly axis: "x" | "y";
  readonly distance: number;
  // Initial facing; omitted, a negative distance faces left and any other faces right.
  readonly facing?: -1 | 1;
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
// A timed hazard's tiles for one phase, by name in its tileset: the leftmost, inner and rightmost
// cells of each row.
export interface PhaseTiles {
  readonly left: string;
  readonly middle: string;
  readonly right: string;
}

export interface Character {
  readonly contactCue?: "red-hazard";
  // Each placement is wider than a running jump's reach (REACH.gap), so it cannot be jumped.
  readonly noJumpOver?: true;
  // A follower's animation tag for each behaviour state of its instance's phaseSource.
  readonly phaseAnimations?: Readonly<Record<string, string>>;
  // A timed hazard's tiles per phase; drawn procedurally until its tileset has every one.
  readonly phaseTiles?: Readonly<Record<HazardPhase, PhaseTiles>>;
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
