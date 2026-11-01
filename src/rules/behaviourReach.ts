import type { BirdTuning, ObjectLayout, Point, Rect } from "../data/types";
import { birdBox, type BirdState, EDGE } from "./bird";
import { collisionCandidates } from "./collisionIndex";
import { overlaps } from "./rect";

export interface BehaviourPlatform {
  readonly collision: "ledge" | "solid";
  readonly owner: ObjectLayout;
  readonly rect: Rect;
}
export interface BehaviourWorld {
  readonly view?: Rect;
  readonly platforms?: readonly BehaviourPlatform[];
  readonly solids: readonly Rect[];
}
export type BehaviourGeometry = readonly Rect[] | BehaviourWorld;
export function behaviourWorld(geometry: BehaviourGeometry): BehaviourWorld {
  return "solids" in geometry ? geometry : { solids: geometry };
}

export interface BehaviourTrack {
  readonly axis: "x" | "y";
  readonly distance: number;
  readonly origin?: Point;
}

type Span = readonly [number, number];
interface Corridor {
  readonly floors: readonly Span[];
  readonly cuts: readonly Span[];
  readonly allowed: readonly Span[];
}
const CACHE_LIMIT = 8;
const CACHE = new WeakMap<readonly Rect[], WeakMap<ObjectLayout, Map<string, Corridor>>>();

function union(spans: readonly Span[]): Span[] {
  const result: [number, number][] = [];
  for (const [left, right] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1);
    if (last && left <= last[1] + EDGE) {
      last[1] = Math.max(last[1], right);
    } else {
      result.push([left, right]);
    }
  }
  return result;
}
function allowedOrigins(floors: readonly Span[], cuts: readonly Span[], box: Rect): Span[] {
  let spans: Span[] = floors
    .map(([left, right]): Span => [left - box.x, right - box.x - box.width])
    .filter(([left, right]) => right >= left);
  for (const [from, to] of cuts) {
    const next: Span[] = [];
    for (const [left, right] of spans) {
      if (from >= right || to <= left) {
        next.push([left, right]);
      } else {
        if (from >= left) {
          next.push([left, from]);
        }
        if (to <= right) {
          next.push([to, right]);
        }
      }
    }
    spans = next;
  }
  return spans;
}
function blocksAtFloor(rect: Rect, box: Rect): boolean {
  return rect.y < box.y + box.height - EDGE && rect.y + rect.height > box.y + EDGE;
}
function staticCorridor(
  object: ObjectLayout,
  world: BehaviourWorld,
  floor: number,
  tolerance: number,
  track: BehaviourTrack,
  box: Rect,
): Corridor {
  let objects = CACHE.get(world.solids);
  if (!objects) {
    objects = new WeakMap();
    CACHE.set(world.solids, objects);
  }
  let entries = objects.get(object);
  if (!entries) {
    entries = new Map();
    objects.set(object, entries);
  }
  const key = [
    floor,
    tolerance,
    track.origin?.x ?? object.origin.x,
    track.distance,
    box.x,
    box.y,
    box.width,
    box.height,
  ].join(":");
  const cached = entries.get(key);
  if (cached) {
    return cached;
  }
  const origin = track.origin ?? object.origin;
  const low = Math.min(origin.x, origin.x + track.distance);
  const high = Math.max(origin.x, origin.x + track.distance);
  const top = Math.min(box.y, floor - tolerance - EDGE);
  const bottom = Math.max(box.y + box.height, floor + tolerance + EDGE);
  const solids = collisionCandidates(world.solids, {
    height: bottom - top,
    width: high - low + box.width + 2 * EDGE,
    x: low + box.x - EDGE,
    y: top,
  });
  const floors = union(
    solids
      .filter((rect) => Math.abs(rect.y - floor) <= tolerance + EDGE)
      .map((rect): Span => [rect.x, rect.x + rect.width]),
  );
  const cuts = solids
    .filter((rect) => blocksAtFloor(rect, box))
    .map((rect): Span => [rect.x - box.x - box.width, rect.x + rect.width - box.x]);
  const result = { allowed: allowedOrigins(floors, cuts, box), cuts, floors };
  if (entries.size >= CACHE_LIMIT) {
    const first = entries.keys().next().value;
    if (first !== undefined) {
      entries.delete(first);
    }
  }
  entries.set(key, result);
  return result;
}

function supportY(
  world: BehaviourWorld,
  owner: ObjectLayout,
  body: Rect,
  tolerance: number,
): number | undefined {
  let top = Infinity;
  const feet = body.y + body.height;
  const consider = (rect: Rect) => {
    if (
      rect.y >= feet - tolerance - EDGE &&
      rect.x < body.x + body.width &&
      body.x < rect.x + rect.width
    ) {
      top = Math.min(top, rect.y);
    }
  };
  for (const rect of collisionCandidates(world.solids, {
    height: Infinity,
    width: body.width,
    x: body.x,
    y: feet - tolerance - EDGE,
  })) {
    consider(rect);
  }
  for (const platform of world.platforms ?? []) {
    if (platform.owner !== owner) {
      consider(platform.rect);
    }
  }
  return top === Infinity ? undefined : top;
}

