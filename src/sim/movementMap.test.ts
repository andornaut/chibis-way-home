// Path out of every pooled encounter: no boss can be left where it cannot leave, map edges are
// moves pursuit's kernel makes, and every spot Chibi can stand on has a skill-free way out.
import {
  type AirMap,
  type AirNodeId,
  locateAir,
  reachableAir,
  sinksAir,
} from "@andornaut/game-kit/terrain/airMap";
import {
  locate,
  type MapEdge,
  type MapEdgeKind,
  type MapMask,
  type MovementMap,
  nearestReachable,
  type NodeId,
  type NodeRef,
  pathTo,
  reachableSet,
  sinks,
} from "@andornaut/game-kit/terrain/movementMap";
import {
  findTraversal,
  stepTraversal,
  type TraversalState,
} from "@andornaut/game-kit/terrain/traversal";
import { describe, expect, it } from "vitest";

import { EDGE, STEP_SECONDS } from "../core";
import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours";
import { TILE } from "../data/screen";
import type { AreaLayout, BehaviourMotion, ObjectLayout, Rect } from "../data/types";
import { RECIPES } from "../data/zones";
import { recipeChunkPool, themesOf } from "../rules/assemble";
import { traversalContext } from "../rules/behaviourTraversal";
import {
  airMask,
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  chibiJumpScripts,
  chibiMovementProfile,
  flightMap,
  groundMap,
  groundMask,
  type MapSupport,
  type MapTerrain,
  mapTerrain,
} from "../rules/movementMaps";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { chunkLayout, ORDINARY } from "../testing/encounterLayouts";

type GroundMotion = Extract<BehaviourMotion, { mode: "ground" }>;

// Seam ground beyond each chunk edge, wider than any body, holds the exit spans.
const PAD = 12 * TILE;
const ENCOUNTER_ROLES = new Set(["antagonist", "antagonist-intro"]);

interface PathOutCase {
  readonly id: string;
  readonly theme: string;
}

function pooledEncounters(): readonly PathOutCase[] {
  const pools = Object.values(RECIPES).flatMap((recipe) =>
    "sections" in recipe
      ? recipe.sections.map(({ chunks, theme }) => ({ chunks, theme }))
      : [{ chunks: recipeChunkPool(CHUNK_LIBRARY, recipe), theme: recipe.theme }],
  );
  const cases = new Map<string, PathOutCase>();
  for (const { chunks, theme } of pools) {
    for (const id of chunks) {
      const chunk = CHUNK_LIBRARY.chunks[id];
      if (
        chunk &&
        themesOf(chunk).includes(theme) &&
        chunk.objects.some(({ role }) => role !== undefined && ENCOUNTER_ROLES.has(role))
      ) {
        cases.set(`${id} ${theme}`, { id, theme });
      }
    }
  }
  return [...cases.values()].sort((a, b) => (`${a.id} ${a.theme}` < `${b.id} ${b.theme}` ? -1 : 1));
}

interface Encounter {
  readonly area: AreaLayout;
  readonly bosses: readonly ObjectLayout[];
  readonly terrain: MapTerrain;
}

function encounter({ id, theme }: PathOutCase): Encounter {
  const layout = chunkLayout(theme, id);
  const area = layout.areas[layout.start.area]!;
  const chunk = CHUNK_LIBRARY.chunks[id]!;
  const pad = (x: number, row: number): Rect => ({
    height: area.height - row * TILE,
    width: PAD,
    x,
    y: row * TILE,
  });
  const terrain = mapTerrain(
    {
      bounds: { height: area.height, width: area.width + 2 * PAD, x: -PAD, y: 0 },
      pads: [pad(-PAD, chunk.entry.row), pad(area.width, chunk.exit.row)],
    },
    area,
  );
  return { area, bosses: area.objects.filter((object) => object.behaviour?.pursuit), terrain };
}

function hitboxAt(map: MovementMap<MapSupport>, x: number, y: number): Rect {
  const { body } = map.profile;
  return { height: body.height, width: body.width, x: x + body.offset.x, y: y + body.offset.y };
}

function describeNode(map: MovementMap<MapSupport>, id: NodeId): string {
  const node = map.nodes[id]!;
  const col = (x: number) => (x / TILE).toFixed(1);
  return `node ${id} row ${(node.y / TILE).toFixed(1)} cols ${col(node.left)}..${col(node.right)}`;
}

function pursuitMotion(object: ObjectLayout, walkSpeed: number): GroundMotion {
  const motion = Object.values(object.behaviour!.states)
    .map((node) => node.motion)
    .find(
      (motion): motion is GroundMotion =>
        motion.kind === "pursue" &&
        motion.mode === "ground" &&
        motion.traversal !== undefined &&
        motion.speed === walkSpeed,
    );
  if (!motion) {
    throw new Error(`No ground pursuit motion for ${object.character}`);
  }
  return motion;
}

