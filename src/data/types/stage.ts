// Zones, areas, chunks, themes, recipes and rooms: plans in tiles and layouts in pixels.

import type { CrumblingDefinition, CrumblingProfile } from "@andornaut/game-kit/terrain/crumbling";

import type { SEAM_ROWS } from "../seams";
import type { SpriteContact } from "./art";
import type {
  BehaviourPlan,
  CharacterState,
  Collision,
  Interaction,
  Motion,
  Quirk,
  Reaction,
  Tuning,
} from "./behaviour";
import type { SkillId } from "./bird";
import type { Point, Rect, Size, TilePoint, TileRect } from "./geometry";

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
interface ElementSkin {
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

export interface Orbit<Host = string> {
  readonly angularSpeed: number;
  readonly host: Host;
  readonly phase: number;
  readonly radius: number;
}

export type ForcedTransitInterval = readonly [minimum: number, maximum: number];
type ForcedTransitBankPurpose = "forward" | "refuge" | "retreat";
type ForcedTransitCertification = "uncertified" | "ordinary";
export type TargetedAttackWindow = "allowed" | "deferred";

type ForcedTransitResult =
  { readonly kind: "egress"; readonly bankId: string } | { readonly kind: "forced" };

// Authored coordinates are tile offsets from the placed mover's nominal origin.
interface ForcedTransitTileBank {
  readonly col: number;
  readonly cols: number;
  readonly id: string;
  readonly purpose: ForcedTransitBankPurpose;
  readonly row: number;
}

export interface ForcedTransitTileOriginWindow {
  readonly col: ForcedTransitInterval;
  readonly row: ForcedTransitInterval;
}

interface ForcedTransitTileWindow {
  readonly certification: ForcedTransitCertification;
  readonly result: ForcedTransitResult;
  // Body-origin tile offsets from the actual physical support rectangle.
  readonly riderOnSupport: ForcedTransitTileOriginWindow;
  readonly supportOrigin: ForcedTransitTileOriginWindow;
}

export interface ForcedTransit {
  readonly banks: readonly ForcedTransitTileBank[];
  readonly boardingBanks: readonly string[];
  readonly group: string;
  readonly leg: string;
  readonly windows: readonly ForcedTransitTileWindow[];
}

// Resolved coordinates are absolute layout pixels, independent of the mover's current pose.
interface ForcedTransitLayoutBank {
  readonly id: string;
  readonly purpose: ForcedTransitBankPurpose;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface ForcedTransitLayoutOriginWindow {
  readonly x: ForcedTransitInterval;
  readonly y: ForcedTransitInterval;
}

export interface ForcedTransitLayoutWindow {
  readonly certification: ForcedTransitCertification;
  readonly result: ForcedTransitResult;
  // Body-origin pixel offsets from the actual physical support rectangle.
  readonly riderOnSupport: ForcedTransitLayoutOriginWindow;
  readonly supportOrigin: ForcedTransitLayoutOriginWindow;
}

export interface ForcedTransitLayout {
  readonly banks: readonly ForcedTransitLayoutBank[];
  readonly boardingBanks: readonly string[];
  readonly group: string;
  readonly leg: string;
  readonly windows: readonly ForcedTransitLayoutWindow[];
}

export interface Instance {
  readonly crumbling?: CrumblingProfile;
  readonly forcedTransit?: ForcedTransit;
  readonly id?: string;
  readonly orbit?: Orbit;
  readonly behaviour?: BehaviourPlan;
  readonly character: string;
  readonly col: number;
  readonly cols?: number;
  readonly excludes?: readonly string[];
  readonly lines?: readonly string[];
  readonly overrides?: Tuning;
  // Decorative backdrop scroll factors, from 0 (fixed) to 1 (world speed), on each axis.
  readonly parallax?: Point;
  // Clip repeating decorative art to this instance's own horizontal span.
  readonly backdropSpan?: boolean;
  // Extend the native bottom row of generated outdoor art to the viewport bottom.
  readonly backdropExtendBottom?: boolean;
  // An interior backdrop repeats only inside its fixed authored world rectangle.
  readonly backdropPlane?: "interior";
  // Area entry naming the stable ground reference for this decorative backdrop.
  readonly groundAnchor?: string;
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
  readonly crumbling?: CrumblingProfile;
  readonly look?: string;
}

// A spot she must never reach from another in one move (a jump, or a walk off an edge): each
// names a surface, given as an entry is.
interface NoCross {
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
  // Assembly-only source indices from ChunkPlan.scenery, before carried-choice filtering.
  readonly sceneryIndices?: readonly number[];
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
  readonly stageExit?: { readonly area: string; readonly rect: TileRect };
  readonly areaOrder?: readonly string[];
  readonly areas: Readonly<Record<string, AreaPlan>>;
  readonly start: AreaLink;
}

// A chunk's difficulty, 1 to 5, as gameplay/design.md's Chunks section grades it.
type Difficulty = 1 | 2 | 3 | 4 | 5;

// A row a chunk's entry or exit stands on: one of SEAM_ROWS (src/data/seams.ts).
type SeamRow = (typeof SEAM_ROWS)[number];

// The ground at a chunk's left or right edge: its top is row `row`.
export interface ChunkSeam {
  readonly row: SeamRow;
}

export type SlotKind = "door" | "event";

// A marked region of a chunk where the seed places an event or a door, in the chunk's tiles.
// id: unique within its chunk.
interface ChunkSlot {
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
  readonly rows?: number;
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
  // Appended after existing objects and filled doors so their indices and motion seeds stay fixed.
  readonly scenery?: readonly Instance[];
  readonly slots?: readonly ChunkSlot[];
  readonly solids: readonly TerrainRect[];
  readonly theme: string | readonly string[];
  readonly weight?: number;
}

// A repeated backdrop drawn across a whole assembled zone: its character, top at row.
export interface ThemeBackdrop {
  readonly character: string;
  // Area entry naming the stable ground reference; row remains an authored offset.
  readonly groundAnchor?: string;
  readonly parallax?: Point;
  readonly role?: string;
  readonly row: number;
  readonly skin?: ElementSkin;
}

export interface BackgroundSection {
  readonly cols: number;
  readonly backdrops: readonly ThemeBackdrop[];
}

// What every chunk of a theme is drawn with, so seams never show (THEMES by key, in
// src/data/chunks.ts). tileset: the art tileset. looks: each look a chunk's terrain names, as
// the tileset's look it is drawn with. backdrops: its repeated backdrops, back to front. door:
// the binding role whose selected door character each filled slot places at its own size,
// centred across the slot and standing on its floor.
export interface ThemePlan {
  readonly background?: {
    readonly weather: readonly ThemeBackdrop[];
    readonly sections: readonly string[];
  };
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
  readonly rows?: number;
  // Spawn inside the authored opening cap, independently of its horizontal seam.
  readonly spawnRow?: number;
  // Trigger coordinates are local to the authored final cap.
  readonly stageExit?: TileRect;
  // Omit to use every compatible middle chunk of the theme.
  readonly chunks?: ChunkPool;
  readonly encounters?: number;
  // Minimum intervening chunks with encounters === 0; zero adds no constraint.
  readonly minEncounterGap?: number;
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
interface ZoneSectionRecipe extends Pick<
  ZoneRecipe,
  | "difficulty"
  | "difficultyWeights"
  | "doors"
  | "events"
  | "length"
  | "rows"
  | "spawnCol"
  | "spawnRow"
  | "theme"
> {
  readonly chunks: ChunkPool;
  readonly id: string;
}
export interface OrderedZoneRecipe {
  readonly stageExit?: TileRect;
  // One quota across all sections, including the global caps.
  readonly encounters?: number;
  // Minimum intervening chunks with encounters === 0; zero adds no constraint.
  readonly minEncounterGap?: number;
  readonly finish: string;
  readonly sections: readonly ZoneSectionRecipe[];
  readonly start: string;
  readonly transitionRoles: { readonly left: string; readonly right: string };
}
export type StageRecipe = ZoneRecipe | OrderedZoneRecipe;

// A sprite in a room playing one tag, looping, its frame's top-left at `at`, in base pixels.
interface RoomAnimation {
  readonly art: string;
  readonly at: Point;
  readonly tag: string;
}

// A character standing in a room: its art playing its idle tag, its frame's top-left at `at`, in
// base pixels.
interface RoomCast {
  readonly at: Point;
  readonly character: string;
}

// PLACEHOLDER: what a room sells, by item key, until gameplay decides the currency and items.
interface RoomShop {
  readonly items: readonly string[];
}

// A room behind a door (ROOMS by key, in src/data/rooms.ts): a full-screen still scene that Use at
// its door shows, play paused, until she leaves. Its name is TEXT.rooms[key].name. art: its
// backdrop, the whole game view; without one, a plain placeholder. animations and cast: what is
// drawn over it. enter selects its entry dialogue; grant names its permanent skill.
export interface RoomPlan {
  readonly animations?: readonly RoomAnimation[];
  readonly art?: string;
  readonly cast?: readonly RoomCast[];
  // Entry dialogue key in DIALOGUES; skill grants are idempotent on every entry.
  readonly enter?: string;
  readonly grant?: SkillId;
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
  readonly crumbling?: CrumblingProfile;
  readonly forcedTransit?: ForcedTransitLayout;
  // Resolved from the original scenery collection, never from art, names or scroll factors.
  readonly scenerySource?: "chunk";
  readonly contactCue?: "red-hazard";
  readonly orbit?: Orbit<number>;
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
  // Clip repeating decorative art to this instance's own horizontal span.
  readonly backdropSpan?: boolean;
  // Extend the native bottom row of generated outdoor art to the viewport bottom.
  readonly backdropExtendBottom?: boolean;
  // An interior backdrop repeats only inside its fixed authored world rectangle.
  readonly backdropPlane?: "interior";
  // Area entry naming the stable ground reference for this decorative backdrop.
  readonly groundAnchor?: string;
  readonly phase: number;
  readonly quips: readonly string[];
  readonly quirks: readonly Quirk[];
  readonly reaction: Reaction;
  readonly room: string | undefined;
  readonly scene: string | undefined;
  readonly width: number;
}

export type CrumblingSupportId = Rect | ObjectLayout;

// An area in base pixels. Falling below its height restarts the zone, her collision box
// reaching past exitX, the left edge of its last column, clears it, and reaching back past backX,
// the right edge of its first column, ends it without clearing it. terrain and tileset are its
// plan's, in tiles, for drawing. chunks: an assembled area's chunks, left to right, for the
// camera; none in a hand-built one.
export interface AreaLayout {
  readonly crumbling?: readonly CrumblingDefinition<CrumblingSupportId>[];
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

export interface ZoneLayout {
  readonly stageExit?: { readonly area: string; readonly rect: Rect };
  readonly areaOrder?: readonly string[];
  readonly areas: Readonly<Record<string, AreaLayout>>;
  // Her drawn frame's size, from art: Use reaches a door her drawn frame covers any of.
  readonly birdFrame: Size;
  readonly start: AreaLink;
}
