import { rectsOverlap } from "@andornaut/game-kit/rect";
import {
  findTraversal,
  stepTraversal,
  type TraversalContext,
  type TraversalInput,
  type TraversalResult,
  type TraversalSafety,
  type TraversalState,
} from "@andornaut/game-kit/terrain/traversal";

import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours";
import type { BehaviourMotion, ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourPlatformFrame, BehaviourWorld } from "./behaviourReach";
import { EDGE } from "./bird";
import { collisionCandidates } from "./collisionIndex";

export type TraversalSupport = ObjectLayout | Rect;
export interface BehaviourTraversalState {
  readonly searchedAt?: Point;
  readonly physical: TraversalState<TraversalSupport>;
  readonly inputs: readonly TraversalInput[];
  readonly target: Rect;
  readonly geometry: string;
  readonly status: TraversalResult<TraversalSupport>["status"];
}
type GroundMotion = Extract<BehaviourMotion, { mode: "ground" }>;

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
  );
}

export function traversalContext(
  world: BehaviourWorld,
  seconds: number,
  object: ObjectLayout,
  motion: GroundMotion,
): TraversalContext<TraversalSupport> | undefined {
  const frame = world.traversalFrame;
  if (!frame || !motion.traversal) {
    return undefined;
  }
  const project = (platforms: readonly BehaviourPlatformFrame[]) =>
    platforms
      .filter(({ owner }) => owner !== object)
      .map(({ after, before, collision, owner, segments }) => {
        const points = [before, after, ...(segments?.flatMap(({ from, to }) => [from, to]) ?? [])];
        return {
          bounds: {
            height:
              Math.max(...points.map((r) => r.y + r.height)) - Math.min(...points.map((r) => r.y)),
            width:
              Math.max(...points.map((r) => r.x + r.width)) - Math.min(...points.map((r) => r.x)),
            x: Math.min(...points.map((r) => r.x)),
            y: Math.min(...points.map((r) => r.y)),
          },
          collider: {
            after,
            before,
            kind: collision,
            supportId: owner,
            ...(segments && { segments }),
          },
          points,
        };
      });
  // Sampled platform arrays are immutable snapshots; query filtering stays outside the memo.
  const projections = new WeakMap<readonly BehaviourPlatformFrame[], ReturnType<typeof project>>();
  const distance = object.behaviour!.pursuit!.distance;
  const left = Math.max(frame.bounds.x, object.origin.x - distance);
  const right = Math.min(
    frame.bounds.x + frame.bounds.width,
    object.origin.x + distance + object.width,
  );
  return {
    body: { height: object.height, offset: { x: 0, y: 0 }, width: object.width },
    bounds: { ...frame.bounds, width: right - left, x: left },
    dtSeconds: seconds,
    epsilon: EDGE,
    maxCollisionSteps: BEHAVIOUR_TRAVERSAL_SEARCH.maxCollisionSteps,
    maxDrop: frame.bounds.height,
    profile: { ...motion.traversal, walkSpeed: motion.speed },
    safe: ({ from, to }) => {
      const sweep = {
        height: from.height + Math.abs(to.y - from.y),
        width: from.width + Math.abs(to.x - from.x),
        x: Math.min(from.x, to.x),
        y: Math.min(from.y, to.y),
      };
      return !(world.hazards ?? []).some(
        ({ owner, rect }) => owner !== object && rectsOverlap(sweep, rect),
      );
    },
    sampleColliders: (time, dt, query) => {
      const current = time === frame.timeSeconds && dt === frame.dtSeconds;
      const platforms = frame.sample
        ? frame.sample(time, dt)
        : current
          ? frame.platforms
          : frame.platforms.length === 0
            ? []
            : undefined;
      const colliders = collisionCandidates(world.solids, query).map((rect) => ({
        after: rect,
        before: rect,
        kind: "solid" as const,
        supportId: rect,
      }));
      let projected = platforms && projections.get(platforms);
      if (platforms && !projected) {
        projected = project(platforms);
        projections.set(platforms, projected);
      }
      const dynamic = (projected ?? [])
        .filter(
          ({ bounds, points }) =>
            points.some((rect) => intersects(rect, query)) || intersects(bounds, query),
        )
        .map(({ collider }) => collider);
      const uncertainHazard =
        time > frame.timeSeconds &&
        (world.hazards ?? []).some(
          ({ owner }) =>
            owner !== object &&
            (owner.orbit !== undefined ||
              owner.behaviour !== undefined ||
              owner.motion.algorithm !== "static" ||
              owner.reaction.kind !== "none"),
        );
      return {
        colliders: [...colliders, ...dynamic],
        complete: platforms !== undefined && !uncertainHazard,
      };
    },
  };
}

