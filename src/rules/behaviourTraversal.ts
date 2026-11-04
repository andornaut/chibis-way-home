import { rectsOverlap } from "@andornaut/game-kit/rect";
import {
  findTraversal,
  stepTraversal,
  type TraversalCollider,
  type TraversalCommand,
  type TraversalContext,
  type TraversalInput,
  type TraversalRequest,
  type TraversalResult,
  type TraversalSafety,
  type TraversalState,
  type TraversalStepResult,
} from "@andornaut/game-kit/terrain/traversal";

import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours";
import type { BehaviourMotion, ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourPlatformFrame, BehaviourWorld } from "./behaviourReach";
import { EDGE } from "./bird";
import { collisionCandidates } from "./collisionIndex";
import { STEP_SECONDS } from "./step";
import { timedHazardSafe } from "./timedHazard";

export type TraversalSupport = ObjectLayout | Rect;
export interface BehaviourTraversalState {
  readonly preparation?: {
    readonly startedAtSeconds: number;
    readonly remainingSeconds: number;
    readonly move: -1 | 0 | 1;
    readonly supportId?: TraversalSupport;
  };
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

interface PlatformProjection {
  readonly bounds: Rect;
  readonly collider: TraversalCollider<TraversalSupport>;
  readonly points: readonly Rect[];
}

// The platform's collider, every chord endpoint and their bounding box.
function projectPlatform({
  after,
  before,
  collision,
  owner,
  segments,
}: BehaviourPlatformFrame): PlatformProjection {
  const points = [before, after];
  if (segments) {
    for (const { from, to } of segments) {
      points.push(from, to);
    }
  }
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const rect of points) {
    left = Math.min(left, rect.x);
    right = Math.max(right, rect.x + rect.width);
    top = Math.min(top, rect.y);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return {
    bounds: { height: bottom - top, width: right - left, x: left, y: top },
    collider: { after, before, kind: collision, supportId: owner, ...(segments && { segments }) },
    points,
  };
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
    platforms.filter(({ owner }) => owner !== object).map(projectPlatform);
  // Sampled platform arrays are immutable snapshots; query filtering stays outside the memo.
  const projections = new WeakMap<readonly BehaviourPlatformFrame[], ReturnType<typeof project>>();
  // Wrappers retain the original rectangle references, including any in-place coordinate changes.
  const solids = new WeakMap<Rect, TraversalCollider<TraversalSupport>>();
  const distance = object.behaviour!.pursuit!.distance;
  const left = Math.max(frame.bounds.x, object.origin.x - distance);
  const right = Math.min(
    frame.bounds.x + frame.bounds.width,
    object.origin.x + distance + object.width,
  );
  return {
    body: {
      height: object.hitbox?.height ?? object.height,
      offset: { x: object.hitbox?.x ?? 0, y: object.hitbox?.y ?? 0 },
      width: object.hitbox?.width ?? object.width,
    },
    bounds: { ...frame.bounds, width: right - left, x: left },
    dtSeconds: seconds,
    epsilon: EDGE,
    maxCollisionSteps: BEHAVIOUR_TRAVERSAL_SEARCH.maxCollisionSteps,
    maxDrop: frame.bounds.height,
    profile: { ...motion.traversal, walkSpeed: motion.speed },
    safe: (request) => {
      const { from, to } = request;
      const sweep = {
        height: from.height + Math.abs(to.y - from.y),
        width: from.width + Math.abs(to.x - from.x),
        x: Math.min(from.x, to.x),
        y: Math.min(from.y, to.y),
      };
      return !(world.hazards ?? []).some(
        ({ owner, rect, timedContacts }) =>
          owner !== object &&
          (timedContacts ? !timedHazardSafe(timedContacts, request) : rectsOverlap(sweep, rect)),
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
      const colliders: TraversalCollider<TraversalSupport>[] = [];
      for (const rect of collisionCandidates(world.solids, query)) {
        let collider = solids.get(rect);
        if (!collider) {
          collider = { after: rect, before: rect, kind: "solid", supportId: rect };
          solids.set(rect, collider);
        }
        colliders.push(collider);
      }
      let projected = platforms && projections.get(platforms);
      if (platforms && !projected) {
        projected = project(platforms);
        projections.set(platforms, projected);
      }
      if (projected) {
        for (const { bounds, collider, points } of projected) {
          if (intersects(bounds, query) || points.some((rect) => intersects(rect, query))) {
            colliders.push(collider);
          }
        }
      }
      const uncertainHazard = (world.hazards ?? []).some(
        ({ boundsAt, owner, timedContacts }) =>
          owner !== object &&
          (timedContacts
            ? timedContacts(time, time + dt) === undefined
            : time > frame.timeSeconds &&
              (owner.orbit !== undefined ||
                owner.behaviour !== undefined ||
                owner.motion.algorithm !== "static" ||
                owner.reaction.kind !== "none") &&
              (() => {
                const bounds = boundsAt?.(time + dt);
                return (
                  !bounds ||
                  !Object.values(bounds).every(Number.isFinite) ||
                  bounds.width <= 0 ||
                  bounds.height <= 0 ||
                  intersects(
                    {
                      height: bounds.height + 2 * EDGE,
                      width: bounds.width + 2 * EDGE,
                      x: bounds.x - EDGE,
                      y: bounds.y - EDGE,
                    },
                    query,
                  )
                );
              })()),
      );
      const unknownSupport = frame.crumbling
        ?.unknown(time)
        .some((volume) => intersects(volume, query));
      return {
        colliders,
        complete: platforms !== undefined && !uncertainHazard && !unknownSupport,
      };
    },
  };
}

interface SupportSpan {
  readonly left: number;
  readonly right: number;
}
// Static terrain shares collisionCandidates' immutable array and rectangle contract.
const SUPPORT_SPANS = new WeakMap<readonly Rect[], Map<number, ReadonlyMap<Rect, SupportSpan>>>();

function staticSupportSpan(solids: readonly Rect[], support: Rect): SupportSpan {
  let heights = SUPPORT_SPANS.get(solids);
  if (!heights) {
    heights = new Map();
    SUPPORT_SPANS.set(solids, heights);
  }
  const cached = heights.get(support.y);
  if (cached) {
    return cached.get(support) ?? { left: support.x, right: support.x + support.width };
  }
  const spans = new Map<Rect, SupportSpan>();
  let span: { left: number; right: number } | undefined;
  for (const rect of solids
    .filter((rect) => Math.abs(rect.y - support.y) <= EDGE)
    .sort((a, b) => a.x - b.x)) {
    if (!span || rect.x > span.right + EDGE) {
      span = { left: rect.x, right: rect.x + rect.width };
    } else {
      span.right = Math.max(span.right, rect.x + rect.width);
    }
    spans.set(rect, span);
  }
  heights.set(support.y, spans);
  return spans.get(support) ?? { left: support.x, right: support.x + support.width };
}

function stationaryPlatforms(world: BehaviourWorld): readonly Rect[] {
  return (world.platforms ?? [])
    .filter(
      ({ owner }) =>
        owner.motion.algorithm === "static" &&
        !owner.behaviour &&
        !owner.orbit &&
        owner.reaction.kind === "none",
    )
    .map(({ rect }) => rect);
}

function stationarySupport(
  world: BehaviourWorld,
  supportId: TraversalSupport | undefined,
): Rect | undefined {
  return (
    world.solids.find((rect) => rect === supportId) ??
    (world.platforms ?? []).find(
      ({ owner, rect }) => owner === supportId && stationaryPlatforms(world).includes(rect),
    )?.rect
  );
}

function supportedSpan(world: BehaviourWorld, support: Rect): SupportSpan {
  let span = world.solids.includes(support)
    ? staticSupportSpan(world.solids, support)
    : { left: support.x, right: support.x + support.width };
  const stationary = stationaryPlatforms(world);
  if (
    (!world.solids.includes(support) && !stationary.includes(support)) ||
    !stationary.some(
      (rect) =>
        Math.abs(rect.y - support.y) <= EDGE &&
        rect.x <= span.right + EDGE &&
        rect.x + rect.width >= span.left - EDGE,
    )
  ) {
    return span;
  }
  const surfaces = [...world.solids, ...stationary].filter(
    (rect) => Math.abs(rect.y - support.y) <= EDGE,
  );
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const rect of surfaces) {
      if (rect.x <= span.right + EDGE && rect.x + rect.width >= span.left - EDGE) {
        const left = Math.min(span.left, rect.x);
        const right = Math.max(span.right, rect.x + rect.width);
        expanded ||= left !== span.left || right !== span.right;
        span = { left, right };
      }
    }
  }
  return span;
}

