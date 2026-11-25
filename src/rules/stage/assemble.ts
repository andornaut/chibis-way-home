import { type Random, randomInt, randomStream, shuffled } from "@andornaut/game-kit/runtime/random";

import type {
  ArenaApproach,
  BackgroundSection,
  Character,
  ChunkPlan,
  ChunkPool,
  ChunkRules,
  FilledSlot,
  Instance,
  OrderedZoneRecipe,
  PlacedChunk,
  SlotKind,
  StageRecipe,
  TerrainRect,
  ThemePlan,
  TilePoint,
  ZonePlan,
  ZoneRecipe,
} from "../../data/types/index.ts";
import { namespaceOrbitInstances } from "../bird/index.ts";
import { arenaApproachProblems } from "./arenaApproaches.ts";
import { withBackgroundSections } from "./backgroundSections.ts";
import { bindElement } from "./elementBinding.ts";
import { namespaceForcedTransit } from "./forcedTransitLayout.ts";
import { withRoomBuildings } from "./roomBuildings.ts";
import {
  candidateOrder,
  failedKey,
  finishesHere,
  hopeless,
  type Pinned,
  type PoolChunk,
  type RunSearch,
  useChunk,
} from "./runSearch.ts";
import { applyStageGeometry, chunkRows, validRows } from "./stageGeometry.ts";

// What zones are assembled from: the chunks and themes by key, the chunk rules, the seam rows,
// a zone's height in rows, and the characters by key, for the size of each theme's door.
// arenas: the chunk id of each stage's arena, by stage key.
export interface ChunkLibrary {
  readonly approaches?: Readonly<Record<string, ArenaApproach>>;
  readonly arenas?: Readonly<Record<string, string>>;
  readonly backgrounds?: Readonly<Record<string, BackgroundSection>>;
  readonly characters: Readonly<Record<string, Pick<Character, "cols" | "rows">>>;
  readonly chunks: Readonly<Record<string, ChunkPlan>>;
  readonly rows: number;
  readonly rules: ChunkRules;
  readonly seams: readonly number[];
  readonly themes: Readonly<Record<string, ThemePlan>>;
}

// A stage's assembled plan.
export interface PlannedAssembly {
  readonly outcome: "planned";
  readonly plan: ZonePlan;
}

// The outcome when no run of a recipe's chunks fits it, with why.
export interface NothingFits {
  readonly outcome: "nothing-fits";
  readonly reason: string;
}

export type StageAssembly = NothingFits | PlannedAssembly;

const nothingFits = (reason: string): NothingFits => ({ outcome: "nothing-fits", reason });
const planned = (plan: ZonePlan): PlannedAssembly => ({ outcome: "planned", plan });

// An assembled zone's one area, and the entry he starts at.
export const ASSEMBLED_AREA = "main";
const START_ENTRY = "start";

// The themes a chunk is drawn in.
export function themesOf(chunk: ChunkPlan): readonly string[] {
  return typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
}

function chunkOf(library: ChunkLibrary, id: string): ChunkPlan {
  const chunk = library.chunks[id];
  if (!chunk) {
    throw new Error(`No chunk ${id}`);
  }
  return chunk;
}

// Authored pools retain their order; implicit flat pools retain the legacy sorted theme order.
// An implicit pool never holds an arena.
export function recipeChunkPool(library: ChunkLibrary, recipe: ZoneRecipe): ChunkPool {
  const arenas = new Set(Object.values(library.arenas ?? {}));
  return (
    recipe.chunks ??
    Object.keys(library.chunks)
      .filter(
        (id) =>
          id !== recipe.start &&
          id !== recipe.finish &&
          !arenas.has(id) &&
          themesOf(chunkOf(library, id)).includes(recipe.theme),
      )
      .sort()
  );
}

export function chunkPoolProblems(
  library: ChunkLibrary,
  context: Pick<ZoneRecipe, "finish" | "rows" | "start" | "theme">,
  pool: ChunkPool,
): string[] {
  const problems: string[] = [];
  if (pool.length === 0 || new Set(pool).size !== pool.length) {
    problems.push("invalid chunk pool");
  }
  for (const id of pool) {
    const chunk = library.chunks[id];
    if (
      chunk &&
      (!Number.isInteger(chunk.cols) ||
        chunk.cols < library.rules.cols.min ||
        chunk.cols > library.rules.cols.max)
    ) {
      problems.push(`invalid generated width for chunk ${id}`);
    }
    if (!chunk) {
      problems.push(`no chunk ${id}`);
    } else if (chunkRows(library, chunk) !== (context.rows ?? library.rows)) {
      problems.push(`pool chunk ${id} height does not match its recipe`);
    } else if (
      id === context.start ||
      id === context.finish ||
      !themesOf(chunk).includes(context.theme)
    ) {
      problems.push(`invalid pool chunk ${id}`);
    }
  }
  return problems;
}

export function eligibleChunks(
  library: ChunkLibrary,
  recipe: Pick<ZoneRecipe, "difficulty" | "difficultyWeights" | "rows">,
  pool: ChunkPool,
): ChunkPool {
  return pool.filter((id) => {
    const chunk = chunkOf(library, id);
    const { difficulty } = chunk;
    return (
      chunkRows(library, chunk) === (recipe.rows ?? library.rows) &&
      difficulty >= recipe.difficulty.min &&
      difficulty <= recipe.difficulty.max &&
      (recipe.difficultyWeights?.[difficulty] ?? 1) > 0
    );
  });
}

const slotCount = (chunk: ChunkPlan, kind: SlotKind) =>
  (chunk.slots ?? []).filter((slot) => slot.kind === kind).length;

const wanted = (entries: readonly { readonly count: number }[]) =>
  entries.reduce((sum, { count }) => sum + count, 0);

// Each pool chunk's draw weight: its own weight times its grade's share (difficultyWeights,
// default 1), divided by the total weight of the pool's chunks of that grade, so each grade is
// drawn in proportion to its share however many chunks it holds.
function drawWeights(
  library: ChunkLibrary,
  shares: ZoneRecipe["difficultyWeights"],
  pool: readonly string[],
): ReadonlyMap<string, number> {
  const totals = new Map<number, number>();
  for (const id of pool) {
    const chunk = chunkOf(library, id);
    totals.set(chunk.difficulty, (totals.get(chunk.difficulty) ?? 0) + (chunk.weight ?? 1));
  }
  return new Map(
    pool.map((id) => {
      const chunk = chunkOf(library, id);
      return [
        id,
        ((chunk.weight ?? 1) * (shares?.[chunk.difficulty] ?? 1)) / totals.get(chunk.difficulty)!,
      ];
    }),
  );
}

