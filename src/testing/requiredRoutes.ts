import { BIRD } from "../data/bird";
import { CHUNKS, EXTERIOR_DEPTH_ALIASES, WOODLAND_DEPTH_ALIASES } from "../data/chunks";
import { ROOMS } from "../data/rooms";
import { TILE } from "../data/screen";
import type { ChunkPlan, ModuleRouteProfile } from "../data/types";
import { type ChunkLibrary, themesOf } from "../rules/assemble";
import { bindElement } from "../rules/elementBinding";
import { objectLayout } from "../rules/tiles";
import { hasDynamicMotion } from "../sim/behaviourBounds";
import type { WalkRouteTarget } from "../sim/zoneWalk";
import { CATALOGUE, HITBOXES, TILESETS } from "./art";
import { ALL_CHUNKS, FIXTURE_RECIPE } from "./chunks";

const ROOM_FILL = "test";
if (!(ROOM_FILL in ROOMS)) {
  throw new Error(`Missing filled-slot room ${ROOM_FILL}`);
}
const EVENT_FILL = FIXTURE_RECIPE.events[0]!.id;

type SlotFills = { readonly door: readonly string[]; readonly event: readonly string[] };

// Every slot of the chunk filled: doors with the test room, events with the fixture event.
export function slotFills(chunk: ChunkPlan): SlotFills {
  return {
    door: (chunk.slots ?? []).filter(({ kind }) => kind === "door").map(() => ROOM_FILL),
    event: (chunk.slots ?? []).filter(({ kind }) => kind === "event").map(() => EVENT_FILL),
  };
}

export const FILLED_CHUNK_SLOTS: Readonly<Record<string, SlotFills>> = Object.fromEntries(
  ALL_CHUNKS.filter(([, , chunk]) => (chunk.slots?.length ?? 0) > 0).map(([name, , chunk]) => [
    name,
    slotFills(chunk),
  ]),
);

type Target = Omit<WalkRouteTarget, "area">;
const bodyCols = BIRD.width / TILE;
const point = (col: number, row: number): Target => ({ at: { col, row } });
const contracts = new Map<string, readonly Target[]>();

function platforms(library: ChunkLibrary, chunk: ChunkPlan): Target[] {
  const theme = library.themes[themesOf(chunk)[0]!]!;
  return chunk.objects
    .filter(({ role }) => role === "ledge" || role === "lift" || role === "shuttle")
    .map((instance) => {
      const bound = bindElement(theme.bindings, instance);
      const cols = bound.cols ?? library.characters[bound.character]!.cols;
      return point(bound.col + cols / 2, bound.row);
    });
}
function recovery(library: ChunkLibrary, chunk: ChunkPlan): Target[] {
  return [...platforms(library, chunk), point(chunk.cols - 2, chunk.exit.row)];
}
function encounter(library: ChunkLibrary, chunk: ChunkPlan): Target[] {
  const result = recovery(library, chunk);
  const floor = Math.max(chunk.entry.row, chunk.exit.row);
  const theme = library.themes[themesOf(chunk)[0]!]!;
  const hazards = chunk.objects
    .filter(({ role }) => role === "edge-top")
    .flatMap((instance) => {
      const bound = bindElement(theme.bindings, instance);
      if (bound.orbit) {
        return [];
      }
      const character = CATALOGUE.characters[bound.character]!;
      const tileset = TILESETS[character.tileset ?? theme.tileset];
      const object = objectLayout(TILE, CATALOGUE, HITBOXES, tileset, TILESETS, bound);
      if (object.collision !== "hazard" || hasDynamicMotion(object)) {
        return [];
      }
      const rect = object.hitbox ?? { height: object.height, width: object.width, x: 0, y: 0 };
      return [{ ...rect, x: object.origin.x + rect.x, y: object.origin.y + rect.y }];
    });
  for (const solid of chunk.solids.filter(({ row }) => row <= floor - 6)) {
    const top = solid.row * TILE;
    // A physical red valley base is lethal terrain, not a required standing refuge.
    const lethal = hazards.some(
      (rect) =>
        rect.x <= solid.col * TILE &&
        rect.x + rect.width >= (solid.col + solid.cols) * TILE &&
        rect.y < top &&
        rect.y + rect.height > top - BIRD.height,
    );
    if (!lethal) {
      result.push(point(solid.col + solid.cols / 2, solid.row));
    }
  }
  for (const cover of chunk.objects.filter(({ role, rows }) => role === "support" && rows === 1)) {
    const cols = cover.cols ?? library.characters[cover.character]!.cols;
    const ground = chunk.solids
      .filter(
        (solid) =>
          solid.col <= cover.col &&
          solid.col + solid.cols >= cover.col + cols &&
          solid.row - cover.row - cover.rows! >= BIRD.height / TILE,
      )
      .sort((a, b) => a.row - b.row)[0];
    if (!ground || cols < bodyCols) {
      throw new Error("Cover requires a grounded body-sized refuge");
    }
    result.push({
      at: { col: cover.col + cols / 2, row: ground.row },
      xRange: { max: cover.col + cols - bodyCols, min: cover.col },
    });
  }
  return result;
}
function register(
  build: (library: ChunkLibrary, chunk: ChunkPlan) => readonly Target[],
  names: readonly string[],
): void {
  for (const name of names) {
    if (contracts.has(name) || !CHUNKS[name]) {
      throw new Error(`Invalid route classification ${name}`);
    }
    const tuple = ALL_CHUNKS.find(([display]) => display === name)!;
    contracts.set(name, build(tuple[1], tuple[2]));
  }
}