// The target envelope contains the native collision body on actual support.
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
  const span = supportedSpan(world, support);
  const width = object.hitbox?.width ?? object.width;
  const height = object.hitbox?.height ?? object.height;
  const left = at.x + (object.hitbox?.x ?? 0);
  const rightward = target.x + target.width / 2 >= left + width / 2;
  const x = rightward ? Math.max(span.left, left + width) : span.left;
  const right = rightward ? span.right : Math.min(span.right, left);
  return right - x < width
    ? undefined
    : {
        height: height + 2 * EDGE,
        width: right - x,
        x,
        y: support.y - height - EDGE,
      };
}

export function preferredDescentInputs(
  world: BehaviourWorld,
  context: TraversalContext<TraversalSupport>,
  request: TraversalRequest<TraversalSupport>,
  direct: TraversalStepResult<TraversalSupport>,
): readonly TraversalCommand[] | undefined {
  const { goal, start } = request;
  if (!start.grounded || direct.status !== "ok" || direct.state.grounded) {
    return undefined;
  }
  const support = stationarySupport(world, start.supportId);
  if (!support) {
    return undefined;
  }
  const { body, epsilon } = context;
  const departure = supportedSpan(world, support);
  const left = start.x + body.offset.x;
  const right = left + body.width;
  const foot = start.y + body.offset.y + body.height;
  if (
    Math.abs(foot - support.y) > epsilon ||
    left < departure.left - epsilon ||
    right > departure.right + epsilon
  ) {
    return undefined;
  }
  const move = Math.sign(direct.state.x - start.x);
  if (
    (move !== -1 && move !== 1) ||
    (move === 1 ? goal.x < right - epsilon : goal.x + goal.width > left + epsilon)
  ) {
    return undefined;
  }
  const landing = world.solids.find(
    (rect) =>
      rect.y > foot + epsilon &&
      Math.abs(rect.y - (goal.y + goal.height - epsilon)) <= epsilon &&
      Math.abs(move === 1 ? rect.x - departure.right : rect.x + rect.width - departure.left) <=
        epsilon,
  );
  const span = landing && staticSupportSpan(world.solids, landing);
  return span &&
    goal.x >= span.left - epsilon &&
    goal.x + goal.width <= span.right + epsilon &&
    Math.abs(move === 1 ? span.left - departure.right : span.right - departure.left) <= epsilon
    ? waypointInputs(context, request, move)
    : undefined;
}

