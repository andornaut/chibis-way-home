import type { Rect } from "../data/types";

// Immutable terrain arrays retain one bounded horizontal broadphase index. Oversized rectangles
// stay in every query without being duplicated across unbounded numbers of buckets.
const CELL = 128;
const MAX_CELLS = 256;
const MAX_QUERIES = 128;
interface Index {
  readonly buckets: ReadonlyMap<number, readonly number[]>;
  readonly queries: Map<number, readonly Rect[]>;
  readonly wide: readonly number[];
}
const INDICES = new WeakMap<readonly Rect[], Index>();

function indexOf(rects: readonly Rect[]): Index {
  const cached = INDICES.get(rects);
  if (cached) {
    return cached;
  }
  const buckets = new Map<number, number[]>();
  const wide: number[] = [];
  rects.forEach((rect, index) => {
    const first = Math.floor(rect.x / CELL);
    const last = Math.floor((rect.x + rect.width) / CELL);
    if (!Number.isFinite(first) || !Number.isFinite(last) || last - first > MAX_CELLS) {
      wide.push(index);
      return;
    }
    for (let cell = first; cell <= last; cell++) {
      const entries = buckets.get(cell) ?? [];
      entries.push(index);
      buckets.set(cell, entries);
    }
  });
  const result = { buckets, queries: new Map<number, readonly Rect[]>(), wide };
  INDICES.set(rects, result);
  return result;
}

// Closed bounds include edge contacts and preserve references/order for the existing exact
// predicates. Call only with immutable terrain, never a freshly rebuilt dynamic collider array.
export function collisionCandidates(rects: readonly Rect[], bounds: Rect): readonly Rect[] {
  const first = Math.floor(bounds.x / CELL);
  const last = Math.floor((bounds.x + bounds.width) / CELL);
  if (!Number.isFinite(first) || !Number.isFinite(last) || bounds.width < 0 || bounds.height < 0) {
    return rects;
  }
  const index = indexOf(rects);
  // Every rectangle is a candidate superset of the bucket selection, so wide or distant spans
  // share one key and numeric keys stay exact.
  const narrow = last - first <= MAX_CELLS && Math.abs(first) <= 2 ** 40;
  const key = narrow ? first * (2 * MAX_CELLS) + (last - first) : Infinity;
  let candidates = index.queries.get(key);
  if (!candidates) {
    if (!narrow) {
      candidates = rects;
    } else {
      const selected = new Set(index.wide);
      for (let cell = first; cell <= last; cell++) {
        for (const entry of index.buckets.get(cell) ?? []) {
          selected.add(entry);
        }
      }
      candidates = [...selected].sort((a, b) => a - b).map((entry) => rects[entry]!);
    }
    if (index.queries.size >= MAX_QUERIES) {
      index.queries.delete(index.queries.keys().next().value!);
    }
    index.queries.set(key, candidates);
  }
  return candidates.filter(
    (rect) =>
      rect.x <= bounds.x + bounds.width &&
      rect.x + rect.width >= bounds.x &&
      rect.y <= bounds.y + bounds.height &&
      rect.y + rect.height >= bounds.y,
  );
}
