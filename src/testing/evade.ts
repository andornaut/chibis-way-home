// The evade playtest: a skill-free Chibi controller that survives an arena's boss by its routes
// and refuges until the chase ends, then walks out. It moves with run, jump and flutter only (no
// Dash or double jump), decides every DECIDE_SECONDS from what Chibi sees, and sees the boss
// BOSS_FAIRNESS's reaction delay late: its body, facing, pursuit and visible tell, never its
// scorer, plan, timers or seed. The boss's distance to a spot is its own movement map's path
// distance there, unbounded where its body does not fit or its map has no path. Policy, first
// match wins:
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
import type { AntagonistKind, ArenaRoute, ObjectLayout, Point, ZoneLayout } from "../data/types";
import { SKILL_PROFILES } from "../progress";
import { birdBox, startBird } from "../rules/bird";
import {
  airMask,
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  flightMap,
  groundMap,
  groundMask,
  type MapSupport,
} from "../rules/movementMaps";
import { startZone, stepZone, type ZoneInput } from "../rules/zone";
import { activateAll, bossSample, type BossTick } from "../sim/bossSimulator";
import { ALLOW, hitboxAt, standingAt } from "../sim/pathOut";
import { zoneTraceLine } from "../sim/zoneTrace";
import { type ArenaCase, type ArenaMaps, isLoop, pixelOf } from "./arenas";
import { DODGES, type DodgeView } from "./dodges";
import { ORDINARY } from "./encounterLayouts";

export const EVADE_SEEDS: readonly number[] = [0, 1, 2, 3];
// entry: the boss acquires Chibi as he enters; mid: as he stands mid-arena on the loop, at its
// waypoint nearest the middle column beyond the threat distance of the boss's spawn.
export type EvadeStart = "entry" | "mid";
export const EVADE_STARTS: readonly EvadeStart[] = ["entry", "mid"];
// The chase must end within this long: the certain give-up plus margin.
export const EVADE_LIMIT_SECONDS = 40;
// After the chase ends, the exit within this many ticks.
export const EVADE_EXIT_TICKS = 600;
const DECIDE_SECONDS = 0.1;
const THREAT_TILES = 6;
// A dodge that has not seen its attack end stops after this long.
const DODGE_LIMIT_SECONDS = 6;
const KEEP_TILES = 3;
const AVOID_TILES = 1;

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
const ticksOf = (seconds: number) => Math.round(seconds / STEP_SECONDS);

export interface EvadeRun {
  readonly death?: string;
  readonly ended?: { readonly cause: string; readonly seconds: number };
  readonly exitTicks?: number;
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

const bottomCentre = (box: { x: number; y: number; width: number; height: number }): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height,
});