// A touching wall can require an ascent before the final landing corridor gets nearer.
// These commands are suggestions; the native search charges and validates every step.
export function preferredAscentInputs(
  world: BehaviourWorld,
  context: TraversalContext<TraversalSupport>,
  request: TraversalRequest<TraversalSupport>,
): readonly TraversalCommand[] | undefined {
  const { goal, start } = request;
  if (!start.grounded) {
    return undefined;
  }
  const { body, epsilon, profile } = context;
  const left = start.x + body.offset.x;
  const right = left + body.width;
  const top = start.y + body.offset.y;
  const foot = top + body.height;
  const move = goal.x >= right - epsilon ? 1 : goal.x + goal.width <= left + epsilon ? -1 : 0;
  if (move === 0) {
    return undefined;
  }
  const maximumRise = (profile.jumpSpeed * profile.jumpSpeed) / (2 * profile.gravity);
  // An upper landing can intercept the straight jump before its lower goal corridor.
  // Leave that route to the independent search without charging an unsuitable preference.
  const intercepted = [...world.solids, ...(world.platforms ?? []).map(({ rect }) => rect)].some(
    (rect) =>
      rect.x < goal.x + goal.width &&
      rect.x + rect.width > goal.x &&
      rect.y >= foot - maximumRise - epsilon &&
      rect.y < goal.y + body.height - epsilon,
  );
  if (intercepted) {
    return undefined;
  }
  const wall = world.solids.some((rect) => {
    const rise = foot - rect.y;
    return (
      Math.abs(move === 1 ? rect.x - right : rect.x + rect.width - left) <= epsilon &&
      rect.y + rect.height > top + epsilon &&
      rise > epsilon &&
      rise <= maximumRise
    );
  });
  if (wall) {
    return Array.from({ length: request.horizonSteps }, (_, index) => ({
      jump: index === 0,
      move,
    }));
  }
  const support = stationarySupport(world, start.supportId);
  if (!support || Math.abs(foot - support.y) > epsilon) {
    return undefined;
  }
  const departure = supportedSpan(world, support);
  if (left < departure.left - epsilon || right > departure.right + epsilon) {
    return undefined;
  }
  const landingFloor = goal.y + goal.height - epsilon;
  const bridge = stationaryPlatforms(world).find((rect) => {
    const rise = foot - rect.y;
    if (
      rise <= epsilon ||
      rise > maximumRise ||
      Math.abs(rect.y - landingFloor) > epsilon ||
      Math.abs(move === 1 ? rect.x - departure.right : rect.x + rect.width - departure.left) >
        epsilon
    ) {
      return false;
    }
    const span = supportedSpan(world, rect);
    return goal.x >= span.left - epsilon && goal.x + goal.width <= span.right + epsilon;
  });
  return bridge ? waypointInputs(context, request, move, true) : undefined;
}

