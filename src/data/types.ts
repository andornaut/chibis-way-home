// The shapes of the game data. The value files beside this one fill them.

import type { SEAM_ROWS } from "./chunks";

// An axis-aligned rectangle in base pixels: x and y are its top-left corner, y grows downward.
export interface Rect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type DeathReason = "crush" | "fall" | "hazard";

// A frozen contact snapshot. Position is the bird body's top-left; support is the nearest
// frozen solid or ledge below the body, or undefined over a void.
export type DeathContact =
  | { readonly contactCue?: "red-hazard"; readonly index: number; readonly kind: "object" }
  | {
      readonly contactCue?: "red-hazard";
      readonly emitter: number;
      readonly id: number;
      readonly kind: "transient";
    };

export interface ZoneDeath {
  readonly contact?: DeathContact;
  readonly position: Point;
  readonly reason: DeathReason;
  readonly support: Rect | undefined;
  readonly velocity: Point;
}

// Death presentation values use pixels and seconds. Recoil x is relative to facing.
export interface DeathTuning {
  readonly bounceSpeed: number;
  readonly fallGravity: number;
  readonly impactSeconds: number;
  readonly maxFallSpeed: number;
  readonly recoilSeconds: number;
  readonly recoilVelocity: Point;
  readonly voidFallDistance: number;
}

export interface DeathText {
  readonly progress: string;
  readonly retry: string;
  readonly stage: string;
  readonly time: string;
  readonly title: string;
}

export interface StatsText {
  readonly attempts: string;
  readonly best: string;
  readonly lastAttempt: string;
  readonly notCleared: string;
  readonly partial: string;
  readonly runTotal: string;
}

export interface Size {
  readonly height: number;
  readonly width: number;
}

// The bird's movement, in base pixels and seconds.
export interface BirdTuning {
  // Speed gained per second while a direction is held, on the ground and in the air.
  readonly airAccel: number;
  readonly groundAccel: number;
  // Seconds after walking off a ledge in which a jump still starts.
  readonly coyoteTime: number;
  // Fastest fall: every fall flutters.
  readonly flutterFallSpeed: number;
  readonly gravity: number;
  // Her collision box.
  readonly height: number;
  readonly width: number;
  // Seconds before landing in which a jump press is kept, to start as she lands.
  readonly jumpBuffer: number;
  // Height of the low hop, including releases during the tap window.
  readonly jumpHopHeight: number;
  // Seconds to the full-jump apex under constant ascent gravity.
  readonly jumpRiseTime: number;
  // Seconds after the tap window over which releasing retains more upward speed.
  readonly jumpReleaseBlendTime: number;
  // Defines the existing full-jump height: speed squared divided by twice gravity.
  readonly jumpSpeed: number;
  // Seconds of forgiving low-hop input before releasing retains extra upward speed.
  readonly jumpTapWindow: number;
  readonly walkSpeed: number;
}

// How the camera follows her. groundSpot is the fraction of screen height from the top at
// which her feet rest on the ground. seamEase is the fraction of screen width over which the
// ground line blends between chunks, centred on the seam.
export interface ContactCueTuning {
  readonly borderWidth: number;
  readonly durationMs: number;
  readonly keylineWidth: number;
  readonly tintAlpha: number;
}

export interface WorldShakeTuning {
  readonly distance: number;
  readonly durationMs: number;
  readonly firstOffMs: number;
  readonly secondOnMs: number;
  readonly secondOffMs: number;
}

export interface CameraTuning {
  // CLEANUP (added 2026-11-01): require this field when the paired contact-shake values land.
  readonly contactShake?: WorldShakeTuning;
  readonly groundSpot: number;
  readonly seamEase: number;
}

