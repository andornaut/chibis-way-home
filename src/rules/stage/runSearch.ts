import type { Random } from "@andornaut/game-kit/runtime/random";

import type { ChunkPlan, ZoneRecipe } from "../../data/types/index.ts";

// A run search's pool, bounds and uses, and the tests it makes at each node: whether a state is
// hopeless, its failed-state key, the candidates that may follow the run, and whether the finish
// may end it.

// A pool chunk with the facts the search reads at every node.
export interface PoolChunk {
  // Its equivalence class: chunks alike in every fact the search tests share one.
  readonly class: number;
  // Whether it closes a loop: it returns to the start's exit row from another seam row.
  readonly closes: boolean;
  readonly cols: number;
  readonly doors: number;
  readonly encounters: number;
  readonly entryRow: number;
  readonly events: number;
  readonly exitRow: number;
  readonly id: string;
  // The exponent of its weighted-order key: 1 / its draw weight.
  readonly keyPower: number;
  // Its slot in the counts array, or -1 when it has no maxPerZone.
  readonly limit: number;
  readonly maxPerZone: number;
}

// A chunk a run must hold at one middle index.
export interface Pinned {
  readonly predecessors?: ReadonlySet<string>;
  readonly at: number;
  readonly chunk: string;
}

// One search's pool and bounds, and the uses its run so far makes of the pool: each limited
// chunk's count and its key codes, each limited class's histogram of member uses (flattened:
// histogramAt[class] + uses - 1) and its members used at least once, and the quiet chunks,
// encounter chunks and encounters the unused chunks still hold.
export interface RunSearch {
  readonly chunks: readonly PoolChunk[];
  readonly classCaps: readonly number[];
  readonly classSizes: readonly number[];
  readonly counts: Int32Array;
  readonly countsCodes: number[];
  encounterChunksLeft: number;
  encountersLeft: number;
  readonly exact: boolean;
  readonly finish: ChunkPlan;
  readonly finishCols: number;
  readonly finishDoors: number;
  readonly finishEvents: number;
  readonly histogram: Int32Array;
  readonly histogramAt: readonly number[];
  // The run so far: pool indexes after the start.
  readonly ids: number[];
  // Weighted-order keys by pool index, read only while sorting one node's candidates.
  readonly keys: Float64Array;
  readonly limitedClasses: readonly number[];
  readonly limits: number;
  readonly loopCap: number | undefined;
  readonly max: number;
  readonly maxCols: number;
  readonly maxDoors: number;
  readonly maxEncounters: number;
  readonly maxEvents: number;
  readonly min: number;
  readonly minCols: number;
  readonly minimumGap: number;
  readonly needDoors: number;
  readonly needEvents: number;
  readonly pinned: Pinned | undefined;
  quietLeft: number;
  readonly recipe: ZoneRecipe;
  // The fewest pool chunks that join a seam row to the finish's entry row, by row.
  readonly toFinish: ReadonlyMap<number, number>;
  readonly usedMembers: Int32Array;
}

// Adds a chunk to the run's uses, or with step -1 removes it.
export function useChunk(run: RunSearch, chunk: PoolChunk, step: 1 | -1): void {
  const { counts, countsCodes, histogram, histogramAt, usedMembers } = run;
  if (chunk.limit < 0) {
    return;
  }
  const at = histogramAt[chunk.class]!;
  const before = counts[chunk.limit]!;
  if (before === 0 || before + step === 0) {
    usedMembers[chunk.class]! += step;
  }
  if (before > 0) {
    histogram[at + before - 1]!--;
  }
  counts[chunk.limit] = before + step;
  countsCodes[chunk.limit] = counts[chunk.limit]!;
  if (before + step > 0) {
    histogram[at + before + step - 1]!++;
  }
  if (chunk.encounters === 0) {
    run.quietLeft -= step;
  } else {
    run.encounterChunksLeft -= step;
    run.encountersLeft -= step * chunk.encounters;
  }
}