// One evade run of the arena from a start and zone seed.
export function evadeRun(
  context: { readonly found: ArenaCase; readonly layout: ZoneLayout; readonly maps: ArenaMaps },
  start: EvadeStart,
  seed: number,
): EvadeRun {
  const { found, layout, maps } = context;
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
  // Each countering refuge as a one-waypoint route at its middle; a move between routes or
  // refuges is a switch. He starts on the loop.
  const refuges: ArenaRoute[] = arena.refuges.flatMap(({ at, kind, width }, index) =>
    counters.includes(kind)
      ? [{ id: `refuge-${index}`, waypoints: [{ col: at.col + width / 2, row: at.row }] }]
      : [],
  );
  let switches = 0;
  let waiting = false;
  let target: Target = { index: 0, route: loop };
  const aim = (next: Target) => {
    if (next.route.id !== target.route.id) {
      switches++;
    }
    target = next;
  };
  let hold = false;
  let dodge: Dodge | undefined;
  let lastDodgeEnd = -1;
  let leg: { edge: MapEdge<MapSupport>; step: number } | undefined;
  let ended: { cause: string; tick: number } | undefined;
  const problems: string[] = [];
  let death: string | undefined;
  let exitTicks: number | undefined;
  let work = 0;

  const box = () => birdBox(ORDINARY, zone.bird);
  // Chibi's map without the spans and legs within AVOID_TILES of the boss's body as he last saw
  // it, his own span aside.
  let avoiding: MapMask = maps.mask;
  const avoid = (boss: AgentSample | undefined) => {
    if (!boss) {
      avoiding = maps.mask;
      return;
    }
    const pad = AVOID_TILES * TILE;
    const near = {
      height: boss.height + 2 * pad,
      width: boss.width + 2 * pad,
      x: boss.at.x - pad,
      y: boss.at.y - pad,
    };
    const own = here()?.node;
    const width = chibi.profile.body.width;
    const height = chibi.profile.body.height;
    avoiding = {
      edge: (id, seconds) =>
        !rectsOverlap(chibi.edges[id]!.sweep, near) && maps.mask.edge(id, seconds),
      key: `avoid:${Math.round(near.x / TILE)}:${Math.round(near.y / TILE)}:${own ?? -1}`,
      node: (id) => {
        const node = chibi.nodes[id]!;
        const span = {
          height,
          width: node.right - node.left + width,
          x: node.left,
          y: node.y - height,
        };
        return maps.mask.node(id) && (id === own || !rectsOverlap(span, near));
      },
    };
  };
  const here = () => locate(chibi, box());
  const chibiDistance = (point: Point): number => {
    const ref = here();
    return ref ? mapDistance(chibi, avoiding, ref, point) : Infinity;
  };
  const solids = maps.encounter.terrain.world.solids;
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
  const waypointPixel = ({ index, route }: Target) => pixelOf(route.waypoints[index]!);
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
  // its launch range, otherwise a walk toward the range.
  const follow = (goal: Point | undefined): ZoneInput => {
    if (leg) {
      const command = leg.edge.commands[leg.step++];
      if (command) {
        // The map's jumps are fixed impulses; he reaches a full jump's height by holding Jump
        // through the rise, and a hop's by a tap.
        const rise = chibi.nodes[leg.edge.from]!.y - chibi.nodes[leg.edge.to]!.y;
        const full = leg.edge.kind === "jump" && rise > ORDINARY.jumpHopHeight;
        return {
          jumpHeld: command.jump || (full && leg.step * STEP_SECONDS < ORDINARY.jumpRiseTime),
          move: command.move,
          useHeld: false,
        };
      }
      leg = undefined;
    }
    if (!goal) {
      return STILL;
    }
    const body = box();
    const toward = (x: number): ZoneInput => {
      const dx = x - body.x;
      return { jumpHeld: false, move: dx > EDGE ? 1 : dx < -EDGE ? -1 : 0, useHeld: false };
    };
    const feet = bottomCentre(body);
    if (!zone.bird.grounded) {
      return toward(goal.x - body.width / 2);
    }
    const ref = here();
    const path = ref && pathTo(chibi, avoiding, ref, { point: goal, radius: TILE });
    const edge = path?.edges[0] === undefined ? undefined : chibi.edges[path.edges[0]];
    if (!edge) {
      return Math.abs(feet.x - goal.x) <= TILE / 2 ? STILL : toward(goal.x - body.width / 2);
    }
    if (edge.kind === "walk") {
      return toward(Math.min(edge.land.right, Math.max(edge.land.left, goal.x - body.width / 2)));
    }
    // Within one tick's walk of the launch range, so a walk at speed never steps over it.
    const reach = ORDINARY.walkSpeed * STEP_SECONDS;
    if (body.x >= edge.launch.left - reach && body.x <= edge.launch.right + reach) {
      leg = { edge, step: 0 };
      return follow(goal);
    }
    return toward(Math.min(edge.launch.right, Math.max(edge.launch.left, body.x)));
  };

  // Each route's next waypoints: those either side of its waypoint nearest Chibi on his map, and
  // that one unless he stands at it. The one maximizing the boss's distance minus his wins, ties
  // by his distance then route id; a waypoint he stands at counts only when the boss cannot reach
  // it.
  const escapeTarget = (among: readonly ArenaRoute[], boss: AgentSample): Target | undefined => {
    // He keeps an unreached target while the boss stays farther from it than he is, so a leg
    // that starts by walking away from it, such as to a jump's launch, is not abandoned.
    if (among.includes(target.route)) {
      const goal = waypointPixel(target);
      const mine = chibiDistance(goal);
      if (mine >= 2 * TILE && mine < bossDistance(boss, goal)) {
        return target;
      }
    }
    let best: { chibi: number; score: number; target: Target } | undefined;
    for (const route of among) {
      const count = loopLength(route);
      const mine = Array.from({ length: count }, (_, index) =>
        chibiDistance(pixelOf(route.waypoints[index]!)),
      );
      const nearest = mine.indexOf(Math.min(...mine));
      if (mine[nearest] === Infinity) {
        continue;
      }
      for (const index of new Set([nearest, step(route, nearest, 1), step(route, nearest, -1)])) {
        const theirs = bossDistance(boss, pixelOf(route.waypoints[index]!));
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
        if (!best || score > best.score || (score === best.score && mine[index]! < best.chibi)) {
          best = { chibi: mine[index]!, score, target: { index, route } };
        }
      }
    }
    return best?.target;
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

  const choose = (tick: number) => {
    const observed = history[Math.max(0, history.length - 1 - delay)];
    const before = history[Math.max(0, history.length - 1 - delay - decide)];
    const boss = observed?.agents[0];
    avoid(boss);
    if (!boss) {
      hold = false;
      return;
    }
    const engaged = boss.pursuit === "engaged";
    // 1. Sheltered from the engaged boss.
    const refuge = engaged ? shelter(boss) : undefined;
    if (refuge) {
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
      const away = escapeTarget([loop], boss);
      const leads =
        away !== undefined &&
        bossDistance(boss, waypointPixel(away)) > chibiDistance(waypointPixel(away));
      const scripted = dodges.find((name) => name !== "retreat");
      if (dodges.includes("retreat") && (!scripted || (gap > THREAT_TILES * TILE && leads))) {
        if (away) {
          aim(away);
        }
        dodge = { attack: attack!.id, boss: boss.id, retreat: true, started: tick };
      } else {
        dodge = { attack: attack!.id, boss: boss.id, script: DODGES[scripted!](), started: tick };
        leg = undefined;
      }
      return;
    }
    const closing = closingSpeed(boss, observed!, before);
    // 3. Threatened: the best waypoint anywhere.
    if (engaged && (gap <= THREAT_TILES * TILE || closing > ORDINARY.walkSpeed)) {
      const next = escapeTarget([...routes, ...refuges], boss);
      if (next) {
        aim(next);
        return;
      }
    }
    // 4. Keep moving round the loop away from the boss, or toward a countering refuge: the next
    // waypoint by the same score.
    const next = escapeTarget([loop, ...refuges], boss);
    if (next) {
      aim(next);
    }
  };

  // A retreat follows the loop's best next waypoint on his map, re-aimed each decision.
  const retreat = () => {
    const observed = history[Math.max(0, history.length - 1 - delay)];
    const boss = observed?.agents.find(({ id }) => id === dodge!.boss);
    if (boss) {
      avoid(boss);
      const away = escapeTarget([loop], boss);
      if (away) {
        aim(away);
      }
    }
  };

  const exitPoint: Point = { x: area.width + 4 * TILE, y: arena.exit.row * TILE };
  const limit = ticksOf(EVADE_LIMIT_SECONDS);
  for (let tick = 0; ; tick++) {
    if (zone.death) {
      death = `${zone.death.reason} at ${(tick * STEP_SECONDS).toFixed(2)} s`;
      problems.push(`death: ${death}`);
      break;
    }
    if (zone.cleared) {
      if (ended) {
        exitTicks = tick - ended.tick;
        if (exitTicks > EVADE_EXIT_TICKS) {
          problems.push(`exit ${exitTicks} ticks after the chase ended`);
        }
      } else {
        problems.push("left the arena before the chase ended");
      }
      break;
    }
    if (zone.turnedBack) {
      problems.push("turned back out of the entry");
      break;
    }
    if (!ended && tick >= limit) {
      problems.push(`the chase is still running at ${EVADE_LIMIT_SECONDS} s`);
      break;
    }
    if (ended && tick - ended.tick > EVADE_EXIT_TICKS) {
      problems.push(`no exit within ${EVADE_EXIT_TICKS} ticks of the chase ending`);
      break;
    }
    let input: ZoneInput;
    if (ended) {
      dodge = undefined;
      // He sets out once nothing the boss threw or dropped is still in flight.
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
      input =
        waiting || (history.at(-1)?.world.transients ?? 0) > 0
          ? follow(undefined)
          : follow(exitPoint);
    } else {
      if (!dodge && tick % decide === 0) {
        choose(tick);
      } else if (dodge?.retreat && tick % decide === 0) {
        retreat();
      }
      if (dodge?.retreat) {
        input = follow(waypointPixel(target));
      } else if (dodge?.script) {
        const latest = history.at(-1)?.agents.find(({ id }) => id === dodge!.boss);
        input = latest
          ? dodge.script!({
              boss: latest,
              seconds: (tick - dodge.started) * STEP_SECONDS,
              target: history.at(-1)!.target,
            })
          : STILL;
      } else if (hold) {
        input = follow(undefined);
      } else {
        input = follow(waypointPixel(target));
      }
    }
    // Until the chase ends he stays inside the arena, a body's width from either edge.
    const body = box();
    if (
      !ended &&
      ((input.move === 1 && body.x + 2 * body.width > area.exitX) ||
        (input.move === -1 && body.x - body.width < area.backX))
    ) {
      input = { ...input, move: 0 };
    }
    const before = zone;
    zone = stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, input, before);
    recorder.record(zoneTraceLine(layout, STEP_SECONDS, before, zone));
    work++;
    const sample = bossSample(ORDINARY, layout, tick, zone);
    history.push(sample);
    if (history.length > 2 * (delay + decide) + 2) {
      history.shift();
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
        leg = undefined;
      }
    }
    if (!ended && zone.escapes.length > 0) {
      const gaveUp = sample.agents.some(({ gaveUp }) => gaveUp);
      ended = { cause: gaveUp ? "give-up" : zone.escapes[0]!.cause, tick };
      leg = undefined;
    }
  }
  if (!death && switches === 0) {
    problems.push("no route switch");
  }
  return {
    ...(death && { death }),
    ...(ended && { ended: { cause: ended.cause, seconds: ended.tick * STEP_SECONDS } }),
    ...(exitTicks !== undefined && { exitTicks }),
    problems,
    seed,
    start,
    switches,
    trace: recorder.hash(),
    work,
  };
}

// Every evade run of the arena: each start for each seed.
export function evadeRuns(context: {
  readonly found: ArenaCase;
  readonly layout: ZoneLayout;
  readonly maps: ArenaMaps;
}): EvadeRun[] {
  return EVADE_STARTS.flatMap((start) => EVADE_SEEDS.map((seed) => evadeRun(context, start, seed)));
}
