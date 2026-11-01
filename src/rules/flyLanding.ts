import { rectsOverlap } from "@andornaut/game-kit/rect";

import type { ObjectLayout, Point, Rect } from "../data/types";
import { type BehaviourWorld, flightAxis } from "./behaviourReach";
import { EDGE } from "./bird";
import { collisionCandidates } from "./collisionIndex";

function supports(object: ObjectLayout, world: BehaviourWorld): readonly Rect[] {
  return [
    ...world.solids,
    ...(world.platforms ?? []).filter(({ owner }) => owner !== object).map(({ rect }) => rect),
  ];
}
function obstacles(object: ObjectLayout, world: BehaviourWorld, body: Rect): readonly Rect[] {
  return [
    ...collisionCandidates(world.solids, body),
    ...(world.platforms ?? [])
      .filter(({ collision, owner }) => collision === "solid" && owner !== object)
      .map(({ rect }) => rect),
    ...(world.hazards ?? []).filter(({ owner }) => owner !== object).map(({ rect }) => rect),
  ];
}

export function supportedLanding(object: ObjectLayout, world: BehaviourWorld, at: Point): boolean {
  const body = { ...at, height: object.height, width: object.width };
  return (
    !obstacles(object, world, body).some((rect) => rectsOverlap(body, rect)) &&
    supports(object, world).some(
      (rect) =>
        Math.abs(at.y + object.height - rect.y) <= EDGE &&
        at.x >= rect.x - EDGE &&
        at.x + object.width <= rect.x + rect.width + EDGE,
    )
  );
}

// Candidates use complete body support and the original encounter's horizontal leash.
export function flyLandingRoute(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
): readonly Point[] | undefined {
  const distance = object.behaviour!.pursuit!.distance;
  const routes: { readonly points: readonly Point[]; readonly length: number }[] = [];
  for (const support of supports(object, world)) {
    const low = Math.max(support.x, object.origin.x - distance);
    const high = Math.min(support.x + support.width - object.width, object.origin.x + distance);
    if (high < low) {
      continue;
    }
    const y = support.y - object.height;
    const body = { height: object.height, width: high - low + object.width, x: low, y };
    let intervals: readonly (readonly [number, number])[] = [[low, high]];
    for (const rect of obstacles(object, world, body)) {
      if (rect.y >= support.y || rect.y + rect.height <= y) {
        continue;
      }
      const from = rect.x - object.width;
      const to = rect.x + rect.width;
      intervals = intervals.flatMap(([left, right]) =>
        from >= right || to <= left
          ? [[left, right] as const]
          : [
              ...(from >= left ? [[left, from] as const] : []),
              ...(to <= right ? [[to, right] as const] : []),
            ],
      );
    }
    for (const [left, right] of intervals) {
      const target = { x: Math.max(left, Math.min(right, at.x)), y };
      if (!supportedLanding(object, world, target)) {
        continue;
      }
      for (const axis of ["x", "y"] as const) {
        const across = axis === "x" ? "y" : "x";
        const via = { ...at, [axis]: target[axis] };
        if (
          Math.abs(flightAxis(object, world, at, axis, via[axis]) - via[axis]) > EDGE ||
          Math.abs(flightAxis(object, world, via, across, target[across]) - target[across]) > EDGE
        ) {
          continue;
        }
        const points = [via, target].filter((point, index, all) => {
          const previous = index === 0 ? at : all[index - 1]!;
          return Math.hypot(point.x - previous.x, point.y - previous.y) > EDGE;
        });
        routes.push({ length: Math.abs(at.x - target.x) + Math.abs(at.y - target.y), points });
      }
    }
  }
  routes.sort(
    (a, b) =>
      a.length - b.length ||
      (a.points.at(-1)?.x ?? at.x) - (b.points.at(-1)?.x ?? at.x) ||
      (a.points.at(-1)?.y ?? at.y) - (b.points.at(-1)?.y ?? at.y),
  );
  return routes[0]?.points;
}
