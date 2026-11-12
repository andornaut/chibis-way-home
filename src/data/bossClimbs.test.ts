import { findTraversal } from "@andornaut/game-kit/terrain/traversal";
import { expect, it, vi } from "vitest";

import { namedStreams } from "../ai/randomStreams.ts";
import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { assembleZone, zonePlanOf } from "../rules/assemble.ts";
import {
  type BehaviourState,
  contactBox,
  startBehaviour,
  stepBehaviour,
} from "../rules/behaviour.ts";
import type { BehaviourWorld } from "../rules/behaviourReach.ts";
import { advanceTraversal, type BehaviourTraversalState } from "../rules/behaviourTraversal.ts";
import { startBird } from "../rules/bird.ts";
import { chunkProblems } from "../rules/chunk.ts";
import { zoneLayout } from "../rules/tiles.ts";
import { standsOn, startZone, stepZone } from "../rules/zone.ts";
import { CHUNK_LIBRARY } from "../rules/zonePlans.ts";
import { withInstances } from "../testing/encounterLayouts.ts";
import { REQUIRED_CHUNK_ROUTES } from "../testing/requiredRoutes.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import { BIRD } from "./bird.ts";
import { CHUNKS } from "./chunks.ts";
import { TILE } from "./screen.ts";
import { apartmentChunkId } from "./zone6.ts";
import { RECIPES } from "./zones.ts";