// The chunks in an order drawn from random, each placed ahead of another as likely as its
// draw weight is to the other's (weighted sampling without replacement).
function weightedOrder(
  random: Random,
  weights: ReadonlyMap<string, number>,
  ids: readonly string[],
): string[] {
  return ids
    .map((id) => ({ id, key: random() ** (1 / weights.get(id)!) }))
    .sort((a, b) => b.key - a.key)
    .map(({ id }) => id);
}

export function difficultyWeightProblems(
  library: ChunkLibrary,
  recipe: Pick<ZoneRecipe, "difficulty" | "difficultyWeights">,
  pool: readonly string[],
): string[] {
  const weights = recipe.difficultyWeights;
  if (weights === undefined) {
    return [];
  }
  if (
    Object.entries(weights).some(
      ([grade, weight]) =>
        !Number.isInteger(Number(grade)) ||
        Number(grade) < 1 ||
        Number(grade) > 5 ||
        !Number.isFinite(weight) ||
        weight < 0,
    )
  ) {
    return ["difficulty weights must be finite nonnegative values for grades 1 to 5"];
  }
  const eligible = pool.filter((id) => {
    const grade = chunkOf(library, id).difficulty;
    return grade >= recipe.difficulty.min && grade <= recipe.difficulty.max;
  });
  return eligible.some((id) => (weights[chunkOf(library, id).difficulty] ?? 1) > 0)
    ? []
    : ["difficulty weights exclude every eligible chunk"];
}

