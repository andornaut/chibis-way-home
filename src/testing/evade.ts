// The evade playtest: a skill-free Chibi controller that gets through an arena past its boss by
// its routes and refuges, and walks out once the boss is behind him or the chase ends. It moves
// with run, jump and flutter only (no Dash or double jump), decides every DECIDE_SECONDS from
// what Chibi sees, and sees the boss BOSS_FAIRNESS's reaction delay late: its body, facing,
// pursuit and visible tell, never its scorer, plan, timers or seed. The boss's distance to a spot
// is its own movement map's path distance there, unbounded where its body does not fit or its
// map has no path. Policy, first match wins:
// 0. The boss behind him (its body centre left of his feet by a tile) and beyond THREAT_TILES,
//    with a path to the exit on his map clear of the boss: head for the exit.
// 1. At a countering refuge the engaged boss cannot reach: hold.
// 2. A visible tell: one of the attack's named dodges (BOSS_FAIRNESS). A retreat, beyond
//    THREAT_TILES where the attack names one and the loop leads away from the boss, follows the
//    loop on his map; otherwise its first named dodge other than retreat, by the shared scripts.
// 3. The engaged boss within THREAT_TILES of Chibi, or closing faster than his walk: head for the
//    waypoint, on any route or refuge, that maximizes the boss's distance minus his.
// 4. Otherwise: keep moving round the loop away from the boss, or toward a countering refuge, by
//    the same score over the loop's and refuges' next waypoints. A refuge the boss can reach is a
//    waypoint, never a place to wait.
// A route's open end is a target only where the boss cannot reach it, and an unreached target is
// kept while the boss is farther from it than he is. Ties go to the nearer waypoint, then the
// route id. Once the chase ends he walks to the exit on his movement map, waiting while anything
// thrown is in flight or the boss ahead threatens him as in rule 3.
// A run needs a switch: a move to another route or refuge, or a change of level on the loop (he
// lands at one loop waypoint row after standing at another while following the loop).
// He aims for a waypoint where he can stand nearest it on its row, and scores the boss there by
// its least distance to that point and the points either side where its body would touch his.
// He moves only by his map: a
// jump leg holds its actual full-jump profile, then replans from physical support if a landing
// interrupts its witness. A walk without an edge stays on its span.
import { type Rect, rectsOverlap } from "@andornaut/game-kit/rect";
import {
  type AirMap,
  type AirMask,
  type AirNodeId,
  airPath,
  locateAir,
} from "@andornaut/game-kit/terrain/airMap";
import {
  locate,
  type MapEdge,
  type MapMask,
  type MapNode,
  type MovementMap,
  type NodeRef,
  pathTo,
} from "@andornaut/game-kit/terrain/movementMap";

import { type AgentSample, centre } from "../ai/agentTrace";
import { traceRecorder } from "../ai/trace";
import { EDGE, STEP_SECONDS } from "../core";
import { ARENA_COUNTERS } from "../data/arenas";
import { BOSS_FAIRNESS } from "../data/bossFairness";
import { TILE } from "../data/screen";
import type {
  AntagonistKind,
  ArenaRoute,
  BirdTuning,
  ObjectLayout,
  Point,
  TilePoint,
  ZoneLayout,
} from "../data/types";
import { SKILL_PROFILES } from "../progress";
import type { BehaviourObserver } from "../rules/behaviourObserver";
import {
  birdBox,
  type BirdState,
  ordinaryHorizontalVelocity,
  startBird,
  stepBird,
} from "../rules/bird";
import {
  airMask,
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  flightMap,
  groundMap,
  groundMask,
  type MapSupport,
  type MapTerrain,
} from "../rules/movementMaps";
import { currentScreen } from "../rules/perception";
import {
  startZone,
  stepZone,
  stepZoneObserved,
  type ZoneInput,
  type ZoneState,
} from "../rules/zone";
import { activateAll, bossSample, type BossTick, supportWorld } from "../sim/bossSimulator";
import { ALLOW, hitboxAt, standingAt } from "../sim/pathOut";
import { zoneTraceLine } from "../sim/zoneTrace";
import { type ArenaCase, type ArenaMaps, isLoop, pixelOf } from "./arenas";
import { DODGES, type DodgeView } from "./dodges";
import { ORDINARY } from "./encounterLayouts";
import { createProjectileAvoidance, type ProjectileFrame } from "./evadeProjectileAvoidance";
import {
  observeProjectiles,
  type ProjectileGravityByEmitter,
  projectileGravityModels,
} from "./evadeProjectiles";

export const EVADE_SEEDS: readonly number[] = [0, 1, 2, 3];
// entry: the boss acquires Chibi as he enters; mid: as he stands mid-arena on the loop, at its
// waypoint nearest the middle column beyond the threat distance of the boss's spawn.
export type EvadeStart = "entry" | "mid";
export const EVADE_STARTS: readonly EvadeStart[] = ["entry", "mid"];

export function observeProjectileFrame(
  tuning: BirdTuning,
  layout: ZoneLayout,
  gravityByEmitter: ProjectileGravityByEmitter,
  zone: ZoneState,
): ProjectileFrame {
  const area = layout.areas[zone.area]!;
  return {
    observation: observeProjectiles(
      {
        gravityByEmitter,
        observer: birdBox(tuning, zone.bird),
        world: { ...supportWorld(layout, zone), view: currentScreen(tuning, area, zone.bird) },
      },
      zone.transients,
    ),
    tick: zone.steps,
  };
}
// From the boss first acquiring him, he reaches the exit alive within this long.
export const EVADE_LIMIT_SECONDS = 60;
// In at least `runs` of an arena's runs, the exit comes `seconds` or more later than the
// boss-free walk: the same controller from the same start and seed with the boss removed.
export const EVADE_SLOWED = { runs: 6, seconds: 3 } as const;
const DECIDE_SECONDS = 0.1;
const THREAT_TILES = 6;
// A dodge that has not seen its attack end stops after this long.
const DODGE_LIMIT_SECONDS = 6;
const KEEP_TILES = 3;
const AVOID_TILES = 1;

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
const ticksOf = (seconds: number) => Math.round(seconds / STEP_SECONDS);

export interface EvadeControllerFailure {
  readonly kind: "unknown" | "unsafe" | "unsupported";
  readonly problem: string;
}

export interface EvadeRun {
  readonly controllerFailure?: EvadeControllerFailure;
  // Seconds from the start to the boss first acquiring him, and from then to the exit.
  readonly acquired?: number;
  readonly death?: string;
  readonly ended?: { readonly cause: string; readonly seconds: number };
  readonly exit?: number;
  // The boss-free walk's seconds from the start to the exit.
  readonly free?: number;
  // Changes of level while following the loop.
  readonly levels: number;
  readonly problems: readonly string[];
  readonly seed: number;
  readonly start: EvadeStart;
  readonly switches: number;
  readonly trace: string;
  readonly work: number;
}

interface Target {
  readonly index: number;
  readonly route: ArenaRoute;
}

// A dodge: a shared script, or a retreat that follows the loop on his map.
interface Dodge {
  readonly attack: string;
  readonly boss: string;
  ended?: number;
  readonly retreat?: true;
  readonly script?: (view: DodgeView) => ZoneInput;
  readonly started: number;
}

type BossMap =
  | { readonly kind: "ground"; readonly map: MovementMap<MapSupport>; readonly mask: MapMask }
  | {
      readonly kind: "air";
      readonly map: AirMap<MapSupport>;
      readonly mask: AirMask;
      readonly speed: number;
    };

// Each boss's own movement map, ground before air, for its distance to a spot.
function bossMaps(maps: ArenaMaps): Map<ObjectLayout, BossMap> {
  const { terrain } = maps.encounter;
  return new Map<ObjectLayout, BossMap>(
    maps.encounter.bosses.map((object): readonly [ObjectLayout, BossMap] => {
      const profiles = bossMovementProfiles(object);
      const ground = profiles.find(({ kind }) => kind === "ground");
      if (ground?.kind === "ground") {
        const map = groundMap({ jumps: BOSS_JUMP_SCRIPTS }, terrain, ground.profile);
        const mask = groundMask({ allowed: ALLOW, climb: true, key: "all" }, map);
        return [object, { kind: "ground", map, mask }] as const;
      }
      const air = profiles.find(({ kind }) => kind === "air");
      if (air?.kind !== "air") {
        throw new Error(`${object.character} has no movement profile`);
      }
      const map = flightMap({}, terrain, object, air.profile);
      const mask = airMask({ allowed: ALLOW, key: "all" }, map);
      return [object, { kind: "air", map, mask, speed: air.profile.speed }] as const;
    }),
  );
}

// The map distance from a standing position to a feet point: the path's seconds at the profile's
// walk speed, plus the walks along the first and last spans the path's legs leave out, and never
// less than the horizontal distance.
function mapDistance(
  map: MovementMap<MapSupport>,
  mask: MapMask,
  from: NodeRef,
  point: Point,
): number {
  const path = pathTo(map, mask, from, { point, radius: TILE });
  if (!path) {
    return Infinity;
  }
  const half = map.profile.body.width / 2;
  const gap = (x: number, range: { left: number; right: number }) =>
    Math.max(0, range.left - x, x - range.right);
  const first = path.edges[0] === undefined ? undefined : map.edges[path.edges[0]]!;
  const last = path.edges.at(-1) === undefined ? undefined : map.edges[path.edges.at(-1)!]!;
  const across = Math.abs(from.x + half - point.x);
  if (!first || !last) {
    return across;
  }
  // A landing range may hold the point, so the walk across never counts for less.
  return Math.max(
    across,
    path.seconds * map.profile.walkSpeed +
      gap(from.x, first.launch) +
      gap(point.x - half, last.land),
  );
}