vi.mock("@andornaut/game-kit/terrain/traversal", async (original) => {
  const actual = await original<typeof import("@andornaut/game-kit/terrain/traversal")>();
  return { ...actual, findTraversal: vi.fn(actual.findTraversal) };
});

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
function layoutOf(theme: string, id: string) {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, theme, 2, [id]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

// The low central crossing, a floor at row 50 with a four-row block from col 24 to col 36, with a
// boss on the floor past the block, in a theme.
const BLOCK_COL = 24;
const CROSSING_FLOOR = 50;
const BLOCK_ROW = 46;
function crossingWith(theme: string, character: string, col = 44) {
  const id = "low-central-crossing";
  const library = withInstances(id, [{ character, col, role: "antagonist", row: 46 }]);
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, theme, 2, [id]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

it.each([
  { boss: "bear-antagonist", theme: "deep-woods" },
  { boss: "dog-antagonist", theme: "city-streets" },
] as const)(
  "production ground boss $boss jumps and lands beyond the crossing's block",
  ({ boss, theme }) => {
    const col = BLOCK_COL;
    const floor = CROSSING_FLOOR;
    const id = boss;
    const layout = crossingWith(theme, boss);
    const area = layout.areas[layout.start.area]!;
    const object = area.objects.find((object) => object.behaviour?.pursuit)!;
    const motion = object.behaviour!.states.pursuit!.motion;
    if (motion.kind !== "pursue" || motion.mode !== "ground" || !motion.traversal) {
      throw new Error("Expected the production ground pursuit profile");
    }
    const platforms = area.objects.flatMap((owner) => {
      if (owner.collision !== "solid" && owner.collision !== "ledge") {
        return [];
      }
      const rect = { ...owner.origin, height: owner.height, width: owner.width };
      return [{ after: rect, before: rect, collision: owner.collision, owner }];
    });
    const hazards = area.objects
      .filter((owner) => owner.collision === "hazard")
      .map((owner) => ({ owner, rect: contactBox(owner, owner.origin, 1) }));
    const target = {
      height: ordinary.height,
      width: ordinary.width,
      x: (col - 5) * TILE,
      y: floor * TILE - ordinary.height,
    };
    vi.mocked(findTraversal).mockClear();
    let at = object.origin;
    let traversal: BehaviourTraversalState | undefined;
    let jumped = false;
    for (let tick = 0; tick < 480; tick++) {
      const world: BehaviourWorld = {
        hazards,
        platforms: platforms.map(({ after, collision, owner }) => ({
          collision,
          owner,
          rect: after,
        })),
        solids: area.solids,
        traversalFrame: {
          bounds: { height: area.height, width: area.width, x: 0, y: 0 },
          dtSeconds: STEP_SECONDS,
          platforms,
          sample: () => platforms,
          timeSeconds: tick * STEP_SECONDS,
        },
      };
      const next = advanceTraversal(world, object, motion, STEP_SECONDS, traversal, at, target);
      at = next.at;
      traversal = next.traversal;
      jumped ||= (traversal?.physical.vy ?? 0) < 0;
      if (traversal?.physical.grounded && at.x + object.width <= col * TILE) {
        expect(jumped).toBe(true);
        expect(at.y + object.height).toBeCloseTo(floor * TILE);
        return;
      }
    }
    const searches = vi.mocked(findTraversal).mock.results.map(({ value }) => ({
      status: value.status,
      work: value.work,
    }));
    expect.fail(
      JSON.stringify({ at, goal: traversal?.target, id, searches, status: traversal?.status }),
    );
  },
);

// An acquired boss on the crossing's floor near the block, with Chibi on the block's top: Fert
// throws from the floor, so he enters pursuit from an attack before he plans onto the block.
it.each([{ actor: "ferret-antagonist", name: "Fert", theme: "apartment-lobby" }] as const)(
  "keeps acquired $name pursuing across the crossing's block",
  ({ actor, theme }) => {
    const floor = BLOCK_ROW;
    const targetCol = BLOCK_COL + 6;
    const wallCol = BLOCK_COL;
    const layout = crossingWith(theme, actor, BLOCK_COL + 16);
    const area = layout.areas[layout.start.area]!;
    const object = area.objects.find((object) => object.character === actor)!;
    const initial = startZone(ordinary, layout, 1);
    const target = {
      ...startBird(ordinary, { x: targetCol * TILE, y: floor * TILE }),
      grounded: true,
    };
    const platforms = area.objects
      .filter((owner) => owner.collision === "solid" || owner.collision === "ledge")
      .map((owner) => ({
        after: { ...owner.origin, height: owner.height, width: owner.width },
        before: { ...owner.origin, height: owner.height, width: owner.width },
        collision: owner.collision as "solid" | "ledge",
        owner,
      }));
    const hazards = area.objects
      .filter((owner) => owner.collision === "hazard")
      .map((owner) => ({ owner, rect: contactBox(owner, owner.origin, 1) }));
    let state: BehaviourState = {
      ...startBehaviour(ordinary, object, target),
      active: true,
      pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
      stateKey: "pursuit",
    };
    let at = object.origin;
    let jumped = false;
    let deferredAt: number | undefined;
    let plannedAfterDefer = false;
    const nodes: Record<string, number> = {};
    vi.mocked(findTraversal).mockClear();
    for (let tick = 0; tick < 600; tick++) {
      const world: BehaviourWorld = {
        decisions: namedStreams(
          initial.seed + initial.attempt,
          `idle-roam:${initial.area}:${area.objects.indexOf(object)}`,
        ),
        hazards,
        platforms: platforms.map(({ after, collision, owner }) => ({
          collision,
          owner,
          rect: after,
        })),
        solids: area.solids,
        traversalFrame: {
          bounds: { height: area.height, width: area.width, x: 0, y: 0 },
          dtSeconds: STEP_SECONDS,
          platforms,
          sample: () => platforms,
          timeSeconds: tick * STEP_SECONDS,
        },
        view: { height: 360, width: 720, x: 0, y: 240 },
      };
      const beforeMotion = object.behaviour!.states[state.stateKey]!.motion.kind;
      const searchesBefore = vi.mocked(findTraversal).mock.calls.length;
      const next = stepBehaviour(ordinary, object, world, STEP_SECONDS, target, at, state);
      const searchesAfter = vi.mocked(findTraversal).mock.calls.length;
      if (
        beforeMotion !== "pursue" &&
        object.behaviour!.states[next.state.stateKey]!.motion.kind === "pursue" &&
        searchesAfter === searchesBefore
      ) {
        deferredAt ??= tick;
      }
      if (deferredAt !== undefined && tick === deferredAt + 1 && searchesAfter > searchesBefore) {
        plannedAfterDefer = true;
      }
      at = next.at;
      state = next.state;
      nodes[state.stateKey] = (nodes[state.stateKey] ?? 0) + 1;
      jumped ||= (state.traversal?.physical.vy ?? 0) < 0;
      const box = contactBox(object, at, state.facing);
      const hit =
        box.x < target.x + ordinary.width &&
        box.x + box.width > target.x &&
        box.y < target.y + ordinary.height &&
        box.y + box.height > target.y;
      if (hit || (state.traversal?.physical.grounded && at.x + object.width <= wallCol * TILE)) {
        expect(jumped).toBe(true);
        expect(plannedAfterDefer, JSON.stringify({ deferredAt, nodes, tick })).toBe(true);
        expect(vi.mocked(findTraversal).mock.calls.length).toBeGreaterThan(0);
        expect(
          vi
            .mocked(findTraversal)
            .mock.calls.every(([context]) => context.dtSeconds === STEP_SECONDS),
        ).toBe(true);
        return;
      }
    }
    expect.fail(
      JSON.stringify({
        at,
        goal: state.traversal?.target,
        jumped,
        nodes,
        searches: vi
          .mocked(findTraversal)
          .mock.results.map(({ value }) => ({ status: value.status, work: value.work })),
        status: state.traversal?.status,
      }),
    );
  },
);

const connectedRoutes = [
  {
    goals: [
      { jumpFrom: 6, row: 46, x: 14 },
      { jumpFrom: 16, row: 42, x: 27 },
      { row: 46, x: 44 },
      { row: 50, x: 56 },
    ],
    id: "broad-mesa",
  },
  {
    goals: [
      { jumpFrom: 20, row: 46, x: 29 },
      { row: 50, x: 56 },
    ],
    id: "low-central-crossing",
  },
];
it.each(connectedRoutes)(
  "ordinary connected encounter terrain $id clears without abilities",
  ({ goals, id }) => {
    const layout = layoutOf("city-streets", id);
    let zone = startZone(ordinary, layout, 1);
    let phase = 0;
    let jumpAt: number | undefined;
    const landings: { phase: number; tick: number; x: number; row: number }[] = [];
    for (let tick = 0; tick < 600 && !zone.death && !zone.cleared; tick++) {
      const goal = goals[phase];
      let move: -1 | 0 | 1 = 1;
      let jumpHeld = false;
      if (goal) {
        if (
          zone.bird.grounded &&
          Math.abs(zone.bird.y + ordinary.height - goal.row * TILE) < 0.01 &&
          zone.bird.x >= goal.x * TILE - 1
        ) {
          landings.push({ phase, row: goal.row, tick, x: zone.bird.x });
          phase++;
          jumpAt = undefined;
        } else {
          if (
            goal.jumpFrom !== undefined &&
            zone.bird.grounded &&
            !zone.bird.jumpHeld &&
            zone.bird.x >= goal.jumpFrom * TILE
          ) {
            jumpAt ??= tick;
          }
          jumpHeld = jumpAt !== undefined && (tick - jumpAt) * STEP_SECONDS < ordinary.jumpRiseTime;
          const stop = (zone.bird.vx * Math.abs(zone.bird.vx)) / (2 * ordinary.brakeAccel);
          if (zone.bird.x + stop >= goal.x * TILE) {
            move = 0;
          }
        }
      }
      zone = stepZone(
        SKILL_PROFILES,
        ordinary,
        layout,
        STEP_SECONDS,
        { jumpHeld, move, useHeld: false },
        zone,
      );
      expect(zone.bird.airJumpUsed).toBe(false);
      expect(zone.bird.dash).toBeUndefined();
    }
    const witness = JSON.stringify({ bird: zone.bird, death: zone.death, id, landings, phase });
    expect(zone.death, witness).toBeUndefined();
    expect(phase, witness).toBe(goals.length);
    expect(zone.cleared, witness).toBe(true);
  },
);

it("keeps quiet connected terrain valid with explicit Apartment route contracts", () => {
  for (const id of ["broad-mesa", "low-central-crossing"]) {
    const chunk = CHUNKS[id]!;
    expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, chunk), id).toEqual([]);
    expect(chunk.encounters).toBe(0);
    expect(REQUIRED_CHUNK_ROUTES[id]!.length, id).toBeGreaterThan(0);
    const tallId = apartmentChunkId(id);
    const tall = CHUNKS[tallId]!;
    expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, tall), tallId).toEqual([]);
    expect(tall.encounters).toBe(0);
    expect(tall.difficulty).toBeGreaterThanOrEqual(4);
    expect(tall.rows).toBe(120);
    expect(REQUIRED_CHUNK_ROUTES[tallId]!.length, tallId).toBeGreaterThan(0);
  }
});

