import { locate, type MapMask, pathTo } from "@andornaut/game-kit/terrain/movementMap";
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
  firstEdgeMask,
  fullJump,
  launchStepSafe,
  prepareLaunch,
  type RouteFollowEvent,
} from "./evade";
import { PENTHOUSE_LAUNCH } from "./fixtures/penthouseLaunch";

function penthouseLaunch() {
  const found = gameArenaCase({
    ...ARENA_SAMPLES.find(({ boss }) => boss === "ferret-antagonist")!,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: PENTHOUSE_LAUNCH.objects,
    solids: PENTHOUSE_LAUNCH.solids,
    stage: "penthouse",
  });
  const maps = arenaMaps(found, arenaLayout(found));
  const bird = {
    ...startBird(ORDINARY, { x: 443, y: 600 }),
    ...PENTHOUSE_LAUNCH.state,
    grounded: true,
  };
  const ref = locate(maps.chibi, birdBox(ORDINARY, bird))!;
  return { bird, maps, ref };
}

it("excludes a launch with no same-span predecessor but retains its already-ready state", () => {
  const { bird, maps, ref } = penthouseLaunch();
  const map = maps.chibi;
  expect(map.nodes[ref.node]).toMatchObject({ deps: [], left: 408, right: 432, y: 600 });
  const edge = map.edges.find(
    (candidate) =>
      candidate.from === ref.node &&
      candidate.launch.left === 408 &&
      candidate.launch.right === 408 &&
      candidate.commands[0]?.jump &&
      candidate.commands[0].move === 1 &&
      map.nodes[candidate.to]?.y === 528,
  )!;
  expect(edge).toBeDefined();
  const filtered = firstEdgeMask(ORDINARY, STEP_SECONDS, map, maps.mask, ref, bird);
  expect(filtered.blocked).toContain(edge.id);
  expect(filtered.mask.edge(edge.id, 0)).toBe(false);
  const ready = firstEdgeMask(ORDINARY, STEP_SECONDS, map, maps.mask, ref, {
    ...bird,
    vx: ORDINARY.walkSpeed,
    x: 408,
  });
  expect(ready.blocked).not.toContain(edge.id);
  expect(ready.mask.edge(edge.id, 0)).toBe(maps.mask.edge(edge.id, 0));
  const path = pathTo(map, filtered.mask, ref, { point: PENTHOUSE_LAUNCH.goal, radius: TILE });
  expect(path?.edges[0]).not.toBe(edge.id);
});

function penthouseDriver(state = PENTHOUSE_LAUNCH.state) {
  const subject = penthouseLaunch();
  const { terrain } = subject.maps.encounter;
  const follower = createRouteFollower(ORDINARY, STEP_SECONDS, subject.maps.chibi, terrain);
  const bounds = { backX: 12, canExit: true, exitX: 708 };
  const solids = terrain.world.solids;
  const ledges = terrain.area.colliders
    .filter(({ kind }) => kind === "ledge")
    .map(({ before }) => before);
  let bird = { ...subject.bird, ...state };
  const step = (goal = PENTHOUSE_LAUNCH.goal, mask = subject.maps.mask, boss?: Rect) => {
    const body = birdBox(ORDINARY, bird);
    const safe = (from: number, to: number, move: -1 | 0 | 1) =>
      boundaryInput(bounds, { ...body, x: from }, { jumpHeld: false, move, useHeld: false })
        .move === move &&
      launchStepSafe(
        solids,
        terrain.hazards.map(({ rect }) => rect),
        0,
        boss,
        body,
        from,
        to,
      );
    const result = follower.step(safe, {
      areaWidth: 720,
      bird,
      goal,
      mask,
    });
    bird = stepBird(
      ORDINARY,
      solids,
      ledges,
      STEP_SECONDS,
      boundaryInput(bounds, body, result.input),
      bird,
    );
    return result;
  };
  return {
    ...subject,
    get bird() {
      return bird;
    },
    observe: (actual: BirdState) => {
      bird = actual;
    },
    step,
  };
}