// Routes can require several supported landings within separate native horizons.
function supportedWaypoint(
  world: BehaviourWorld,
  context: TraversalContext<TraversalSupport>,
  direct: TraversalStepResult<TraversalSupport>,
  start: TraversalState<TraversalSupport>,
  goal: Rect,
): { readonly goal: Rect; readonly jump: boolean } | undefined {
  if (!start.grounded || direct.status !== "ok" || direct.state.grounded) {
    return undefined;
  }
  const support = stationarySupport(world, start.supportId);
  if (!support) {
    return undefined;
  }
  const { body, epsilon } = context;
  const departure = supportedSpan(world, support);
  const left = start.x + body.offset.x;
  const right = left + body.width;
  const foot = start.y + body.offset.y + body.height;
  const move = Math.sign(direct.state.x - start.x);
  if (
    (move !== -1 && move !== 1) ||
    Math.abs(foot - support.y) > epsilon ||
    left < departure.left - epsilon ||
    right > departure.right + epsilon ||
    (move === 1 ? goal.x < right - epsilon : goal.x + goal.width > left + epsilon)
  ) {
    return undefined;
  }
  const landing = world.solids
    .filter(
      (rect) =>
        rect.y > foot + epsilon &&
        rect.y <= goal.y + goal.height + epsilon &&
        Math.abs(move === 1 ? rect.x - departure.right : rect.x + rect.width - departure.left) <=
          epsilon,
    )
    .sort((a, b) => a.y - b.y)[0];
  const maximumRise =
    (context.profile.jumpSpeed * context.profile.jumpSpeed) / (2 * context.profile.gravity);
  const upper =
    !landing &&
    stationaryPlatforms(world)
      .filter((rect) => {
        const rise = foot - rect.y;
        return (
          rise > epsilon &&
          rise <= maximumRise &&
          Math.abs(move === 1 ? rect.x - departure.right : rect.x + rect.width - departure.left) <=
            epsilon
        );
      })
      .sort((a, b) => b.y - a.y)[0];
  const next = landing ?? upper;
  if (!next) {
    return undefined;
  }
  const span = supportedSpan(world, next);
  const sameLanding = goal.x >= span.left - epsilon && goal.x + goal.width <= span.right + epsilon;
  if (span.right - span.left < body.width || (!upper && sameLanding)) {
    return undefined;
  }
  return {
    goal:
      upper && sameLanding
        ? goal
        : {
            height: body.height + 2 * epsilon,
            width: span.right - span.left,
            x: span.left,
            y: next.y - body.height - epsilon,
          },
    jump: Boolean(upper),
  };
}