// Encounter constraints are opt-in. Counts come only from explicit chunk metadata.
function encounterQuota(
  library: ChunkLibrary,
  quota: number | undefined,
  ids: readonly string[],
): number | undefined {
  if (quota === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(quota) || quota < 0) {
    throw new Error("Encounter quota must be a nonnegative safe integer");
  }
  for (const id of ids) {
    const count = chunkOf(library, id).encounters;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Invalid encounter count for chunk ${id}`);
    }
  }
  return quota;
}

function minimumEncounterGap(
  library: ChunkLibrary,
  gap: number | undefined,
  ids: readonly string[],
): number {
  if (gap === undefined) {
    return 0;
  }
  if (!Number.isSafeInteger(gap) || gap < 0) {
    throw new Error("Minimum encounter gap must be a nonnegative safe integer");
  }
  if (gap > 0) {
    for (const id of ids) {
      const count = chunkOf(library, id).encounters;
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(`Invalid encounter count for chunk ${id}`);
      }
    }
  }
  return gap;
}

const quietAfter = (minimum: number, quietChunks: number, encounters: number) =>
  encounters === 0 ? Math.min(minimum, quietChunks + 1) : 0;

function encounterFits(
  library: ChunkLibrary,
  remaining: number | undefined,
  previous: string | undefined,
  id: string,
): boolean {
  if (remaining === undefined) {
    return true;
  }
  const count = chunkOf(library, id).encounters;
  return (
    count <= remaining &&
    (count === 0 || previous === undefined || chunkOf(library, previous).encounters === 0)
  );
}

// The exact search's bounds: the most limited chunks in its pool and the most nodes it visits
// before it gives way to the class search. Its key holds every limited chunk's uses, so its
// states grow with their number. Then the nodes the class search visits before it fails loudly
// rather than exhaust memory.
export const EXACT_LIMITED_CHUNKS = 32;
export const EXACT_NODE_LIMIT = 1_000_000;
export const SEARCH_NODE_LIMIT = 2_000_000;

// The exact search's answer when its pool or its nodes exceed its bounds.
const EXCEEDED = "exceeded";

// The loops of a run of middle chunks after the start chunk: how many times its seam row returns
// to the start's exit row after leaving it, which is how many of its chunks enter on another row
// and exit on that one.
export function runLoops(library: ChunkLibrary, start: string, run: readonly string[]): number {
  const row = chunkOf(library, start).exit.row;
  return run.filter((id) => {
    const { entry, exit } = chunkOf(library, id);
    return entry.row !== row && exit.row === row;
  }).length;
}

// The ids of the chunks between the recipe's start and finish, left to right: a seeded run
// whose seams join, never the same chunk twice in a row, each chunk at most its maxPerZone
// times, within the difficulty band, with slots enough for the recipe's events and doors,
// and the whole zone within the recipe's length. It aims for a length drawn from the seed, tries
// the chunks in a seeded weighted order (as weightedOrder), and backtracks when stuck. Undefined
// when none exists.
//
// The exact search remembers a failed state by its last chunk and every limited chunk's uses,
// and gives up with EXCEEDED on a pool of more than EXACT_LIMITED_CHUNKS limited chunks or after
// EXACT_NODE_LIMIT nodes. The class search remembers it by
// feasibility alone: chunks alike in columns, slots, encounters, seam rows and maxPerZone form a
// class, and any unused member of a class finishes a run exactly as another does, so its key
// holds the class of the last chunk, its uses, and each class's histogram of member uses. It
// also cuts states that no length, slot or encounter bound can complete before drawing their
// candidates, and throws after SEARCH_NODE_LIMIT nodes. Both draw in the same order at a node;
// they differ in the failed states they skip, and so in the draws they consume.
//
// With a pinned chunk, the run holds it once, as its middle chunk at index `at`, which lies in
// the run's second half (floor(n / 2) to n - 1 of n middle chunks); the pool never holds it.
//
// With a loop cap, the run holds at most that many loops (runLoops): a chunk that would close
// one more is no candidate, and a failed state is remembered with its loops.
function searchRun(
  library: ChunkLibrary,
  random: Random,
  loopCap: number | undefined,
  pinned: Pinned | undefined,
  recipe: ZoneRecipe,
  exact: boolean,
): readonly string[] | typeof EXCEEDED | undefined {
  const start = chunkOf(library, recipe.start);
  const finish = chunkOf(library, recipe.finish);
  const pool = eligibleChunks(library, recipe, recipeChunkPool(library, recipe));
  const quota = encounterQuota(library, recipe.encounters, [recipe.start, recipe.finish, ...pool]);
  const minimumGap = minimumEncounterGap(library, recipe.minEncounterGap, [
    recipe.start,
    recipe.finish,
    ...pool,
  ]);
  const initialRemaining =
    quota === undefined ? undefined : quota - start.encounters - finish.encounters;
  if (initialRemaining !== undefined && initialRemaining < 0) {
    return undefined;
  }
  const { max, min } = recipe.length;
  const target = randomInt(random, min, max + 1);
  const run = prepareSearch(library, loopCap, pinned, recipe, exact, minimumGap, pool);
  if (exact && run.limits > EXACT_LIMITED_CHUNKS) {
    return EXCEEDED;
  }
  const { chunks, finishCols, ids, minCols } = run;
  const failed = new Set<string>();
  let nodes = 0;
  // Thrown to unwind the exact search when it reaches EXACT_NODE_LIMIT.
  const exceeded = new Error(EXCEEDED);

  const search = (
    width: number,
    events: number,
    doors: number,
    remaining: number | undefined,
    quietChunks: number,
    loops: number,
  ): boolean => {
    if (++nodes > (exact ? EXACT_NODE_LIMIT : SEARCH_NODE_LIMIT)) {
      if (exact) {
        throw exceeded;
      }
      throw new Error(
        `Assembly search of ${recipe.start} to ${recipe.finish} exceeded ${SEARCH_NODE_LIMIT} nodes`,
      );
    }
    const last = ids.length === 0 ? -1 : ids[ids.length - 1]!;
    const prev = last < 0 ? undefined : chunks[last]!;
    const exitRow = prev ? prev.exitRow : start.exit.row;
    if (width + minCols + finishCols > max && exitRow !== finish.entry.row) {
      return false;
    }
    const key = failedKey(run, width, last, events, doors, remaining, quietChunks, loops);
    if (failed.has(key)) {
      return false;
    }
    const prevEncounters = prev ? prev.encounters : start.encounters;
    if (
      !exact &&
      hopeless(run, width, events, doors, remaining, quietChunks, prevEncounters, exitRow)
    ) {
      failed.add(key);
      return false;
    }
    const order = candidateOrder(
      run,
      random,
      width,
      last,
      exitRow,
      remaining,
      quietChunks,
      prevEncounters,
      loops,
    );
    const finishFirst = width + finishCols >= target;
    const finishes = () =>
      finishesHere(run, width, events, doors, remaining, quietChunks, prevEncounters, exitRow);
    if (finishFirst && finishes()) {
      return true;
    }
    for (const index of order) {
      const chunk = chunks[index]!;
      ids.push(index);
      useChunk(run, chunk, 1);
      const found = search(
        width + chunk.cols,
        events + chunk.events,
        doors + chunk.doors,
        remaining === undefined ? undefined : remaining - chunk.encounters,
        quietAfter(minimumGap, quietChunks, chunk.encounters),
        loops + (chunk.closes ? 1 : 0),
      );
      if (found) {
        return true;
      }
      ids.pop();
      useChunk(run, chunk, -1);
    }
    if (!finishFirst && finishes()) {
      return true;
    }
    failed.add(key);
    return false;
  };

  try {
    return search(
      start.cols,
      slotCount(start, "event"),
      slotCount(start, "door"),
      initialRemaining,
      start.encounters > 0 ? 0 : minimumGap,
      0,
    )
      ? ids.map((index) => chunks[index]!.id)
      : undefined;
  } catch (error) {
    if (error === exceeded) {
      return EXCEEDED;
    }
    throw error;
  }
}

// A search's pool chunks with their classes, its bounds, and a run with no chunks yet.
function prepareSearch(
  library: ChunkLibrary,
  loopCap: number | undefined,
  pinned: Pinned | undefined,
  recipe: ZoneRecipe,
  exact: boolean,
  minimumGap: number,
  pool: readonly string[],
): RunSearch {
  const start = chunkOf(library, recipe.start);
  const finish = chunkOf(library, recipe.finish);
  const weights = drawWeights(library, recipe.difficultyWeights, pool);
  const classIds = new Map<string, number>();
  // Each class's maxPerZone (Infinity when unlimited) and its member count.
  const classCaps: number[] = [];
  const classSizes: number[] = [];
  let limits = 0;
  const chunks: readonly PoolChunk[] = [...pool, ...(pinned ? [pinned.chunk] : [])].map((id) => {
    const chunk = chunkOf(library, id);
    const facts = {
      cols: chunk.cols,
      doors: slotCount(chunk, "door"),
      encounters: chunk.encounters,
      entryRow: chunk.entry.row,
      events: slotCount(chunk, "event"),
      exitRow: chunk.exit.row,
      maxPerZone: chunk.maxPerZone ?? Infinity,
    };
    // The finish is its own class: a run never ends on two finishes in a row.
    const signature =
      id === recipe.finish || id === pinned?.chunk
        ? `${id === pinned?.chunk ? "pinned" : "finish"}:${id}`
        : `${facts.cols}|${facts.doors}|${facts.encounters}|${facts.entryRow}|` +
          `${facts.events}|${facts.exitRow}|${facts.maxPerZone}${
            pinned?.predecessors === undefined ? "" : `|approach:${pinned.predecessors.has(id)}`
          }`;
    let classId = classIds.get(signature);
    if (classId === undefined) {
      classId = classCaps.length;
      classIds.set(signature, classId);
      classCaps.push(facts.maxPerZone);
      classSizes.push(0);
    }
    classSizes[classId]!++;
    return {
      ...facts,
      class: classId,
      closes: facts.entryRow !== start.exit.row && facts.exitRow === start.exit.row,
      id,
      keyPower: id === pinned?.chunk ? 1 : 1 / weights.get(id)!,
      limit: chunk.maxPerZone === undefined ? -1 : limits++,
    };
  });
  const counts = new Int32Array(limits);
  const countsCodes = Array<number>(limits).fill(0);
  // Per limited class, how many of its members have each use count from 1 to its maxPerZone,
  // flattened: histogramAt[class] + uses - 1.
  const histogramAt = classCaps.map(() => -1);
  let histogramSize = 0;
  for (const [classId, cap] of classCaps.entries()) {
    if (Number.isFinite(cap)) {
      histogramAt[classId] = histogramSize;
      histogramSize += cap;
    }
  }
  const histogram = new Int32Array(histogramSize);
  // Per class, its members used at least once.
  const usedMembers = new Int32Array(classCaps.length);
  const limitedClasses = classCaps.flatMap((cap, classId) =>
    Number.isFinite(cap) ? [classId] : [],
  );
  const keys = new Float64Array(chunks.length);
  // Bounds on what the unused chunks can still add, for the cuts.
  const minCols = Math.min(...chunks.map(({ cols }) => cols));
  const maxCols = Math.max(...chunks.map(({ cols }) => cols));
  const maxEvents = Math.max(0, ...chunks.map(({ events }) => events));
  const maxDoors = Math.max(0, ...chunks.map(({ doors }) => doors));
  const maxEncounters = Math.max(0, ...chunks.map(({ encounters }) => encounters));
  // The fewest pool chunks that join a seam row to the finish's entry row, by row.
  const toFinish = new Map<number, number>([[finish.entry.row, 0]]);
  for (let changed = true; changed;) {
    changed = false;
    for (const { entryRow, exitRow } of chunks) {
      const through = (toFinish.get(exitRow) ?? Infinity) + 1;
      if (through < (toFinish.get(entryRow) ?? Infinity)) {
        toFinish.set(entryRow, through);
        changed = true;
      }
    }
  }
  // Uses left: of quiet chunks, of encounter chunks, and of encounters those chunks hold.
  let quietLeft = 0;
  let encounterChunksLeft = 0;
  let encountersLeft = 0;
  for (const chunk of chunks) {
    if (chunk.encounters === 0) {
      quietLeft += chunk.maxPerZone;
    } else {
      encounterChunksLeft += chunk.maxPerZone;
      encountersLeft += chunk.maxPerZone * chunk.encounters;
    }
  }
  return {
    chunks,
    classCaps,
    classSizes,
    counts,
    countsCodes,
    encounterChunksLeft,
    encountersLeft,
    exact,
    finish,
    finishCols: finish.cols,
    finishDoors: slotCount(finish, "door"),
    finishEvents: slotCount(finish, "event"),
    histogram,
    histogramAt,
    ids: [],
    keys,
    limitedClasses,
    limits,
    loopCap,
    max: recipe.length.max,
    maxCols,
    maxDoors,
    maxEncounters,
    maxEvents,
    min: recipe.length.min,
    minCols,
    minimumGap,
    needDoors: wanted(recipe.doors),
    needEvents: wanted(recipe.events),
    pinned,
    quietLeft,
    recipe,
    toFinish,
    usedMembers,
  };
}

// The zone key's run for a seed: the exact search's, or when that exceeds its bounds, the class
// search's from a fresh stream of the same seed. The run is searched without the recipe's loop
// cap first; only one that holds more loops is searched again, from fresh streams of the same
// seed, with the cap enforced. A run within the cap is therefore the same with and without it.
function seededRun(
  library: ChunkLibrary,
  seed: number,
  key: string,
  pinned: Pinned | undefined,
  recipe: ZoneRecipe,
): readonly string[] | undefined {
  const search = (loopCap: number | undefined) => {
    const attempt = (exact: boolean) =>
      searchRun(library, randomStream(seed, `assemble:${key}`), loopCap, pinned, recipe, exact);
    const run = attempt(true);
    if (run !== EXCEEDED) {
      return run;
    }
    const fallback = attempt(false);
    return fallback === EXCEEDED ? undefined : fallback;
  };
  const run = search(undefined);
  const { loopCap } = recipe;
  return run === undefined ||
    loopCap === undefined ||
    runLoops(library, recipe.start, run) <= loopCap
    ? run
    : search(loopCap);
}

// The run of a stage with an arena: the arena once, among its pool's chunks without encounters.
// A run of those chunks with the arena's columns set aside gives the middle count n; the arena's
// index is drawn from the stage seed in floor(n / 2) to n - 1, and the run is searched with the
// arena pinned there, then at each later index of that half, wrapping, until one joins. The
// arena is the stage's one encounter beyond its caps', so the recipe's quota and gap give way.
function arenaRun(
  library: ChunkLibrary,
  seed: number,
  key: string,
  arenaId: string,
  predecessors: ReadonlySet<string> | undefined,
  recipe: ZoneRecipe,
): readonly string[] | undefined {
  const arena = chunkOf(library, arenaId);
  const caps =
    chunkOf(library, recipe.start).encounters + chunkOf(library, recipe.finish).encounters;
  const quiet: ZoneRecipe = {
    ...recipe,
    chunks: recipeChunkPool(library, recipe).filter(
      (id) => id !== arenaId && chunkOf(library, id).encounters === 0,
    ),
    encounters: caps + arena.encounters,
    minEncounterGap: 0,
  };
  const sized = seededRun(library, seed, key, undefined, {
    ...quiet,
    encounters: caps,
    length: { max: recipe.length.max - arena.cols, min: recipe.length.min - arena.cols },
  });
  if (!sized) {
    return undefined;
  }
  const count = sized.length + 1;
  const low = Math.floor(count / 2);
  const span = count - low;
  const first = randomInt(randomStream(seed, `arena:${key}`), 0, span);
  for (let offset = 0; offset < span; offset++) {
    const at = low + ((first + offset) % span);
    const run = seededRun(
      library,
      seed,
      key,
      { at, chunk: arenaId, ...(predecessors === undefined ? {} : { predecessors }) },
      quiet,
    );
    if (run) {
      return run;
    }
  }
  return undefined;
}

const shiftPoint = (col: number, point: TilePoint): TilePoint => ({
  ...point,
  col: point.col + col,
});
const shiftInstance = (col: number, instance: Instance): Instance => ({
  ...instance,
  col: instance.col + col,
});

// A zone of chunks ids, left to right, drawn in theme: each chunk's contents moved to its zone
// columns, each terrain look as the theme's tileset draws it, the theme's repeated backdrops
// across the whole zone, and fills (event ids, then door rooms, by kind) placed in its slots by
// random. A filled door slot places the theme's door at its own size, centred across the slot
// (half a tile in where the two widths differ by an odd number of tiles) and standing on its
// floor, leading to its room.
// He starts at spawnCol on the first chunk's entry row.
export function zonePlanOf(
  library: ChunkLibrary,
  random: Random,
  fills: Readonly<Record<SlotKind, readonly string[]>> &
    Partial<Pick<ZoneRecipe, "start" | "startDoors">>,
  themeKey: string,
  spawnCol: number,
  ids: readonly string[],
): ZonePlan {
  const theme = library.themes[themeKey];
  if (!theme) {
    throw new Error(`No theme ${themeKey}`);
  }
  const chunks = ids.map((id) => chunkOf(library, id));
  const first = chunks[0];
  const rows = first ? chunkRows(library, first) : library.rows;
  if (!validRows(rows) || chunks.some((chunk) => chunkRows(library, chunk) !== rows)) {
    throw new Error("Assembled chunks must share one positive authored height");
  }
  if (!first || !Number.isInteger(spawnCol) || spawnCol <= 1 || spawnCol >= first.cols) {
    throw new Error(
      `Spawn column ${spawnCol} must be an integer beyond the first column and inside the opening chunk`,
    );
  }
  const placed = chunks.reduce<PlacedChunk[]>((list, chunk, index) => {
    const last = list.at(-1);
    list.push({ chunk: ids[index] ?? "", col: last ? last.col + last.cols : 0, cols: chunk.cols });
    return list;
  }, []);
  const scoped = chunks.map((chunk, index) => {
    const combined = namespaceForcedTransit(
      `chunk${index}`,
      namespaceOrbitInstances(`chunk${index}`, [...(chunk.backdrops ?? []), ...chunk.objects]),
    );
    const count = chunk.backdrops?.length ?? 0;
    return { backdrops: combined.slice(0, count), objects: combined.slice(count) };
  });
  const cols = placed.reduce((sum, chunk) => sum + chunk.cols, 0);
  const at = (index: number) => placed[index]?.col ?? 0;
  const look = (id: string, solid: TerrainRect): TerrainRect => {
    if (solid.look === undefined) {
      return solid;
    }
    const drawn = theme.looks[solid.look];
    if (drawn === undefined) {
      throw new Error(`Theme ${themeKey} has no look ${solid.look} for chunk ${id}`);
    }
    return { ...solid, look: drawn };
  };
  const slots = chunks.flatMap((chunk, index) =>
    (chunk.slots ?? []).map((slot): FilledSlot => ({
      ...slot,
      area: { ...slot.area, col: slot.area.col + at(index) },
      chunk: index,
    })),
  );
  const filled = new Map<FilledSlot, string>();
  for (const kind of ["event", "door"] as const) {
    const open = shuffled(
      random,
      slots.filter((slot) => slot.kind === kind),
    );
    const want = fills[kind];
    if (want.length > open.length) {
      throw new Error(`${want.length} ${kind}s for ${open.length} ${kind} slots`);
    }
    const remaining = [...want];
    for (const room of kind === "door" ? (fills.startDoors ?? []) : []) {
      const wanted = remaining.indexOf(room);
      if (wanted < 0) {
        throw new Error(`Start door room ${room} is not requested by the recipe`);
      }
      const index = open.findIndex((slot) => slot.chunk === 0 && ids[slot.chunk] === fills.start);
      if (index < 0) {
        throw new Error(`No door slot in fixed start ${fills.start} for room ${room}`);
      }
      remaining.splice(wanted, 1);
      filled.set(open.splice(index, 1)[0]!, room);
    }
    remaining.forEach((fill, index) => filled.set(open[index] as FilledSlot, fill));
  }
  const doorTemplate = bindElement(theme.bindings, {
    character: "",
    col: 0,
    role: theme.door,
    row: 0,
  });
  const door = library.characters[doorTemplate.character];
  if (!door) {
    throw new Error(`No character ${doorTemplate.character} for theme ${themeKey}'s doors`);
  }
  const doors = slots.flatMap((slot): Instance[] => {
    const room = filled.get(slot);
    if (slot.kind !== "door" || room === undefined) {
      return [];
    }
    const { area } = slot;
    return [
      {
        ...doorTemplate,
        col: area.col + (area.cols - door.cols) / 2,
        room,
        row: area.row + area.rows - door.rows,
      },
    ];
  });
  const scenery = chunks.flatMap((chunk, index) =>
    (chunk.scenery ?? []).map((instance) =>
      bindElement(theme.bindings, shiftInstance(at(index), instance)),
    ),
  );
  const objects: Instance[] = [
    ...theme.backdrops.map((backdrop) =>
      bindElement(theme.bindings, { ...backdrop, col: 0, cols }),
    ),
    ...chunks.flatMap((_, index) =>
      scoped[index]!.backdrops.map((instance) =>
        bindElement(theme.bindings, shiftInstance(at(index), instance)),
      ),
    ),
    ...chunks.flatMap((_, index) =>
      scoped[index]!.objects.map((instance) =>
        bindElement(theme.bindings, shiftInstance(at(index), instance)),
      ),
    ),
    ...doors,
    ...scenery,
  ];
  return {
    areas: {
      [ASSEMBLED_AREA]: {
        chunks: placed,
        cols,
        entries: {
          [START_ENTRY]: {
            col: spawnCol,
            row: first.entry.row,
          },
        },
        noCross: chunks.flatMap((chunk, index) =>
          (chunk.noCross ?? []).map(({ from, to }) => ({
            from: shiftPoint(at(index), from),
            to: shiftPoint(at(index), to),
          })),
        ),
        objects,
        ...(scenery.length > 0 && {
          sceneryIndices: scenery.map((_, index) => objects.length - scenery.length + index),
        }),
        outOfReach: chunks.flatMap((chunk, index) =>
          (chunk.outOfReach ?? []).map((spot) => shiftPoint(at(index), spot)),
        ),
        rows,
        slots: slots.map((slot) => {
          const fill = filled.get(slot);
          return fill === undefined ? slot : { ...slot, fill };
        }),
        solids: chunks.flatMap((chunk, index) =>
          chunk.solids.map((solid) =>
            look(ids[index] ?? "", { ...solid, col: solid.col + at(index) }),
          ),
        ),
        tileset: theme.tileset,
      },
    },
    start: { area: ASSEMBLED_AREA, entry: START_ENTRY },
  };
}