// Runs an edge's witness through pursuit's own kernel context from the launch, and proves each
// leg (split at each landing) with pursuit's search, the witness as its preferred inputs.
function edgeProblems(
  terrain: MapTerrain,
  object: ObjectLayout,
  map: MovementMap<MapSupport>,
  edge: MapEdge<MapSupport>,
): string | undefined {
  const motion = pursuitMotion(object, map.profile.walkSpeed);
  const context = traversalContext(terrain.world, STEP_SECONDS, object, motion)!;
  const from = map.nodes[edge.from]!;
  const { body } = map.profile;
  let state: TraversalState<MapSupport> = {
    fallFromY: from.y,
    grounded: true,
    vy: 0,
    x: edge.launch.left - body.offset.x,
    y: from.y - body.height - body.offset.y,
  };
  const legs: { start: TraversalState<MapSupport>; tick: number; end: number }[] = [];
  let legStart = { state, tick: 0 };
  let airborne = false;
  for (const [tick, command] of edge.commands.entries()) {
    const result = stepTraversal(context, { ...command, timeSeconds: tick * STEP_SECONDS }, state);
    if (result.status !== "ok") {
      return `${edge.kind} ${edge.id} step ${tick} ${result.status}`;
    }
    state = result.state;
    airborne ||= !state.grounded;
    if (state.grounded && airborne) {
      legs.push({ end: tick + 1, start: legStart.state, tick: legStart.tick });
      legStart = { state, tick: tick + 1 };
      airborne = false;
    }
  }
  const landed = locate(map, hitboxAt(map, state.x, state.y));
  if (!state.grounded || landed?.node !== edge.to) {
    const on = landed ? describeNode(map, landed.node) : "nothing";
    return `${edge.kind} ${edge.id} lands on ${on}, not ${describeNode(map, edge.to)}`;
  }
  for (const leg of legs) {
    const end = edge.commands
      .slice(0, leg.end)
      .reduce<TraversalState<MapSupport>>(
        (s, command, tick) =>
          tick < leg.tick
            ? s
            : stepTraversal(context, { ...command, timeSeconds: tick * STEP_SECONDS }, s).state,
        leg.start,
      );
    const node = map.nodes[locate(map, hitboxAt(map, end.x, end.y))!.node]!;
    const result = findTraversal(
      { ...context, dtSeconds: STEP_SECONDS },
      {
        ...BEHAVIOUR_TRAVERSAL_SEARCH.budget,
        goal: {
          height: body.height + 2 * EDGE,
          width: node.right - node.left + body.width,
          x: node.left,
          y: node.y - body.height - EDGE,
        },
        preferredInputs: edge.commands.slice(leg.tick, leg.end),
        start: leg.start,
        timeSeconds: leg.tick * STEP_SECONDS,
      },
    );
    if (result.status !== "found") {
      return `${edge.kind} ${edge.id} leg at ${leg.tick} ${result.status}`;
    }
  }
  return undefined;
}

interface PathOutOptions {
  // Boss edge kinds left out of every query, to prove the checks see the routes they carry.
  readonly disabled: ReadonlySet<MapEdgeKind>;
}

interface PathOutReport {
  readonly edges: number;
  readonly problems: readonly string[];
}

const ALLOW = () => true;
const NONE: ReadonlySet<MapEdgeKind> = new Set();

