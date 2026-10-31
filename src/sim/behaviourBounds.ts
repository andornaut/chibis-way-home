import type { BehaviourPlan, ObjectLayout, Point, Rect } from "../data/types";

export function hasDynamicBehaviour(pattern: BehaviourPlan): boolean {
  return Object.values(pattern.states).some(
    (node) => node.motion.kind !== "wait" || (node.onEnter?.length ?? 0) > 0,
  );
}

function waypoints(pattern: BehaviourPlan): readonly Point[] {
  return [
    { x: 0, y: 0 },
    {
      x: pattern.axis === "x" ? pattern.distance : 0,
      y: pattern.axis === "y" ? pattern.distance : 0,
    },
    ...Object.values(pattern.states).flatMap((node) =>
      node.motion.kind === "fly" ? [node.motion.to] : [],
    ),
  ];
}

// Flight segments stay inside their endpoint bounds. Graph hops can rise above any waypoint.
export function sweptBehaviourRect(pattern: BehaviourPlan, origin: Rect): Rect {
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
  return {
    height: origin.height + bottom - top + hop,
    width: origin.width + right - left,
    x: origin.x + left,
    y: origin.y + top - hop,
  };
}

// Taking the longest possible waypoint leg per node conservatively covers branching graphs.
export function behaviourCycleSeconds(pattern: BehaviourPlan): number {
  const points = waypoints(pattern);
  return Object.values(pattern.states).reduce((sum, node) => {
    const motion = node.motion;
    let travel = 0;
    if (motion.kind === "fly" && motion.speed > 0) {
      travel =
        Math.max(
          ...points.map((point) => Math.hypot(motion.to.x - point.x, motion.to.y - point.y)),
        ) / motion.speed;
    } else if (motion.kind !== "wait" && motion.speed > 0) {
      travel = Math.abs(pattern.distance) / motion.speed;
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
        const dx = action.velocity.x * seconds;
        const times = [0, seconds];
        const apex = -action.velocity.y / action.gravity;
        if (apex > 0 && apex < seconds) {
          times.push(apex);
        }
        const heights = times.map(
          (time) => action.velocity.y * time + (action.gravity * time * time) / 2,
        );
        left = Math.min(left, track.x + action.offset.x + Math.min(0, dx));
        right = Math.max(
          right,
          track.x + track.width - object.width + action.offset.x + Math.max(0, dx) + template.width,
        );
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