function capturedWalk() {
  const subject = penthouseDriver();
  for (let tick = 0; tick < 20; tick++) {
    expect(subject.step().problem).toBeUndefined();
  }
  expect(subject.bird.x).toBe(433);
  expect(subject.bird.vx).toBe(240);
  return subject;
}

it("replans the captured launch state to the same public goal through ordinary physics", () => {
  const subject = penthouseDriver();
  let reached = false;
  for (let tick = 0; tick < 600; tick++) {
    expect(subject.step().problem).toBeUndefined();
    const actual = birdBox(ORDINARY, subject.bird);
    const ref = subject.bird.grounded ? locate(subject.maps.chibi, actual) : undefined;
    if (
      ref &&
      Math.abs(actual.x + actual.width / 2 - PENTHOUSE_LAUNCH.goal.x) <= TILE / 2 &&
      Math.abs(actual.y + actual.height - PENTHOUSE_LAUNCH.goal.y) <= EDGE
    ) {
      reached = true;
      break;
    }
  }
  expect(reached).toBe(true);
});

it("retains a walk at its shared boundary and advances only after physical destination progress", () => {
  for (const subject of [penthouseDriver({ vx: 240, x: 430, y: 564 }), capturedWalk()]) {
    const checked: number[] = [];
    const mask: MapMask = {
      ...subject.maps.mask,
      edge: (id, seconds) => {
        checked.push(id);
        return subject.maps.mask.edge(id, seconds);
      },
    };
    const boundary = subject.bird.x === 430;
    if (boundary) {
      expect(subject.step(PENTHOUSE_LAUNCH.goal, mask).problem).toBeUndefined();
    }
    const from = subject.maps.chibi.nodes[subject.ref.node]!;
    const walk = subject.maps.chibi.edges.find(
      (edge) =>
        edge.from === from.id &&
        edge.kind === "walk" &&
        subject.maps.chibi.nodes[edge.to]!.left === from.right,
    )!;
    expect(subject.bird.x).toBeCloseTo(boundary ? 432 : 433);
    checked.length = 0;
    const beforeLand = subject.step(PENTHOUSE_LAUNCH.goal, mask);
    expect(checked[0]).toBe(walk.id);
    expect(beforeLand.input.move).toBe(1);
    expect(beforeLand.events).toEqual([]);
    expect(subject.bird.x).toBeCloseTo(boundary ? 434 : 435);
    checked.length = 0;
    const afterLand = subject.step(PENTHOUSE_LAUNCH.goal, mask);
    expect(checked[0]).not.toBe(walk.id);
    expect(afterLand.input.move).toBe(1);
    expect(afterLand.events).toEqual([]);
  }
});

it("discards a retained static prefix when its mask or goal changes", () => {
  for (const changed of ["goal", "mask"]) {
    const subject = capturedWalk();
    expect(subject.bird.x).toBeCloseTo(433);
    const nextWalk = subject.maps.chibi.edges.find(
      (edge) =>
        edge.kind === "walk" &&
        subject.maps.chibi.nodes[edge.from]!.left === 432 &&
        subject.maps.chibi.nodes[edge.to]!.left === 528,
    )!;
    const mask: MapMask = {
      ...subject.maps.mask,
      edge: (id, seconds) => id !== nextWalk.id && subject.maps.mask.edge(id, seconds),
    };
    const result = subject.step(
      changed === "goal" ? { x: 420, y: 600 } : PENTHOUSE_LAUNCH.goal,
      changed === "mask" ? mask : subject.maps.mask,
    );
    expect(result.problem).toBeUndefined();
    expect(result.input.move).toBe(-1);
  }
});