// This is a direct support/clearance query, not a path search. Spatial tolerance is data-owned.
export function targetReachable(
  tuning: BirdTuning,
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  box: Rect,
  groundY: number,
  tolerance: number,
  track: BehaviourTrack | undefined,
  bird: BirdState,
): boolean {
  const plan = track;
  if (!plan) {
    return false;
  }
  const hers = birdBox(tuning, bird);
  const origin = plan.origin ?? object.origin;
  const low = Math.min(origin[plan.axis], origin[plan.axis] + plan.distance);
  const high = Math.max(origin[plan.axis], origin[plan.axis] + plan.distance);
  const offset = box[plan.axis] - at[plan.axis];
  const length = plan.axis === "x" ? box.width : box.height;
  if (
    hers[plan.axis] >= high + offset + length ||
    hers[plan.axis] + (plan.axis === "x" ? hers.width : hers.height) <= low + offset
  ) {
    return false;
  }
  if (plan.axis === "y") {
    if (hers.x >= box.x + box.width + tolerance || hers.x + hers.width <= box.x - tolerance) {
      return false;
    }
    const nearest = Math.max(
      low,
      Math.min(
        high,
        Math.max(
          hers.y - offset - length + EDGE,
          Math.min(at.y, hers.y + hers.height - offset - EDGE),
        ),
      ),
    );
    const sweep = {
      ...box,
      height: box.height + Math.abs(nearest - at.y),
      y: Math.min(box.y, box.y + nearest - at.y),
    };
    return (
      !collisionCandidates(world.solids, sweep).some((solid) => overlaps(sweep, solid)) &&
      !(world.platforms ?? []).some(
        (platform) =>
          platform.owner !== object &&
          platform.collision === "solid" &&
          overlaps(sweep, platform.rect),
      )
    );
  }
  const floor = groundY + object.height;
  const support = supportY(world, object, hers, tolerance);
  if (
    support === undefined ||
    Math.abs(support - floor) > tolerance + EDGE ||
    (bird.grounded && Math.abs(support - hers.y - hers.height) > tolerance + EDGE)
  ) {
    return false;
  }
  const baselineBox = { ...box, x: box.x - at.x, y: box.y - at.y + groundY };
  const spans = groundSpans(object, world, floor, tolerance, plan, baselineBox);
  for (const [left, right] of spans) {
    const from = Math.max(low, left);
    const to = Math.min(high, right);
    if (
      at.x >= from - EDGE &&
      at.x <= to + EDGE &&
      hers.x < to + baselineBox.x + box.width &&
      hers.x + hers.width > from + baselineBox.x
    ) {
      return true;
    }
  }
  return false;
}

function groundSpans(
  object: ObjectLayout,
  world: BehaviourWorld,
  floor: number,
  tolerance: number,
  track: BehaviourTrack,
  baselineBox: Rect,
): readonly Span[] {
  const cached = staticCorridor(object, world, floor, tolerance, track, baselineBox);
  const floors: Span[] = [];
  const cuts: Span[] = [];
  for (const platform of world.platforms ?? []) {
    if (platform.owner === object) {
      continue;
    }
    const rect = platform.rect;
    if (Math.abs(rect.y - floor) <= tolerance + EDGE) {
      floors.push([rect.x, rect.x + rect.width]);
    }
    if (platform.collision === "solid" && blocksAtFloor(rect, baselineBox)) {
      cuts.push([rect.x - baselineBox.x - baselineBox.width, rect.x + rect.width - baselineBox.x]);
    }
  }
  return floors.length === 0 && cuts.length === 0
    ? cached.allowed
    : allowedOrigins(union([...cached.floors, ...floors]), [...cached.cuts, ...cuts], baselineBox);
}

// Stop at the edge of connected support; pursuit never adds jumping or falling physics.
export function groundPursuitEnd(
  object: ObjectLayout,
  world: BehaviourWorld,
  track: BehaviourTrack,
  at: Point,
  box: Rect,
  desired: number,
): number {
  const baseline = { ...box, x: box.x - at.x };
  const spans = groundSpans(object, world, at.y + object.height, EDGE, track, baseline);
  const origin = track.origin ?? object.origin;
  const low = Math.min(origin.x, origin.x + track.distance);
  const high = Math.max(origin.x, origin.x + track.distance);
  for (const [left, right] of spans) {
    const from = Math.max(low, left);
    const to = Math.min(high, right);
    if (at.x >= from - EDGE && at.x <= to + EDGE) {
      return Math.max(from, Math.min(to, desired));
    }
  }
  return at.x;
}