it("assembles Penthouse quota and room with distinct capped encounter templates", () => {
  const recipe = RECIPES.penthouse!;
  if ("sections" in recipe) {
    throw new Error("Expected a continuous Penthouse recipe");
  }
  const plan = assembleZone(CHUNK_LIBRARY, 1, "penthouse", recipe);
  const area = plan.areas[plan.start.area]!;
  const placements = area.chunks!;
  const hostile = placements.filter(({ chunk }) => CHUNK_LIBRARY.chunks[chunk]!.encounters > 0);
  expect(hostile.reduce((sum, { chunk }) => sum + CHUNK_LIBRARY.chunks[chunk]!.encounters, 0)).toBe(
    recipe.encounters,
  );
  expect(new Set(hostile.map(({ chunk }) => chunk)).size).toBe(hostile.length);
  expect(area.objects.filter(({ room }) => room !== undefined)).toHaveLength(
    recipe.doors.reduce((sum, door) => sum + door.count, 0),
  );
  for (let index = 1; index < placements.length; index++) {
    const previous = CHUNK_LIBRARY.chunks[placements[index - 1]!.chunk]!;
    const next = CHUNK_LIBRARY.chunks[placements[index]!.chunk]!;
    expect(previous.exit.row).toBe(next.entry.row);
  }
});