it("retains a leftward walk until its existing land plane is crossed on full destination support", () => {
  const subject = penthouseDriver({ vx: -240, x: 435, y: 564 });
  const checked: number[] = [];
  const mask: MapMask = {
    ...subject.maps.mask,
    edge: (id, seconds) => {
      checked.push(id);
      return subject.maps.mask.edge(id, seconds);
    },
  };
  subject.step(PENTHOUSE_LAUNCH.goal, mask);
  expect(subject.bird.x).toBe(433);
  checked.length = 0;
  const beforeBoundary = subject.step(PENTHOUSE_LAUNCH.goal, mask);
  const walk = subject.maps.chibi.edges[checked[0]!]!;
  expect(walk.kind).toBe("walk");
  expect(walk.commands[0]!.move).toBe(-1);
  expect(beforeBoundary.input.move).toBe(-1);
  expect(subject.bird.x).toBe(431);
  checked.length = 0;
  expect(subject.step(PENTHOUSE_LAUNCH.goal, mask).input.move).toBe(-1);
  expect(checked[0]).toBe(walk.id);
  expect(subject.bird.x).toBe(429);
  // The destination is now full support beyond land430, so its incompatible jump is replanned.
  expect(subject.step(PENTHOUSE_LAUNCH.goal, mask).input.move).toBe(1);
});

it("discards a retained walk after actual partial contact or a different support height", () => {
  for (const at of [
    { x: 80, y: 563.9 },
    { x: 472, y: 491.9 },
  ]) {
    const subject = capturedWalk();
    const saved = subject.bird;
    const actual = stepBird(
      ORDINARY,
      subject.maps.encounter.terrain.world.solids,
      [],
      STEP_SECONDS,
      { jumpHeld: false, move: 0 },
      { ...saved, ...at, grounded: false, vx: 0, vy: 100 },
    );
    expect(actual.grounded).toBe(true);
    const ref = locate(subject.maps.chibi, birdBox(ORDINARY, actual));
    if (at.x === 80) {
      expect(ref).toBeUndefined();
    } else {
      expect(subject.maps.chibi.nodes[ref!.node]!.y).toBe(528);
    }
    subject.observe(actual);
    const checked: number[] = [];
    const mask: MapMask = {
      ...subject.maps.mask,
      edge: (id, seconds) => {
        checked.push(id);
        return subject.maps.mask.edge(id, seconds);
      },
      key: `observed-support:${at.x}`,
    };
    subject.step(PENTHOUSE_LAUNCH.goal, mask);
    if (ref) {
      expect(checked.some((id) => subject.maps.chibi.edges[id]!.from === ref.node)).toBe(true);
    } else {
      // Recovery cannot restore a prefix discarded by the partial contact observation.
      subject.observe(saved);
      expect(subject.step().input.move).toBe(-1);
    }
  }
});

it("rejects a retained walk whose next ordinary sweep reaches an observed body", () => {
  const subject = capturedWalk();
  expect(subject.bird.x).toBeCloseTo(433);
  const boss = { height: 36, width: 2, x: 458, y: 564 };
  const result = subject.step(PENTHOUSE_LAUNCH.goal, subject.maps.mask, boss);
  expect(result.problem).toBe("selected walk has no safe ordinary step");
  expect(result.events).toEqual([]);
});

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

it("keeps a predecessor-compatible edge even when bounded preparation is unknown", () => {
  const subject = fixture();
  const bird = {
    ...startBird(ORDINARY, { x: 24.1, y: 80 * TILE }),
    grounded: true,
    vx: 24,
  };
  const ref = locate(subject.map, birdBox(ORDINARY, bird))!;
  const span = subject.map.nodes[ref.node]!;
  expect(subject.edge.from).toBe(ref.node);
  expect(
    prepareLaunch(() => true, ORDINARY, STEP_SECONDS, span, subject.edge.launch, 1, bird).kind,
  ).toBe("unknown");
  const filtered = firstEdgeMask(ORDINARY, STEP_SECONDS, subject.map, subject.mask, ref, bird);
  expect(filtered.blocked).not.toContain(subject.edge.id);
  expect(filtered.mask.edge(subject.edge.id, 0)).toBe(true);
});

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