// Where an airborne body comes down: the highest standing span under its feet that its x lies
// within.
function landing(map: MovementMap<MapSupport>, hitbox: Rect): NodeRef | undefined {
  const feet = hitbox.y + hitbox.height;
  let best: NodeRef | undefined;
  for (const { id, left, right, y } of map.nodes) {
    if (y >= feet - EDGE && hitbox.x >= left && hitbox.x <= right) {
      if (!best || y < map.nodes[best.node]!.y) {
        best = { node: id, x: hitbox.x };
      }
    }
  }
  return best;
}

// Whether a jump edge's proof is a full jump rather than a hop. The map's jumps are fixed
// impulses and an edge does not name its script, so the proof's apex above the launch tells
// them apart: above the midpoint of a hop's and a full jump's heights. He reaches a full jump's
// height by holding Jump through the rise, and a hop's by a tap.
export function fullJump(
  hopHeight: number,
  map: MovementMap<MapSupport>,
  edge: MapEdge<MapSupport>,
) {
  const { body, gravity, jumpSpeed } = map.profile;
  const apex = map.nodes[edge.from]!.y - body.height - edge.sweep.y;
  return (
    edge.commands.some(({ jump }) => jump) &&
    apex > (hopHeight + jumpSpeed ** 2 / (2 * gravity)) / 2
  );
}

type LaunchMove = -1 | 0 | 1;
type LaunchState = { readonly vx: number; readonly x: number };
type LaunchSafety = (from: number, to: number, move: LaunchMove) => boolean;
interface LaunchPlan {
  readonly commands: readonly LaunchMove[];
  readonly states: readonly LaunchState[];
}
interface LaunchSearchWork {
  readonly expansions: number;
  readonly states: number;
  readonly transitions: number;
}
type LaunchPreparation =
  | { readonly kind: "ready" }
  | {
      readonly input: ZoneInput;
      readonly kind: "prepare";
      readonly plan: LaunchPlan;
      readonly search?: LaunchSearchWork;
    }
  | {
      readonly kind: "unknown";
      readonly search?: LaunchSearchWork;
    };

// A map witness applies its horizontal command immediately. Prepare that velocity with ordinary
// ground inputs, proving the run-up stays on this support before starting the jump clock.
export function prepareLaunch(
  safeStep: LaunchSafety,
  tuning: BirdTuning,
  seconds: number,
  span: { readonly left: number; readonly right: number },
  launch: { readonly left: number; readonly right: number },
  move: -1 | 0 | 1,
  bird: { readonly vx: number; readonly x: number },
): LaunchPreparation {
  if (
    ![seconds, tuning.walkSpeed, tuning.groundAccel, tuning.brakeAccel].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    ![bird.x, bird.vx, span.left, span.right, launch.left, launch.right].every(Number.isFinite) ||
    span.left > span.right ||
    launch.left > launch.right ||
    bird.x < span.left - EDGE ||
    bird.x > span.right + EDGE
  ) {
    return { kind: "unknown" };
  }
  const acceleration = Math.min(tuning.groundAccel, tuning.brakeAccel);
  const limit =
    Math.ceil((2 * tuning.walkSpeed) / (acceleration * seconds)) +
    Math.ceil((span.right - span.left) / (tuning.walkSpeed * seconds)) +
    2;
  const horizon = 3 * limit;
  const budget = horizon * (Math.ceil((2 * tuning.walkSpeed) / (acceleration * seconds)) + 1);
  const transitionLimit = 3 * budget;
  const stepDistance = Math.max(tuning.walkSpeed, Math.abs(bird.vx)) * seconds;
  const velocityStep = Math.max(tuning.groundAccel, tuning.brakeAccel) * seconds;
  if (
    ![limit, horizon, budget, transitionLimit].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    ) ||
    ![stepDistance, velocityStep].every((value) => Number.isFinite(value) && value > 0)
  ) {
    return { kind: "unknown" };
  }
  if (!safeStep(bird.x, bird.x, 0)) {
    return { kind: "unknown" };
  }
  const speed = move * tuning.walkSpeed;
  const ready = ({ vx, x }: typeof bird) =>
    Math.abs(vx - speed) <= EDGE &&
    x >= launch.left - EDGE &&
    x <= launch.right + EDGE &&
    safeStep(x, x, move);
  if (ready(bird)) {
    return { kind: "ready" };
  }
  const search = { expansions: 0, states: 0, transitions: 0 };
  let exhausted = false;
  const unknown = () => ({ kind: "unknown", search: { ...search } }) as const;
  const advance = (state: typeof bird, command: -1 | 0 | 1) => {
    if (search.transitions === transitionLimit) {
      exhausted = true;
      return undefined;
    }
    search.transitions++;
    const vx = ordinaryHorizontalVelocity(tuning, seconds, command, true, state.vx);
    const x = state.x + vx * seconds;
    return x < span.left - EDGE || x > span.right + EDGE || !safeStep(state.x, x, command)
      ? undefined
      : { vx, x };
  };
  const forward = (initial: typeof bird, commands: (-1 | 0 | 1)[]) => {
    let state = initial;
    for (let tick = 0; tick < limit; tick++) {
      const next = advance(state, move);
      if (!next) {
        return undefined;
      }
      state = next;
      commands.push(move);
      if (ready(state)) {
        return commands;
      }
      if (state.vx === 0 && move === 0) {
        break;
      }
    }
    return undefined;
  };
  // Preserve feasible forward preparation; otherwise choose the shortest safe grounded prefix.
  let best = forward(bird, []);
  if (!best && move !== 0) {
    const opposite = move === 1 ? -1 : 1;
    let back = bird;
    const prefix: (-1 | 0 | 1)[] = [];
    for (let ticks = 0; ticks < limit; ticks++) {
      for (const brake of [false, true]) {
        let state = back;
        const commands = [...prefix];
        if (brake) {
          while (state.vx !== 0 && commands.length < 2 * limit) {
            const next = advance(state, 0);
            if (!next) {
              break;
            }
            state = next;
            commands.push(0);
          }
          if (state.vx !== 0) {
            continue;
          }
        }
        const candidate = forward(state, commands);
        if (candidate && (!best || candidate.length < best.length)) {
          best = candidate;
        }
      }
      const next = advance(back, opposite);
      if (!next) {
        break;
      }
      back = next;
      prefix.push(opposite);
    }
  }
  if (exhausted) {
    return unknown();
  }
  if (!best) {
    const toward = bird.x < launch.left ? 1 : bird.x > launch.right ? -1 : 0;
    const moves: readonly LaunchMove[] =
      move === 0
        ? toward === 0
          ? [0, -1, 1]
          : [toward, 0, toward === 1 ? -1 : 1]
        : [move, 0, move === 1 ? -1 : 1];
    const heuristic = (state: LaunchState) =>
      Math.max(
        Math.ceil(
          Math.max(0, launch.left - state.x - EDGE, state.x - launch.right - EDGE) / stepDistance,
        ),
        Math.ceil(Math.max(0, Math.abs(state.vx - speed) - EDGE) / velocityStep),
      );
    const records: {
      command: LaunchMove;
      depth: number;
      heap: number;
      lower: number;
      order: number;
      parent: number;
      state: LaunchState;
    }[] = [
      { command: 0, depth: 0, heap: -1, lower: heuristic(bird), order: 0, parent: -1, state: bird },
    ];
    const visited = new Map<number, Map<number, number>>([[bird.x, new Map([[bird.vx, 0]])]]);
    const heap: number[] = [];
    let order = 0;
    const earlier = (left: number, right: number) => {
      const a = records[left]!;
      const b = records[right]!;
      return (
        a.depth + a.lower < b.depth + b.lower ||
        (a.depth + a.lower === b.depth + b.lower && a.order < b.order)
      );
    };
    const swap = (left: number, right: number) => {
      [heap[left], heap[right]] = [heap[right]!, heap[left]!];
      records[heap[left]!]!.heap = left;
      records[heap[right]!]!.heap = right;
    };
    const enqueue = (index: number) => {
      const record = records[index]!;
      if (record.heap === -1) {
        record.heap = heap.length;
        record.order = order++;
        heap.push(index);
      }
      let at = record.heap;
      while (at > 0) {
        const parent = Math.floor((at - 1) / 2);
        if (!earlier(heap[at]!, heap[parent]!)) {
          break;
        }
        swap(at, parent);
        at = parent;
      }
    };
    const pop = () => {
      const index = heap[0]!;
      const last = heap.pop()!;
      records[index]!.heap = -1;
      if (heap.length > 0) {
        heap[0] = last;
        records[last]!.heap = 0;
        let at = 0;
        while (2 * at + 1 < heap.length) {
          let child = 2 * at + 1;
          if (child + 1 < heap.length && earlier(heap[child + 1]!, heap[child]!)) {
            child++;
          }
          if (!earlier(heap[child]!, heap[at]!)) {
            break;
          }
          swap(at, child);
          at = child;
        }
      }
      return index;
    };
    enqueue(0);
    search.states = 1;
    while (heap.length > 0) {
      if (search.expansions === budget) {
        return unknown();
      }
      const index = pop();
      const record = records[index]!;
      search.expansions++;
      if (ready(record.state)) {
        best = [];
        for (let at = index; records[at]!.parent !== -1; at = records[at]!.parent) {
          best.push(records[at]!.command);
        }
        best.reverse();
        break;
      }
      if (record.depth === horizon) {
        continue;
      }
      for (const command of moves) {
        if (command === 0 && record.state.vx === 0) {
          continue;
        }
        const next = advance(record.state, command);
        if (exhausted) {
          return unknown();
        }
        if (!next) {
          continue;
        }
        const depth = record.depth + 1;
        const lower = heuristic(next);
        if (depth + lower > horizon) {
          continue;
        }
        const previous = visited.get(next.x)?.get(next.vx);
        if (previous !== undefined) {
          if (records[previous]!.depth <= depth) {
            continue;
          }
          Object.assign(records[previous]!, { command, depth, parent: index });
          enqueue(previous);
          continue;
        }
        if (records.length === budget) {
          return unknown();
        }
        const velocities = visited.get(next.x) ?? new Map<number, number>();
        velocities.set(next.vx, records.length);
        visited.set(next.x, velocities);
        records.push({ command, depth, heap: -1, lower, order: 0, parent: index, state: next });
        enqueue(records.length - 1);
        search.states = records.length;
      }
    }
    if (!best) {
      return unknown();
    }
  }
  const states: LaunchState[] = [bird];
  for (const command of best) {
    const next = advance(states.at(-1)!, command);
    if (!next) {
      return unknown();
    }
    states.push(next);
  }
  return {
    input: { jumpHeld: false, move: best[0]!, useHeld: false },
    kind: "prepare",
    plan: { commands: best, states },
    search: { ...search },
  };
}