// The recipe's events and doors, each id or room repeated count times.
function fillsOf(recipe: Pick<ZoneRecipe, "doors" | "events">): Record<SlotKind, string[]> {
  return {
    door: recipe.doors.flatMap(({ count, room }) => Array<string>(count).fill(room)),
    event: recipe.events.flatMap(({ count, id }) => Array<string>(count).fill(id)),
  };
}

// Section length includes its global caps and at least one generated chunk.
export function orderedRecipeProblems(library: ChunkLibrary, recipe: OrderedZoneRecipe): string[] {
  const problems: string[] = [];
  if (recipe.sections.length === 0) {
    return ["ordered stage has no sections"];
  }
  if (
    new Set(recipe.sections.map(({ id }) => id)).size !== recipe.sections.length ||
    recipe.sections.some(({ id }) => id.length === 0)
  ) {
    problems.push("section ids must be unique and nonempty");
  }
  for (const id of [recipe.start, recipe.finish]) {
    if (!library.chunks[id]) {
      problems.push(`no chunk ${id}`);
    }
  }
  const first = recipe.sections[0];
  const last = recipe.sections.at(-1);
  for (const [id, section] of [
    [recipe.start, first],
    [recipe.finish, last],
  ] as const) {
    const cap = library.chunks[id];
    if (
      cap &&
      section &&
      (!Number.isInteger(cap.cols) ||
        cap.cols < library.rules.cols.min ||
        cap.cols > library.rules.cols.max ||
        !themesOf(cap).includes(section.theme) ||
        chunkRows(library, cap) !== (section.rows ?? library.rows))
    ) {
      problems.push(`invalid cap ${id} for section ${section.id}`);
    }
  }
  for (const [index, section] of recipe.sections.entries()) {
    if (!validRows(section.rows ?? library.rows)) {
      problems.push(`invalid height for section ${section.id}`);
    }
    if (!library.themes[section.theme]) {
      problems.push(`no theme ${section.theme}`);
    }
    problems.push(
      ...chunkPoolProblems(
        library,
        {
          finish: recipe.finish,
          ...(section.rows !== undefined && { rows: section.rows }),
          start: recipe.start,
          theme: section.theme,
        },
        section.chunks,
      ),
    );
    if (
      !Number.isSafeInteger(section.length.min) ||
      !Number.isSafeInteger(section.length.max) ||
      section.length.min <= 0 ||
      section.length.min > section.length.max
    ) {
      problems.push(`invalid length for section ${section.id}`);
    }
    problems.push(
      ...difficultyWeightProblems(
        library,
        section,
        section.chunks.filter((id) => library.chunks[id] !== undefined),
      ),
    );
    const widths = section.chunks.flatMap((id) => {
      const chunk = library.chunks[id];
      return chunk &&
        themesOf(chunk).includes(section.theme) &&
        chunk.difficulty >= section.difficulty.min &&
        chunk.difficulty <= section.difficulty.max &&
        (section.difficultyWeights?.[chunk.difficulty] ?? 1) > 0
        ? [chunk.cols]
        : [];
    });
    const capWidth =
      (index === 0 ? (library.chunks[recipe.start]?.cols ?? 0) : 0) +
      (index === recipe.sections.length - 1 ? (library.chunks[recipe.finish]?.cols ?? 0) : 0);
    if (widths.length > 0 && section.length.min < capWidth + Math.min(...widths)) {
      problems.push(`length for section ${section.id} must include its caps and a generated chunk`);
    }
    if (!Number.isInteger(section.spawnCol) || section.spawnCol <= 1) {
      problems.push(`invalid spawn column for section ${section.id}`);
    }
    if (
      !Number.isInteger(section.difficulty.min) ||
      !Number.isInteger(section.difficulty.max) ||
      section.difficulty.min < 1 ||
      section.difficulty.max > 5 ||
      section.difficulty.min > section.difficulty.max
    ) {
      problems.push(`invalid difficulty for section ${section.id}`);
    }
    for (const { count } of [...section.doors, ...section.events]) {
      if (!Number.isInteger(count) || count < 0) {
        problems.push(`invalid fill count for section ${section.id}`);
      }
    }
  }
  return problems;
}