function groundProblems(
  options: PathOutOptions,
  { terrain }: Encounter,
  refuges: readonly { x: number; y: number }[],
  object: ObjectLayout,
  map: MovementMap<MapSupport>,
): PathOutReport {
  const problems: string[] = [];
  const name = object.character;
  const withoutDisabled = (mask: MapMask): MapMask => ({
    ...mask,
    edge: (id, t) => !options.disabled.has(map.edges[id]!.kind) && mask.edge(id, t),
  });
  const everything = withoutDisabled(groundMask({ allowed: ALLOW, climb: true, key: "all" }, map));
  const pursuit = withoutDisabled(
    groundMask({ allowed: ALLOW, climb: false, key: "pursuit" }, map),
  );
  const collapsed = withoutDisabled(
    groundMask(
      { allowed: (id) => !terrain.crumbling.has(id), climb: false, key: "collapsed" },
      map,
    ),
  );
  const exits = map.nodes
    .filter(({ supportId }) => terrain.pads.includes(supportId as Rect))
    .map(({ id }) => id);
  const exit = { predicate: ({ id }: { id: NodeId }) => exits.includes(id) };
  const spawn = locate(map, hitboxAt(map, object.origin.x, object.origin.y));
  if (!spawn) {
    return { edges: 0, problems: [`${name} spawn is on no node`] };
  }
  const ref = (node: NodeId): NodeRef => ({ node, x: map.nodes[node]!.left });
  const reachable = reachableSet(map, everything, spawn);
  for (const node of [...reachable].sort((a, b) => a - b)) {
    if (!pathTo(map, pursuit, ref(node), exit)) {
      problems.push(`${name} ${describeNode(map, node)} has no pursuit path to an exit`);
    }
    if (!pathTo(map, pursuit, ref(node), { node: spawn.node })) {
      problems.push(`${name} ${describeNode(map, node)} has no pursuit path to the spawn`);
    }
    if (collapsed.node(node) && !pathTo(map, collapsed, ref(node), exit)) {
      problems.push(`${name} ${describeNode(map, node)} has no exit once crumbling supports fall`);
    }
  }
  for (const node of sinks(map, pursuit, spawn, exits)) {
    problems.push(`${name} ${describeNode(map, node)} is a sink`);
  }
  // Authored track ends from the placed origin: patrols, waits, returns and rushes.
  const plan = object.behaviour!;
  for (const [key, state] of Object.entries(plan.states)) {
    const track = state.track ?? plan;
    if ((state.motion.kind !== "move" && state.motion.kind !== "hop") || track.axis !== "x") {
      continue;
    }
    const at = locate(map, hitboxAt(map, object.origin.x + track.distance, object.origin.y));
    if (at && !pathTo(map, pursuit, at, exit)) {
      problems.push(`${name} ${key} track end ${describeNode(map, at.node)} has no exit`);
    }
  }
  // Climb ends leave by ordinary pursuit moves.
  for (const edge of map.edges) {
    if (edge.kind === "climb" && reachable.has(edge.from)) {
      if (!pathTo(map, pursuit, ref(edge.to), exit)) {
        problems.push(`${name} climb end ${describeNode(map, edge.to)} has no exit`);
      }
    }
  }
  // Rearm reach: from every give-up spot toward every refuge, each edge on the map's route is a
  // move the kernel makes.
  const used = new Set<number>();
  for (const node of reachable) {
    for (const refuge of refuges) {
      const near = nearestReachable(map, pursuit, ref(node), refuge);
      const path = near && pathTo(map, pursuit, ref(node), { node: near.node });
      path?.edges.forEach((edge) => used.add(edge));
    }
  }
  for (const id of [...used].sort((a, b) => a - b)) {
    const edge = map.edges[id]!;
    if (edge.deps.length > 0) {
      continue;
    }
    const problem = edgeProblems(terrain, object, map, edge);
    if (problem) {
      problems.push(
        `${name} ${describeNode(map, edge.from)} -> ${describeNode(map, edge.to)} ${problem}`,
      );
    }
  }
  return { edges: used.size, problems };
}

function airProblems(
  { area, terrain }: Encounter,
  object: ObjectLayout,
  map: AirMap<MapSupport>,
): readonly string[] {
  const name = object.character;
  const spawn = locateAir(map, { ...object.origin, height: object.height, width: object.width });
  if (spawn === undefined) {
    return [`${name} spawn is in no air cell`];
  }
  const mask = airMask({ allowed: ALLOW, key: "all" }, map);
  const reachable = reachableAir(map, mask, spawn);
  const problems: string[] = [];
  const exits = [...reachable].filter((id) => {
    const { body } = map.nodes[id]!;
    return body.x + body.width <= terrain.bounds.x + PAD || body.x >= area.width;
  });
  if (exits.length === 0) {
    problems.push(`${name} reaches no exit cell`);
  }
  for (const id of sinksAir(map, mask, spawn, exits)) {
    problems.push(`${name} air ${map.nodes[id]!.kind} ${id} is a sink`);
  }
  // The mask allows every edge at every time, so a reverse search from the spawn finds every
  // node that reaches it.
  const incoming = map.nodes.map((): AirNodeId[] => []);
  for (const { from, to } of map.edges) {
    incoming[to]!.push(from);
  }
  const returns = new Set([spawn]);
  for (const id of returns) {
    for (const from of incoming[id]!) {
      returns.add(from);
    }
  }
  for (const id of [...reachable].filter((node) => !returns.has(node)).sort((a, b) => a - b)) {
    problems.push(`${name} air ${map.nodes[id]!.kind} ${id} has no path to the spawn`);
  }
  if (![...reachable].some((id) => map.nodes[id]!.kind === "perch")) {
    problems.push(`${name} reaches no perch`);
  }
  return problems;
}

// Chibi's refuges: the spans he can stand on after entering from either side.
function chibiRefuges({ terrain }: Encounter, map: MovementMap<MapSupport>): readonly NodeId[] {
  const mask = groundMask({ allowed: ALLOW, climb: false, key: "all" }, map);
  const entered = new Set<NodeId>();
  for (const { id, left, supportId } of map.nodes) {
    if (terrain.pads.includes(supportId as Rect)) {
      reachableSet(map, mask, { node: id, x: left }).forEach((node) => entered.add(node));
    }
  }
  return [...entered].sort((a, b) => a - b);
}