// These ordinary families promise the primary route, checked by actual right-edge completion.
register(
  () => [],
  [
    "overjump-low-roof",
    "vertical-red-gate",
    "city-boundary-edge-yard",
    "city-boundary-gaps",
    "city-boundary-jumps",
    "city-boundary-low-ceiling",
    "city-boundary-return-gap",
    "city-boundary-return-high",
    "city-boundary-return-terrace",
    "city-boundary-upper-climb",
    "compound-ascent",
    "park-bandstand",
    "park-finish",
    "park-high-walk",
    "park-lawn",
    "park-low-ceiling",
    "park-slope-down",
    "park-start",
    "park-steps-down",
    "park-terrace-down",
    "park-terrace-up",
    "park-upper-terrace",
  ],
);
register(recovery, [
  "horizontal-platform-orbit",
  "vertical-platform-orbit",
  "city-boundary-ground-hazard",
  "city-boundary-lift",
  "city-boundary-shuttle",
  "compound-compact-ascent",
  "compound-compact-climb",
  "compound-double-lift",
  "compound-lift-shuttle",
  "compound-low-ceiling-hazard",
  "compound-low-ceiling-shuttle",
  "compound-return-high",
  "compound-return-shuttle",
  "compound-return-terrace",
  "park-pond",
]);
register(
  (library, chunk) => [...recovery(library, chunk), point(30, chunk.solids[2]!.row)],
  ["broad-mesa"],
);
register(
  (library, chunk) => [...recovery(library, chunk), point(30, chunk.solids[1]!.row)],
  ["low-central-crossing"],
);
register(
  (library, chunk) => [...recovery(library, chunk), point(33, chunk.solids[3]!.row)],
  ["dry-underground-gallery-encounter"],
);
register(
  (library, chunk) => {
    const theme = library.themes[themesOf(chunk)[0]!]!;
    const gate = bindElement(
      theme.bindings,
      chunk.objects.find(({ role }) => role === "edge-left")!,
    );
    const character = CATALOGUE.characters[gate.character]!;
    const object = objectLayout(
      TILE,
      CATALOGUE,
      HITBOXES,
      TILESETS[character.tileset ?? theme.tileset],
      TILESETS,
      gate,
    );
    const rect = object.hitbox!;
    const left = (object.origin.x + rect.x) / TILE;
    const right = left + rect.width / TILE;
    const refuge = chunk.solids.find(
      ({ col, cols, row }) => col <= gate.col && col + cols >= right && row === chunk.entry.row,
    )!;
    return [
      point(7, 50),
      { at: { col: 26, row: 50 }, xRange: { max: Math.floor(left - bodyCols), min: refuge.col } },
      {
        at: { col: 31, row: 50 },
        xRange: { max: refuge.col + refuge.cols - bodyCols, min: Math.ceil(right) },
      },
      point(35, 50),
      point(58, 50),
    ];
  },
  ["compound-transfer-gate"],
);
register(
  () => [
    { at: { col: 26, row: 44 }, xRange: { max: 28 - bodyCols, min: 24 } },
    { at: { col: 34, row: 44 }, xRange: { max: 36 - bodyCols, min: 32 } },
    point(58, 50),
  ],
  ["warned-vent-terrace"],
);
register(
  () => [{ at: { col: 27, row: 48 }, xRange: { max: 30 - bodyCols, min: 24 } }, point(58, 50)],
  ["crumbling-support-crossing"],
);
register(encounter, [
  "offset-two-level-terrace-encounter",
  "open-stepped-ridge-encounter",
  ...["early", "middle", "late"].flatMap((position) => [
    `patrol-cover-${position}`,
    `growl-cover-${position}`,
    `flyer-shelter-${position}`,
    `vertical-stack-${position}`,
  ]),
  "bounded-flyer-post",
  "city-boundary-climb-yard",
  "city-boundary-dog-high",
  "city-boundary-dog-terrace",
  "climbing-enemy-lane",
  "compound-patrol-lift",
  "compound-perch-yard",
  "compound-vertical-yard",
  "growl-clearing",
  "growl-lift-clearing",
]);
register(
  recovery,
  [
    "back-streets",
    "city-boundary",
    "city-outskirts",
    "city-streets",
    "country-lanes",
    "deep-woods",
    "familiar-neighbourhood",
    "farmland",
    "forest-paths",
    "freight-terminal",
    "loading-yards",
    "ravine",
    "river-crossing",
    "street",
    "warehouse-district",
  ].flatMap((stage) => [`${stage}-start`, `${stage}-finish`]),
);
register(recovery, [
  "industrial-ascent",
  "industrial-deep-ascent",
  "industrial-deep-descent",
  "industrial-descent",
  "outdoor-descent",
  "outdoor-lift-ascent",
  "outdoor-upper-ascent",
  "outdoor-deep-descent",
  "outdoor-deep-ascent",
  "outdoor-terrace-ascent",
  "outdoor-ferry-ascent",
  "woodland-timed-descent",
  "woodland-timed-return",
  "woodland-deep-descent",
  "woodland-deep-ascent",
  "home-timed-descent",
  "home-timed-return",
  "home-deep-descent",
  "home-deep-ascent",
]);
register(() => [point(36, 30)], ["city-boundary-steps"]);
register(
  (library, chunk) => [
    ...recovery(library, chunk),
    { at: { col: 29, row: 30 }, xRange: { max: 30, min: 28 } },
    { at: { col: 47, row: 45 }, xRange: { max: 48, min: 46 } },
  ],
  ["outdoor-surface-return"],
);
register(() => [point(2, 110), point(2, 80), point(37, 50)], ["apartment-floor-start"]);
register(
  () => [point(11, 25), point(23, 20), point(35, 15), point(50, 10)],
  ["apartment-floor-finish"],
);
register(() => [point(30, 45), point(58, 40)], ["guarded-valley"]);