function assembleOrdered(
  library: ChunkLibrary,
  seed: number,
  key: string,
  recipe: OrderedZoneRecipe,
): StageAssembly {
  const problems = orderedRecipeProblems(library, recipe);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
  const start = chunkOf(library, recipe.start);
  const finish = chunkOf(library, recipe.finish);
  const first = recipe.sections[0];
  const last = recipe.sections.at(-1);
  if (
    !first ||
    !last ||
    !themesOf(start).includes(first.theme) ||
    !themesOf(finish).includes(last.theme)
  ) {
    throw new Error("Stage caps do not match their section themes");
  }
  const counts = new Map<string, number>();
  for (const id of [recipe.start, recipe.finish]) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if ([...counts].some(([id, count]) => count > (chunkOf(library, id).maxPerZone ?? Infinity))) {
    throw new Error("Stage caps exceed maxPerZone");
  }
  const pools = recipe.sections.map((section) => eligibleChunks(library, section, section.chunks));
  const weights = recipe.sections.map((section, index) =>
    drawWeights(library, section.difficultyWeights, pools[index]!),
  );
  const quota = encounterQuota(library, recipe.encounters, [
    recipe.start,
    recipe.finish,
    ...pools.flat(),
  ]);
  const minimumGap = minimumEncounterGap(library, recipe.minEncounterGap, [
    recipe.start,
    recipe.finish,
    ...pools.flat(),
  ]);
  const remaining = quota === undefined ? undefined : quota - start.encounters - finish.encounters;
  const selected: (readonly string[])[] = [];
  const failed = new Set<string>();
  const limited = [...new Set(recipe.sections.flatMap((section) => section.chunks))]
    .filter((id) => chunkOf(library, id).maxPerZone !== undefined)
    .sort();
  const randoms = recipe.sections.map((section) =>
    randomStream(seed, `section:${key}:${section.id}`),
  );
  const targets = recipe.sections.map((section) =>
    randomInt(
      randomStream(seed, `length:${key}:${section.id}`),
      section.length.min,
      section.length.max + 1,
    ),
  );
  const choose = (
    quietChunks: number,
    index: number,
    previous: string | undefined,
    remaining: number | undefined,
  ): boolean => {
    const section = recipe.sections[index];
    if (!section) {
      return remaining === undefined || remaining === 0;
    }
    const cap = index === 0 ? start : undefined;
    const end = index === recipe.sections.length - 1 ? finish : undefined;
    const needDoors = wanted(section.doors);
    const needEvents = wanted(section.events);
    const search = (
      quietChunks: number,
      ids: readonly string[],
      width: number,
      doors: number,
      events: number,
      remaining: number | undefined,
    ): boolean => {
      const prev = ids.at(-1) ?? (cap ? recipe.start : previous);
      const seam =
        ids.length > 0 || cap !== undefined ? chunkOf(library, prev ?? "").exit.row : undefined;
      const state = [
        index,
        width,
        prev ?? "",
        Math.min(doors, needDoors),
        Math.min(events, needEvents),
        ...(remaining === undefined
          ? []
          : [remaining, prev !== undefined && chunkOf(library, prev).encounters > 0]),
        ...(minimumGap > 0 ? [quietChunks] : []),
        ...limited.map((id) => counts.get(id) ?? 0),
      ].join(":");
      if (failed.has(state)) {
        return false;
      }
      const total = width + (end?.cols ?? 0);
      const finishSection = () => {
        if (
          ids.length === 0 ||
          total < section.length.min ||
          total > section.length.max ||
          (end !== undefined && seam !== end.entry.row) ||
          (end !== undefined && end.encounters > 0 && quietChunks < minimumGap) ||
          (end !== undefined &&
            remaining !== undefined &&
            (remaining !== 0 || !encounterFits(library, finish.encounters, prev, recipe.finish))) ||
          doors + (end ? slotCount(end, "door") : 0) < needDoors ||
          events + (end ? slotCount(end, "event") : 0) < needEvents
        ) {
          return false;
        }
        selected[index] = ids;
        return choose(quietChunks, index + 1, ids.at(-1), remaining);
      };
      if (total >= (targets[index] ?? section.length.min) && finishSection()) {
        return true;
      }
      const next = (pools[index] ?? []).filter((id) => {
        const chunk = chunkOf(library, id);
        return (
          id !== prev &&
          encounterFits(library, remaining, prev, id) &&
          (chunk.encounters === 0 || quietChunks >= minimumGap) &&
          (seam === undefined || chunk.entry.row === seam) &&
          (counts.get(id) ?? 0) < (chunk.maxPerZone ?? Infinity) &&
          width + chunk.cols + (end?.cols ?? 0) <= section.length.max &&
          (ids.length > 0 || cap !== undefined || section.spawnCol < chunk.cols)
        );
      });
      for (const id of weightedOrder(randoms[index]!, weights[index]!, next)) {
        const chunk = chunkOf(library, id);
        const count = counts.get(id) ?? 0;
        counts.set(id, count + 1);
        if (
          search(
            quietAfter(minimumGap, quietChunks, chunk.encounters),
            [...ids, id],
            width + chunk.cols,
            doors + slotCount(chunk, "door"),
            events + slotCount(chunk, "event"),
            remaining === undefined ? undefined : remaining - chunk.encounters,
          )
        ) {
          return true;
        }
        counts.set(id, count);
      }
      if (total < (targets[index] ?? section.length.min) && finishSection()) {
        return true;
      }
      failed.add(state);
      return false;
    };
    return search(
      quietChunks,
      [],
      cap?.cols ?? 0,
      cap ? slotCount(cap, "door") : 0,
      cap ? slotCount(cap, "event") : 0,
      remaining,
    );
  };
  if (
    (remaining !== undefined && remaining < 0) ||
    !choose(start.encounters > 0 ? 0 : minimumGap, 0, undefined, remaining)
  ) {
    return nothingFits(`No ordered assembly of stage ${key} fits its section pools and lengths`);
  }
  const order = recipe.sections.map(({ id }) => id);
  const areas = Object.fromEntries(
    recipe.sections.map((section, index) => {
      const middle = selected[index];
      if (!middle || middle.length === 0) {
        throw new Error(`No selected chunk for ${section.id}`);
      }
      const ids = [
        ...(index === 0 ? [recipe.start] : []),
        ...middle,
        ...(index === order.length - 1 ? [recipe.finish] : []),
      ];
      const single = applyStageGeometry(
        section,
        zonePlanOf(
          library,
          randomStream(seed, `slots:${key}:${section.id}`),
          fillsOf(section),
          section.theme,
          section.spawnCol,
          ids,
        ),
      ).areas[ASSEMBLED_AREA];
      if (!single) {
        throw new Error(`No assembled section ${section.id}`);
      }
      const previous = order[index - 1];
      const next = order[index + 1];
      const marker = (side: "left" | "right"): Instance => {
        const instance = bindElement(library.themes[section.theme]?.bindings ?? {}, {
          character: "",
          col: 0,
          role: recipe.transitionRoles[side],
          row: 0,
        });
        const character = library.characters[instance.character];
        if (
          !character ||
          character.cols > library.rules.footing ||
          character.rows > library.rules.headroom
        ) {
          throw new Error(`Transition marker ${instance.character} exceeds safe seam dimensions`);
        }
        const row =
          side === "left"
            ? chunkOf(library, ids[0] ?? "").entry.row
            : chunkOf(library, ids.at(-1) ?? "").exit.row;
        return {
          ...instance,
          col: side === "left" ? 0 : single.cols - character.cols,
          row: row - character.rows,
        };
      };
      return [
        section.id,
        {
          ...single,
          entries: {
            ...single.entries,
            return: { col: single.cols - 2, row: chunkOf(library, ids.at(-1) ?? "").exit.row },
          },
          objects: [
            ...single.objects,
            ...(previous !== undefined ? [marker("left")] : []),
            ...(next !== undefined ? [marker("right")] : []),
          ],
          walkLinks: {
            ...(previous !== undefined ? { left: { area: previous, entry: "return" } } : {}),
            ...(next !== undefined ? { right: { area: next, entry: START_ENTRY } } : {}),
          },
        },
      ];
    }),
  );
  return planned(
    applyStageGeometry(
      { ...(recipe.stageExit && { stageExit: recipe.stageExit }) },
      { areaOrder: order, areas, start: { area: order[0] ?? "", entry: START_ENTRY } },
    ),
  );
}