type LaunchEdge = Pick<MapEdge<MapSupport>, "commands" | "kind" | "launch">;
interface LaunchContext {
  readonly bird: { readonly vx: number; readonly x: number };
  readonly edge?: LaunchEdge | undefined;
  readonly grounded: boolean;
  readonly goal?: Point | undefined;
  readonly hasGoal: boolean;
  readonly scripted: boolean;
  readonly span?: { readonly left: number; readonly right: number } | undefined;
}

export function startsJump(edge: LaunchEdge | undefined) {
  return Boolean(edge?.commands[0]?.jump);
}

// A nonzero grounded prefix must reach the launch from a previous position on this span.
// Exclude only edges whose final ordinary step cannot do that, never an exhausted search.
export function firstEdgeMask(
  tuning: BirdTuning,
  seconds: number,
  map: MovementMap<MapSupport>,
  base: MapMask,
  ref: NodeRef,
  bird: BirdState,
): { readonly blocked: readonly number[]; readonly mask: MapMask } {
  const span = map.nodes[ref.node];
  const blocked: number[] = [];
  if (
    !span ||
    span.kind !== "static" ||
    span.deps.length > 0 ||
    !bird.grounded ||
    bird.carryVx !== 0 ||
    ![seconds, tuning.walkSpeed].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isFinite(seconds * tuning.walkSpeed) ||
    ![span.left, span.right, span.y, bird.x, bird.y, bird.vx].every(Number.isFinite) ||
    bird.x < span.left - EDGE ||
    bird.x > span.right + EDGE ||
    Math.abs(birdBox(tuning, bird).y + tuning.height - span.y) > EDGE
  ) {
    return { blocked, mask: base };
  }
  for (const id of map.outgoing[ref.node] ?? []) {
    const edge = map.edges[id]!;
    if (!startsJump(edge) || edge.deps.length > 0) {
      continue;
    }
    const velocity = edge.commands[0]!.move * tuning.walkSpeed;
    if (
      bird.x >= edge.launch.left - EDGE &&
      bird.x <= edge.launch.right + EDGE &&
      Math.abs(bird.vx - velocity) <= EDGE
    ) {
      continue;
    }
    const left = Math.max(span.left - EDGE, edge.launch.left - EDGE);
    const right = Math.min(span.right + EDGE, edge.launch.right + EDGE);
    const previousLeft = left - (velocity + EDGE) * seconds;
    const previousRight = right - (velocity - EDGE) * seconds;
    if (left > right || previousRight < span.left - EDGE || previousLeft > span.right + EDGE) {
      blocked.push(id);
    }
  }
  if (blocked.length === 0) {
    return { blocked, mask: base };
  }
  blocked.sort((a, b) => a - b);
  const excluded = new Set(blocked);
  return {
    blocked,
    mask: {
      ...base,
      edge: (id, departSeconds) => base.edge(id, departSeconds) && !excluded.has(id),
      ...(base.key === undefined
        ? {}
        : {
            key: `${base.key}:launch:${ref.node}:${blocked.join(",")}`,
          }),
    },
  };
}

export function boundaryInput(
  bounds: { readonly backX: number; readonly canExit: boolean; readonly exitX: number },
  body: Rect,
  input: ZoneInput,
): ZoneInput {
  if (
    (input.move === -1 && body.x - body.width < bounds.backX) ||
    (input.move === 1 && !bounds.canExit && body.x + 2 * body.width > bounds.exitX)
  ) {
    return { ...input, move: 0 };
  }
  return input;
}

export function launchStepSafe(
  solids: readonly Rect[],
  hazards: readonly Rect[],
  pad: number,
  boss: Rect | undefined,
  body: Rect,
  from: number,
  to: number,
) {
  const sweep = { ...body, width: body.width + Math.abs(to - from), x: Math.min(from, to) };
  return (
    !solids.some((solid) => rectsOverlap(solid, sweep)) &&
    !hazards.some((hazard) => rectsOverlap(hazard, sweep)) &&
    (!boss || !touchesBoss(solids, pad, boss, sweep))
  );
}

export function createLaunchPreparation(tuning: BirdTuning, seconds: number) {
  let pending:
    | {
        cursor: number;
        edge: LaunchEdge;
        goal?: Point | undefined;
        plan: LaunchPlan;
        span: { readonly left: number; readonly right: number };
      }
    | undefined;
  const step = (safeStep: LaunchSafety, context: LaunchContext) => {
    const { bird, edge, goal, grounded, hasGoal, scripted, span } = context;
    if (!grounded || !hasGoal || scripted || !span || !edge || !startsJump(edge)) {
      pending = undefined;
      return { kind: "approach" } as const;
    }
    if (
      pending &&
      (pending.edge !== edge ||
        pending.span.left !== span.left ||
        pending.span.right !== span.right ||
        pending.goal?.x !== goal?.x ||
        pending.goal?.y !== goal?.y)
    ) {
      pending = undefined;
    }
    if (pending) {
      const expected = pending.plan.states[pending.cursor]!;
      const safe =
        expected.x === bird.x &&
        expected.vx === bird.vx &&
        pending.plan.commands.slice(pending.cursor).every((command, index) => {
          const from = pending!.plan.states[pending!.cursor + index]!;
          const to = pending!.plan.states[pending!.cursor + index + 1]!;
          return safeStep(from.x, to.x, command);
        }) &&
        safeStep(
          pending.plan.states.at(-1)!.x,
          pending.plan.states.at(-1)!.x,
          edge.commands[0]!.move,
        );
      if (safe && pending.cursor < pending.plan.commands.length) {
        const command = pending.plan.commands[pending.cursor++]!;
        return {
          input: { jumpHeld: false, move: command, useHeld: false },
          kind: "prepare",
        } as const;
      }
      pending = undefined;
    }
    const preparation = prepareLaunch(
      safeStep,
      tuning,
      seconds,
      span,
      edge.launch,
      edge.commands[0]!.move,
      bird,
    );
    if (preparation.kind === "prepare") {
      pending = {
        cursor: 1,
        edge,
        goal,
        plan: preparation.plan,
        span: { left: span.left, right: span.right },
      };
    }
    return preparation;
  };
  return Object.assign(step, {
    reset: () => {
      pending = undefined;
    },
  });
}

export interface RouteFollowEvent {
  readonly cause?: string;
  readonly edge: number;
  readonly kind: "abandoned" | "completed";
}
type RouteFollowOutcome =
  | {
      readonly kind: "completed" | "following" | "idle";
      readonly problem?: never;
    }
  | EvadeControllerFailure;
export type RouteFollowResult = RouteFollowOutcome & {
  readonly events: readonly RouteFollowEvent[];
  readonly input: ZoneInput;
};
export interface RouteFollowContext {
  readonly areaWidth: number;
  readonly bird: BirdState;
  readonly goal?: Point | undefined;
  readonly mask: MapMask;
}