// A clearable wall's top surface stages a climb whose whole route exceeds one native horizon.
function ascentWaypoint(
  world: BehaviourWorld,
  context: TraversalContext<TraversalSupport>,
  start: TraversalState<TraversalSupport>,
  goal: Rect,
): Rect | undefined {
  if (!start.grounded) {
    return undefined;
  }
  const { body, epsilon, profile } = context;
  const left = start.x + body.offset.x;
  const right = left + body.width;
  const top = start.y + body.offset.y;
  const foot = top + body.height;
  const move = goal.x >= right - epsilon ? 1 : goal.x + goal.width <= left + epsilon ? -1 : 0;
  if (move === 0) {
    return undefined;
  }
  const touching = world.solids.filter(
    (rect) =>
      Math.abs(move === 1 ? rect.x - right : rect.x + rect.width - left) <= epsilon &&
      rect.y < foot - epsilon &&
      rect.y + rect.height > top + epsilon,
  );
  const wall = touching.sort((a, b) => a.y - b.y)[0];
  const maximumRise = (profile.jumpSpeed * profile.jumpSpeed) / (2 * profile.gravity);
  if (!wall || foot - wall.y > maximumRise) {
    return undefined;
  }
  const span = supportedSpan(world, wall);
  const sameLanding = goal.x >= span.left - epsilon && goal.x + goal.width <= span.right + epsilon;
  return span.right - span.left < body.width || sameLanding
    ? undefined
    : {
        height: body.height + 2 * epsilon,
        width: span.right - span.left,
        x: span.left,
        y: wall.y - body.height - epsilon,
      };
}

function waypointInputs(
  context: TraversalContext<TraversalSupport>,
  request: TraversalRequest<TraversalSupport>,
  move: -1 | 1,
  jump = false,
): readonly TraversalCommand[] {
  const { body, dtSeconds, epsilon, profile } = context;
  const left = request.start.x + body.offset.x;
  const distance =
    move === 1 ? request.goal.x + request.goal.width - left - body.width : left - request.goal.x;
  const steps = Math.max(0, Math.floor((distance + epsilon) / (profile.walkSpeed * dtSeconds)));
  return Array.from({ length: request.horizonSteps }, (_, index) => ({
    jump: jump && index === 0,
    move: index < steps ? move : 0,
  }));
}

function originSegments(
  object: ObjectLayout,
  offset: Point,
  segments: readonly TraversalSafety[],
): readonly TraversalSafety[] {
  const originRect = (rect: Rect): Rect => ({
    height: object.height,
    width: object.width,
    x: rect.x - offset.x,
    y: rect.y - offset.y,
  });
  return segments.map((leg) => ({ ...leg, from: originRect(leg.from), to: originRect(leg.to) }));
}