// The zone key's recipe assembled for a seed: its start chunk, a seeded run of its
// theme's chunks (searchRun), and its finish chunk, with the recipe's events and doors in
// seeded slots, or that nothing fits. The same seed always gives the same outcome.
export function assembleStage(
  library: ChunkLibrary,
  seed: number,
  key: string,
  recipe: StageRecipe,
): StageAssembly {
  if ("sections" in recipe) {
    const themes = Object.fromEntries(recipe.sections.map(({ id, theme }) => [id, theme]));
    const ordered = assembleOrdered(library, seed, key, recipe);
    return ordered.outcome === "nothing-fits"
      ? ordered
      : planned(
          withRoomBuildings(
            library,
            themes,
            withBackgroundSections(library, seed, key, themes, ordered.plan),
          ),
        );
  }
  if (recipe.chunks !== undefined) {
    const problems = chunkPoolProblems(library, recipe, recipe.chunks);
    if (problems.length > 0) {
      throw new Error(problems.join("; "));
    }
  }
  const rows = recipe.rows ?? library.rows;
  if (
    !validRows(rows) ||
    [recipe.start, recipe.finish].some((id) => chunkRows(library, chunkOf(library, id)) !== rows)
  ) {
    throw new Error("Recipe height must match its authored caps");
  }
  const arenaId = library.arenas?.[key];
  let predecessors: ReadonlySet<string> | undefined;
  if (recipe.arenaApproach !== undefined) {
    const problems = arenaApproachProblems(
      {
        arena: arenaId,
        eligible: eligibleChunks(library, recipe, recipeChunkPool(library, recipe)),
        stage: key,
      },
      recipe.arenaApproach,
      library.approaches?.[key],
    );
    if (problems.length > 0) {
      throw new Error(`${key}: ${problems.join("; ")}`);
    }
    predecessors = new Set(recipe.arenaApproach.predecessors);
  }
  const run =
    arenaId === undefined
      ? seededRun(library, seed, key, undefined, recipe)
      : arenaRun(library, seed, key, arenaId, predecessors, recipe);
  if (!run) {
    return nothingFits(
      `No assembly of zone ${key} fits its recipe: its theme's chunks never join from ` +
        `${recipe.start} to ${recipe.finish} within ${recipe.length.min} to ` +
        `${recipe.length.max} columns, the difficulty band and each chunk's maxPerZone, ` +
        "with slots for its events and doors",
    );
  }
  const themes = { [ASSEMBLED_AREA]: recipe.theme };
  const zone = zonePlanOf(
    library,
    randomStream(seed, `slots:${key}`),
    {
      ...fillsOf(recipe),
      start: recipe.start,
      ...(recipe.startDoors && { startDoors: recipe.startDoors }),
    },
    recipe.theme,
    recipe.spawnCol,
    [recipe.start, ...run, recipe.finish],
  );
  return planned(
    withRoomBuildings(
      library,
      themes,
      withBackgroundSections(library, seed, key, themes, applyStageGeometry(recipe, zone)),
    ),
  );
}

