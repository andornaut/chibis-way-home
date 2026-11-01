import type { BehaviourMotion, BehaviourPlan, ObjectLayout, Point, Rect } from "../data/types";

export function hasDynamicBehaviour(pattern: BehaviourPlan): boolean {
  return Object.values(pattern.states).some(
    (node) => node.motion.kind !== "wait" || (node.onEnter?.length ?? 0) > 0,
  );
}

export function hasDynamicMotion(object: ObjectLayout): boolean {
  return (
    object.orbit !== undefined ||
    (object.behaviour
      ? hasDynamicBehaviour(object.behaviour)
      : object.motion.algorithm !== "static" || object.reaction.kind !== "none")
  );
}

// Only exact integer cycle ratios establish a finite shared period here.
export function objectCycleSeconds(objects: readonly ObjectLayout[], object: ObjectLayout): number {
  if (object.orbit) {
    const host = objectCycleSeconds(objects, objects[object.orbit.host]!);
    if (object.orbit.angularSpeed === 0) {
      return host;
    }
    const spin = (2 * Math.PI) / Math.abs(object.orbit.angularSpeed);
    if (host === 0) {
      return spin;
    }
    return Number.isSafeInteger(host / spin) || Number.isSafeInteger(spin / host)
      ? Math.max(host, spin)
      : Infinity;
  }
  const { distance, pause, speed } = object.motion;
  return object.behaviour
    ? behaviourCycleSeconds(object.behaviour)
    : speed > 0
      ? 2 * (distance / speed + pause)
      : 0;
}

function flightWaypoints(motion: Extract<BehaviourMotion, { kind: "fly" }>): readonly Point[] {
  if (motion.to !== "target") {
    return [motion.to];
  }
  const { height, width, x, y } = motion.bounds;
  return [
    { x, y },
    { x: x + width, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
  ];
}

function waypoints(pattern: BehaviourPlan): readonly Point[] {
  return [
    { x: 0, y: 0 },
    ...Object.values(pattern.states).flatMap((node) => [
      ...(node.motion.kind === "move" || node.motion.kind === "hop"
        ? [node.track ?? pattern].map((track) => ({
            x: track.axis === "x" ? track.distance : 0,
            y: track.axis === "y" ? track.distance : 0,
          }))
        : []),
      ...(node.motion.kind === "fly" ? flightWaypoints(node.motion) : []),
    ]),
  ];
}

export interface BehaviourBoundsContext {
  readonly areaBounds: Rect;
  readonly targetHeight: number;
  readonly maximumRise: number;
}

// Local attacks retain their extents around any pursuit anchor inside the encounter leash.
export function sweptBehaviourRect(
  context: BehaviourBoundsContext | undefined,
  pattern: BehaviourPlan,
  origin: Rect,
): Rect {
  const points = waypoints(pattern);
  const left = Math.min(...points.map(({ x }) => x));
  const right = Math.max(...points.map(({ x }) => x));
  const top = Math.min(...points.map(({ y }) => y));
  const bottom = Math.max(...points.map(({ y }) => y));
  const hop = Math.max(
    0,
    ...Object.values(pattern.states).map((node) =>
      node.motion.kind === "hop" ? node.motion.hopHeight : 0,
    ),
  );
  if (pattern.pursuit) {
    if (!context) {
      throw new Error("Pursuit bounds require area and target movement context");
    }
    const drift = Math.max(
      0,
      ...Object.values(pattern.states).map(({ motion, track }) =>
        motion.kind === "hop" && (track?.axis ?? pattern.axis) === "x"
          ? motion.speed * motion.hopSeconds
          : 0,
      ),
    );
    const anchorTop = Math.min(
      origin.y,
      context.areaBounds.y - context.maximumRise - context.targetHeight - origin.height,
    );
    const anchorBottom = Math.max(
      origin.y,
      context.areaBounds.y + context.areaBounds.height + context.targetHeight,
    );
    return {
      height: origin.height + anchorBottom - anchorTop + bottom - top + hop,
      width: origin.width + 2 * pattern.pursuit.distance + right - left + 2 * drift,
      x: origin.x - pattern.pursuit.distance + left - drift,
      y: anchorTop + top - hop,
    };
  }
  return {
    height: origin.height + bottom - top + hop,
    width: origin.width + right - left,
    x: origin.x + left,
    y: origin.y + top - hop,
  };
}

// Taking the longest possible waypoint leg per node conservatively covers branching graphs.
export function behaviourCycleSeconds(pattern: BehaviourPlan): number {
  if (
    Object.values(pattern.states).some(
      (node) => node.motion.kind === "pursue" && node.motion.speed > 0,
    )
  ) {
    return Infinity;
  }
  const points = waypoints(pattern);
  return Object.values(pattern.states).reduce((sum, node) => {
    const motion = node.motion;
    let travel = 0;
    if (motion.kind === "fly" && motion.speed > 0) {
      travel =
        Math.max(
          ...flightWaypoints(motion).flatMap((to) =>
            points.map((point) => Math.hypot(to.x - point.x, to.y - point.y)),
          ),
        ) / motion.speed;
    } else if (motion.kind !== "wait" && motion.speed > 0) {
      travel = Math.abs(node.track?.distance ?? pattern.distance) / motion.speed;
    }
    const hop = motion.kind === "hop" ? motion.hopSeconds : 0;
    const waits = node.transitions.flatMap(({ when }) =>
      when
        .filter((condition) => condition.kind === "elapsed")
        .map((condition) => condition.seconds),
    );
    return sum + Math.max(travel, hop) + Math.max(0, ...waits);
  }, 0);
}

// Phase selection includes emitted hazards and gusts even when their actor is outside the probe.
export function emissionBounds(object: ObjectLayout, track: Rect): Rect {
  let left = track.x;
  let right = track.x + track.width;
  let top = track.y;
  let bottom = track.y + track.height;
  for (const node of Object.values(object.behaviour?.states ?? {})) {
    for (const action of node.onEnter ?? []) {
      if (action.kind === "force-pulse") {
        left = Math.min(left, track.x - action.range);
        right = Math.max(right, track.x + track.width + action.range);
        top = Math.min(top, track.y - action.height);
      } else {
        const template = object.spawnTemplates?.[action.character];
        if (!template) {
          continue;
        }
        const seconds = action.lifeSeconds;
        const times = [0, seconds];
        const apex = -action.velocity.y / action.gravity;
        if (apex > 0 && apex < seconds) {
          times.push(apex);
        }
        const heights = times.map(
          (time) => action.velocity.y * time + (action.gravity * time * time) / 2,
        );
        for (const facing of action.mirrorWithFacing ? [-1, 1] : [1]) {
          const offset =
            facing === 1 ? action.offset.x : object.width - action.offset.x - template.width;
          const dx = action.velocity.x * facing * seconds;
          left = Math.min(left, track.x + offset + Math.min(0, dx));
          right = Math.max(
            right,
            track.x + track.width - object.width + offset + Math.max(0, dx) + template.width,
          );
        }
        top = Math.min(top, track.y + action.offset.y + Math.min(...heights));
        bottom = Math.max(
          bottom,
          track.y +
            track.height -
            object.height +
            action.offset.y +
            Math.max(...heights) +
            template.height,
        );
      }
    }
  }
  return { height: bottom - top, width: right - left, x: left, y: top };
}
