import { locate, type MapMask } from "@andornaut/game-kit/terrain/movementMap";
import { expect, it } from "vitest";

import { EDGE, STEP_SECONDS } from "../core";
import { TILE } from "../data/screen";
import type { Point, Rect, TerrainRect } from "../data/types";
import { birdBox, type BirdState, startBird, stepBird } from "../rules/bird";
import { arenaLayout, arenaMaps, gameArenaCase } from "./arenas";
import { ARENA_SAMPLES } from "./arenaSamples";
import { ORDINARY } from "./encounterLayouts";
import {
  boundaryInput,
  createRouteFollower,
  fullJump,
  launchStepSafe,
  type RouteFollowEvent,
} from "./evade";

function fixture() {
  const floor = 80;
  const solids: TerrainRect[] = [
    { col: 0, cols: 60, look: "raised", row: floor, rows: 40 },
    { col: 4, cols: 4, look: "raised", row: floor - 2, rows: 2 },
  ];
  const found = gameArenaCase({
    ...ARENA_SAMPLES.find(({ boss }) => boss === "dog-antagonist")!,
    solids,
  });
  const layout = arenaLayout(found);
  const maps = arenaMaps(found, layout);
  const map = maps.chibi;
  const edge = map.edges.find(
    (candidate) =>
      candidate.kind === "wall-top" &&
      candidate.launch.left === 24 &&
      candidate.launch.right === 24 &&
      candidate.commands[0]!.move === 1,
  )!;
  expect(edge).toBeDefined();
  // Isolate the composite edge at entry; fresh paths from every later node stay unrestricted.
  const mask: MapMask = {
    edge: (id, seconds) =>
      maps.mask.edge(id, seconds) && (map.edges[id]!.from !== edge.from || id === edge.id),
    key: "composite-edge-fixture",
    node: maps.mask.node,
  };
  const target = map.nodes[edge.to]!;
  return {
    edge,
    goal: { x: edge.land.left + ORDINARY.width / 2, y: target.y },
    map,
    mask,
    target,
    terrain: maps.encounter.terrain,
  };
}

function driver() {
  const subject = fixture();
  const follower = createRouteFollower(ORDINARY, STEP_SECONDS, subject.map, subject.terrain);
  const bounds = { backX: 12, canExit: false, exitX: 720 };
  const solids = subject.terrain.world.solids;
  const ledges = subject.terrain.area.colliders
    .filter(({ kind }) => kind === "ledge")
    .map(({ before }) => before);
  let bird: BirdState = {
    ...startBird(ORDINARY, { x: 24.2, y: 80 * TILE }),
    grounded: true,
    vx: 24,
  };
  const events: RouteFollowEvent[] = [];
  const step = (goal: Point = subject.goal, boss?: Rect) => {
    const body = birdBox(ORDINARY, bird);
    const safe = (from: number, to: number, move: -1 | 0 | 1) =>
      boundaryInput(bounds, { ...body, x: from }, { jumpHeld: false, move, useHeld: false })
        .move === move &&
      launchStepSafe(
        solids,
        subject.terrain.hazards.map(({ rect }) => rect),
        0,
        boss,
        body,
        from,
        to,
      );
    const result = follower.step(safe, { areaWidth: 720, bird, goal, mask: subject.mask });
    events.push(...result.events);
    const input = boundaryInput(bounds, body, result.input);
    const before = bird;
    bird = stepBird(ORDINARY, solids, ledges, STEP_SECONDS, input, bird);
    return { before, input, result };
  };
  return {
    ...subject,
    get bird() {
      return bird;
    },
    events,
    follower,
    step,
  };
}

it("abandons an interrupted composite edge and reaches its original goal through actual full support", () => {
  const subject = driver();
  let partial = false;
  let recovered = false;
  let reached = false;
  for (let tick = 0; tick < 600; tick++) {
    const { before, input, result } = subject.step();
    expect(result.problem).toBeUndefined();
    if (!before.grounded && !before.jumpHeld) {
      expect(input.jumpHeld).toBe(false);
    }
    const body = birdBox(ORDINARY, subject.bird);
    const ref = subject.bird.grounded ? locate(subject.map, body) : undefined;
    if (subject.bird.grounded && !ref) {
      partial = true;
    }
    if (partial && ref && subject.map.nodes[ref.node]!.y === 78 * TILE) {
      recovered = true;
    }
    if (
      ref?.node === subject.target.id &&
      Math.abs(body.x + body.width / 2 - subject.goal.x) <= TILE / 2 &&
      Math.abs(body.y + body.height - subject.goal.y) <= EDGE
    ) {
      reached = true;
      break;
    }
  }
  expect(partial).toBe(true);
  expect(recovered).toBe(true);
  expect(reached).toBe(true);
  expect(
    subject.events.some((event) => event.edge === subject.edge.id && event.kind === "abandoned"),
  ).toBe(true);
  expect(
    subject.events.some((event) => event.edge === subject.edge.id && event.kind === "completed"),
  ).toBe(false);
});

it("preserves the actual full-jump hold when a changed goal abandons its logical edge", () => {
  const subject = driver();
  expect(fullJump(ORDINARY.jumpHopHeight, subject.map, subject.edge)).toBe(true);
  for (let tick = 0; tick < 100 && subject.bird.grounded; tick++) {
    subject.step();
  }
  expect(subject.bird.grounded).toBe(false);
  expect(subject.bird.jumpHeldFor).toBeGreaterThan(0);
  expect(subject.bird.jumpHeldFor).toBeLessThan(ORDINARY.jumpRiseTime);
  const goal = { ...subject.goal, x: subject.goal.x + 12 };
  const { before, input, result } = subject.step(goal);
  expect(
    result.events.some(({ cause, kind }) => kind === "abandoned" && cause === "goal-changed"),
  ).toBe(true);
  expect(input.jumpHeld).toBe(true);
  expect(subject.bird.jumpHeldFor).toBe(before.jumpHeldFor + STEP_SECONDS);
  for (
    let tick = 0;
    tick < 60 && !subject.bird.grounded && subject.bird.jumpHeldFor < ORDINARY.jumpRiseTime;
    tick++
  ) {
    expect(subject.step(goal).input.jumpHeld).toBe(true);
  }
});

it("reports unknown instead of recovering partial support through an observed body", () => {
  const subject = driver();
  let partial = false;
  for (let tick = 0; tick < 200; tick++) {
    const body = birdBox(ORDINARY, subject.bird);
    if (subject.bird.grounded && !locate(subject.map, body)) {
      partial = true;
      break;
    }
    expect(subject.step().result.problem).toBeUndefined();
  }
  expect(partial).toBe(true);
  const body = birdBox(ORDINARY, subject.bird);
  const boss = { height: body.height, width: 100, x: body.x + body.width, y: body.y };
  const result = subject.step(subject.goal, boss).result;
  expect(result.problem).toBeDefined();
  expect(result.events.some(({ kind }) => kind === "completed")).toBe(false);
});