// The seam steps every run of the zone key's recipe takes, each as its sources: the pool chunks
// able to make it, in pool order. Judged on seam rows alone. A run is a walk over seam rows from
// the start's exit row to the finish's entry row, each chunk one step from its entry row to its
// exit row. A stage with an arena also walks to the arena's entry row, through one of its
// approach predecessors when it names them, and on from the arena's exit row. A step is required
// when such a walk exists with its chunks and none without them, such as each step of a single
// loop of rows and the chain that reaches an arena's approach. Its sources are those of its
// chunks that alone restore a walk: all of them, or only the approach predecessors where the step
// leads into the arena. Lengths, slots, encounters and maxPerZone are ignored, so every run
// holds a source of every step named. The cost is one pass over the pool for each step and each
// chunk of a required one.
export function requiredSteps(
  library: ChunkLibrary,
  key: string,
  recipe: ZoneRecipe,
): readonly (readonly string[])[] {
  const arenaId = library.arenas?.[key];
  const arena = arenaId === undefined ? undefined : chunkOf(library, arenaId);
  const predecessors = recipe.arenaApproach?.predecessors;
  const start = chunkOf(library, recipe.start);
  const finish = chunkOf(library, recipe.finish);
  // An arena's run draws only chunks without encounters (arenaRun).
  const steps = eligibleChunks(library, recipe, recipeChunkPool(library, recipe)).flatMap((id) => {
    const { encounters, entry, exit } = chunkOf(library, id);
    return arena !== undefined && (id === arenaId || encounters > 0)
      ? []
      : [{ entryRow: entry.row, exitRow: exit.row, id }];
  });
  type Step = (typeof steps)[number];
  // Whether the caps alone make a run: they join and fill the least length.
  const bare =
    recipe.start !== recipe.finish &&
    start.exit.row === finish.entry.row &&
    start.cols + finish.cols >= recipe.length.min - (arena?.cols ?? 0);
  // The rows a walk from row reaches, or with backward the rows a walk reaches row from.
  const reach = (walk: readonly Step[], backward: boolean, row: number) => {
    const rows = new Set([row]);
    for (let grew = true; grew;) {
      grew = false;
      for (const { entryRow, exitRow } of walk) {
        const [from, to] = backward ? [exitRow, entryRow] : [entryRow, exitRow];
        if (rows.has(from) && !rows.has(to)) {
          rows.add(to);
          grew = true;
        }
      }
    }
    return rows;
  };
  const fits = (walk: readonly Step[]) => {
    const fromStart = reach(walk, false, start.exit.row);
    const toFinish = reach(walk, true, finish.entry.row);
    if (
      !bare &&
      !walk.some(({ entryRow, exitRow }) => fromStart.has(entryRow) && toFinish.has(exitRow))
    ) {
      return false;
    }
    if (arena === undefined) {
      return true;
    }
    return (
      toFinish.has(arena.exit.row) &&
      (predecessors === undefined
        ? fromStart.has(arena.entry.row)
        : walk.some(
            ({ entryRow, exitRow, id }) =>
              predecessors.includes(id) && fromStart.has(entryRow) && exitRow === arena.entry.row,
          ))
    );
  };
  if (!fits(steps)) {
    return [];
  }
  const sharing = new Map<string, Step[]>();
  for (const step of steps) {
    const rows = `${step.entryRow}>${step.exitRow}`;
    sharing.set(rows, [...(sharing.get(rows) ?? []), step]);
  }
  return [...sharing.values()].flatMap((members) => {
    const others = steps.filter((step) => !members.includes(step));
    if (fits(others)) {
      return [];
    }
    const sources = members.filter((member) => fits([...others, member])).map(({ id }) => id);
    return sources.length > 0 ? [sources] : [];
  });
}