// The target envelope is supported terrain containing the complete pursuer, not Chibi's box.
export function traversalGoal(
  world: BehaviourWorld,
  object: ObjectLayout,
  at: Point,
  target: Rect,
): Rect | undefined {
  const floor = target.y + target.height;
  const supports = [
    ...collisionCandidates(world.solids, { ...target, height: Infinity }),
    ...(world.platforms ?? []).filter(({ owner }) => owner !== object).map(({ rect }) => rect),
  ]
    .filter(
      (rect) =>
        rect.y >= floor - EDGE &&
        rect.x <= target.x + target.width &&
        rect.x + rect.width >= target.x,
    )
    .sort((a, b) => a.y - b.y);
  const support = supports[0];
  if (!support) {
    return undefined;
  }
  const rightward = target.x + target.width / 2 >= at.x + object.width / 2;
  const x = rightward ? Math.max(support.x, at.x + object.width) : support.x;
  const right = rightward ? support.x + support.width : Math.min(support.x + support.width, at.x);
  return right - x < object.width
    ? undefined
    : {
        height: object.height + 2 * EDGE,
        width: right - x,
        x,
        y: support.y - object.height - EDGE,
      };
}

export function advanceTraversal(
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: GroundMotion,
  seconds: number,
  prior: BehaviourTraversalState | undefined,
  at: Point,
  target: Rect,
): {
  readonly at: Point;
  readonly segments?: readonly TraversalSafety[];
  readonly traversal?: BehaviourTraversalState;
} {
  const context = traversalContext(world, seconds, object, motion);
  const frame = world.traversalFrame;
  if (!context || !frame) {
    return { at };
  }
  const physical =
    prior?.physical.x === at.x && prior.physical.y === at.y
      ? prior.physical
      : {
          fallFromY: at.y + object.height,
          grounded: true,
          vy: 0,
          ...at,
        };
  const goal = traversalGoal(world, object, at, target);
  const key = frame.platforms
    .map(({ after, before }) => [before.x, before.y, after.x, after.y].join(":"))
    .join(";");
  const move =
    target.x + target.width / 2 === at.x + object.width / 2
      ? 0
      : target.x + target.width / 2 < at.x + object.width / 2
        ? -1
        : 1;
  let searchedAt = prior?.searchedAt;
  let inputs = prior?.inputs ?? [];
  let status = prior?.status ?? "geometry-unavailable";
  const input = { jump: false, move, timeSeconds: frame.timeSeconds } as const;
  const direct = stepTraversal(context, input, physical);
  const progress = direct.status === "ok" && Math.abs(direct.state.x - physical.x) > EDGE;
  const sameGoal =
    goal &&
    prior &&
    ["x", "y", "width", "height"].every(
      (axis) => goal[axis as keyof Rect] === prior.target[axis as keyof Rect],
    );
  if (
    !inputs.length &&
    direct.status === "ok" &&
    (!physical.grounded || (direct.state.grounded && progress))
  ) {
    return {
      at: direct.state,
      segments: direct.segments,
      traversal: {
        geometry: key,
        ...(searchedAt && { searchedAt }),
        inputs: [],
        physical: direct.state,
        status: prior?.status ?? "geometry-unavailable",
        target: goal ?? target,
      },
    };
  }
  if (
    !inputs.length &&
    goal &&
    (!searchedAt ||
      searchedAt.x !== at.x ||
      searchedAt.y !== at.y ||
      !sameGoal ||
      prior?.geometry !== key ||
      prior.status === "found")
  ) {
    const result = findTraversal(context, {
      ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
      goal,
      start: physical,
      timeSeconds: frame.timeSeconds,
    });
    searchedAt = at;
    status = result.status;
    inputs = result.status === "found" ? result.inputs : [];
  }
  const planned = inputs[0];
  let result = planned
    ? stepTraversal(context, { ...planned, timeSeconds: frame.timeSeconds }, physical)
    : direct;
  if (result.status !== "ok" && !physical.grounded) {
    const falling = stepTraversal(context, { ...input, move: 0 }, physical);
    if (falling.status === "ok") {
      result = falling;
    }
  }
  const accepted =
    result.status === "ok" && (planned || !physical.grounded || result.state.grounded);
  return {
    at: accepted ? result.state : at,
    ...(accepted && { segments: result.segments }),
    traversal: {
      geometry: key,
      ...(searchedAt && { searchedAt }),
      inputs: accepted && planned ? inputs.slice(1) : [],
      physical: accepted ? result.state : physical,
      status: result.status === "geometry-unavailable" ? "geometry-unavailable" : status,
      target: goal ?? target,
    },
  };
}