function transferGateFixture() {
  const layout = layoutOf("city-streets", "compound-transfer-gate");
  const area = layout.areas[layout.start.area]!;
  const hosts = area.objects.flatMap((object, index) =>
    object.character === "city-shuttle" ? [{ index, object }] : [],
  );
  const gate = area.objects.findIndex((object) => object.character === "red-edge-left");
  return { area, gate, hosts, layout };
}

it("transfer gate completes both ferry tracks and the perpendicular gate cycle", () => {
  const { gate, hosts, layout } = transferGateFixture();
  const indices = [...hosts.map(({ index }) => index), gate];
  const ranges = indices.map(() => ({ max: -Infinity, min: Infinity, states: new Set<string>() }));
  let zone = startZone(ordinary, layout, 1);
  for (let tick = 0; tick < 960; tick++) {
    zone = stepZone(SKILL_PROFILES, ordinary, layout, STEP_SECONDS, idle, zone);
    expect(zone.death).toBeUndefined();
    indices.forEach((index, cursor) => {
      const coordinate = index === gate ? zone.objects[index]!.y : zone.objects[index]!.x;
      ranges[cursor]!.min = Math.min(ranges[cursor]!.min, coordinate);
      ranges[cursor]!.max = Math.max(ranges[cursor]!.max, coordinate);
      ranges[cursor]!.states.add(zone.behaviours[index]!.stateKey);
    });
  }
  hosts.forEach(({ object }, cursor) => {
    expect(ranges[cursor]!.min).toBeCloseTo(object.origin.x);
    expect(ranges[cursor]!.max).toBeCloseTo(object.origin.x + object.behaviour!.distance);
  });
  expect(ranges[2]!.min).toBeCloseTo(34 * TILE);
  expect(ranges[2]!.max).toBeCloseTo(44 * TILE);
  for (const range of ranges) {
    for (const key of ["forward", "back", "wait-far", "wait-near"]) {
      expect(range.states.has(key)).toBe(true);
    }
  }
});

