import { rectsOverlap } from "@andornaut/game-kit/rect";

import type { RandomStreams } from "../ai/randomStreams";
import type {
  AreaLayout,
  BirdTuning,
  ObjectLayout,
  Point,
  Rect,
  TargetedAttackWindow,
} from "../data/types";
import { birdBox, type BirdState, EDGE } from "./bird";
import { collisionCandidates } from "./collisionIndex";
import type { TimedHazardSampler } from "./timedHazard";

export interface BehaviourPlatform {
  readonly collision: "ledge" | "solid";
  readonly owner: ObjectLayout;
  readonly rect: Rect;
}
export interface BehaviourPlatformFrame {
  readonly after: Rect;
  readonly before: Rect;
  readonly collision: "ledge" | "solid";
  readonly owner: ObjectLayout;
  readonly segments?: readonly {
    readonly endSeconds: number;
    readonly from: Rect;
    readonly startSeconds: number;
    readonly to: Rect;
  }[];
}

// Crumbling collider presence for predictions: a phase key for plan caches, and the support
// volumes whose presence is unknown for a tick starting at timeSeconds.
export interface CrumblingPrediction {
  readonly key: string;
  readonly unknown: (timeSeconds: number) => readonly Rect[];
}

export interface BehaviourTraversalFrame {
  readonly crumbling?: CrumblingPrediction;
  readonly sample?: (
    timeSeconds: number,
    dtSeconds: number,
  ) => readonly BehaviourPlatformFrame[] | undefined;
  readonly bounds: Rect;
  readonly dtSeconds: number;
  readonly platforms: readonly BehaviourPlatformFrame[];
  readonly timeSeconds: number;
}

export interface BehaviourWorld {
  readonly targetedAttackWindow?: TargetedAttackWindow;
  // Object-local decision streams; equal keys replay equal draws.
  readonly decisions?: RandomStreams;
  readonly chunks?: AreaLayout["chunks"];
  readonly traversalFrame?: BehaviourTraversalFrame;
  readonly hazards?: readonly {
    readonly owner: ObjectLayout;
    readonly rect: Rect;
    readonly timedContacts?: TimedHazardSampler;
    // Certified occupancy through this absolute time; undefined keeps future geometry unknown.
    readonly boundsAt?: (endSeconds: number) => Rect | undefined;
  }[];
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
      !collisionCandidates(world.solids, sweep).some((solid) => rectsOverlap(sweep, solid)) &&
      !(world.platforms ?? []).some(
        (platform) =>
          platform.owner !== object &&
          platform.collision === "solid" &&
          rectsOverlap(sweep, platform.rect),
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
  const spans = groundSpans(object, world, floor, tolerance, plan, baselineBox, true);
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
  walls: boolean,
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
    if (walls && platform.collision === "solid" && blocksAtFloor(rect, baselineBox)) {
      cuts.push([rect.x - baselineBox.x - baselineBox.width, rect.x + rect.width - baselineBox.x]);
    }
  }
  if (!walls) {
    return allowedOrigins(union([...cached.floors, ...floors]), [], baselineBox);
  }
  return floors.length === 0 && cuts.length === 0
    ? cached.allowed
    : allowedOrigins(union([...cached.floors, ...floors]), [...cached.cuts, ...cuts], baselineBox);
}

function spanEnd(
  object: ObjectLayout,
  spans: readonly Span[],
  track: BehaviourTrack,
  at: Point,
  desired: number,
): number {
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
  return spanEnd(
    object,
    groundSpans(object, world, at.y + object.height, EDGE, track, baseline, true),
    track,
    at,
    desired,
  );
}

// Stop where the box would leave connected support, ignoring walls; without support under the
// box it does not travel.
export function groundSupportEnd(
  object: ObjectLayout,
  world: BehaviourWorld,
  track: BehaviourTrack,
  at: Point,
  box: Rect,
  desired: number,
): number {
  const baseline = { ...box, x: box.x - at.x };
  return spanEnd(
    object,
    groundSpans(object, world, at.y + object.height, EDGE, track, baseline, false),
    track,
    at,
    desired,
  );
}

