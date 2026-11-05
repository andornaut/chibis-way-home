// Ground pursuit route choice on the boss's movement map. The map picks the next edge of the
// fastest path to Chibi's node, or the reachable spot nearest him to pace at; the existing
// traversal kernel executes and proves every leg.
import {
  type EdgeId,
  locate,
  type MapMask,
  type MapNode,
  type MovementMap,
  nearestReachable,
  type NodeId,
  type NodeRef,
  pathTo,
} from "@andornaut/game-kit/terrain/movementMap";
import type { TraversalCommand } from "@andornaut/game-kit/terrain/traversal";

import { collisionCandidates, EDGE } from "../core";
import { TILE } from "../data/screen";
import type { ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourWorld } from "./behaviourReach";
import type { MapSupport, PursuitGroundMap } from "./movementMaps";
import { timedHazardSafe } from "./timedHazard";

export interface BehaviourMapPursuitState {
  // An edge whose witness landed part-way (a wall top): its rest from this command continues
  // as the next leg.
  readonly continuing?: { readonly edge: EdgeId; readonly offset: number };
  // Edges whose leg proof failed, disabled while the boss's node, Chibi's goal and the mask key
  // stay as `key` says, until the next pace turn.
  readonly failed: readonly EdgeId[];
  readonly key: string;
  readonly paceDirection?: -1 | 1;
  // The route chosen for `key`, reused until it changes: the next edge, a chase on Chibi's node,
  // or a pace around the hitbox-left x nearest him; and whether a path reaches him.
  readonly route?: {
    readonly key: string;
    readonly next: { readonly edge: EdgeId } | { readonly chase: true } | { readonly pace: number };
    readonly reachable: boolean;
  };
}

// One leg towards the goal. `chase`: the boss shares Chibi's node and chases him directly.
// `edge`: walk to the launch point (hitbox-left x), then take the edge to its target node.
// `pace`: walk to a pace end on the current node at pace speed.
export type MapLeg =
  | { readonly kind: "chase" }
  | {
      readonly commands: readonly TraversalCommand[];
      readonly edge: EdgeId;
      readonly goal: Rect;
      readonly kind: "edge";
      // Undefined while continuing an edge from its part-way landing.
      readonly launch?: number;
      // The first command's index in the edge's witness.
      readonly offset: number;
      readonly walk: boolean;
    }
  | { readonly goal: Rect; readonly kind: "pace" };

export interface MapPlan {
  readonly leg: MapLeg;
  readonly state: BehaviourMapPursuitState;
}

function hitbox(object: ObjectLayout, at: Point): Rect {
  const box = object.hitbox;
  return {
    height: box?.height ?? object.height,
    width: box?.width ?? object.width,
    x: at.x + (box?.x ?? 0),
    y: at.y + (box?.y ?? 0),
  };
}

// The hitbox envelope over a node's whole span, as a traversal goal.
function nodeGoal(
  map: MovementMap<MapSupport>,
  node: MapNode<MapSupport>,
  left = node.left,
  right = node.right,
): Rect {
  const { height, width } = map.profile.body;
  return {
    height: height + 2 * EDGE,
    width: right - left + width,
    x: left,
    y: node.y - height - EDGE,
  };
}

const fixedOwner = (owner: ObjectLayout) =>
  owner.motion.algorithm === "static" &&
  !owner.behaviour &&
  !owner.orbit &&
  owner.reaction.kind === "none";

// The support top under Chibi's body (the highest at or below his feet across his width) and
// whether the map holds it. Over a pit his feet stand in for it.
function targetSupport(
  world: BehaviourWorld,
  object: ObjectLayout,
  entry: PursuitGroundMap,
  hers: Rect,
): { readonly mapped: boolean; readonly y: number } {
  const feet = hers.y + hers.height;
  let best: { mapped: boolean; y: number } | undefined;
  const consider = (rect: Rect, mapped: boolean) => {
    if (
      rect.y >= feet - EDGE &&
      rect.x < hers.x + hers.width &&
      hers.x < rect.x + rect.width &&
      (!best || rect.y < best.y)
    ) {
      best = { mapped, y: rect.y };
    }
  };
  for (const rect of collisionCandidates(world.solids, { ...hers, height: Infinity })) {
    consider(rect, true);
  }
  for (const { owner, rect } of world.platforms ?? []) {
    if (owner !== object) {
      consider(
        rect,
        fixedOwner(owner) &&
          entry.terrain.area.colliders.some(({ supportId }) => supportId === owner),
      );
    }
  }
  return best ?? { mapped: true, y: feet };
}