// A ground body whose support has gone falls under its pursuit physics with no input. The fall
// is not a chosen move, so hazards do not veto it. Undefined while the body stands on support.
export function supportFall(
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: GroundMotion,
  seconds: number,
  prior: BehaviourTraversalState | undefined,
  at: Point,
):
  | {
      readonly at: Point;
      readonly segments: readonly TraversalSafety[];
      readonly traversal: BehaviourTraversalState;
    }
  | undefined {
  const context = traversalContext(world, seconds, object, motion);
  const frame = world.traversalFrame;
  if (!context || !frame) {
    return undefined;
  }
  const physical =
    prior?.physical.x === at.x && prior.physical.y === at.y
      ? prior.physical
      : { fallFromY: at.y + object.height, grounded: true, vy: 0, ...at };
  const fell = stepTraversal(
    { ...context, safe: () => true },
    { jump: false, move: 0, timeSeconds: frame.timeSeconds },
    physical,
  );
  if (fell.status !== "ok" || (physical.grounded && fell.state.grounded)) {
    return undefined;
  }
  return {
    at: fell.state,
    segments: originSegments(object, context.body.offset, fell.segments),
    traversal: {
      geometry: "",
      inputs: [],
      physical: fell.state,
      status: "geometry-unavailable",
      target: { ...at, height: object.height, width: object.width },
    },
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
  return advanceTraversalStep(
    world,
    object,
    motion,
    seconds,
    prior,
    () => traversalGoal(world, object, at, target),
    at,
    target,
  );
}

export function advanceTraversalTo(
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: GroundMotion,
  seconds: number,
  prior: BehaviourTraversalState,
  goal: Rect,
  at: Point,
) {
  return advanceTraversalStep(world, object, motion, seconds, prior, () => goal, at, goal);
}

function advanceTraversalStep(
  world: BehaviourWorld,
  object: ObjectLayout,
  motion: GroundMotion,
  seconds: number,
  prior: BehaviourTraversalState | undefined,
  resolveGoal: () => Rect | undefined,
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
  if (prior?.preparation) {
    const preparation = prior.preparation;
    const previous = { ...prior };
    delete (previous as { preparation?: unknown }).preparation;
    const waited = stepTraversal(
      context,
      { jump: false, move: 0, timeSeconds: frame.timeSeconds },
      physical,
    );
    const hold = (state: BehaviourTraversalState) => ({
      at: waited.status === "ok" ? waited.state : at,
      ...(waited.status === "ok" && {
        segments: originSegments(object, context.body.offset, waited.segments),
      }),
      traversal: { ...state, physical: waited.status === "ok" ? waited.state : physical },
    });
    if (
      waited.status !== "ok" ||
      !waited.state.grounded ||
      waited.state.supportId !== preparation.supportId
    ) {
      return hold({
        ...previous,
        inputs: [],
        status: waited.status === "geometry-unavailable" ? "geometry-unavailable" : previous.status,
      });
    }
    if (preparation.remainingSeconds > EDGE) {
      return hold({
        ...previous,
        preparation: {
          ...preparation,
          remainingSeconds: Math.max(0, preparation.remainingSeconds - seconds),
        },
      });
    }
    // The tell's wait invalidates timed mover predictions; prove the prepared takeoff again now.
    const searchContext = { ...context, dtSeconds: STEP_SECONDS };
    const request: TraversalRequest<TraversalSupport> = {
      ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
      goal: prior.target,
      start: physical,
      timeSeconds: frame.timeSeconds,
    };
    const preferredInputs = preferredAscentInputs(world, searchContext, request);
    const proof = findTraversal(searchContext, {
      ...request,
      ...(preferredInputs && { preferredInputs }),
    });
    const launch = proof.status === "found" ? proof.inputs[0] : undefined;
    if (!launch?.jump || launch.move !== preparation.move) {
      return hold({
        ...previous,
        inputs: proof.status === "found" ? proof.inputs : [],
        status: proof.status,
      });
    }
    const advanced = stepTraversal(
      context,
      { ...launch, timeSeconds: frame.timeSeconds },
      physical,
    );
    if (advanced.status !== "ok") {
      return hold({
        ...previous,
        inputs: [],
        status:
          advanced.status === "geometry-unavailable" ? "geometry-unavailable" : previous.status,
      });
    }
    return {
      at: advanced.state,
      segments: originSegments(object, context.body.offset, advanced.segments),
      traversal: {
        ...previous,
        inputs: proof.status === "found" ? proof.inputs.slice(1) : [],
        physical: advanced.state,
        status: "found" as const,
      },
    };
  }
  let goal = prior?.inputs.length ? prior.target : resolveGoal();
  const key =
    frame.platforms
      .map(({ after, before }) => [before.x, before.y, after.x, after.y].join(":"))
      .join(";") + (frame.crumbling?.key ?? "");
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
  // Without planned inputs, a grounded body whose support has gone falls instead of holding
  // its place.
  if (
    !prior?.inputs.length &&
    physical.grounded &&
    direct.status === "ok" &&
    !direct.state.grounded
  ) {
    const fall = supportFall(world, object, motion, seconds, prior, at);
    if (fall) {
      return {
        ...fall,
        traversal: {
          ...fall.traversal,
          status: prior?.status ?? fall.traversal.status,
          target: goal ?? target,
        },
      };
    }
  }
  const progress = direct.status === "ok" && Math.abs(direct.state.x - physical.x) > EDGE;
  const waypoint =
    !inputs.length && goal && supportedWaypoint(world, context, direct, physical, goal);
  if (waypoint) {
    goal = waypoint.goal;
  }
  const resolved = goal;
  const sameGoal =
    resolved &&
    prior &&
    ["x", "y", "width", "height"].every(
      (axis) => resolved[axis as keyof Rect] === prior.target[axis as keyof Rect],
    );
  if (
    !inputs.length &&
    direct.status === "ok" &&
    (!physical.grounded || (direct.state.grounded && progress))
  ) {
    return {
      at: direct.state,
      segments: originSegments(object, context.body.offset, direct.segments),
      traversal: {
        geometry: key,
        ...(searchedAt && { searchedAt }),
        inputs: [],
        physical: direct.state,
        status: sameGoal ? (prior?.status ?? "geometry-unavailable") : "geometry-unavailable",
        target: goal ?? target,
      },
    };
  }
  // Start fixed-quantum witnesses on full steps; graph remainders only integrate motion.
  if (
    !inputs.length &&
    goal &&
    seconds + EDGE >= STEP_SECONDS &&
    (!searchedAt ||
      searchedAt.x !== at.x ||
      searchedAt.y !== at.y ||
      !sameGoal ||
      prior?.geometry !== key ||
      prior.status === "found")
  ) {
    const searchContext = { ...context, dtSeconds: STEP_SECONDS };
    const request: TraversalRequest<TraversalSupport> = {
      ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
      goal,
      start: physical,
      timeSeconds: frame.timeSeconds,
    };
    const preferredInputs = waypoint
      ? waypointInputs(searchContext, request, move === -1 ? -1 : 1, waypoint.jump)
      : (preferredDescentInputs(world, searchContext, request, direct) ??
        (!progress ? preferredAscentInputs(world, searchContext, request) : undefined));
    let result = findTraversal(searchContext, {
      ...request,
      ...(preferredInputs && { preferredInputs }),
    });
    // An exhausted climb retries toward the blocking wall's top in this search event,
    // so the unchanged position, goal and geometry cannot leave it without a staged leg.
    const ascent =
      result.status === "budget-exhausted" &&
      !waypoint &&
      !progress &&
      ascentWaypoint(world, searchContext, physical, goal);
    if (ascent) {
      const staged = { ...request, goal: ascent };
      const climbInputs = preferredAscentInputs(world, searchContext, staged);
      const climb = findTraversal(searchContext, {
        ...staged,
        ...(climbInputs && { preferredInputs: climbInputs }),
      });
      if (climb.status === "found") {
        goal = ascent;
        result = climb;
      }
    }
    searchedAt = at;
    status = result.status;
    inputs = result.status === "found" ? result.inputs : [];
  }
  const planned = inputs[0];
  if (planned?.jump && physical.grounded && motion.traversal!.prepSeconds > 0) {
    const waited = stepTraversal(
      context,
      { jump: false, move: 0, timeSeconds: frame.timeSeconds },
      physical,
    );
    return {
      at: waited.status === "ok" ? waited.state : at,
      ...(waited.status === "ok" && {
        segments: originSegments(object, context.body.offset, waited.segments),
      }),
      traversal: {
        geometry: key,
        inputs: [],
        physical: waited.status === "ok" ? waited.state : physical,
        ...(waited.status === "ok" &&
          waited.state.grounded && {
            preparation: {
              move: planned.move,
              remainingSeconds: Math.max(0, motion.traversal!.prepSeconds - seconds),
              startedAtSeconds: frame.timeSeconds,
              ...(waited.state.supportId !== undefined && { supportId: waited.state.supportId }),
            },
          }),
        status,
        target: goal ?? target,
      },
    };
  }

  let result = planned
    ? stepTraversal(context, { ...planned, timeSeconds: frame.timeSeconds }, physical)
    : direct;
  // An airborne body that cannot take a chosen step still falls; hazards do not veto gravity.
  if (result.status !== "ok" && !physical.grounded) {
    const falling = stepTraversal(
      { ...context, safe: () => true },
      { ...input, move: 0 },
      physical,
    );
    if (falling.status === "ok") {
      result = falling;
    }
  }
  const accepted =
    result.status === "ok" && (planned || !physical.grounded || result.state.grounded);
  return {
    at: accepted ? result.state : at,
    ...(accepted && { segments: originSegments(object, context.body.offset, result.segments) }),
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
  const key =
    (frame?.platforms ?? [])
      .filter(({ after, before }) => intersects(before, local) || intersects(after, local))
      .map(({ after, before }) => [before.x, before.y, after.x, after.y].join(":"))
      .join(";") + (frame?.crumbling?.key ?? "");
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