// The words the player reads.
export interface GameText {
  readonly stats: StatsText;
  readonly update: {
    readonly accept: string;
    readonly title: string;
  };
  readonly death: DeathText;
  // Dialogue controls and speaker names; paragraph text lives in lines.
  readonly dialogue: {
    readonly continue: string;
    readonly skip: string;
    readonly speakers: Readonly<Record<string, string>>;
  };
  readonly homePage: {
    readonly description: string;
    readonly keyboard: string;
    readonly play: string;
    readonly subline: string;
    readonly touch: string;
  };
  // What characters say in dialogue, by key.
  readonly lines: Readonly<Record<string, string>>;
  // Map destination and stage names, indexed separately by catalogue and stage-node id.
  readonly map: {
    readonly continue: string;
    readonly stageNumber: string;
    readonly stages: Readonly<Record<string, string>>;
    readonly title: string;
    readonly zones: Readonly<Record<string, string>>;
  };
  // The touch buttons' names, which the home page's controls text uses.
  readonly buttons: {
    readonly jump: string;
    readonly use: string;
  };
  // What characters say in passing, by key.
  readonly quips: Readonly<Record<string, string>>;
  // A room's Leave button, which returns her to its door.
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
  // The pause card: its title, the Settings and Back to title rows, and Resume.
  readonly pause: {
    readonly home: string;
    readonly resume: string;
    readonly settings: string;
    readonly title: string;
  };
  // The start screen: Start without saved progress, or Continue and Restart with it, and the nav
  // bar's Settings and Exit buttons.
  readonly start: {
    readonly continue: string;
    readonly exit: string;
    readonly restart: string;
    readonly settings: string;
    readonly start: string;
  };
  // The settings card: its title, the Move controls and Action buttons rows, the Install row and
  // its button, and the install steps card: its title and, for each browser that installs only
  // from its own menu, its two steps.
  readonly settings: {
    readonly actionButtons: string;
    readonly install: string;
    readonly installButton: string;
    readonly installSteps: {
      readonly firefoxAndroid: InstallSteps;
      readonly ios: InstallSteps;
      readonly title: string;
    };
    readonly moveControls: string;
    readonly title: string;
  };
}

// A browser's install steps: the first beside its button's glyph, the second beside the install
// glyph.
export interface InstallSteps {
  readonly first: string;
  readonly second: string;
}

// The touch controls, in base pixels.
export interface TouchTuning {
  // A move touch moves her once it is more than this far left or right of where it started.
  readonly moveDeadZone: number;
  // A press that travels further than this is a drag, not a tap: a tap outside a card closes it.
  readonly tapMaxDistance: number;
}

// A rectangle on the tile grid, in whole tiles: col and row are its top-left tile.
export interface TileRect {
  readonly col: number;
  readonly cols: number;
  readonly row: number;
  readonly rows: number;
}

export interface TilePoint {
  readonly col: number;
  readonly row: number;
}

export type Collision = "hazard" | "ledge" | "none" | "solid" | "use";
export type Direction = "down" | "left" | "right" | "up";
export type MotionAlgorithm = "ease" | "hop" | "linear" | "static" | "wander";
export type ReactionKind = "approach" | "avoid" | "none";

// How an object moves from where it is placed, in tiles and seconds (pixels in a layout). Its far
// end is distance away in direction. linear: there at speed, pause, back, pause. ease: the same
// legs, easing in and out (speed is the leg's average). hop: linear, plus an upward arc
// hopHeight high on each leg. wander: each leg goes to a random point between the placed spot
// and the far end. variance (0 to 1): each leg's speed, distance and pause vary by up to that
// fraction.
export interface Motion {
  readonly algorithm: MotionAlgorithm;
  readonly direction: Direction;
  readonly distance: number;
  readonly hopHeight: number;
  readonly pause: number;
  readonly speed: number;
  readonly variance: number;
}

// Within range of her (centre to centre), an "avoid" object moves away from her and an
// "approach" one toward her, along its motion's axis, at speed. Out of range, it goes back to its
// path at that speed and follows it again. In tiles (pixels in a layout).
export interface Reaction {
  readonly kind: ReactionKind;
  readonly range: number;
  readonly speed: number;
}

export type BehaviourCondition =
  | { readonly kind: "visible" }
  | { readonly kind: "boundary" }
  | { readonly kind: "arrived"; readonly tolerance: number }
  | { readonly kind: "elapsed"; readonly seconds: number }
  | { readonly kind: "nearby"; readonly range: number }
  | { readonly kind: "same-ground"; readonly tolerance: number }
  | { readonly kind: "reachable" | "lost-target"; readonly tolerance: number };