export function createRouteFollower(
  tuning: BirdTuning,
  seconds: number,
  map: MovementMap<MapSupport>,
  terrain: MapTerrain,
) {
  const preparation = createLaunchPreparation(tuning, seconds);
  const solids = terrain.world.solids;
  const staticColliders = terrain.area.colliders.filter(
    ({ after, before }) =>
      before.x === after.x &&
      before.y === after.y &&
      before.width === after.width &&
      before.height === after.height,
  );
  const ledges = staticColliders.filter(({ kind }) => kind === "ledge").map(({ before }) => before);
  let leg: { airborne: boolean; edge: MapEdge<MapSupport>; goal: Point; step: number } | undefined;
  let prefix: { edges: number[]; cursor: number; goal: Point } | undefined;
  let holdingFull = false;
  const reset = () => {
    leg = undefined;
    prefix = undefined;
    preparation.reset();
  };
  const step = (safeStep: LaunchSafety, context: RouteFollowContext): RouteFollowResult => {
    const { areaWidth, bird, goal, mask } = context;
    const events: RouteFollowEvent[] = [];
    const body = birdBox(tuning, bird);
    let ref = bird.grounded ? locate(map, body) : undefined;
    if (bird.grounded) {
      holdingFull = false;
    }
    const finish = (
      input: ZoneInput,
      outcome: RouteFollowOutcome = { kind: "following" },
    ): RouteFollowResult => ({
      events,
      input:
        holdingFull && !bird.grounded && bird.jumpHeld && bird.jumpHeldFor < tuning.jumpRiseTime
          ? { ...input, jumpHeld: true }
          : input,
      ...outcome,
    });
    const abandon = (cause: string) => {
      if (leg) {
        events.push({ cause, edge: leg.edge.id, kind: "abandoned" });
      }
      leg = undefined;
      prefix = undefined;
      preparation.reset();
    };
    const toward = (x: number): ZoneInput => ({
      jumpHeld: false,
      move: x > body.x + EDGE ? 1 : x < body.x - EDGE ? -1 : 0,
      useHeld: false,
    });
    if (!goal) {
      abandon("no-goal");
      preparation.reset();
      return finish(STILL, { kind: "idle" });
    }
    if (leg && (leg.goal.x !== goal.x || leg.goal.y !== goal.y)) {
      abandon("goal-changed");
    }
    if (leg) {
      leg.airborne ||= !bird.grounded;
      if (leg.airborne && bird.grounded) {
        if (
          ref?.node === leg.edge.to &&
          body.x >= leg.edge.land.left - EDGE &&
          body.x <= leg.edge.land.right + EDGE
        ) {
          events.push({ edge: leg.edge.id, kind: "completed" });
          leg = undefined;
        } else {
          abandon("interrupted-landing");
        }
      } else {
        const command = leg.edge.commands[leg.step];
        if (!command) {
          abandon("witness-ended");
        } else if (command.jump) {
          abandon("unprepared-sublaunch");
        } else {
          leg.step++;
          if (command.jump) {
            holdingFull = fullJump(tuning.jumpHopHeight, map, leg.edge);
          }
          return finish({ jumpHeld: command.jump, move: command.move, useHeld: false });
        }
      }
    }
    if (!bird.grounded) {
      prefix = undefined;
      preparation.reset();
      return finish(toward(goal.x - body.width / 2));
    }
    const supported = (id: number) => {
      const node = map.nodes[id];
      return Boolean(
        node &&
        bird.grounded &&
        body.x >= node.left - EDGE &&
        body.x <= node.right + EDGE &&
        Math.abs(body.y + body.height - node.y) <= EDGE &&
        staticColliders.some(
          ({ before, supportId }) =>
            supportId === node.supportId &&
            Math.abs(before.y - node.y) <= EDGE &&
            body.x >= before.x - EDGE &&
            body.x + body.width <= before.x + before.width + EDGE,
        ),
      );
    };
    const walkInput = (edge: MapEdge<MapSupport>) =>
      toward(Math.min(edge.land.right, Math.max(edge.land.left, goal.x - body.width / 2)));
    const walkSafe = (edge: MapEdge<MapSupport>) => {
      const input = walkInput(edge);
      const vx = ordinaryHorizontalVelocity(tuning, seconds, input.move, true, bird.vx);
      return safeStep(body.x, body.x + vx * seconds, input.move);
    };
    let retained: MapEdge<MapSupport> | undefined;
    if (prefix) {
      let valid = prefix.goal.x === goal.x && prefix.goal.y === goal.y;
      if (valid) {
        while (prefix.cursor < prefix.edges.length) {
          const edge = map.edges[prefix.edges[prefix.cursor]!]!;
          if (edge.kind !== "walk" || startsJump(edge) || !supported(edge.to)) {
            break;
          }
          const move = edge.commands[0]?.move;
          if (!(
            (move === 1 && body.x >= edge.land.left - EDGE) ||
            (move === -1 && body.x <= edge.land.right + EDGE)
          )) {
            break;
          }
          // Ground connection progress does not complete a jump witness.
          prefix.cursor++;
        }
      }
      let depart = 0;
      for (let i = prefix.cursor; valid && i < prefix.edges.length; i++) {
        const edge = map.edges[prefix.edges[i]!]!;
        valid = mask.node(edge.from) && mask.node(edge.to) && mask.edge(edge.id, depart);
        depart += edge.seconds;
      }
      const edge = map.edges[prefix.edges[prefix.cursor]!];
      valid &&= Boolean(
        edge &&
        (supported(edge.from) || (edge.kind === "walk" && !startsJump(edge) && supported(edge.to))),
      );
      if (valid && edge) {
        const node = supported(edge.from) ? edge.from : edge.to;
        const actual = { node, x: body.x };
        valid = !firstEdgeMask(tuning, seconds, map, mask, actual, bird).blocked.includes(edge.id);
        if (valid && edge.kind === "walk" && !startsJump(edge)) {
          valid = walkSafe(edge);
        }
        if (valid) {
          ref = actual;
          retained = edge;
        }
      }
      if (!valid) {
        prefix = undefined;
        preparation.reset();
      }
    }
    if (!ref) {
      prefix = undefined;
      preparation.reset();
      const feet = body.y + body.height;
      const candidates = map.nodes
        .flatMap((node) => {
          if (
            node.kind !== "static" ||
            node.deps.length > 0 ||
            !mask.node(node.id) ||
            Math.abs(node.y - feet) > EDGE
          ) {
            return [];
          }
          const support = staticColliders.find(
            (collider) =>
              collider.supportId === node.supportId &&
              Math.abs(collider.before.y - feet) <= EDGE &&
              collider.before.x < body.x + body.width &&
              collider.before.x + collider.before.width > body.x,
          );
          return support ? [{ node, support: support.before }] : [];
        })
        .sort(
          (a, b) =>
            Math.abs(Math.min(a.node.right, Math.max(a.node.left, body.x)) - body.x) -
              Math.abs(Math.min(b.node.right, Math.max(b.node.left, body.x)) - body.x) ||
            a.node.id - b.node.id,
        );
      const candidate = candidates[0];
      if (!candidate) {
        return finish(STILL, {
          kind: "unsupported",
          problem: "cannot recover full-foot support from actual contact",
        });
      }
      const { node, support } = candidate;
      const contact = (x: number) => support.x < x + body.width && support.x + support.width > x;
      const safe = (from: number, to: number, move: LaunchMove) =>
        contact(from) && contact(to) && safeStep(from, to, move);
      const recovered = prepareLaunch(
        safe,
        tuning,
        seconds,
        {
          left: Math.max(0, support.x - body.width),
          right: Math.min(areaWidth - body.width, support.x + support.width),
        },
        node,
        0,
        bird,
      );
      if (recovered.kind !== "prepare") {
        return finish(STILL, {
          kind: recovered.kind === "unknown" ? "unknown" : "unsupported",
          problem: "cannot establish full-foot support with ordinary input",
        });
      }
      const predicted = stepBird(tuning, solids, ledges, seconds, recovered.input, bird);
      if (!predicted.grounded || Math.abs(predicted.y - bird.y) > EDGE || !contact(predicted.x)) {
        return finish(STILL, {
          kind: "unsafe",
          problem: "ordinary support recovery leaves actual contact",
        });
      }
      return finish(recovered.input);
    }
    let edge = retained;
    if (!edge) {
      const compatible = firstEdgeMask(tuning, seconds, map, mask, ref, bird);
      const path = pathTo(map, compatible.mask, ref, { point: goal, radius: TILE });
      if (!path && compatible.blocked.length > 0) {
        preparation.reset();
        return finish(STILL, {
          kind: "unknown",
          problem: "no path with a compatible first grounded launch",
        });
      }
      edge = path?.edges[0] === undefined ? undefined : map.edges[path.edges[0]];
      const selected: number[] = [];
      for (const id of path?.edges ?? []) {
        const candidate = map.edges[id]!;
        if (
          candidate.deps.length > 0 ||
          [candidate.from, candidate.to].some(
            (node) => map.nodes[node]!.kind !== "static" || map.nodes[node]!.deps.length > 0,
          ) ||
          (candidate.kind !== "walk" && !startsJump(candidate))
        ) {
          break;
        }
        selected.push(id);
        if (startsJump(candidate)) {
          prefix = { cursor: 0, edges: selected, goal: { ...goal } };
          break;
        }
      }
    }
    const prepared = preparation(safeStep, {
      bird,
      edge,
      goal,
      grounded: true,
      hasGoal: true,
      scripted: false,
      span: map.nodes[ref.node],
    });
    if (!edge) {
      const feet = bottomCentre(body);
      if (Math.abs(feet.x - goal.x) <= TILE / 2) {
        return finish(STILL, {
          kind:
            supported(ref.node) && Math.abs(feet.y - goal.y) <= EDGE ? "completed" : "following",
        });
      }
      return finish(toward(spanGoal(areaWidth, map.nodes[ref.node], goal.x - body.width / 2)));
    }
    const jump = startsJump(edge);
    if (edge.kind === "walk" && !jump) {
      if (prefix && !walkSafe(edge)) {
        prefix = undefined;
        preparation.reset();
        return finish(STILL, {
          kind: "unsafe",
          problem: "selected walk has no safe ordinary step",
        });
      }
      return finish(walkInput(edge));
    }
    if (jump && prepared.kind === "unknown") {
      return finish(STILL, {
        kind: "unknown",
        problem: "cannot establish a velocity-matched jump launch on its support",
      });
    }
    if (jump && prepared.kind === "prepare") {
      return finish(prepared.input);
    }
    const reach = jump ? EDGE : tuning.walkSpeed * seconds;
    if (
      (jump && prepared.kind === "ready") ||
      (body.x >= edge.launch.left - reach && body.x <= edge.launch.right + reach)
    ) {
      const command = edge.commands[0];
      if (!command) {
        return finish(STILL, {
          kind: "unsupported",
          problem: "selected edge has no witness commands",
        });
      }
      leg = { airborne: false, edge, goal: { ...goal }, step: 1 };
      prefix = undefined;
      if (command.jump) {
        holdingFull = fullJump(tuning.jumpHopHeight, map, edge);
      }
      return finish({ jumpHeld: command.jump, move: command.move, useHeld: false });
    }
    return finish(toward(Math.min(edge.launch.right, Math.max(edge.launch.left, body.x))));
  };
  return { reset, step };
}

