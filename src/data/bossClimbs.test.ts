import { findTraversal } from "@andornaut/game-kit/terrain/traversal";
import { describe, expect, it, vi } from "vitest";

import { assembleZone, zonePlanOf } from "../rules/assemble";
import { type BehaviourState, contactBox, startBehaviour, stepBehaviour } from "../rules/behaviour";
import type { BehaviourWorld } from "../rules/behaviourReach";
import { advanceTraversal, type BehaviourTraversalState } from "../rules/behaviourTraversal";
import { startBird } from "../rules/bird";
import { chunkProblems } from "../rules/chunk";
import { supportedLanding } from "../rules/flyLanding";
import { STEP_SECONDS } from "../rules/step";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { REQUIRED_CHUNK_ROUTES } from "../testing/requiredRoutes";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";
import { BIRD } from "./bird";
import { CHUNKS } from "./chunks";
import { TILE } from "./screen";
import { apartmentChunkId } from "./zone6";
import { RECIPES } from "./zones";

vi.mock("@andornaut/game-kit/terrain/traversal", async (original) => {
  const actual = await original<typeof import("@andornaut/game-kit/terrain/traversal")>();
  return { ...actual, findTraversal: vi.fn(actual.findTraversal) };
});

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const cases = [
  { col: 20, floor: 30, id: "city-boundary-dog-high", theme: "city-streets" },
  { col: 20, floor: 40, id: "city-boundary-dog-terrace", theme: "city-streets" },
  { col: 16, floor: 50, id: "patrol-cover-early", theme: "city-streets" },
  { col: 24, floor: 50, id: "patrol-cover-middle", theme: "city-streets" },
  { col: 16, floor: 50, id: "growl-cover-early", theme: "deep-woods" },
  { col: 24, floor: 50, id: "growl-cover-middle", theme: "deep-woods" },
  { col: 24, floor: 40, id: "growl-clearing", theme: "deep-woods" },
  { col: 32, floor: 50, id: "flyer-shelter-early", theme: "loading-yards" },
  { col: 42, floor: 50, id: "flyer-shelter-middle", theme: "loading-yards" },
];
function layoutOf(theme: string, id: string) {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, theme, 2, [id]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

describe.each(cases)("ordinary climb $id", ({ col, floor, id, theme }) => {
  it("requires a jump and crosses with one ordinary jump and a safe landing", () => {
    const base = layoutOf(theme, id);
    const areaId = base.start.area;
    const area = base.areas[areaId]!;
    const layout = {
      ...base,
      areas: {
        ...base.areas,
        [areaId]: {
          ...area,
          entries: {
            ...area.entries,
            [base.start.entry]: {
              x: (col - 3) * TILE + ordinary.width / 2,
              y: floor * TILE,
            },
          },
          objects: area.objects.filter((object) => !object.behaviour?.pursuit),
        },
      },
    };
    const start = () =>
      stepZone(ordinary, layout, STEP_SECONDS, idle, startZone(ordinary, layout, 1));
    let walking = start();
    for (let tick = 0; tick < 120; tick++) {
      walking = stepZone(ordinary, layout, STEP_SECONDS, { ...idle, move: 1 }, walking);
    }
    expect(walking.death).toBeUndefined();
    expect(walking.bird.x + ordinary.width).toBeLessThanOrEqual(col * TILE + 1e-6);
    let zone = start();
    for (let tick = 0; tick < 360; tick++) {
      zone = stepZone(
        ordinary,
        layout,
        STEP_SECONDS,
        { ...idle, jumpHeld: tick * STEP_SECONDS < ordinary.jumpRiseTime, move: 1 },
        zone,
      );
      expect(zone.death).toBeUndefined();
      if (zone.bird.grounded && zone.bird.x >= (col + 5) * TILE) {
        expect(zone.bird.dash).toBeUndefined();
        return;
      }
    }
    expect.fail(JSON.stringify({ bird: zone.bird, id }));
  });
});

it.each(cases.filter(({ id }) => ["patrol-cover-early", "growl-clearing"].includes(id)))(
  "production ground boss jumps and lands beyond $id obstruction",
  ({ col, floor, id, theme }) => {
    const layout = layoutOf(theme, id);
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

it("keeps acquired Archie pursuing across the production middle-yard low wall", () => {
  const layout = layoutOf("city-streets", "patrol-cover-middle");
  const area = layout.areas[layout.start.area]!;
  const object = area.objects.find((object) => object.character === "dog-antagonist")!;
  const initial = startZone(ordinary, layout, 1);
  const target = { ...startBird(ordinary, { x: 21 * TILE, y: 50 * TILE }), grounded: true };
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
      hazards,
      idleDecision: {
        namespace: `idle-roam:${initial.area}:${area.objects.indexOf(object)}`,
        seed: initial.seed + initial.attempt,
      },
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
    if (hit || (state.traversal?.physical.grounded && at.x + object.width <= 24 * TILE)) {
      expect(jumped).toBe(true);
      expect(plannedAfterDefer).toBe(true);
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
});

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
      zone = stepZone(ordinary, layout, STEP_SECONDS, { jumpHeld, move, useHeld: false }, zone);
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

it.each(
  [
    "open-stepped-ridge-encounter",
    "offset-two-level-terrace-encounter",
    "dry-underground-gallery-encounter",
  ].flatMap((chunkId) => ([-1, 1] as const).map((direction) => ({ chunkId, direction }))),
)("ordinary route crosses $chunkId facing $direction", ({ chunkId, direction }) => {
  const base = layoutOf(
    chunkId === "dry-underground-gallery-encounter" ? "loading-yards" : "city-streets",
    chunkId,
  );
  const id = base.start.area;
  const area = base.areas[id]!;
  const layout = {
    ...base,
    areas: {
      ...base.areas,
      [id]: {
        ...area,
        entries: {
          ...area.entries,
          [base.start.entry]: { x: direction === 1 ? 24 : 684, y: 50 * TILE },
        },
        objects: area.objects.filter((object) => !object.behaviour?.pursuit),
      },
    },
  };
  let zone = startZone(ordinary, layout, 1);
  let held = 0;
  for (let tick = 0; tick < 1200; tick++) {
    const arrived = direction === 1 ? zone.bird.x >= 648 : zone.bird.x <= 60;
    if (zone.bird.grounded && !arrived) {
      held = 44;
    }
    zone = stepZone(
      ordinary,
      layout,
      STEP_SECONDS,
      { ...idle, jumpHeld: !arrived && held-- > 0, move: arrived ? 0 : direction },
      zone,
    );
    expect(zone.death).toBeUndefined();
    expect(zone.cleared).toBe(false);
    expect(zone.turnedBack).toBe(false);
    if (zone.bird.grounded && arrived) {
      expect(zone.bird.y + ordinary.height).toBeCloseTo(50 * TILE);
      return;
    }
  }
  expect.fail(JSON.stringify({ bird: zone.bird, direction }));
});

it.each(
  [
    { name: "Archie", theme: "city-streets" },
    { name: "Bini", theme: "deep-woods" },
    { name: "Trixi", theme: "country-lanes" },
  ].flatMap((profile) =>
    ["open-stepped-ridge-encounter", "offset-two-level-terrace-encounter"].flatMap((chunkId) =>
      ([-1, 1] as const).map((direction) => ({ ...profile, chunkId, direction })),
    ),
  ),
)("actual full $name leaves $chunkId safely facing $direction", ({ chunkId, direction, theme }) => {
  const layout = layoutOf(theme, chunkId);
  const area = layout.areas[layout.start.area]!;
  const object = area.objects.find((owner) => owner.behaviour?.pursuit)!;
  const motion = object.behaviour!.states.pursuit!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "ground" || !motion.traversal) {
    throw Error("Expected actual ground traversal");
  }
  const target = {
    height: ordinary.height,
    width: ordinary.width,
    x: direction === 1 ? 684 : 12,
    y: 50 * TILE - ordinary.height,
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
    .filter((owner) => owner !== object && owner.collision === "hazard")
    .map((owner) => ({ owner, rect: contactBox(owner, owner.origin, 1) }));
  let at = object.origin;
  let traversal: BehaviourTraversalState | undefined;
  for (let tick = 0; tick < 1200; tick++) {
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
    if (traversal?.physical.grounded && (direction === 1 ? at.x >= 636 : at.x <= 48)) {
      expect(at.y + object.height).toBeCloseTo(50 * TILE);
      return;
    }
  }
  expect.fail(
    JSON.stringify({ at, direction, status: traversal?.status, target: traversal?.target }),
  );
});

it("shares the qualified Trixi ridge collider and traversal with Fert and Kiwi", () => {
  const objectOf = (theme: string) => {
    const layout = layoutOf(theme, "open-stepped-ridge-encounter");
    return layout.areas[layout.start.area]!.objects.find((owner) => owner.behaviour?.pursuit)!;
  };
  const trixi = objectOf("country-lanes");
  for (const theme of ["apartment-restaurant", "back-streets"]) {
    const object = objectOf(theme);
    expect({ height: object.height, hitbox: object.hitbox, width: object.width }).toEqual({
      height: trixi.height,
      hitbox: trixi.hitbox,
      width: trixi.width,
    });
    expect(object.behaviour!.states.pursuit!.motion).toEqual(
      trixi.behaviour!.states.pursuit!.motion,
    );
  }
});

it("actual Pebble flies beneath the dry gallery roof and returns to supported recovery", () => {
  const layout = layoutOf("loading-yards", "dry-underground-gallery-encounter");
  const area = layout.areas[layout.start.area]!;
  const object = area.objects.find((owner) => owner.behaviour?.pursuit)!;
  const initial = startZone(ordinary, layout, 1);
  const target = { ...startBird(ordinary, { x: 42 * TILE, y: 44 * TILE }), grounded: true };
  const platforms = area.objects
    .filter((owner) => owner.collision === "solid" || owner.collision === "ledge")
    .map((owner) => ({
      after: { ...owner.origin, height: owner.height, width: owner.width },
      before: { ...owner.origin, height: owner.height, width: owner.width },
      collision: owner.collision as "solid" | "ledge",
      owner,
    }));
  let at = object.origin;
  let state = startBehaviour(ordinary, object, target);
  let shots = 0;
  let overheadTell = false;
  for (let tick = 0; tick < 1200; tick++) {
    const world: BehaviourWorld = {
      idleDecision: {
        namespace: `idle-roam:${initial.area}:${area.objects.indexOf(object)}`,
        seed: initial.seed + initial.attempt,
      },
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
    const next = stepBehaviour(ordinary, object, world, STEP_SECONDS, target, at, state);
    at = next.at;
    state = next.state;
    for (const solid of area.solids) {
      expect(
        at.x < solid.x + solid.width &&
          at.x + object.width > solid.x &&
          at.y < solid.y + solid.height &&
          at.y + object.height > solid.y,
      ).toBe(false);
    }
    if (state.stateKey.startsWith("prepare-drop")) {
      overheadTell = true;
      expect(at.y + object.height).toBeLessThanOrEqual(target.y - 6 * TILE + 1e-6);
    }
    shots += next.actions.filter(({ action }) => action.kind === "spawn").length;
    if ((state.attackCooldownRemainingSeconds ?? 0) > 0) {
      expect(overheadTell).toBe(true);
      expect(shots).toBe(3);
      expect(supportedLanding(object, world, at)).toBe(true);
      return;
    }
  }
  expect.fail(JSON.stringify({ at, shots, state: state.stateKey }));
});