it("ordinary transfer gate route boards, observes, crosses the gate and rides the second ferry", () => {
  const { area, gate, hosts, layout } = transferGateFixture();
  const [first, second] = hosts;
  if (!first || !second) {
    throw Error("Expected two ferries");
  }
  let zone = startZone(ordinary, layout, 1);
  let phase = "first-board";
  let launch = 0;
  let boardSecond: number | undefined;
  let crossing = false;
  const carried = [0, 0];
  for (let tick = 0; tick < 1200; tick++) {
    const on = hosts.map(({ index, object }) =>
      standsOn(ordinary, zone.bird, {
        ...zone.objects[index]!,
        height: object.height,
        width: object.width,
      }),
    );
    if (phase === "first-board" && on[0]) {
      phase = "first-ride";
    }
    if (
      phase === "first-ride" &&
      zone.objects[first.index]!.x >=
        first.object.origin.x + first.object.behaviour!.distance - 1e-6
    ) {
      phase = "first-transfer";
      launch = tick;
    }
    if (
      phase === "first-transfer" &&
      zone.bird.grounded &&
      zone.bird.x >= 24 * TILE &&
      zone.bird.x + ordinary.width <= 28 * TILE
    ) {
      phase = "gate";
    }
    if (
      phase === "gate" &&
      zone.objects[gate]!.y + area.objects[gate]!.height <= zone.bird.y - 3 * TILE
    ) {
      crossing = true;
    }
    if (phase === "gate" && crossing && zone.bird.x >= 30 * TILE - 4) {
      phase = "second-board";
    }
    if (
      phase === "second-board" &&
      boardSecond === undefined &&
      zone.behaviours[second.index]!.stateKey === "back" &&
      zone.objects[second.index]!.x <= second.object.origin.x + second.object.width / 2
    ) {
      boardSecond = tick;
    }
    if (phase === "second-board" && on[1]) {
      phase = "second-ride";
    }
    if (
      phase === "second-ride" &&
      zone.objects[second.index]!.x >=
        second.object.origin.x + second.object.behaviour!.distance - 1e-6
    ) {
      phase = "second-transfer";
      launch = tick;
    }
    const goal =
      phase === "first-board"
        ? zone.objects[first.index]!.x + (first.object.width - ordinary.width) / 2
        : phase === "first-transfer"
          ? 25 * TILE
          : phase === "gate" && crossing
            ? 30 * TILE
            : phase === "second-board" && boardSecond !== undefined
              ? zone.objects[second.index]!.x + (second.object.width - ordinary.width) / 2
              : phase === "second-transfer"
                ? 55 * TILE
                : zone.bird.x;
    const move = Math.abs(goal - zone.bird.x) <= 4 ? 0 : goal > zone.bird.x ? 1 : -1;
    const jumpHeld =
      phase === "first-board"
        ? tick < 8
        : phase === "first-transfer" || phase === "second-transfer"
          ? tick - launch < 8
          : phase === "second-board" && boardSecond !== undefined
            ? tick - boardSecond < 8
            : false;
    const previous = zone.bird.x;
    zone = stepZone(
      SKILL_PROFILES,
      ordinary,
      layout,
      STEP_SECONDS,
      { ...idle, jumpHeld, move },
      zone,
    );
    expect(zone.death, phase).toBeUndefined();
    on.forEach((standing, index) => {
      if (standing) {
        carried[index]! += Math.max(0, zone.bird.x - previous);
      }
    });
    if (
      phase === "second-transfer" &&
      zone.bird.grounded &&
      zone.bird.x >= 54 * TILE &&
      zone.bird.x + ordinary.width <= 60 * TILE
    ) {
      expect(crossing).toBe(true);
      expect(carried.every((distance) => distance > 8 * TILE)).toBe(true);
      expect(zone.bird.y + ordinary.height).toBeCloseTo(50 * TILE);
      return;
    }
  }
  expect.fail(JSON.stringify({ bird: zone.bird, carried, phase }));
});

it("transfer gate missed near boarding recovers on a ledge and reboards normally", () => {
  const { hosts, layout } = transferGateFixture();
  const first = hosts[0]!;
  let zone = startZone(ordinary, layout, 1);
  let recovered = false;
  let boardAt: number | undefined;
  for (let tick = 0; tick < 1200; tick++) {
    const at = zone.objects[first.index]!;
    if (zone.bird.grounded && Math.abs(zone.bird.y + ordinary.height - 54 * TILE) < 1e-6) {
      recovered = true;
    }
    if (
      recovered &&
      boardAt === undefined &&
      zone.behaviours[first.index]!.stateKey === "back" &&
      at.x <= first.object.origin.x + 2 * TILE
    ) {
      boardAt = tick;
    }
    const goal =
      boardAt === undefined ? 5 * TILE : at.x + (first.object.width - ordinary.width) / 2;
    const move =
      (recovered && boardAt === undefined) || Math.abs(goal - zone.bird.x) <= 4
        ? 0
        : goal > zone.bird.x
          ? 1
          : -1;
    zone = stepZone(
      SKILL_PROFILES,
      ordinary,
      layout,
      STEP_SECONDS,
      {
        ...idle,
        jumpHeld: boardAt !== undefined && (tick - boardAt) * STEP_SECONDS < ordinary.jumpRiseTime,
        move,
      },
      zone,
    );
    expect(zone.death).toBeUndefined();
    if (
      recovered &&
      standsOn(ordinary, zone.bird, {
        ...zone.objects[first.index]!,
        height: first.object.height,
        width: first.object.width,
      })
    ) {
      return;
    }
  }
  expect.fail(JSON.stringify({ bird: zone.bird, recovered }));
});