// The hitbox-left x a walk without a map edge heads for: the goal's, kept within his span unless
// the goal lies past the area's exit edge. He leaves a span only by an edge, whose proof keeps
// clear of static hazards.
export function spanGoal(
  areaWidth: number,
  span: { readonly left: number; readonly right: number } | undefined,
  x: number,
): number {
  return span && x < areaWidth ? Math.min(span.right, Math.max(span.left, x)) : x;
}

// Where he stands for a surface point: the feet point nearest it on a span at its height, so a
// waypoint against a post or cabinet is one he can reach and stop at.
export function standingPoint(map: MovementMap<MapSupport>, point: Point): Point {
  const half = map.profile.body.width / 2;
  let best: { dx: number; x: number } | undefined;
  for (const { left, right, y } of map.nodes) {
    if (Math.abs(y - point.y) <= EDGE) {
      const x = Math.min(right + half, Math.max(left + half, point.x));
      if (!best || Math.abs(x - point.x) < best.dx) {
        best = { dx: Math.abs(x - point.x), x };
      }
    }
  }
  return best ? { x: best.x, y: point.y } : point;
}

const bottomCentre = (box: { x: number; y: number; width: number; height: number }): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height,
});

export interface RouteProgressGoal {
  readonly point: Readonly<Point>;
  readonly support: MapSupport;
}

type RouteSelectionContext = "ordinary" | "reaction";
type RouteProgressIntent = "exit" | "ordinary" | "reaction" | "shelter";

export function createRouteProgress(physicalGoals: readonly RouteProgressGoal[]) {
  const goals = physicalGoals.map(({ point, support }) => ({ point: { ...point }, support }));
  const completed = new Map<MapSupport, Set<string>>();
  let intent: RouteProgressIntent | undefined;
  const key = ({ point }: RouteProgressGoal) => `${point.x},${point.y}`;
  const visited = (goal: RouteProgressGoal) => completed.get(goal.support)?.has(key(goal)) === true;
  const arrived = (actual: RouteProgressGoal | undefined, goal: RouteProgressGoal) =>
    actual !== undefined &&
    actual.support === goal.support &&
    Math.abs(actual.point.x - goal.point.x) <= TILE / 2 &&
    Math.abs(actual.point.y - goal.point.y) <= EDGE;
  const reset = () => completed.clear();
  return {
    arrived,
    enter(next: RouteProgressIntent) {
      if (intent !== next) {
        reset();
        intent = next;
      }
    },
    observe(actual: RouteProgressGoal | undefined) {
      const reached = goals.filter((goal) => arrived(actual, goal));
      const mark = () => {
        for (const goal of reached) {
          const keys = completed.get(goal.support) ?? new Set<string>();
          keys.add(key(goal));
          completed.set(goal.support, keys);
        }
      };
      mark();
      if (goals.length > 0 && goals.every(visited)) {
        reset();
        mark();
      }
    },
    reset,
    select<T>(
      context: RouteSelectionContext,
      ranked: readonly { readonly goal: RouteProgressGoal | undefined; readonly value: T }[],
    ) {
      return (
        context === "ordinary"
          ? (ranked.find(({ goal }) => goal !== undefined && !visited(goal)) ?? ranked[0])
          : ranked[0]
      )?.value;
    },
  };
}

export function dispatchRoute<T>(
  actions: {
    readonly exit: () => T;
    readonly follow: () => T;
    readonly hold: () => T;
    readonly shelter: () => T;
    readonly unknown: () => T;
  },
  context: {
    readonly arrived: boolean;
    readonly exiting: boolean;
    readonly onward: boolean;
    readonly sheltered: boolean;
    readonly threatened: boolean;
  },
): T {
  if (context.exiting) {
    return actions.exit();
  }
  if (context.sheltered) {
    return actions.shelter();
  }
  if (context.onward) {
    return actions.follow();
  }
  if (!context.threatened && context.arrived) {
    return actions.hold();
  }
  return actions.unknown();
}

export function completedGoalHold(
  tuning: BirdTuning,
  seconds: number,
  terrain: MapTerrain,
  safeStep: (from: number, to: number, move: LaunchMove) => boolean,
  context: {
    readonly bird: BirdState;
    readonly bounds: { readonly backX: number; readonly exitX: number };
    readonly goal: RouteProgressGoal;
    readonly maskValid: boolean;
    readonly node: MapNode<MapSupport>;
    readonly projectilesKnown: boolean;
  },
): { readonly input: ZoneInput; readonly kind: "hold" } | EvadeControllerFailure {
  const { bird, goal, maskValid, node, projectilesKnown } = context;
  if (!projectilesKnown) {
    return { kind: "unknown", problem: "completed-goal hold lacks a known projectile observation" };
  }
  const body = birdBox(tuning, bird);
  const supported = (actual: BirdState) => {
    const box = birdBox(tuning, actual);
    return (
      actual.grounded &&
      goal.support === node.supportId &&
      box.x >= node.left - EDGE &&
      box.x <= node.right + EDGE &&
      Math.abs(box.y + box.height - node.y) <= EDGE &&
      terrain.area.colliders.some(
        ({ after, before, supportId }) =>
          supportId === node.supportId &&
          before.x === after.x &&
          before.y === after.y &&
          before.width === after.width &&
          before.height === after.height &&
          Math.abs(box.y + box.height - before.y) <= EDGE &&
          box.x >= before.x - EDGE &&
          box.x + box.width <= before.x + before.width + EDGE,
      )
    );
  };
  if (
    !maskValid ||
    !supported(bird) ||
    Math.abs(body.x + body.width / 2 - goal.point.x) > TILE / 2 ||
    Math.abs(body.y + body.height - goal.point.y) > EDGE
  ) {
    return { kind: "unsafe", problem: "completed-goal hold no longer has valid arrived support" };
  }
  const predicted = stepBird(
    tuning,
    terrain.world.solids,
    terrain.area.colliders.filter(({ kind }) => kind === "ledge").map(({ before }) => before),
    seconds,
    STILL,
    bird,
  );
  const predictedBody = birdBox(tuning, predicted);
  if (
    predictedBody.x < context.bounds.backX ||
    predictedBody.x + predictedBody.width > context.bounds.exitX
  ) {
    return { kind: "unsafe", problem: "completed-goal braking step crosses the area boundary" };
  }
  if (!supported(predicted) || !safeStep(body.x, predictedBody.x, 0)) {
    return { kind: "unsafe", problem: "completed-goal braking step leaves safe support" };
  }
  return { input: STILL, kind: "hold" };
}

export interface EvadeContext {
  readonly found: ArenaCase;
  readonly layout: ZoneLayout;
  readonly maps: ArenaMaps;
  readonly observers?: {
    readonly boss?: BehaviourObserver;
    readonly free?: BehaviourObserver;
  };
}

export function stepEvade(
  observer: BehaviourObserver | undefined,
  layout: ZoneLayout,
  input: ZoneInput,
  zone: ZoneState,
): ZoneState {
  return observer
    ? stepZoneObserved(observer, SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, input, zone)
    : stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, input, zone);
}

// The layout with every boss removed, for the boss-free walk.
function bossFree(context: EvadeContext): ZoneLayout {
  const { layout, maps } = context;
  const bosses = new Set(maps.encounter.bosses);
  const area = layout.areas[layout.start.area]!;
  return {
    ...layout,
    areas: {
      ...layout.areas,
      [layout.start.area]: {
        ...area,
        objects: area.objects.filter((object) => !bosses.has(object)),
      },
    },
  };
}

// Whether Chibi's body anywhere in rect could touch the boss's body padded by pad: the rects
// overlap, and no solid lies between the boss's body and rect across their whole overlap, as a
// roof between a boss above and a span below it, or a wall between them side by side.
export function touchesBoss(solids: readonly Rect[], pad: number, boss: Rect, rect: Rect): boolean {
  const near = {
    height: boss.height + 2 * pad,
    width: boss.width + 2 * pad,
    x: boss.x - pad,
    y: boss.y - pad,
  };
  if (!rectsOverlap(rect, near)) {
    return false;
  }
  const left = Math.max(rect.x, near.x);
  const right = Math.min(rect.x + rect.width, near.x + near.width);
  const top = Math.max(rect.y, near.y);
  const bottom = Math.min(rect.y + rect.height, near.y + near.height);
  const between = (low: number, high: number, from: number, to: number) =>
    from >= low - EDGE && to <= high + EDGE;
  return !solids.some((solid) => {
    const spansX = solid.x <= left + EDGE && solid.x + solid.width >= right - EDGE;
    const spansY = solid.y <= top + EDGE && solid.y + solid.height >= bottom - EDGE;
    return (
      (spansX &&
        (between(boss.y + boss.height, rect.y, solid.y, solid.y + solid.height) ||
          between(rect.y + rect.height, boss.y, solid.y, solid.y + solid.height))) ||
      (spansY &&
        (between(boss.x + boss.width, rect.x, solid.x, solid.x + solid.width) ||
          between(rect.x + rect.width, boss.x, solid.x, solid.x + solid.width)))
    );
  });
}

// One evade run of the arena from a start and zone seed, with its boss-free walk.
export function evadeRun(context: EvadeContext, start: EvadeStart, seed: number): EvadeRun {
  const free = evadeWalk(context.observers?.free, context, bossFree(context), start, seed);
  const run = evadeWalk(context.observers?.boss, context, context.layout, start, seed);
  return {
    ...run,
    ...(free.cleared !== undefined && { free: free.cleared }),
    problems: [...run.problems, ...free.problems.map((problem) => `boss-free walk: ${problem}`)],
    work: run.work + free.work,
  };
}

