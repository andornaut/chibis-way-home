import { EDGE } from "../core";
import type { BehaviourMotion, ObjectLayout, Point, Rect } from "../data/types";
import { supportedDestinations } from "./behaviourDestinations";
import { type BehaviourWorld, flightAxis } from "./behaviourReach";
import { supportedLanding } from "./flyLanding";

type Motion = Extract<BehaviourMotion, { to: "support" }>;
interface Geometry {
  readonly bounds?: Rect;
  readonly hazards: NonNullable<BehaviourWorld["hazards"]>;
  readonly platforms: NonNullable<BehaviourWorld["platforms"]>;
  readonly solids: readonly Rect[];
}
export interface FlightSelectionState {
  readonly entry: Point;
  readonly status: "moving" | "pending" | "supported";
  readonly target?: Point;
  readonly pending?: Geometry;
}
function geometry(world: BehaviourWorld): Geometry {
  return {
    ...(world.traversalFrame && { bounds: { ...world.traversalFrame.bounds } }),
    hazards: (world.hazards ?? []).map((item) => ({ ...item, rect: { ...item.rect } })),
    platforms: (world.platforms ?? []).map((item) => ({ ...item, rect: { ...item.rect } })),
    solids: world.solids,
  };
}
function sameRect(a: Rect | undefined, b: Rect | undefined): boolean {
  return (
    a === b ||
    (a !== undefined &&
      b !== undefined &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height)
  );
}
function sameGeometry(a: Geometry, world: BehaviourWorld): boolean {
  const platforms = world.platforms ?? [],
    hazards = world.hazards ?? [];
  return (
    a.solids === world.solids &&
    sameRect(a.bounds, world.traversalFrame?.bounds) &&
    a.platforms.length === platforms.length &&
    a.hazards.length === hazards.length &&
    a.platforms.every(
      (item, i) =>
        item.owner === platforms[i]!.owner &&
        item.collision === platforms[i]!.collision &&
        sameRect(item.rect, platforms[i]!.rect),
    ) &&
    a.hazards.every(
      (item, i) => item.owner === hazards[i]!.owner && sameRect(item.rect, hazards[i]!.rect),
    )
  );
}

// The full frame ascends above both endpoints before crossing and descending onto support.
function selectedFlightRoute(
  world: BehaviourWorld,
  object: ObjectLayout,
  clearance: number,
  entry: Point,
  target: Point,
  at: Point,
): readonly Point[] | undefined {
  const bounds = world.traversalFrame?.bounds,
    leash = object.behaviour!.pursuit!.distance;
  if (!bounds || !supportedLanding(object, world, target)) {
    return undefined;
  }
  const cruiseY = Math.min(entry.y, target.y) - clearance;
  const aligned = Math.abs(at.x - target.x) <= EDGE;
  const points = aligned
    ? [target]
    : [{ x: at.x, y: cruiseY }, { x: target.x, y: cruiseY }, target];
  let from = at;
  const route: Point[] = [];
  for (const to of points) {
    if (
      to.x < Math.max(bounds.x, object.origin.x - leash) - EDGE ||
      to.x + object.width >
        Math.min(bounds.x + bounds.width, object.origin.x + leash + object.width) + EDGE ||
      to.y < bounds.y - EDGE ||
      to.y + object.height > bounds.y + bounds.height + EDGE
    ) {
      return undefined;
    }
    const axis = Math.abs(to.x - from.x) > EDGE ? "x" : "y";
    if (Math.abs(flightAxis(object, world, from, axis, to[axis]) - to[axis]) > EDGE) {
      return undefined;
    }
    const sweep = {
      height: object.height + Math.abs(to.y - from.y),
      width: object.width + Math.abs(to.x - from.x),
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
    };
    if (
      (world.hazards ?? []).some(
        ({ owner, rect }) =>
          owner !== object &&
          sweep.x < rect.x + rect.width &&
          rect.x < sweep.x + sweep.width &&
          sweep.y < rect.y + rect.height &&
          rect.y < sweep.y + sweep.height,
      )
    ) {
      return undefined;
    }
    if (Math.hypot(to.x - from.x, to.y - from.y) > EDGE) {
      route.push(to);
    }
    from = to;
  }
  return route;
}

export function selectSupportedFlight(
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: Motion,
  facing: -1 | 1,
  decision: number,
  at: Point,
  prior?: FlightSelectionState,
): {
  readonly decision: number;
  readonly state: FlightSelectionState;
  readonly points?: readonly Point[];
} {
  const policy = motion.selection!;
  const entry = prior?.entry ?? at;
  const pending = (): FlightSelectionState => ({
    entry,
    pending: geometry(world),
    status: "pending",
  });
  if (prior?.pending && sameGeometry(prior.pending, world)) {
    return { decision, state: prior };
  }
  if (prior?.target) {
    const points = selectedFlightRoute(world, object, policy.clearance, entry, prior.target, at);
    if (points) {
      return {
        decision,
        points,
        state: { entry, status: points.length ? "moving" : "supported", target: prior.target },
      };
    }
    return { decision, state: pending() };
  }
  if (!world.decisions || !world.traversalFrame) {
    return { decision, state: pending() };
  }
  const random = world.decisions(`supported-flight:${decision}`);
  const targets = supportedDestinations(
    (point) => supportedLanding(object, world, point),
    { distance: policy.distance, minMovement: policy.minDistance },
    object,
    world,
    facing,
    "fly",
    random,
    entry,
  );
  for (const target of targets.slice(0, policy.maxAttempts)) {
    const points = selectedFlightRoute(world, object, policy.clearance, entry, target, at);
    if (points) {
      return { decision: decision + 1, points, state: { entry, status: "moving", target } };
    }
  }
  return { decision: decision + 1, state: pending() };
}