// Disables track and climb edges (pursuit never climbs), edges that failed their leg proof, and
// any node or edge whose dynamic terrain is absent, of unknown future presence, or not clear of
// a timed or moving hazard over the edge's travel.
export function pursuitMapMask(
  world: BehaviourWorld,
  entry: PursuitGroundMap,
  failed: readonly EdgeId[],
): MapMask {
  const { map, terrain } = entry;
  const frame = world.traversalFrame;
  const now = frame?.timeSeconds ?? 0;
  const present = (dep: MapSupport) =>
    "character" in dep
      ? (world.platforms ?? []).some(({ owner }) => owner === dep)
      : world.solids.includes(dep);
  const supportRect = (dep: MapSupport): Rect =>
    "character" in dep ? { ...dep.origin, height: dep.height, width: dep.width } : dep;
  const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.width - EDGE &&
    b.x < a.x + a.width - EDGE &&
    a.y < b.y + b.height - EDGE &&
    b.y < a.y + a.height - EDGE;
  const crumblingKnown = (dep: MapSupport, until: number) => {
    const rect = supportRect(dep);
    return (
      present(dep) &&
      !(frame?.crumbling?.unknown(until) ?? []).some((volume) => overlaps(volume, rect))
    );
  };
  const disabled = new Set(failed);
  return {
    edge: (id, departSeconds) => {
      const edge = map.edges[id]!;
      if (edge.kind === "climb" || edge.kind === "track-climb" || disabled.has(id)) {
        return false;
      }
      const start = now + departSeconds;
      const end = start + edge.seconds;
      return edge.deps.every((dep) => {
        if (terrain.crumbling.has(dep)) {
          return crumblingKnown(dep, end);
        }
        const hazard = (world.hazards ?? []).find(({ owner }) => owner === dep);
        if (!hazard) {
          return true;
        }
        if (hazard.timedContacts) {
          return timedHazardSafe(hazard.timedContacts, {
            endSeconds: end,
            from: edge.sweep,
            phase: "sweep",
            startSeconds: start,
            to: edge.sweep,
          });
        }
        const bounds = hazard.boundsAt?.(end);
        return (
          bounds !== undefined &&
          [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
          !overlaps(bounds, edge.sweep)
        );
      });
    },
    key: `${frame?.crumbling?.key ?? ""}|${failed.join(",")}`,
    node: (id) =>
      map.nodes[id]!.deps.every((dep) => !terrain.crumbling.has(dep) || crumblingKnown(dep, now)),
  };
}

interface MapGoalView {
  readonly from: NodeRef;
  readonly mask: MapMask;
  readonly predicate: (node: MapNode<MapSupport>) => boolean;
  readonly toward: Point;
}

// Where the boss stands on its map and the nodes that count as Chibi's: the boss-body spans on
// his support whose hitbox range meets his body. Undefined when the boss is off the map (in the
// air or on a mover) or Chibi stands on a mover, which the on-demand planner handles.
function goalView(
  world: BehaviourWorld,
  object: ObjectLayout,
  entry: PursuitGroundMap,
  failed: readonly EdgeId[],
  at: Point,
  hers: Rect,
): MapGoalView | undefined {
  const { map } = entry;
  const from = locate(map, hitbox(object, at));
  const support = targetSupport(world, object, entry, hers);
  if (!from || !support.mapped) {
    return undefined;
  }
  const mask = pursuitMapMask(world, entry, failed);
  if (!mask.node(from.node)) {
    return undefined;
  }
  const { width } = map.profile.body;
  return {
    from,
    mask,
    predicate: (node) =>
      Math.abs(node.y - support.y) <= 2 * EDGE &&
      node.right + width > hers.x &&
      node.left < hers.x + hers.width,
    toward: { x: hers.x + hers.width / 2, y: support.y },
  };
}

// Whether map pursuit applies: the boss stands on its map and Chibi on mapped support.
export function mapCovers(
  world: BehaviourWorld,
  object: ObjectLayout,
  entry: PursuitGroundMap,
  at: Point,
  hers: Rect,
): boolean {
  return goalView(world, object, entry, [], at, hers) !== undefined;
}

// Whether the map has a path from the boss to Chibi's node, or undefined off the map.
export function mapReachable(
  world: BehaviourWorld,
  object: ObjectLayout,
  entry: PursuitGroundMap,
  at: Point,
  hers: Rect,
): boolean | undefined {
  const view = goalView(world, object, entry, [], at, hers);
  return (
    view && pathTo(entry.map, view.mask, view.from, { predicate: view.predicate }) !== undefined
  );
}

const clamp = (low: number, high: number, value: number) => Math.max(low, Math.min(high, value));

function edgeLeg(entry: PursuitGroundMap, id: EdgeId, x: number): MapLeg {
  const { map } = entry;
  const edge = map.edges[id]!;
  return {
    commands: edge.commands,
    edge: id,
    goal: nodeGoal(map, map.nodes[edge.to]!),
    kind: "edge",
    launch: clamp(edge.launch.left, edge.launch.right, x),
    offset: 0,
    walk: edge.kind === "walk",
  };
}

// The next leg: the first edge of the fastest path to Chibi's node, else of the path to the
// reachable spot nearest him, else a pace there. `step` is the walk distance of one tick.
export function planMapLeg(
  world: BehaviourWorld,
  object: ObjectLayout,
  entry: PursuitGroundMap,
  pace: { readonly distance: number },
  step: number,
  prior: BehaviourMapPursuitState | undefined,
  at: Point,
  hers: Rect,
): MapPlan | undefined {
  const { map } = entry;
  const from = locate(map, hitbox(object, at));
  // Between a part-way landing and the edge's target, the edge's witness continues.
  const continuing = prior?.continuing;
  const partway = continuing && map.edges[continuing.edge]!;
  if (continuing && partway && from?.node !== partway.to && from?.node !== partway.from) {
    return {
      leg: {
        commands: partway.commands.slice(continuing.offset),
        edge: continuing.edge,
        goal: nodeGoal(map, map.nodes[partway.to]!),
        kind: "edge",
        offset: continuing.offset,
        walk: false,
      },
      state: prior,
    };
  }
  if (!from) {
    return undefined;
  }
  const support = targetSupport(world, object, entry, hers);
  const key = `${from.node}|${support.y}|${world.traversalFrame?.crumbling?.key ?? ""}`;
  const failed = prior?.key === key ? prior.failed : [];
  const view = goalView(world, object, entry, failed, at, hers);
  if (!view) {
    return undefined;
  }
  // The route is replanned when the node, Chibi's support, the mask or his position to within
  // ROUTE_BUCKET tiles changes.
  const routeKey = `${key}|${failed.join(",")}|${Math.floor(view.toward.x / (ROUTE_BUCKET * TILE))}`;
  const route = prior?.route?.key === routeKey ? prior.route : chooseRoute(entry, view, routeKey);
  const state = { failed, key, route };
  const { next } = route;
  if ("edge" in next) {
    return { leg: edgeLeg(entry, next.edge, from.x), state };
  }
  if ("chase" in next) {
    return { leg: { kind: "chase" }, state };
  }
  const node = map.nodes[from.node]!;
  const half = Math.min(pace.distance, node.right - node.left) / 2;
  const low = clamp(node.left, node.right - 2 * half, next.pace - half);
  const high = low + 2 * half;
  let direction = prior?.paceDirection ?? (from.x < next.pace ? 1 : -1);
  const turned = Math.abs((direction === 1 ? high : low) - from.x) <= step + EDGE;
  if (turned) {
    direction = direction === 1 ? -1 : 1;
  }
  const x = direction === 1 ? high : low;
  return {
    leg: { goal: nodeGoal(map, node, x, x), kind: "pace" },
    state: turned
      ? { failed: [], key, paceDirection: direction }
      : { ...state, paceDirection: direction },
  };
}

// Chibi's position bucket, in tiles, within which a route stays chosen.
const ROUTE_BUCKET = 4;

// The first edge of the fastest path to Chibi's node, a chase when the boss is on it, else the
// first edge towards the reachable spot nearest him, else a pace there.
function chooseRoute(
  entry: PursuitGroundMap,
  view: MapGoalView,
  key: string,
): NonNullable<BehaviourMapPursuitState["route"]> {
  const { map } = entry;
  const path = pathTo(map, view.mask, view.from, { predicate: view.predicate });
  if (path) {
    return {
      key,
      next: path.edges.length ? { edge: path.edges[0]! } : { chase: true },
      reachable: true,
    };
  }
  const near = nearestReachable(map, view.mask, view.from, view.toward)!;
  const edge =
    near.node === view.from.node
      ? undefined
      : pathTo(map, view.mask, view.from, { node: near.node as NodeId })?.edges[0];
  return { key, next: edge === undefined ? { pace: near.x } : { edge }, reachable: false };
}

// An idle ground recovery's goal: the map position nearest Chibi when it lies at least
// `minMovement` away, the landing node of the first edge towards it when it is on another node,
// or else a pace end `distance` away on the current node. A hitbox envelope, or undefined when
// the boss is off its map or no spot is that far.
export function mapRecoveryGoal(
  world: BehaviourWorld,
  object: ObjectLayout,
  entry: PursuitGroundMap,
  config: { readonly distance: number; readonly minMovement: number },
  at: Point,
  hers: Rect,
): Rect | undefined {
  const { map } = entry;
  const view = goalView(world, object, entry, [], at, hers);
  if (!view) {
    return undefined;
  }
  const { from } = view;
  const near = nearestReachable(map, view.mask, from, view.toward)!;
  if (near.node !== from.node) {
    const edge = pathTo(map, view.mask, from, { node: near.node as NodeId })?.edges[0];
    return edge === undefined ? undefined : nodeGoal(map, map.nodes[map.edges[edge]!.to]!);
  }
  const node = map.nodes[from.node]!;
  const far = (x: number) => Math.abs(x - from.x) >= config.minMovement;
  const away = from.x <= near.x ? -1 : 1;
  const x = [near.x, near.x + away * config.distance, near.x - away * config.distance]
    .map((value) => clamp(node.left, node.right, value))
    .find(far);
  return x === undefined
    ? undefined
    : nodeGoal(map, node, Math.max(node.left, x - EDGE), Math.min(node.right, x + EDGE));
}

// Records that a chase on Chibi's node made no progress (terrain the map leaves out, such as a
// mover, blocks it): the boss paces back from the blocked hitbox-left x `at`, away from `toward`,
// until the route changes.
export function blockMapChase(
  pace: { readonly distance: number },
  at: number,
  toward: number,
  state: BehaviourMapPursuitState,
): BehaviourMapPursuitState {
  const route = state.route;
  const away = toward < at ? 1 : -1;
  return route
    ? { ...state, route: { ...route, next: { pace: at + (away * pace.distance) / 2 } } }
    : state;
}

// Records that an edge's leg proof failed, so the next plan avoids it.
export function failMapEdge(
  edge: EdgeId,
  state: BehaviourMapPursuitState,
): BehaviourMapPursuitState {
  const next = { ...state };
  delete (next as { continuing?: unknown }).continuing;
  return state.failed.includes(edge) ? next : { ...next, failed: [...state.failed, edge] };
}

// Records the progress of a leg whose found takeoff covers `consumed` witness commands before
// a part-way landing, or clears the continuation once a leg covers the rest.
export function advanceMapEdge(
  leg: Extract<MapLeg, { readonly kind: "edge" }>,
  consumed: number | undefined,
  state: BehaviourMapPursuitState,
): BehaviourMapPursuitState {
  const next = { ...state };
  delete (next as { continuing?: unknown }).continuing;
  return consumed === undefined
    ? next
    : { ...next, continuing: { edge: leg.edge, offset: leg.offset + consumed } };
}
