import { rectsOverlap } from "@andornaut/game-kit/rect";

import type { ObjectLayout, Point, Rect } from "../data/types";
import { type BehaviourPlatformFrame, type BehaviourWorld, flightAxis } from "./behaviourReach";
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
function landingRoute(
  preferred: Point | undefined,
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
      if (
        preferred &&
        (Math.abs(preferred.y - y) > EDGE ||
          preferred.x < left - EDGE ||
          preferred.x > right + EDGE)
      ) {
        continue;
      }
      const target = preferred ?? { x: Math.max(left, Math.min(right, at.x)), y };
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
        if (
          [
            {
              height: object.height + Math.abs(via.y - at.y),
              width: object.width + Math.abs(via.x - at.x),
              x: Math.min(at.x, via.x),
              y: Math.min(at.y, via.y),
            },
            {
              height: object.height + Math.abs(target.y - via.y),
              width: object.width + Math.abs(target.x - via.x),
              x: Math.min(via.x, target.x),
              y: Math.min(via.y, target.y),
            },
          ].some((sweep) =>
            (world.hazards ?? []).some(
              ({ owner, rect }) => owner !== object && rectsOverlap(sweep, rect),
            ),
          )
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

export function flyLandingRoute(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
): readonly Point[] | undefined {
  return landingRoute(undefined, object, world, at);
}

// A selected refuge uses the same supported-perch and two-axis clipping proof.
export function flyLandingPath(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
  target: Point,
): readonly Point[] | undefined {
  return landingRoute(target, object, world, at);
}

export interface FlyLandingState {
  readonly speed: number;
  readonly support?: {
    readonly owner?: ObjectLayout;
    readonly rect: Rect;
    readonly localX: number;
  };
}

function sampledPlatforms(
  world: BehaviourWorld,
  offset: number,
  seconds: number,
): readonly BehaviourPlatformFrame[] | undefined {
  const frame = world.traversalFrame;
  if (!frame) {
    return world.platforms?.map(({ collision, owner, rect }) => ({
      after: rect,
      before: rect,
      collision,
      owner,
    }));
  }
  const start = frame.timeSeconds + offset;
  if (frame.sample) {
    return frame.sample(start, seconds);
  }
  if (offset < -EDGE || offset + seconds > frame.dtSeconds + EDGE) {
    return frame.platforms.length === 0 ? [] : undefined;
  }
  const at = (platform: BehaviourPlatformFrame, time: number): Rect => {
    const segments = platform.segments ?? [
      {
        endSeconds: frame.timeSeconds + frame.dtSeconds,
        from: platform.before,
        startSeconds: frame.timeSeconds,
        to: platform.after,
      },
    ];
    const leg = segments.find(({ endSeconds }) => endSeconds >= time) ?? segments.at(-1);
    if (!leg) {
      return platform.before;
    }
    const fraction = Math.max(
      0,
      Math.min(1, (time - leg.startSeconds) / (leg.endSeconds - leg.startSeconds || 1)),
    );
    return {
      ...leg.from,
      x: leg.from.x + (leg.to.x - leg.from.x) * fraction,
      y: leg.from.y + (leg.to.y - leg.from.y) * fraction,
    };
  };
  return frame.platforms.map((platform) => ({
    ...platform,
    after: at(platform, start + seconds),
    before: at(platform, start),
    ...(platform.segments && {
      segments: platform.segments
        .filter((leg) => leg.endSeconds > start && leg.startSeconds < start + seconds)
        .map((leg) => ({
          endSeconds: Math.min(start + seconds, leg.endSeconds),
          from: at(platform, Math.max(start, leg.startSeconds)),
          startSeconds: Math.max(start, leg.startSeconds),
          to: at(platform, Math.min(start + seconds, leg.endSeconds)),
        })),
    }),
  }));
}

// A missing dynamic sample is unknown geometry, never a stationary perch.
export function landingWorldAt(world: BehaviourWorld, offset: number): BehaviourWorld | undefined {
  const platforms = sampledPlatforms(world, offset, 0);
  if (world.traversalFrame && !platforms) {
    return undefined;
  }
  return {
    ...world,
    platforms: (platforms ?? []).map(({ before, collision, owner }) => ({
      collision,
      owner,
      rect: before,
    })),
  };
}

export function landingSupport(
  object: ObjectLayout,
  world: BehaviourWorld,
  at: Point,
): FlyLandingState["support"] {
  if (!supportedLanding(object, world, at)) {
    return undefined;
  }
  const fits = (rect: Rect) =>
    Math.abs(at.y + object.height - rect.y) <= EDGE &&
    at.x >= rect.x - EDGE &&
    at.x + object.width <= rect.x + rect.width + EDGE;
  const platform = world.platforms?.find(({ owner, rect }) => owner !== object && fits(rect));
  const rect = platform?.rect ?? world.solids.find(fits);
  return rect
    ? { ...(platform && { owner: platform.owner }), localX: at.x - rect.x, rect }
    : undefined;
}

// Carry follows the actual support chords and validates every swept body interval.
export function carryLandingSupport(
  object: ObjectLayout,
  world: BehaviourWorld,
  offset: number,
  seconds: number,
  at: Point,
  support: NonNullable<FlyLandingState["support"]>,
): {
  readonly at: Point;
  readonly supported: boolean;
  readonly points: readonly {
    readonly at: Point;
    readonly seconds: number;
  }[];
} {
  const platforms = sampledPlatforms(world, offset, seconds);
  const beforeWorld = landingWorldAt(world, offset);
  const failure = { at, points: [], supported: false } as const;
  if (!beforeWorld || !supportedLanding(object, beforeWorld, at)) {
    return failure;
  }
  if (!support.owner) {
    if (!world.solids.includes(support.rect)) {
      return failure;
    }
    return { at, points: [{ at, seconds }], supported: true };
  }
  const platform = platforms?.find(({ owner }) => owner === support.owner);
  if (
    !platform ||
    Math.abs(at.x - platform.before.x - support.localX) > EDGE ||
    Math.abs(at.y + object.height - platform.before.y) > EDGE
  ) {
    return failure;
  }
  const start = (world.traversalFrame?.timeSeconds ?? 0) + offset;
  const legs = platform.segments?.length
    ? platform.segments
    : [
        {
          endSeconds: start + seconds,
          from: platform.before,
          startSeconds: start,
          to: platform.after,
        },
      ];
  let current = at;
  const points: { at: Point; seconds: number }[] = [];
  for (const leg of legs) {
    const end = leg.endSeconds - (world.traversalFrame?.timeSeconds ?? 0);
    const snapshot = landingWorldAt(world, end);
    if (!snapshot) {
      return { at: current, points, supported: false };
    }
    const target = { x: leg.to.x + support.localX, y: leg.to.y - object.height };
    const sweep = {
      height: object.height + Math.abs(target.y - current.y),
      width: object.width + Math.abs(target.x - current.x),
      x: Math.min(current.x, target.x),
      y: Math.min(current.y, target.y),
    };
    const withoutCarrier = {
      ...snapshot,
      platforms: (snapshot.platforms ?? []).filter(({ owner }) => owner !== support.owner),
    };
    if (
      obstacles(object, withoutCarrier, sweep).some((rect) => rectsOverlap(sweep, rect)) ||
      !supportedLanding(object, snapshot, target)
    ) {
      return { at: current, points, supported: false };
    }
    current = target;
    points.push({ at: current, seconds: end - offset });
  }
  return { at: current, points, supported: true };
}