// Whether no run of the unused chunks can finish from this state: too few columns to reach the
// finish's seam row, too few slots, encounters or chunks left, or the encounters cannot be
// spaced within the columns left.
export function hopeless(
  run: RunSearch,
  width: number,
  events: number,
  doors: number,
  remaining: number | undefined,
  quietChunks: number,
  prevEncounters: number,
  exitRow: number,
): boolean {
  const { encounterChunksLeft, encountersLeft, finish, finishCols, finishDoors, finishEvents } =
    run;
  const { max, maxCols, maxDoors, maxEncounters, maxEvents, min, minCols, minimumGap } = run;
  const { needDoors, needEvents, quietLeft, toFinish } = run;
  const room = max - width - finishCols;
  const most = Math.floor(room / minCols);
  const least = Math.max(0, Math.ceil((min - width - finishCols) / maxCols));
  if (
    (toFinish.get(exitRow) ?? Infinity) > most ||
    needEvents - events - finishEvents > most * maxEvents ||
    needDoors - doors - finishDoors > most * maxDoors
  ) {
    return true;
  }
  if (remaining === undefined) {
    return least > quietLeft + encounterChunksLeft;
  }
  if (least > quietLeft + Math.min(remaining, encounterChunksLeft)) {
    return true;
  }
  if (remaining === 0) {
    return false;
  }
  if (remaining > encountersLeft) {
    return true;
  }
  // Encounter chunks never touch under a quota, and stand minimumGap quiet chunks apart.
  const placed = Math.ceil(remaining / maxEncounters);
  const apart = Math.max(minimumGap, 1);
  const quiet =
    Math.max(minimumGap - quietChunks, prevEncounters > 0 ? 1 : 0) +
    (placed - 1) * apart +
    (finish.encounters > 0 ? apart : 0);
  return quiet > quietLeft || placed + quiet > most;
}

// A class's key when it holds unused members enough for every chunk a run can still place.
const SATURATED = 0xffff;

// The failed-state key. Exact: the last chunk (-1 for the start) and each limited chunk's
// uses. Class: the last chunk's class (-1 for the start) and its uses, and each limited
// class's use histogram unless the class is saturated.
export function failedKey(
  run: RunSearch,
  width: number,
  last: number,
  events: number,
  doors: number,
  remaining: number | undefined,
  quietChunks: number,
  loops: number,
): string {
  const { chunks, classCaps, classSizes, counts, countsCodes, exact, finishCols } = run;
  const { histogram, histogramAt, ids, limitedClasses, loopCap, max, minCols } = run;
  const { minimumGap, needDoors, needEvents, pinned, usedMembers } = run;
  const lastChunk = last < 0 ? undefined : chunks[last]!;
  let key = exact
    ? `${width}|${last}`
    : `${width}|${lastChunk ? lastChunk.class : -1}|` +
      `${lastChunk && lastChunk.limit >= 0 ? counts[lastChunk.limit] : 0}`;
  key += `|${Math.min(events, needEvents)}|${Math.min(doors, needDoors)}`;
  if (remaining !== undefined) {
    key += `|${remaining}`;
  }
  if (minimumGap > 0) {
    key += `|${quietChunks}`;
  }
  if (pinned) {
    key += `|${Math.min(ids.length, 2 * pinned.at + 2)}`;
  }
  if (loopCap !== undefined) {
    key += `|${loops}`;
  }
  if (exact) {
    // A fixed-length tail of one character per count.
    return [key, String.fromCharCode(...countsCodes)].join("|");
  }
  // Per limited class, its histogram, or SATURATED when its unused members alone can fill
  // every chunk a run can still place: no future run then exhausts it, and any run maps onto
  // its unused members, so its uses do not change whether the state can finish.
  const most = Math.floor((max - width - finishCols) / minCols);
  const tail: number[] = [];
  for (const classId of limitedClasses) {
    if (classSizes[classId]! - usedMembers[classId]! >= most) {
      tail.push(SATURATED);
    } else {
      const at = histogramAt[classId]!;
      for (let uses = 0; uses < classCaps[classId]!; uses++) {
        tail.push(histogram[at + uses]!);
      }
    }
  }
  return `${key}|${String.fromCharCode(...tail)}`;
}