export type BehaviourMotion =
  | { readonly kind: "wait" }
  | { readonly kind: "fly"; readonly to: Point; readonly speed: number }
  // Target flight captures contact-centred aim on entry; bounds limit relative top-left positions.
  | { readonly kind: "fly"; readonly to: "target"; readonly bounds: Rect; readonly speed: number }
  | {
      readonly direction: -1 | 1 | "facing" | "target";
      readonly kind: "move";
      readonly speed: number;
    }
  | {
      readonly direction: -1 | 1 | "facing" | "target";
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

export interface BehaviourNode {
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
  readonly spotted?: DialogueLine;
  readonly axis: "x" | "y";
  readonly distance: number;
  readonly inactiveAnimation?: string;
  readonly initial: string;
  readonly states: Readonly<Record<string, BehaviourNode>>;
}

export type InteractionKind = "none" | "quip" | "talk";

// How a character interacts with her, within range tiles of her (centre to centre). quip: says
// one of its quips when she comes within range; talk: Use within range opens its dialogue.
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
// default motion, reaction and interaction its characters tune. collision: solid blocks her from
// every side; ledge only from above; touching a hazard restarts the zone; Use in a use zone, a
// door, opens its room; none is scenery.
export interface Archetype {
  readonly collision: Collision;
  readonly interaction: Interaction;
  readonly motion: Motion;
  readonly reaction: Reaction;
}

// The states an animation tag can play for. open: a door as she uses it, before its room shows.
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

// One paragraph in a linear conversation: speaker names a SPEAKERS entry, line a TEXT.lines key.
export interface DialogueLine {
  readonly line: string;
  readonly speaker: string;
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
  readonly foreshadow: string;
  readonly intro: string;
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

export interface AreaLink {
  readonly area: string;
  readonly entry: string;
}

// One placed thing in an area: a character with its top-left tile at col, row, and cols x rows
// tiles in size when given, else the character's. Overrides go one way: an instance's overrides
// over its character's tuning over its archetype. phase (0 to 1, default 0) is where its motion
// starts in its round trip: 0 at the placed spot heading out, 0.5 at the far end heading back.
// lines replace the character's for this one instance; scene names a dialogue scene. requires
// and excludes are carried-choice flags: it is placed only while every required flag is set and
// no excluded one is. room: a door's room, a key of ROOMS (src/data/rooms.ts). A door is an
// instance whose archetype is "door" (its collision "use"); every door has a room, and nothing
// else has one.
export interface ElementSkin {
  readonly art: string;
  readonly tileset: string | null;
}

export interface ElementBinding {
  readonly behaviour?: BehaviourPlan;
  readonly character: string;
  readonly lines?: readonly string[];
  readonly overrides?: Tuning;
  readonly parallax?: Point;
  readonly phase?: number;
  readonly scene?: string | null;
  readonly skin?: ElementSkin;
}

export interface Instance {
  readonly behaviour?: BehaviourPlan;
  readonly character: string;
  readonly col: number;
  readonly cols?: number;
  readonly excludes?: readonly string[];
  readonly lines?: readonly string[];
  readonly overrides?: Tuning;
  // Decorative backdrop scroll factors, from 0 (fixed) to 1 (world speed), on each axis.
  readonly parallax?: Point;
  readonly phase?: number;
  readonly requires?: readonly string[];
  readonly room?: string;
  readonly role?: string;
  readonly row: number;
  readonly rows?: number;
  readonly scene?: string;
  readonly skin?: ElementSkin;
}

// A run of terrain. In an area with a tileset, look names the family of the tileset's tiles it is
// drawn with: "sidewalk" or "floor" (a top row, alternating with a joint every other column, over
// a face), "road" (a top over road, with a kerb on the terrain beside it) or "post" (2 wide: a
// cap, a shaft and a base). Without a tileset it is a flat rectangle and has no look.
export interface TerrainRect extends TileRect {
  readonly look?: string;
}

// A spot she must never reach from another in one move (a jump, or a walk off an edge): each
// names a surface, given as an entry is.
export interface NoCross {
  readonly from: TilePoint;
  readonly to: TilePoint;
}

// One area of a zone: cols x rows tiles (rows is 60, two screens). solids are the terrain.
// entries are named points where she arrives: she stands on the top edge of row `row`, her
// collision box centred on the grid line at the left edge of column `col`. tileset: the art
// tileset its terrain and tile objects are drawn from; without one, both are flat rectangles.
// noCross and outOfReach name surfaces by a spot on each, given as an entry is: noCross pairs a
// spot with one she must never reach from it in one move, and outOfReach marks surfaces she must
// never reach from the start. An assembled zone's area also lists the chunks it is made of, left
// to right, and its slots with what the seed put in each; a hand-built area has neither.
export interface AreaPlan {
  readonly walkLinks?: { readonly left?: AreaLink; readonly right?: AreaLink };
  readonly chunks?: readonly PlacedChunk[];
  readonly cols: number;
  readonly entries: Readonly<Record<string, TilePoint>>;
  readonly noCross?: readonly NoCross[];
  readonly objects: readonly Instance[];
  readonly outOfReach?: readonly TilePoint[];
  readonly rows: number;
  readonly slots?: readonly FilledSlot[];
  readonly solids: readonly TerrainRect[];
  readonly tileset?: string;
}

// A zone: its areas by name, and where she starts, its only checkpoint: a fall or a hazard
// puts her back there.
export interface ZonePlan {
  readonly areaOrder?: readonly string[];
  readonly areas: Readonly<Record<string, AreaPlan>>;
  readonly start: AreaLink;
}

// A chunk's difficulty, 1 to 5, as gameplay/design.md's Chunks section grades it.
export type Difficulty = 1 | 2 | 3 | 4 | 5;

// A row a chunk's entry or exit stands on: one of SEAM_ROWS (src/data/chunks.ts).
export type SeamRow = (typeof SEAM_ROWS)[number];

// The ground at a chunk's left or right edge: its top is row `row`.
export interface ChunkSeam {
  readonly row: SeamRow;
}

export type SlotKind = "door" | "event";

// A marked region of a chunk where the seed places an event or a door, in the chunk's tiles.
// id: unique within its chunk.
export interface ChunkSlot {
  readonly area: TileRect;
  readonly id: string;
  readonly kind: SlotKind;
}

// The limits every chunk keeps (CHUNK_RULES, in src/data/chunks.ts). cols: its width range.
// The seam rule: at its entry and exit, the seam surface runs at least footing tiles in from the
// edge, with no gap, hazard or mover's path within them, and headroom rows clear of any solid,
// ledge or hazard above them.
export interface ChunkRules {
  readonly cols: { readonly max: number; readonly min: number };
  readonly footing: number;
  readonly headroom: number;
}

// A hand-built piece of a zone (CHUNKS by id, in src/data/chunks.ts): cols wide and as tall as
// a zone, its contents in its own tiles from its top-left. theme: the theme or themes it is drawn
// in; each look its terrain names is a key of every such theme's looks. difficulty: 1 to 5.
// weight (default 1): how likely the seed is to pick it over another that fits. maxPerZone: the
// most times it appears in one zone, unlimited when left out. entry and exit: the ground at its
// left and right edges, where it joins the chunks either side. backdrops: its own placed
// scenery, drawn in front of the theme's repeated backdrops. slots: where the seed may place
// events and doors; it must play with every slot empty.
export interface ChunkPlan {
  readonly encounters: number;
  readonly backdrops?: readonly Instance[];
  readonly cols: number;
  readonly difficulty: Difficulty;
  readonly entry: ChunkSeam;
  readonly exit: ChunkSeam;
  readonly maxPerZone?: number;
  readonly noCross?: readonly NoCross[];
  readonly objects: readonly Instance[];
  readonly outOfReach?: readonly TilePoint[];
  readonly slots?: readonly ChunkSlot[];
  readonly solids: readonly TerrainRect[];
  readonly theme: string | readonly string[];
  readonly weight?: number;
}

// A repeated backdrop drawn across a whole assembled zone: its character, top at row.
export interface ThemeBackdrop {
  readonly character: string;
  readonly parallax?: Point;
  readonly role?: string;
  readonly row: number;
  readonly skin?: ElementSkin;
}

// What every chunk of a theme is drawn with, so seams never show (THEMES by key, in
// src/data/chunks.ts). tileset: the art tileset. looks: each look a chunk's terrain names, as
// the tileset's look it is drawn with. backdrops: its repeated backdrops, back to front. door:
// the binding role whose selected door character each filled slot places at its own size,
// centred across the slot and standing on its floor.
export interface ThemePlan {
  readonly backdrops: readonly ThemeBackdrop[];
  readonly bindings: Readonly<Record<string, ElementBinding>>;
  readonly door: string;
  readonly looks: Readonly<Record<string, string>>;
  readonly tileset: string;
}

export type ChunkPool = readonly string[];

// How a zone is assembled from chunks (RECIPES by key, in src/data/zones.ts): its theme, its
// fixed start and finish chunks, and between them a seeded run of the theme's chunks. length:
// the zone's whole width range in columns, start and finish chunks included. difficulty: the
// inclusive band for every middle chunk, independent of position. Safe start and finish chunks
// are exempt. spawnCol: her centre column within the opening chunk. events and doors: what the
// seed places in the chunks' slots, count of each.
export interface ZoneRecipe {
  // Omit to use every compatible middle chunk of the theme.
  readonly chunks?: ChunkPool;
  readonly encounters?: number;
  readonly difficulty: { readonly max: Difficulty; readonly min: Difficulty };
  readonly difficultyWeights?: Readonly<Partial<Record<Difficulty, number>>>;
  readonly doors: readonly { readonly count: number; readonly room: string }[];
  readonly events: readonly { readonly count: number; readonly id: string }[];
  readonly finish: string;
  readonly length: { readonly max: number; readonly min: number };
  readonly spawnCol: number;
  readonly start: string;
  readonly theme: string;
}

// Section lengths include their applicable global caps and one or more generated pool chunks.
export interface ZoneSectionRecipe extends Pick<
  ZoneRecipe,
  "difficulty" | "difficultyWeights" | "doors" | "events" | "length" | "spawnCol" | "theme"
> {
  readonly chunks: ChunkPool;
  readonly id: string;
}
export interface OrderedZoneRecipe {
  // One quota across all sections, including the global caps.
  readonly encounters?: number;
  readonly finish: string;
  readonly sections: readonly ZoneSectionRecipe[];
  readonly start: string;
  readonly transitionRoles: { readonly left: string; readonly right: string };
}
export type StageRecipe = ZoneRecipe | OrderedZoneRecipe;

// A sprite in a room playing one tag, looping, its frame's top-left at `at`, in base pixels.
export interface RoomAnimation {
  readonly art: string;
  readonly at: Point;
  readonly tag: string;
}

// A character standing in a room: its art playing its idle tag, its frame's top-left at `at`, in
// base pixels.
export interface RoomCast {
  readonly at: Point;
  readonly character: string;
}

// PLACEHOLDER: what a room sells, by item key, until gameplay decides the currency and items.
export interface RoomShop {
  readonly items: readonly string[];
}

// A room behind a door (ROOMS by key, in src/data/rooms.ts): a full-screen still scene that Use at
// its door shows, play paused, until she leaves. Its name is TEXT.rooms[key].name. art: its
// backdrop, the whole game view; without one, a plain placeholder. animations and cast: what is
// drawn over it. enter (a dialogue scene that plays as she enters) and shop are not built yet.
export interface RoomPlan {
  readonly animations?: readonly RoomAnimation[];
  readonly art?: string;
  readonly cast?: readonly RoomCast[];
  readonly enter?: string;
  readonly shop?: RoomShop;
}

// A chunk in an assembled zone: its id, and the zone columns it takes.
export interface PlacedChunk {
  readonly chunk: string;
  readonly col: number;
  readonly cols: number;
}

// A slot in an assembled zone, in zone tiles: the chunk it is in (an index into the area's
// chunks), its id there, and what the seed put in it, the event's id or the door's room; empty
// when the recipe asked for fewer.
export interface FilledSlot extends ChunkSlot {
  readonly chunk: number;
  readonly fill?: string;
}

// How far the bird can jump, in tiles, from the top of the ground she leaves to the top of the
// ledge she lands on. hop: the height of a short hop; jump: the height of a full jump; gap: the
// width of a gap, at the same height, that a running full jump crosses.
export interface Reaches {
  readonly gap: number;
  readonly hop: number;
  readonly jump: number;
}

// A placed thing in base pixels, its instance, character and archetype resolved into one flat
// object: its placed top-left corner, size, motion, reaction and interaction in pixels, and what
// the view and dialogue need. hitbox: where a hazard touches her, from its top-left corner, when
// its art declares one; else its whole rectangle.
export interface ObjectLayout {
  readonly contactCue?: "red-hazard";
  readonly contact?: SpriteContact;
  readonly spawnTemplates?: Readonly<Record<string, ObjectLayout>>;
  readonly behaviour?: BehaviourPlan;
  // The visual tileset, otherwise the area's tileset; null explicitly selects sprite/image art.
  readonly tileset?: string | null;
  readonly animations: Readonly<Record<CharacterState, string | undefined>>;
  readonly art: string;
  readonly character: string;
  readonly collision: Collision;
  readonly height: number;
  readonly hitbox: Rect | undefined;
  readonly interaction: Interaction;
  readonly lines: readonly string[];
  readonly motion: Motion;
  readonly origin: Point;
  readonly parallax?: Point;
  readonly phase: number;
  readonly quips: readonly string[];
  readonly quirks: readonly Quirk[];
  readonly reaction: Reaction;
  readonly room: string | undefined;
  readonly scene: string | undefined;
  readonly width: number;
}

// An area in base pixels. Falling below its height restarts the zone, her collision box
// reaching past exitX, the left edge of its last column, clears it, and reaching back past backX,
// the right edge of its first column, ends it without clearing it. terrain and tileset are its
// plan's, in tiles, for drawing. chunks: an assembled area's chunks, left to right, for the
// camera; none in a hand-built one.
export interface AreaLayout {
  readonly walkLinks?: { readonly left?: AreaLink; readonly right?: AreaLink };
  readonly backX: number;
  readonly chunks: readonly { readonly width: number; readonly x: number }[];
  readonly entries: Readonly<Record<string, Point>>;
  readonly exitX: number;
  readonly height: number;
  readonly objects: readonly ObjectLayout[];
  readonly solids: readonly Rect[];
  readonly terrain: readonly TerrainRect[];
  readonly tileset: string | undefined;
  readonly width: number;
}

// A sprite's hit box in its frame, with the frame's size: the game draws the frame centred on
// its object's rectangle along x and standing on its bottom edge.
export type PixelRun = readonly [y: number, left: number, right: number];

export interface SpriteSilhouette {
  readonly width: number;
  readonly height: number;
  readonly frames: Readonly<Record<string, readonly PixelRun[]>>;
}

export interface SpriteSilhouettes {
  readonly version: 1;
  readonly sprites: Readonly<Record<string, SpriteSilhouette>>;
}

export interface SpriteContact {
  readonly frame: Size;
  readonly frames: Readonly<Record<string, readonly PixelRun[]>>;
  readonly tags: Readonly<
    Record<
      string,
      {
        readonly frames: readonly { readonly frame: string; readonly seconds: number }[];
        readonly once: boolean;
      }
    >
  >;
}

export interface ArtHitbox {
  readonly contact?: SpriteContact;
  readonly frame: Size;
  readonly hitbox: Rect;
}

export interface ZoneLayout {
  readonly areaOrder?: readonly string[];
  readonly areas: Readonly<Record<string, AreaLayout>>;
  // Her drawn frame's size, from art: Use reaches a door her drawn frame covers any of.
  readonly birdFrame: Size;
  readonly start: AreaLink;
}

// A point on the map: a zone she plays, or a fork where paths split or join. at: where it is
// drawn on the map screen, on its tile grid. zone: a zone node's key in ZONES or RECIPES; a zone
// not built yet has none.
export interface MapNode {
  readonly at: TilePoint;
  readonly id: string;
  readonly kind: "fork" | "zone";
  readonly zone?: string;
}

// A path from one node to the next, in the direction she travels, never back. A path not built
// yet is drawn dotted and cannot be chosen.
export interface MapEdge {
  readonly built: boolean;
  readonly from: string;
  readonly to: string;
}

// A pen mark on the map's paper: its art key and its top-left, in base pixels, at least a tile
// clear of every node, path and label.
export interface MapDecoration {
  readonly art: string;
  readonly at: Point;
}

// A themed map destination groups a nonempty ordered sequence of stage-node ids.
// Its marker centre is on the map grid; icon is an art key with normal and visited tags.
export interface MapDestination {
  readonly at: TilePoint;
  readonly icon: string;
  readonly id: string;
  readonly stages: readonly [string, ...string[]];
}

// The map of zones: every path starts at start and ends at finish. decorations: the pen marks on
// its paper.
export interface ZoneMap {
  readonly decorations: readonly MapDecoration[];
  readonly destinations: readonly MapDestination[];
  readonly edges: readonly MapEdge[];
  readonly finish: string;
  readonly nodes: readonly MapNode[];
  readonly start: string;
}