export interface BehaviourRearmState {
  readonly visible: boolean;
  readonly stateKey: string;
  readonly supports: readonly TraversalSupport[];
  readonly goal?: Rect;
  readonly geometry: string;
  readonly inputs: readonly TraversalInput[];
  readonly status: TraversalResult<TraversalSupport>["status"];
}

// Retry a jump-only reach proof on scene/graph/support events, never each patrol position.
export function probeRearm(
  world: BehaviourWorld,
  seconds: number,
  object: ObjectLayout,
  motion: GroundMotion,
  anchor: Point,
  stateKey: string,
  visible: boolean,
  previous: BehaviourRearmState | undefined,
  at: Point,
  target: Rect,
): { readonly rearm: BehaviourRearmState; readonly reachable?: boolean } {
  const context = traversalContext(world, seconds, object, motion);
  const frame = world.traversalFrame;
  const body = { ...at, height: object.height, width: object.width };
  const geometry = context?.sampleColliders(frame!.timeSeconds, seconds, body);
  const supports =
    geometry?.colliders
      .filter(
        ({ before }) =>
          Math.abs(before.y - at.y - object.height) <= EDGE &&
          before.x < at.x + object.width &&
          before.x + before.width > at.x,
      )
      .map(({ supportId }) => supportId) ?? [];
  const goal = traversalGoal(world, object, anchor, target);
  const local = goal
    ? {
        height: Math.max(at.y + object.height, goal.y + goal.height) - Math.min(at.y, goal.y),
        width: Math.max(at.x + object.width, goal.x + goal.width) - Math.min(at.x, goal.x),
        x: Math.min(at.x, goal.x),
        y: Math.min(at.y, goal.y),
      }
    : body;
  const key = (frame?.platforms ?? [])
    .filter(({ after, before }) => intersects(before, local) || intersects(after, local))
    .map(({ after, before }) => [before.x, before.y, after.x, after.y].join(":"))
    .join(";");
  const changed =
    !previous ||
    !previous.visible ||
    previous.stateKey !== stateKey ||
    previous.geometry !== key ||
    previous.supports.length !== supports.length ||
    supports.some((support, index) => support !== previous.supports[index]) ||
    !goal ||
    !previous.goal ||
    (["x", "y", "width", "height"] as const).some((axis) => goal[axis] !== previous.goal![axis]);
  let inputs = previous?.inputs ?? [];
  let status = previous?.status ?? "geometry-unavailable";
  if (changed) {
    status = "geometry-unavailable";
    inputs = [];
  }
  if (visible && changed && context && frame && goal && geometry?.complete) {
    const result = findTraversal(context, {
      ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
      goal,
      start: { ...at, fallFromY: at.y + object.height, grounded: true, vy: 0 },
      timeSeconds: frame.timeSeconds,
    });
    inputs = result.status === "found" ? result.inputs : [];
    status = result.status;
  }
  let reachable: boolean | undefined;
  if (visible && status === "found" && context && frame && goal && geometry?.complete) {
    const first = inputs[0];
    // A cached witness is eligible only if its actual first movement still validates.
    const checked = stepTraversal(
      context,
      { jump: first?.jump ?? false, move: first?.move ?? 0, timeSeconds: frame.timeSeconds },
      { ...at, fallFromY: at.y + object.height, grounded: true, vy: 0 },
    );
    if (checked.status === "ok") {
      reachable = true;
    } else {
      status =
        checked.status === "geometry-unavailable" ? "geometry-unavailable" : "budget-exhausted";
    }
  } else if (visible && status === "unreachable" && goal && geometry?.complete) {
    reachable = false;
  }
  return {
    rearm: { geometry: key, ...(goal && { goal }), inputs, stateKey, status, supports, visible },
    ...(reachable !== undefined && { reachable }),
  };
}