// Why a pool chunk may not follow the run's last one, if it may not:
// - approach: the arena's approach predecessors must come right before it.
// - encounter-gap: too few quiet chunks since the last encounter.
// - encounter-quota: over the remaining encounter quota, or touching the last encounter chunk.
// - length: past the recipe's length with the finish.
// - loop-cap: it closes a loop past the recipe's loop cap.
// - max-per-zone: its maxPerZone uses are spent.
// - pin: the pinned chunk belongs at its pinned index, and only there.
// - repeat: it is the last chunk.
// - seam: its entry row is not the run's exit row.
type CandidateRefusal =
  | "approach"
  | "encounter-gap"
  | "encounter-quota"
  | "length"
  | "loop-cap"
  | "max-per-zone"
  | "pin"
  | "repeat"
  | "seam";

// The one admission test of a candidate chunk, at pool index `index`, after the run's last one.
function candidateRefusal(
  run: RunSearch,
  width: number,
  last: number,
  exitRow: number,
  remaining: number | undefined,
  quietChunks: number,
  prevEncounters: number,
  loops: number,
  index: number,
): CandidateRefusal | undefined {
  const { chunks, counts, finishCols, ids, loopCap, max, minimumGap, pinned } = run;
  const chunk = chunks[index]!;
  const prev = last < 0 ? undefined : chunks[last]!;
  if (index === last) {
    return "repeat";
  }
  if (pinned !== undefined && (chunk.id === pinned.chunk) !== (ids.length === pinned.at)) {
    return "pin";
  }
  if (
    pinned?.predecessors !== undefined &&
    ((ids.length === pinned.at - 1 && !pinned.predecessors.has(chunk.id)) ||
      (ids.length === pinned.at && (prev === undefined || !pinned.predecessors.has(prev.id))))
  ) {
    return "approach";
  }
  if (
    remaining !== undefined &&
    (chunk.encounters > remaining || (chunk.encounters !== 0 && prevEncounters !== 0))
  ) {
    return "encounter-quota";
  }
  if (chunk.encounters !== 0 && quietChunks < minimumGap) {
    return "encounter-gap";
  }
  if (chunk.entryRow !== exitRow) {
    return "seam";
  }
  if (loopCap !== undefined && chunk.closes && loops >= loopCap) {
    return "loop-cap";
  }
  if (chunk.limit >= 0 && counts[chunk.limit]! >= chunk.maxPerZone) {
    return "max-per-zone";
  }
  return width + chunk.cols + finishCols > max ? "length" : undefined;
}

// The chunks that may follow the run's last one (candidateRefusal), in the node's seeded
// weighted order. Draws one key per candidate, in pool order.
export function candidateOrder(
  run: RunSearch,
  random: Random,
  width: number,
  last: number,
  exitRow: number,
  remaining: number | undefined,
  quietChunks: number,
  prevEncounters: number,
  loops: number,
): number[] {
  const { chunks, keys } = run;
  const order: number[] = [];
  for (let index = 0; index < chunks.length; index++) {
    const refusal = candidateRefusal(
      run,
      width,
      last,
      exitRow,
      remaining,
      quietChunks,
      prevEncounters,
      loops,
      index,
    );
    if (refusal === undefined) {
      keys[index] = random() ** chunks[index]!.keyPower;
      order.push(index);
    }
  }
  order.sort((a, b) => keys[b]! - keys[a]!);
  return order;
}

// Whether the finish can end the run here: joined at the seam, not after another finish,
// within the recipe's length, the encounter quota and spacing, its slots, and the pin.
export function finishesHere(
  run: RunSearch,
  width: number,
  events: number,
  doors: number,
  remaining: number | undefined,
  quietChunks: number,
  prevEncounters: number,
  exitRow: number,
): boolean {
  const { chunks, finish, finishCols, finishDoors, finishEvents, ids, max, min } = run;
  const { minimumGap, needDoors, needEvents, pinned, recipe } = run;
  const last = ids.length === 0 ? -1 : ids[ids.length - 1]!;
  const prev = last < 0 ? undefined : chunks[last]!;
  return (
    (prev ? prev.id : recipe.start) !== recipe.finish &&
    exitRow === finish.entry.row &&
    width + finishCols >= min &&
    width + finishCols <= max &&
    (finish.encounters === 0 || quietChunks >= minimumGap) &&
    (remaining === undefined ||
      (remaining === 0 && (finish.encounters === 0 || prevEncounters === 0))) &&
    events + finishEvents >= needEvents &&
    doors + finishDoors >= needDoors &&
    (pinned === undefined || (ids.length > pinned.at && Math.floor(ids.length / 2) <= pinned.at))
  );
}