// The avoided chunks the narrowed pool of the zone key's recipe keeps: for each required step
// (requiredSteps) whose every source is avoided, the source avoided least recently, which is the
// one whose newest entry is oldest, the lowest id among equals.
function keptSources(
  library: ChunkLibrary,
  avoid: AvoidEntries,
  key: string,
  recipe: ZoneRecipe,
): ReadonlySet<string> {
  // The index of the newest entry that names each avoided chunk.
  const newest = new Map<string, number>();
  for (const [index, entry] of avoid.entries()) {
    for (const id of entry) {
      if (!newest.has(id)) {
        newest.set(id, index);
      }
    }
  }
  const kept = new Set<string>();
  for (const sources of requiredSteps(library, key, recipe)) {
    if (sources.every((id) => newest.has(id))) {
      kept.add(
        sources.reduce((oldest, id) => {
          const order = newest.get(id)! - newest.get(oldest)!;
          return order > 0 || (order === 0 && id < oldest) ? id : oldest;
        }),
      );
    }
  }
  return kept;
}

// Whether a stage's avoided chunks were left out of its plan ("honoured"), or no assembly fitted
// without them and every pool was used whole ("fallback").
export type Avoidance = "fallback" | "honoured";

// The chunks to avoid: the middle chunk ids of a zone's recent stage entries, one list an entry,
// newest first.
export type AvoidEntries = readonly (readonly string[])[];

// A zone assembled with chunks to avoid, or that nothing fits even with every pool whole.
export type AvoidingAssembly = NothingFits | (PlannedAssembly & { readonly avoidance: Avoidance });

// assembleStage, first with the avoided chunks left out of every middle pool, then, when no
// assembly fits without them, with every pool whole. Where every source of a step a flat recipe
// cannot do without is avoided, the pool keeps the one avoided least recently (keptSources), so
// a step with one source always keeps it and a step with several takes them in turn. An ordered
// stage's section pools keep none. Deterministic in (seed, avoid). Recency across stages passes
// the zone's recent stage entries; no entry, or none that names a chunk, assembles as
// assembleStage and counts as honoured. Only the outcome that nothing fits falls back: a narrowed
// pool that is no valid pool, or nothing fitting the narrowed pools. Errors are thrown on.
export function assembleZoneAvoiding(
  library: ChunkLibrary,
  avoid: AvoidEntries,
  seed: number,
  key: string,
  recipe: StageRecipe,
): AvoidingAssembly {
  const avoided = new Set(avoid.flat());
  const whole = (avoidance: Avoidance): AvoidingAssembly => {
    const assembly = assembleStage(library, seed, key, recipe);
    return assembly.outcome === "planned" ? { ...assembly, avoidance } : assembly;
  };
  if (avoided.size === 0) {
    return whole("honoured");
  }
  let narrowed: StageRecipe;
  let valid: boolean;
  if ("sections" in recipe) {
    narrowed = {
      ...recipe,
      sections: recipe.sections.map((section) => ({
        ...section,
        chunks: section.chunks.filter((id) => !avoided.has(id)),
      })),
    };
    valid = orderedRecipeProblems(library, narrowed).length === 0;
  } else {
    const kept = keptSources(library, avoid, key, recipe);
    const chunks = recipeChunkPool(library, recipe).filter(
      (id) => !avoided.has(id) || kept.has(id),
    );
    narrowed = { ...recipe, chunks };
    valid = chunks.length > 0;
  }
  const honoured = valid ? assembleStage(library, seed, key, narrowed) : undefined;
  return honoured?.outcome === "planned"
    ? { ...honoured, avoidance: "honoured" }
    : whole("fallback");
}