// Axis-separated swept clipping prevents flight from crossing solid cover.
// A clipped physical approach can make contact before the two body centres coincide.
export function flightContactApproach(
  world: BehaviourWorld,
  object: ObjectLayout,
  at: Point,
  contact: Rect,
  target: Rect,
): Point | undefined {
  const x = target.x + target.width / 2 - contact.width / 2 - (contact.x - at.x);
  const y = target.y + target.height / 2 - contact.height / 2 - (contact.y - at.y);
  const across = { x: flightAxis(object, world, at, "x", x), y: at.y };
  const end = { x: across.x, y: flightAxis(object, world, across, "y", y) };
  const body = { ...end, height: object.height, width: object.width };
  const solids = [
    ...collisionCandidates(world.solids, body),
    ...(world.platforms ?? [])
      .filter(({ collision, owner }) => collision === "solid" && owner !== object)
      .map(({ rect }) => rect),
  ];
  if (solids.some((rect) => rectsOverlap(body, rect))) {
    return undefined;
  }
  const points = [at, across, end];
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]!,
      to = points[index]!;
    const sweep = {
      height: object.height + Math.abs(to.y - from.y),
      width: object.width + Math.abs(to.x - from.x),
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
    };
    if (
      (world.hazards ?? []).some(({ owner, rect }) => owner !== object && rectsOverlap(sweep, rect))
    ) {
      return undefined;
    }
  }
  return rectsOverlap(
    { ...contact, x: contact.x + end.x - at.x, y: contact.y + end.y - at.y },
    target,
  )
    ? end
    : undefined;
}

export function flightAxis(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  axis: "x" | "y",
  desired: number,
): number {
  let to = desired;
  const across = axis === "x" ? "y" : "x";
  const depth = axis === "x" ? "height" : "width";
  const length = axis === "x" ? "width" : "height";
  const start = Math.min(at[axis], desired) - EDGE;
  const extent = object[length] + Math.abs(desired - at[axis]) + 2 * EDGE;
  const sweep =
    axis === "x"
      ? { height: object.height, width: extent, x: start, y: at.y }
      : { height: extent, width: object.width, x: at.x, y: start };
  const clip = (solid: Rect) => {
    // Contact within EDGE across the travel is beside the solid, not over it.
    if (
      at[across] >= solid[across] + solid[depth] - EDGE ||
      at[across] + object[depth] <= solid[across] + EDGE
    ) {
      return;
    }
    if (desired > at[axis] && at[axis] + object[length] <= solid[axis] + EDGE) {
      to = Math.min(to, solid[axis] - object[length]);
    }
    if (desired < at[axis] && at[axis] >= solid[axis] + solid[length] - EDGE) {
      to = Math.max(to, solid[axis] + solid[length]);
    }
  };
  for (const solid of collisionCandidates(world.solids, sweep)) {
    clip(solid);
  }
  for (const platform of world.platforms ?? []) {
    if (platform.owner !== object && platform.collision === "solid") {
      clip(platform.rect);
    }
  }
  return to;
}

export function overheadFlightGoal(
  tuning: BirdTuning,
  overhead: { readonly ahead: number; readonly clearance: number },
  direction: -1 | 1,
  bird: BirdState,
  object: ObjectLayout,
): Point {
  return overheadFlightGoalForRect(overhead, direction, birdBox(tuning, bird), object);
}

export function overheadFlightGoalForRect(
  overhead: { readonly ahead: number; readonly clearance: number },
  direction: -1 | 1,
  target: Rect,
  object: ObjectLayout,
): Point {
  return {
    x: target.x + target.width / 2 + direction * overhead.ahead - object.width / 2,
    y: target.y - overhead.clearance - object.height,
  };
}

// Prove ascent before lateral travel with the same full-body swept clipping used by flight.
export function overheadFlightRoute(
  world: BehaviourWorld,
  object: ObjectLayout,
  at: Point,
  target: Point,
): readonly Point[] | undefined {
  const bounds = world.traversalFrame?.bounds;
  const distance = object.behaviour?.pursuit?.distance;
  if (
    !bounds ||
    distance === undefined ||
    target.x < Math.max(bounds.x, object.origin.x - distance) - EDGE ||
    target.x >
      Math.min(bounds.x + bounds.width - object.width, object.origin.x + distance) + EDGE ||
    target.y < bounds.y - EDGE ||
    target.y + object.height > bounds.y + bounds.height + EDGE
  ) {
    return undefined;
  }
  const above = { x: at.x, y: target.y };
  if (
    Math.abs(flightAxis(object, world, at, "y", above.y) - above.y) > EDGE ||
    Math.abs(flightAxis(object, world, above, "x", target.x) - target.x) > EDGE
  ) {
    return undefined;
  }
  const points = [at, above, target];
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]!,
      to = points[index]!;
    const sweep = {
      height: object.height + Math.abs(to.y - from.y),
      width: object.width + Math.abs(to.x - from.x),
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
    };
    if (
      (world.hazards ?? []).some(({ owner, rect }) => owner !== object && rectsOverlap(sweep, rect))
    ) {
      return undefined;
    }
  }
  return [above, target];
}