function evadeWalk(
  observer: BehaviourObserver | undefined,
  context: EvadeContext,
  layout: ZoneLayout,
  start: EvadeStart,
  seed: number,
): EvadeRun & { readonly cleared?: number } {
  const { found, maps } = context;
  const { arena } = found;
  const chibi: MovementMap<MapSupport> = maps.chibi;
  const area = layout.areas[layout.start.area]!;
  const fairness = BOSS_FAIRNESS[arena.boss]!;
  const counters = ARENA_COUNTERS[arena.boss as AntagonistKind] ?? [];
  const delay = ticksOf(fairness.reactionDelaySeconds);
  const decide = ticksOf(DECIDE_SECONDS);
  const bosses = bossMaps(maps);
  const loop = [...arena.routes].sort((a, b) => (a.id < b.id ? -1 : 1)).find(isLoop)!;
  const routes = [...arena.routes].sort((a, b) => (a.id < b.id ? -1 : 1));
  const recorder = traceRecorder({ retain: false });

  let zone = activateAll(startZone(ORDINARY, layout, seed));
  if (start === "mid") {
    // The loop waypoint nearest the arena's middle column that lies beyond the threat distance
    // of every boss's spawn, of the entry and outside every refuge, so he starts on the move in
    // the boss's reach rather than where the entry run would take him.
    const entry = area.entries[layout.start.entry]!;
    const clear = (point: Point) =>
      Math.hypot(point.x - entry.x, point.y - entry.y) > THREAT_TILES * TILE &&
      maps.encounter.bosses.every((object) => {
        const x = object.origin.x + object.width / 2;
        const y = object.origin.y + object.height / 2;
        return Math.hypot(point.x - x, point.y - y) > THREAT_TILES * TILE;
      });
    const sheltered = ({ col, row }: { col: number; row: number }) =>
      arena.refuges.some(
        ({ at, width }) => row === at.row && col >= at.col && col <= at.col + width,
      );
    const middle = [...loop.waypoints]
      .filter((point) => clear(pixelOf(point)) && !sheltered(point))
      .sort((a, b) => Math.abs(a.col - 30) - Math.abs(b.col - 30) || a.row - b.row)[0];
    if (!middle) {
      throw new Error(`Arena ${arena.id} has no loop waypoint clear of its boss`);
    }
    zone = { ...zone, bird: startBird(ORDINARY, pixelOf(middle)) };
  }

  const history: BossTick[] = [];
  const projectileHistory: ProjectileFrame[] = [];
  const gravityByEmitter = projectileGravityModels(area.objects);
  // Each countering refuge as a one-waypoint route at its middle; a move between routes or
  // refuges is a switch. He starts on the loop.
  const refuges: ArenaRoute[] = arena.refuges.flatMap(({ at, kind, width }, index) =>
    counters.includes(kind)
      ? [{ id: `refuge-${index}`, waypoints: [{ col: at.col + width / 2, row: at.row }] }]
      : [],
  );
  let switches = 0;
  let levels = 0;
  const loopRows = new Set(loop.waypoints.map(({ row }) => row));
  let level: number | undefined;
  let waiting = false;
  let target: Target = { index: 0, route: loop };
  const aim = (next: Target) => {
    if (next.route.id !== target.route.id) {
      switches++;
    }
    target = next;
  };
  let hold = false;
  let routeSelection: { readonly arrived: boolean; readonly threatened: boolean } | undefined;
  let exiting = false;
  let dodge: Dodge | undefined;
  let lastDodgeEnd = -1;
  const follower = createRouteFollower(ORDINARY, STEP_SECONDS, chibi, maps.encounter.terrain);
  let ended: { cause: string; tick: number } | undefined;
  const problems: string[] = [];
  let launchProblem: string | undefined;
  let controllerFailure: EvadeControllerFailure | undefined;
  let death: string | undefined;
  let acquired: number | undefined;
  let cleared: number | undefined;
  let work = 0;

  const box = () => birdBox(ORDINARY, zone.bird);
  // Chibi's map without the spans and legs from which his body could touch the boss's body as he
  // last saw it, padded by AVOID_TILES except through solid terrain, his own span aside.
  let avoiding: MapMask = maps.mask;
  let observedBody: Rect | undefined;
  const avoid = (boss: AgentSample | undefined) => {
    observedBody = boss && { height: boss.height, width: boss.width, ...boss.at };
    if (!boss) {
      avoiding = maps.mask;
      return;
    }
    const pad = AVOID_TILES * TILE;
    const body = { height: boss.height, width: boss.width, ...boss.at };
    const own = here()?.node;
    const width = chibi.profile.body.width;
    const height = chibi.profile.body.height;
    const terrain = maps.encounter.terrain.world.solids;
    avoiding = {
      edge: (id, seconds) =>
        !touchesBoss(terrain, pad, body, chibi.edges[id]!.sweep) && maps.mask.edge(id, seconds),
      key: `avoid:${Math.round(body.x / TILE)}:${Math.round(body.y / TILE)}:${own ?? -1}`,
      node: (id) => {
        const node = chibi.nodes[id]!;
        const span = {
          height,
          width: node.right - node.left + width,
          x: node.left,
          y: node.y - height,
        };
        return maps.mask.node(id) && (id === own || !touchesBoss(terrain, pad, body, span));
      },
    };
  };
  const here = () => locate(chibi, box());
  const chibiDistance = (point: Point): number => {
    const ref = here();
    return ref ? mapDistance(chibi, avoiding, ref, point) : Infinity;
  };
  const solids = maps.encounter.terrain.world.solids;
  const projectileAvoidance = createProjectileAvoidance(ORDINARY, STEP_SECONDS, decide, delay, {
    ledges: maps.encounter.terrain.area.colliders
      .filter(({ kind }) => kind === "ledge")
      .map(({ before }) => before),
    solids,
  });
  const preparationHazards = maps.encounter.terrain.hazards.map(({ rect }) => rect);
  const safePreparationStep = (from: number, to: number, move: -1 | 0 | 1) => {
    const body = { ...box(), x: from };
    const input = { jumpHeld: false, move, useHeld: false };
    return (
      boundaryInput(
        { backX: area.backX, canExit: Boolean(ended) || exiting, exitX: area.exitX },
        body,
        input,
      ).move === move &&
      launchStepSafe(solids, preparationHazards, AVOID_TILES * TILE, observedBody, body, from, to)
    );
  };
  const objectOf = (boss: AgentSample) => area.objects[Number(boss.id.split(":")[1])]!;
  // Where each boss was last located on its map, for while it is airborne off its nodes.
  const groundRefs = new Map<string, NodeRef>();
  const airNodes = new Map<string, AirNodeId>();
  // The boss's path distance to a feet point on its own map: unbounded where its body does not
  // fit, a ground boss cannot stand or its map has no path, and
  // zero before it has first been located.
  const bossDistance = (boss: AgentSample, point: Point): number => {
    const own = bosses.get(objectOf(boss))!;
    const body = {
      height: boss.height - 2 * EDGE,
      width: boss.width - 2 * EDGE,
      x: point.x - boss.width / 2 + EDGE,
      y: point.y - boss.height + EDGE,
    };
    if (solids.some((solid) => rectsOverlap(solid, body))) {
      return Infinity;
    }
    if (own.kind === "ground") {
      if (!standingAt(own.map, point)) {
        return Infinity;
      }
      const hitbox = hitboxAt(own.map, boss.at.x, boss.at.y);
      const found = locate(own.map, hitbox) ?? landing(own.map, hitbox);
      if (found) {
        groundRefs.set(boss.id, found);
      }
      const ref = groundRefs.get(boss.id);
      return ref ? mapDistance(own.map, own.mask, ref, point) : 0;
    }
    const found = locateAir(own.map, { height: boss.height, width: boss.width, ...boss.at });
    if (found !== undefined) {
      airNodes.set(boss.id, found);
    }
    const from = airNodes.get(boss.id);
    if (from === undefined) {
      return 0;
    }
    // Air goals measure from the body's centre.
    const goal = { point: { x: point.x, y: point.y - boss.height / 2 }, radius: TILE };
    const path = airPath(own.map, own.mask, from, goal);
    return path ? path.seconds * own.speed : Infinity;
  };
  const stands = new Map<string, Point>();
  const standOf = (point: TilePoint): Point => {
    const key = `${point.col},${point.row}`;
    const found = stands.get(key) ?? standingPoint(chibi, pixelOf(point));
    stands.set(key, found);
    return found;
  };
  const waypointPixel = ({ index, route }: Target) => standOf(route.waypoints[index]!);
  // The boss's distance to touching him at a feet point: the least of its distances to that point
  // and to the points either side where its body would just overlap his, so a post beside him
  // does not hide him from a boss standing on his side of it.
  const bossReach = (boss: AgentSample, point: Point): number => {
    const half = (boss.width + ORDINARY.width) / 2 - EDGE;
    return Math.min(
      ...[-half, 0, half].map((dx) => bossDistance(boss, { x: point.x + dx, y: point.y })),
    );
  };
  // Waypoints of a loop, its closing repeat left out.
  const loopLength = (route: ArenaRoute) => route.waypoints.length - (isLoop(route) ? 1 : 0);
  const step = (route: ArenaRoute, index: number, by: 1 | -1) => {
    const count = loopLength(route);
    if (isLoop(route)) {
      return (index + by + count) % count;
    }
    return Math.min(count - 1, Math.max(0, index + by));
  };

  // Moves along Chibi's map toward a feet point: an edge's witness commands once he stands in
  // its launch range, otherwise a walk toward the range that never leaves his span except by an
  // edge, whose proof keeps clear of static hazards.
  const follow = (goal: Point | undefined): ZoneInput => {
    if (controllerFailure) {
      return STILL;
    }
    const result = follower.step(safePreparationStep, {
      areaWidth: area.width,
      bird: zone.bird,
      goal,
      mask: avoiding,
    });
    launchProblem = result.problem;
    if (result.kind === "unknown" || result.kind === "unsafe" || result.kind === "unsupported") {
      controllerFailure = { kind: result.kind, problem: result.problem };
    }
    return result.input;
  };

  const progressGoal = (point: Point): RouteProgressGoal | undefined => {
    const half = chibi.profile.body.width / 2;
    const node = chibi.nodes.find(
      (node) =>
        point.x - half >= node.left - EDGE &&
        point.x - half <= node.right + EDGE &&
        Math.abs(point.y - node.y) <= EDGE,
    );
    return node && { point, support: node.supportId };
  };
  const goalsByRoute = new Map(
    [...routes, ...refuges].map((route) => [
      route,
      route.waypoints.map((point) => progressGoal(standOf(point))),
    ]),
  );
  const progress = createRouteProgress(
    [...goalsByRoute.values()].flatMap((goals) => goals.flatMap((goal) => (goal ? [goal] : []))),
  );
  const waypointGoal = ({ index, route }: Target) => goalsByRoute.get(route)?.[index];
  const actualProgress = (ref: NodeRef | undefined): RouteProgressGoal | undefined => {
    const body = box();
    const node = ref && chibi.nodes[ref.node];
    const fullSupport =
      node &&
      zone.bird.grounded &&
      maps.encounter.terrain.area.colliders.some(
        ({ after, before, supportId }) =>
          before.x === after.x &&
          before.y === after.y &&
          before.width === after.width &&
          before.height === after.height &&
          supportId === node.supportId &&
          Math.abs(body.y + body.height - before.y) <= EDGE &&
          body.x >= before.x - EDGE &&
          body.x + body.width <= before.x + before.width + EDGE,
      );
    return fullSupport ? { point: bottomCentre(body), support: node.supportId } : undefined;
  };

  // Each route's next waypoints: those either side of its waypoint nearest Chibi on his map, and
  // that one unless he stands at it. The one maximizing the boss's distance minus his wins, ties
  // by his distance then route id; a waypoint he stands at counts only when the boss cannot reach
  // it.
  const escapeTarget = (
    context: RouteSelectionContext,
    origin: NodeRef | undefined,
    among: readonly ArenaRoute[],
    boss: AgentSample,
  ): Target | undefined => {
    const actual = context === "ordinary" ? actualProgress(origin) : undefined;
    if (context === "ordinary") {
      progress.observe(actual);
    }
    // He keeps an unreached target while the boss stays farther from it than he is, so a leg
    // that starts by walking away from it, such as to a jump's launch, is not abandoned.
    if (among.includes(target.route)) {
      const goal = waypointPixel(target);
      const mine = chibiDistance(goal);
      if (context === "reaction") {
        if (mine >= 2 * TILE && mine < bossReach(boss, goal)) {
          return target;
        }
      } else {
        const physical = waypointGoal(target);
        if (mine < Infinity && physical !== undefined && !progress.arrived(actual, physical)) {
          if (mine < bossReach(boss, goal)) {
            return target;
          }
          progress.reset();
        }
      }
    }
    const candidates: { chibi: number; score: number; target: Target }[] = [];
    for (const route of among) {
      const count = loopLength(route);
      const mine = Array.from({ length: count }, (_, index) =>
        chibiDistance(standOf(route.waypoints[index]!)),
      );
      const nearest = mine.indexOf(Math.min(...mine));
      if (mine[nearest] === Infinity) {
        continue;
      }
      for (const index of new Set([nearest, step(route, nearest, 1), step(route, nearest, -1)])) {
        const theirs = bossReach(boss, standOf(route.waypoints[index]!));
        // A route's open end leads nowhere but back past the boss, so it is a target only
        // where the boss cannot reach it.
        const end = !isLoop(route) && (index === 0 || index === count - 1);
        if (
          mine[index] === Infinity ||
          (theirs !== Infinity && (mine[index]! < 2 * TILE || (end && route.waypoints.length > 1)))
        ) {
          continue;
        }
        // The current target keeps a margin, so near-equal scores do not flip him back and forth.
        const kept = target.route === route && target.index === index ? KEEP_TILES * TILE : 0;
        const score = theirs - mine[index]! + kept;
        candidates.push({ chibi: mine[index]!, score, target: { index, route } });
      }
    }
    candidates.sort((a, b) => (a.score > b.score ? -1 : a.score < b.score ? 1 : a.chibi - b.chibi));
    return context === "reaction"
      ? candidates[0]?.target
      : progress.select(
          context,
          candidates.map(({ target }) => ({
            goal: waypointGoal(target),
            value: target,
          })),
        );
  };

  // The countering refuge he stands in, if the boss cannot reach him there.
  const shelter = (boss: AgentSample): ArenaRoute | undefined => {
    const feet = bottomCentre(box());
    if (!zone.bird.grounded) {
      return undefined;
    }
    const index = arena.refuges.findIndex(
      ({ at, kind, width }) =>
        counters.includes(kind) &&
        feet.x >= at.col * TILE - EDGE &&
        feet.x <= (at.col + width) * TILE + EDGE &&
        Math.abs(feet.y - at.row * TILE) <= TILE / 2 &&
        unreachable(boss, feet),
    );
    return refuges.find(({ id }) => id === `refuge-${index}`);
  };
  // No feet point on his row from which the boss's body would overlap his reaches its map.
  const unreachable = (boss: AgentSample, feet: Point) => {
    const half = (boss.width + ORDINARY.width) / 2 - EDGE;
    for (let dx = -half; dx <= half; dx += TILE / 4) {
      if (bossDistance(boss, { x: feet.x + dx, y: feet.y }) !== Infinity) {
        return false;
      }
    }
    return true;
  };

  // The boss's closing speed on Chibi over the decision interval, both bodies as he saw them.
  const closingSpeed = (boss: AgentSample, observed: BossTick, before: BossTick | undefined) => {
    const prior = before?.agents.find(({ id }) => id === boss.id);
    if (!prior || before!.tick >= observed.tick) {
      return 0;
    }
    const apart = (agent: AgentSample, sample: BossTick) => {
      const a = centre(agent);
      const b = centre(sample.target);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    return (
      (apart(prior, before!) - apart(boss, observed)) /
      ((observed.tick - before!.tick) * STEP_SECONDS)
    );
  };

  // 0. The boss behind him beyond THREAT_TILES and a path to the exit seam on his map clear of it.
  const exitSeam: Point = { x: area.width - 2 * TILE, y: arena.exit.row * TILE };
  const exitPoint: Point = { x: area.width + 4 * TILE, y: arena.exit.row * TILE };
  const exitClear = (boss: AgentSample | undefined) => {
    const feet = bottomCentre(box());
    const seen = boss && centre(boss);
    if (
      seen &&
      (seen.x > feet.x - TILE ||
        Math.hypot(seen.x - feet.x, seen.y - (feet.y - ORDINARY.height / 2)) <= THREAT_TILES * TILE)
    ) {
      return false;
    }
    const ref = here();
    // Airborne, off his map's spans, he keeps the last verdict.
    if (!ref) {
      return exiting;
    }
    return pathTo(chibi, avoiding, ref, { point: exitSeam, radius: TILE }) !== undefined;
  };
  // He follows his map to the exit seam, then walks out past it.
  const toExit = () => follow(bottomCentre(box()).x >= exitSeam.x - TILE ? exitPoint : exitSeam);

  const choose = (tick: number) => {
    routeSelection = undefined;
    const observed = history[Math.max(0, history.length - 1 - delay)];
    const before = history[Math.max(0, history.length - 1 - delay - decide)];
    const boss = observed?.agents[0];
    avoid(boss);
    exiting = exitClear(boss);
    if (exiting || !boss) {
      progress.enter("exit");
      hold = false;
      return;
    }
    const engaged = boss.pursuit === "engaged";
    // 1. Sheltered from the engaged boss.
    const refuge = engaged ? shelter(boss) : undefined;
    if (refuge) {
      progress.enter("shelter");
      aim({ index: 0, route: refuge });
      hold = true;
      return;
    }
    hold = false;
    const feet = bottomCentre(box());
    const now = centre(boss);
    const gap = Math.hypot(now.x - feet.x, now.y - (feet.y - ORDINARY.height / 2));
    // 2. A visible tell, first seen after any dodge ended: beyond the threat distance, a retreat
    // round the loop where the attack names one and the loop's best next waypoint lies farther
    // from the boss than from him, otherwise its first named dodge other than retreat.
    const attack = boss.attack;
    const dodges = attack?.phase === "tell" ? fairness.dodges[attack.id] : undefined;
    if (dodges && dodges.length > 0 && observed!.tick > lastDodgeEnd) {
      progress.enter("reaction");
      const away = escapeTarget("reaction", undefined, [loop], boss);
      const leads =
        away !== undefined &&
        bossReach(boss, waypointPixel(away)) > chibiDistance(waypointPixel(away));
      const scripted = dodges.find((name) => name !== "retreat");
      if (dodges.includes("retreat") && (!scripted || (gap > THREAT_TILES * TILE && leads))) {
        if (away) {
          aim(away);
        }
        dodge = { attack: attack!.id, boss: boss.id, retreat: true, started: tick };
      } else {
        dodge = { attack: attack!.id, boss: boss.id, script: DODGES[scripted!](), started: tick };
        follower.reset();
      }
      return;
    }
    // Ordinary target selection is not evaluated in flight or without a map origin.
    // The follower still executes its witness or recovers actual partial contact.
    const origin = zone.bird.grounded ? here() : undefined;
    if (!origin) {
      return;
    }
    const closing = closingSpeed(boss, observed!, before);
    // 3. Threatened: the best waypoint anywhere.
    const threatened = engaged && (gap <= THREAT_TILES * TILE || closing > ORDINARY.walkSpeed);
    progress.enter("ordinary");
    if (threatened) {
      const next = escapeTarget("ordinary", origin, [...routes, ...refuges], boss);
      if (next) {
        aim(next);
        return;
      }
    }
    // 4. Keep moving round the loop away from the boss, or toward a countering refuge: the next
    // waypoint by the same score.
    const next = escapeTarget("ordinary", origin, [loop, ...refuges], boss);
    if (next) {
      aim(next);
    } else {
      const physical = waypointGoal(target);
      routeSelection = {
        arrived: physical !== undefined && progress.arrived(actualProgress(origin), physical),
        threatened,
      };
    }
  };

  // A retreat follows the loop's best next waypoint on his map, re-aimed each decision.
  const retreat = () => {
    const observed = history[Math.max(0, history.length - 1 - delay)];
    const boss = observed?.agents.find(({ id }) => id === dodge!.boss);
    if (boss) {
      avoid(boss);
      const away = escapeTarget("reaction", undefined, [loop], boss);
      if (away) {
        aim(away);
      }
    }
  };

  const holdInput = (projectilesKnown: boolean): ZoneInput => {
    const ref = here();
    const goal = waypointGoal(target);
    const node = ref && chibi.nodes[ref.node];
    const goalNode =
      goal &&
      chibi.nodes.find(
        (node) =>
          node.supportId === goal.support &&
          Math.abs(node.y - goal.point.y) <= EDGE &&
          goal.point.x - ORDINARY.width / 2 >= node.left - EDGE &&
          goal.point.x - ORDINARY.width / 2 <= node.right + EDGE,
      );
    const result =
      node && goal
        ? completedGoalHold(ORDINARY, STEP_SECONDS, maps.encounter.terrain, safePreparationStep, {
            bird: zone.bird,
            bounds: { backX: area.backX, exitX: area.exitX },
            goal,
            maskValid: goalNode !== undefined && avoiding.node(goalNode.id),
            node,
            projectilesKnown,
          })
        : { kind: "unsafe" as const, problem: "completed-goal hold lost its actual support" };
    if (result.kind === "hold") {
      return result.input;
    }
    controllerFailure = result;
    launchProblem = result.problem;
    return STILL;
  };

  const limit = ticksOf(EVADE_LIMIT_SECONDS);
  const free = maps.encounter.bosses.every((object) => !area.objects.includes(object));
  for (let tick = 0; ; tick++) {
    if (zone.death) {
      death = `${zone.death.reason} at ${(tick * STEP_SECONDS).toFixed(2)} s`;
      problems.push(`death: ${death}`);
      break;
    }
    if (zone.cleared) {
      cleared = tick * STEP_SECONDS;
      if (!free && acquired === undefined) {
        problems.push("left the arena before the boss acquired him");
      }
      break;
    }
    if (zone.turnedBack) {
      problems.push("turned back out of the entry");
      break;
    }
    if (tick - (acquired ?? 0) >= limit) {
      problems.push(
        free || acquired !== undefined
          ? `no exit within ${EVADE_LIMIT_SECONDS} s`
          : `the boss never acquired him in ${EVADE_LIMIT_SECONDS} s`,
      );
      break;
    }
    const projectileFrame = projectileAvoidance.observe(
      zone.steps,
      projectileHistory[Math.max(0, projectileHistory.length - 1 - delay)],
    );
    const observedProjectiles = projectileFrame?.observation;
    const observedProjectilePresence =
      observedProjectiles !== undefined &&
      (observedProjectiles.kind === "unknown" || observedProjectiles.projectiles.length > 0);
    let input: ZoneInput;
    if (ended) {
      dodge = undefined;
      // He sets out once his delayed visible-projectile observation is clear.
      // He waits while the boss, as he saw it, lies ahead within THREAT_TILES or closes faster
      // than his walk.
      const observed = history[Math.max(0, history.length - 1 - delay)];
      const seen = observed?.agents[0];
      if (tick % decide === 0) {
        avoid(seen);
        const feet = bottomCentre(box());
        const ahead = seen && centre(seen);
        waiting =
          ahead !== undefined &&
          ahead.x > feet.x - TILE &&
          (Math.hypot(ahead.x - feet.x, ahead.y - feet.y) <= THREAT_TILES * TILE ||
            closingSpeed(
              seen!,
              observed!,
              history[Math.max(0, history.length - 1 - delay - decide)],
            ) > ORDINARY.walkSpeed);
      }
      input = waiting || observedProjectilePresence ? follow(undefined) : toExit();
    } else {
      if (!dodge && tick % decide === 0) {
        choose(tick);
      } else if (dodge?.retreat && tick % decide === 0) {
        retreat();
      }
      if (dodge?.retreat) {
        input = follow(waypointPixel(target));
      } else if (dodge?.script) {
        follower.reset();
        const latest = history.at(-1)?.agents.find(({ id }) => id === dodge!.boss);
        input = latest
          ? dodge.script!({
              boss: latest,
              seconds: (tick - dodge.started) * STEP_SECONDS,
              target: history.at(-1)!.target,
            })
          : STILL;
      } else {
        input = dispatchRoute(
          {
            exit: () => {
              routeSelection = undefined;
              return toExit();
            },
            follow: () => follow(waypointPixel(target)),
            hold: () => holdInput(observedProjectiles?.kind === "known"),
            shelter: () => follow(undefined),
            unknown: () => {
              controllerFailure = {
                kind: "unknown",
                problem: "no eligible observed escape target",
              };
              launchProblem = controllerFailure.problem;
              return STILL;
            },
          },
          {
            arrived: routeSelection?.arrived ?? false,
            exiting,
            onward: routeSelection === undefined,
            sheltered: hold,
            threatened: routeSelection?.threatened ?? false,
          },
        );
      }
    }
    const projectileInput = projectileAvoidance(
      safePreparationStep,
      {
        bird: zone.bird,
        frame: projectileFrame,
        guard: (body, requested) =>
          boundaryInput(
            { backX: area.backX, canExit: Boolean(ended) || exiting, exitX: area.exitX },
            body,
            requested,
          ),
        support: () => {
          const ref = here();
          const node = ref && chibi.nodes[ref.node];
          return node?.kind === "static" && node.deps.length === 0 ? node : undefined;
        },
        tick: zone.steps,
      },
      input,
    );
    if (observedProjectiles?.kind === "unknown") {
      controllerFailure = observedProjectiles;
      launchProblem = observedProjectiles.problem;
    }
    if (projectileInput.problem) {
      controllerFailure = projectileInput.controllerFailure;
      launchProblem = projectileInput.problem;
    }
    if (projectileInput.override) {
      routeSelection = undefined;
      progress.reset();
      follower.reset();
    }
    input = projectileInput.input;
    // He never turns back out of the entry, and leaves by the exit only on his way out.
    input = boundaryInput(
      { backX: area.backX, canExit: Boolean(ended) || exiting, exitX: area.exitX },
      box(),
      input,
    );
    if (launchProblem) {
      problems.push(launchProblem);
      break;
    }
    const before = zone;
    zone = stepEvade(observer, layout, input, before);
    recorder.record(zoneTraceLine(layout, STEP_SECONDS, before, zone));
    work++;
    const sample = bossSample(ORDINARY, layout, tick, zone);
    if (acquired === undefined && sample.agents.some(({ pursuit }) => pursuit === "engaged")) {
      acquired = tick;
    }
    history.push(sample);
    projectileHistory.push(observeProjectileFrame(ORDINARY, layout, gravityByEmitter, zone));
    if (history.length > 2 * (delay + decide) + 2) {
      history.shift();
      projectileHistory.shift();
    }
    if (dodge) {
      const latest = sample.agents.find(({ id }) => id === dodge!.boss);
      if (
        dodge.ended === undefined &&
        (latest?.attack?.id !== dodge.attack || latest.pursuit !== "engaged")
      ) {
        dodge.ended = tick;
      }
      if (dodge.ended !== undefined || tick - dodge.started >= ticksOf(DODGE_LIMIT_SECONDS)) {
        dodge = undefined;
        lastDodgeEnd = tick;
        follower.reset();
      }
    }
    // A change of level on the loop: grounded at a loop waypoint row other than the last one.
    if (!ended && !exiting && target.route === loop && zone.bird.grounded) {
      const row = Math.round(bottomCentre(box()).y / TILE);
      if (loopRows.has(row) && Math.abs(bottomCentre(box()).y - row * TILE) <= EDGE) {
        if (level !== undefined && row !== level) {
          levels++;
        }
        level = row;
      }
    }
    if (!ended && zone.escapes.length > 0) {
      const gaveUp = sample.agents.some(({ gaveUp }) => gaveUp);
      ended = { cause: gaveUp ? "give-up" : zone.escapes[0]!.cause, tick };
      follower.reset();
    }
  }
  if (!free && !death && switches === 0 && levels === 0) {
    problems.push("no route switch or loop level change");
  }
  return {
    ...(controllerFailure && { controllerFailure }),
    ...(acquired !== undefined && { acquired: acquired * STEP_SECONDS }),
    ...(cleared !== undefined && { cleared }),
    ...(death && { death }),
    ...(ended && { ended: { cause: ended.cause, seconds: ended.tick * STEP_SECONDS } }),
    ...(cleared !== undefined &&
      acquired !== undefined && { exit: cleared - acquired * STEP_SECONDS }),
    levels,
    problems,
    seed,
    start,
    switches,
    trace: recorder.hash(),
    work,
  };
}

// Every evade run of the arena: each start for each seed.
export function evadeRuns(context: EvadeContext): EvadeRun[] {
  return EVADE_STARTS.flatMap((start) => EVADE_SEEDS.map((seed) => evadeRun(context, start, seed)));
}