const fixtures = new Set([
  "fixture test-down-50",
  "fixture test-drop-50",
  "fixture test-finish",
  "fixture test-flat-40",
  "fixture test-flat-50",
  "fixture test-gap-30",
  "fixture test-gap-50",
  "fixture test-hazard-50",
  "fixture test-start",
  "fixture test-up-30",
  "fixture test-up-40",
  "fixture test-wide-50",
]);
const aliases = new Map(
  [...Object.entries(EXTERIOR_DEPTH_ALIASES), ...Object.entries(WOODLAND_DEPTH_ALIASES)].map(
    ([base, alias]) => [alias, base],
  ),
);

function filledApproaches(library: ChunkLibrary, chunk: ChunkPlan): Target[] {
  const theme = library.themes[themesOf(chunk)[0]!]!;
  const door = bindElement(theme.bindings, { character: "", col: 0, role: theme.door, row: 0 });
  const doorCols = library.characters[door.character]!.cols;
  return (chunk.slots ?? []).map(({ area, kind }) => {
    const cols = kind === "door" ? doorCols : area.cols;
    const col = area.col + (area.cols - cols) / 2;
    if (cols < bodyCols) {
      throw new Error("Slot approach must fit Chibi's body");
    }
    return {
      at: { col: col + cols / 2, row: area.row + area.rows },
      xRange: { max: col + cols - bodyCols, min: col },
    };
  });
}

// A module pair's targets: its declared profile's over the whole composed chunk, its declared
// targets, then its slot approaches.
export function moduleRouteTargets(
  library: ChunkLibrary,
  route: { readonly profile: ModuleRouteProfile; readonly targets: readonly Target[] },
  chunk: ChunkPlan,
): readonly Target[] {
  const profile =
    route.profile === "encounter" ? encounter : route.profile === "recovery" ? recovery : () => [];
  return [...profile(library, chunk), ...route.targets, ...filledApproaches(library, chunk)];
}

// Synthetic fixtures retain exhaustive traversal; their secondary lists do not change that mode.
export const REQUIRED_CHUNK_ROUTES: Readonly<Record<string, readonly Target[]>> =
  Object.fromEntries(
    ALL_CHUNKS.map(([name, library, chunk]) => {
      const prefix = [
        "apartment-tall-",
        "industrial-tall-",
        "industrial-tunnel-",
        "blue-vertical-",
        "countryside-vertical-",
        "woodland-vertical-",
        "home-vertical-",
      ].find((prefix) => name.startsWith(prefix));
      const original = prefix ? name.slice(prefix.length) : name;
      const base = aliases.get(original) ?? original;
      const sourceTargets = fixtures.has(name) ? [] : contracts.get(base);
      const offset = prefix && CHUNKS[base] ? chunk.entry.row - CHUNKS[base]!.entry.row : 0;
      const targets = sourceTargets?.map((target) => ({
        ...target,
        at: { ...target.at, row: target.at.row + offset },
      }));
      if (!targets) {
        throw new Error(`Unclassified required route ${name}`);
      }
      return [name, [...targets, ...filledApproaches(library, chunk)]];
    }),
  );