function chibiProblems(
  { terrain }: Encounter,
  map: MovementMap<MapSupport>,
  refuges: readonly NodeId[],
): readonly string[] {
  const mask = groundMask({ allowed: ALLOW, climb: false, key: "all" }, map);
  const exit = {
    predicate: ({ supportId }: { supportId: MapSupport }) =>
      terrain.pads.includes(supportId as Rect),
  };
  return refuges.flatMap((id) =>
    pathTo(map, mask, { node: id, x: map.nodes[id]!.left }, exit)
      ? []
      : [`Chibi ${describeNode(map, id)} has no skill-free path to an exit`],
  );
}

function chibiMap(terrain: MapTerrain): MovementMap<MapSupport> {
  return groundMap({ jumps: chibiJumpScripts(ORDINARY) }, terrain, chibiMovementProfile(ORDINARY));
}

function pathOut(options: PathOutOptions, subject: PathOutCase) {
  const found = encounter(subject);
  const chibi = chibiMap(found.terrain);
  const refugeNodes = chibiRefuges(found, chibi);
  const refuges = refugeNodes.map((id) => {
    const { left, right, y } = chibi.nodes[id]!;
    return { x: (left + right) / 2 + ORDINARY.width / 2, y };
  });
  const problems = [...chibiProblems(found, chibi, refugeNodes)];
  let edges = 0;
  for (const object of found.bosses) {
    for (const entry of bossMovementProfiles(object)) {
      if (entry.kind === "ground") {
        const map = groundMap({ jumps: BOSS_JUMP_SCRIPTS }, found.terrain, entry.profile);
        const report = groundProblems(options, found, refuges, object, map);
        edges += report.edges;
        problems.push(...report.problems);
      } else {
        problems.push(
          ...airProblems(found, object, flightMap(found.terrain, object, entry.profile)),
        );
      }
    }
  }
  return { bosses: found.bosses.length, edges, problems };
}

const CASES = pooledEncounters();

// Layout problems for gameplay, by case: each must keep failing exactly so until its layout
// changes.
const KNOWN_PROBLEMS: Readonly<Record<string, readonly string[]>> = {};

describe("movement map path out", () => {
  it("covers every pooled encounter chunk", () => {
    expect(CASES.length).toBeGreaterThan(0);
    for (const key of Object.keys(KNOWN_PROBLEMS)) {
      expect(CASES.map(({ id, theme }) => `${id} ${theme}`)).toContain(key);
    }
  });
  it.each(CASES)("$id $theme", (subject) => {
    const result = pathOut({ disabled: NONE }, subject);
    expect(result.bosses).toBeGreaterThan(0);
    expect(result.problems).toEqual(KNOWN_PROBLEMS[`${subject.id} ${subject.theme}`] ?? []);
  });
});

describe("patrol-cover-late regression", () => {
  const subject = { id: "patrol-cover-late", theme: "city-streets" };

  it("lets Archie reach the right block top from the floor below it", () => {
    const found = encounter(subject);
    const archie = found.bosses.find(({ character }) => character === "dog-antagonist")!;
    const entry = bossMovementProfiles(archie)[0]!;
    if (entry.kind !== "ground") {
      throw new Error("Expected Archie's ground profile");
    }
    const map = groundMap({ jumps: BOSS_JUMP_SCRIPTS }, found.terrain, entry.profile);
    const mask = groundMask({ allowed: ALLOW, climb: false, key: "pursuit" }, map);
    const below = locate(
      map,
      hitboxAt(map, 43.2 * TILE - map.profile.body.offset.x, archie.origin.y),
    )!;
    const path = pathTo(map, mask, below, { point: { x: 50 * TILE, y: 44 * TILE }, radius: TILE });
    expect(path).toBeDefined();
    for (const id of path!.edges) {
      expect(edgeProblems(found.terrain, archie, map, map.edges[id]!)).toBeUndefined();
    }
  });

  // Jumps and wall-tops are each the other's alternative over these blocks: either alone keeps
  // every route; without both, the yard floor between the blocks is a sink the checks report.
  it("reports the floor between the blocks once no edge can climb a block", () => {
    expect(pathOut({ disabled: NONE }, subject).problems).toEqual([]);
    expect(pathOut({ disabled: new Set(["wall-top"]) }, subject).problems).toEqual([]);
    expect(pathOut({ disabled: new Set(["jump", "wall-top"]) }, subject).problems).toContain(
      "dog-antagonist node 5 row 50.0 cols 24.0..43.3 is a sink",
    );
  });
});
