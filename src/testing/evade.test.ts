import { locate } from "@andornaut/game-kit/terrain/movementMap";
import { expect, it } from "vitest";

import { STEP_SECONDS } from "../core";
import { TILE } from "../data/screen";
import type { Instance, Rect, TerrainRect } from "../data/types";
import { birdBox, type BirdState, startBird, stepBird } from "../rules/bird";
import { proveArena } from "./arenaCertify";
import { arenaLayout, arenaMaps, gameArenaCase } from "./arenas";
import { ARENA_SAMPLES } from "./arenaSamples";
import { ORDINARY } from "./encounterLayouts";
import {
  boundaryInput,
  createLaunchPreparation,
  evadeRun,
  fullJump,
  launchStepSafe,
  prepareLaunch,
  spanGoal,
  standingPoint,
  startsJump,
  touchesBoss,
} from "./evade";

// Each sample's arena proof: static checks, required route, path out and every evade run, with
// its hash over the evade trace hashes.
const HASHES: Readonly<Record<string, string>> = {
  "arena-bear-sample": "4d5c8d5df14d7800",
  "arena-dog-sample": "697ae943f4af20eb",
  "arena-ferret-sample": "c9695317d63dc560",
  "arena-goose-sample": "19dd127f3ff1b368",
  "arena-pigeon-sample": "de4482ac9228136c",
  "arena-raccoon-sample": "21737e2d627578cc",
};

it.each(ARENA_SAMPLES.map((arena) => [arena.id, arena] as const))(
  "%s passes the arena proof",
  (id, arena) => {
    const proof = proveArena(gameArenaCase(arena));
    expect(proof.problems).toEqual([]);
    expect(proof.hash).toBe(HASHES[id]);
  },
  600_000,
);

// A boss on a one-row roof masks the open floor beside it, never the nook below the roof.
it("masks only spans Chibi could touch the boss from, not through a roof", () => {
  const tile = 16;
  const roof = { height: tile, width: 10 * tile, x: 0, y: 10 * tile };
  const boss = { height: 4 * tile, width: 3 * tile, x: 3 * tile, y: 6 * tile };
  const nook = { height: 3 * tile, width: 10 * tile, x: 0, y: 11 * tile };
  const beside = { height: 3 * tile, width: 2 * tile, x: 6 * tile, y: 7 * tile };
  expect(touchesBoss([roof], 2 * tile, boss, nook)).toBe(false);
  expect(touchesBoss([], 2 * tile, boss, nook)).toBe(true);
  expect(touchesBoss([roof], 2 * tile, boss, beside)).toBe(true);
});

const FLOOR = 80;
const rect = (col: number, cols: number, row: number, rows: number): TerrainRect => ({
  col,
  cols,
  look: "raised",
  row,
  rows,
});
const ground = (col: number, cols: number) => rect(col, cols, FLOOR, 120 - FLOOR);

// Chibi's map of the dog sample's frame with the given terrain and Archie on the far floor.
function chibiOf(solids: readonly TerrainRect[], objects: readonly Instance[] = []) {
  const found = gameArenaCase({
    ...ARENA_SAMPLES.find(({ boss }) => boss === "dog-antagonist")!,
    objects: [
      ...objects,
      { character: "dog-antagonist", col: 56, role: "antagonist", row: FLOOR - 4 },
    ],
    solids,
  });
  return arenaMaps(found, arenaLayout(found)).chibi;
}
const nodeAt = (map: ReturnType<typeof chibiOf>, col: number, row: number) =>
  map.nodes.find(
    ({ left, right, y }) => y === row * TILE && left <= col * TILE && right >= col * TILE,
  )!;

// A red pit beside the exit: his path over it is a full jump, and a walk without an edge stops
// at his span's end rather than stepping into the pit.
it("jumps a pit beside the exit in full and never walks off his span into it", () => {
  const pit: Instance[] = [
    { character: "red-edge-top", col: 46, cols: 3, role: "edge-top", row: FLOOR + 3 },
    { character: "red-edge-support", col: 46, cols: 3, role: "support", row: FLOOR + 4, rows: 36 },
  ];
  const map = chibiOf([ground(0, 46), ground(49, 11)], pit);
  const from = nodeAt(map, 40, FLOOR);
  const beyond = nodeAt(map, 52, FLOOR);
  const over = map.edges.filter(({ from: start, to }) => start === from.id && to === beyond.id);
  const apex = (edge: (typeof over)[number]) => FLOOR * TILE - ORDINARY.height - edge.sweep.y;
  // A crossing that does not rise is still a full jump where its proof is one.
  const full = over.filter((edge) => fullJump(ORDINARY.jumpHopHeight, map, edge));
  expect(full.length).toBeGreaterThan(0);
  expect(full.every((edge) => apex(edge) > ORDINARY.jumpHopHeight + 1)).toBe(true);
  expect(
    over
      .filter((edge) => !full.includes(edge))
      .every((edge) => apex(edge) <= ORDINARY.jumpHopHeight + 1),
  ).toBe(true);
  expect(spanGoal(60 * TILE, from, 50 * TILE)).toBe(from.right);
  expect(spanGoal(60 * TILE, from, 64 * TILE)).toBe(64 * TILE);
});

// From a five-column slot between a deck end and a four-row post, the jump over the post to the
// floor beyond does not rise, yet its proof is a full jump, so he holds Jump rather than tapping.
it("takes a full jump over a post when the proof does, although the landing does not rise", () => {
  const map = chibiOf([ground(0, 60), rect(4, 10, FLOOR - 7, 1), rect(19, 1, FLOOR - 4, 4)]);
  const slot = nodeAt(map, 16, FLOOR);
  const over = map.edges.filter(
    ({ from, kind, to }) =>
      kind === "jump" &&
      from === slot.id &&
      map.nodes[to]!.y === FLOOR * TILE &&
      map.nodes[to]!.left > 19 * TILE,
  );
  expect(over.length).toBeGreaterThan(0);
  expect(over.every((edge) => fullJump(ORDINARY.jumpHopHeight, map, edge))).toBe(true);
});

// A waypoint in a one-column post's column beside an overhang is reached where he stands against
// the post, so he stops there instead of pressing into the post.
it("stands for a waypoint against a post at the end of his span", () => {
  const map = chibiOf([ground(0, 60), rect(14, 6, FLOOR - 6, 1), rect(24, 1, FLOOR - 4, 4)]);
  const at = standingPoint(map, { x: 24 * TILE, y: FLOOR * TILE });
  const span = nodeAt(map, 22, FLOOR);
  expect(at).toEqual({ x: span.right + ORDINARY.width / 2, y: FLOOR * TILE });
  expect(at.x + ORDINARY.width / 2).toBeLessThanOrEqual(24 * TILE + 1e-6);
});

it("prepares a reversed full-jump launch before replaying its landing witness", () => {
  const solids = [
    { height: 480, width: 720, x: 0, y: FLOOR * TILE },
    { height: 36, width: 60, x: 4 * TILE, y: (FLOOR - 3) * TILE },
  ];
  const ledge = { height: TILE, width: 30 * TILE, x: 14 * TILE, y: (FLOOR - 7) * TILE };
  const map = chibiOf(
    [ground(0, 60), rect(4, 5, FLOOR - 3, 3)],
    [{ character: "platform-ledge", col: 14, cols: 30, role: "ledge", row: FLOOR - 7 }],
  );
  const span = nodeAt(map, 6, FLOOR - 3);
  const edge = map.edges.find(
    (candidate) =>
      candidate.kind === "jump" &&
      candidate.from === span.id &&
      map.nodes[candidate.to]!.y === ledge.y &&
      candidate.launch.left <= 73 &&
      candidate.launch.right >= 73 &&
      candidate.commands.every(({ move }) => move === 1) &&
      fullJump(ORDINARY.jumpHopHeight, map, candidate),
  )!;
  expect(edge).toBeDefined();
  const initial: BirdState = {
    ...startBird(ORDINARY, { x: 73 + ORDINARY.width / 2, y: span.y }),
    grounded: true,
    vx: -ORDINARY.walkSpeed,
  };
  let prepared = initial;
  const safe = (from: number, to: number) =>
    launchStepSafe(
      solids,
      [],
      0,
      undefined,
      { height: ORDINARY.height, width: ORDINARY.width, x: prepared.x, y: prepared.y },
      from,
      to,
    );
  let ticks = 0;
  for (; ticks < 60; ticks++) {
    const preparation = prepareLaunch(safe, ORDINARY, STEP_SECONDS, span, edge.launch, 1, prepared);
    expect(preparation.kind).not.toBe("unknown");
    if (preparation.kind === "ready") {
      break;
    }
    if (preparation.kind === "prepare") {
      prepared = stepBird(ORDINARY, solids, [ledge], STEP_SECONDS, preparation.input, prepared);
      expect(prepared.grounded).toBe(true);
      expect(prepared.jumpHeldFor).toBe(0);
    }
  }
  expect(ticks).toBeGreaterThan(0);
  expect(ticks).toBeLessThan(60);
  expect(prepared.vx).toBe(ORDINARY.walkSpeed);
  const land = (start: BirdState) => {
    let bird = start;
    for (let tick = 0; tick < 180; tick++) {
      const command = edge.commands[tick];
      bird = stepBird(
        ORDINARY,
        solids,
        [ledge],
        STEP_SECONDS,
        {
          jumpHeld:
            command !== undefined &&
            (command.jump || (tick + 1) * STEP_SECONDS < ORDINARY.jumpRiseTime),
          move: command?.move ?? 1,
        },
        bird,
      );
      if (tick > 0 && bird.grounded) {
        return bird;
      }
    }
    throw new Error("jump did not land");
  };
  const landing = map.nodes[edge.to]!;
  const unprepared = land(initial);
  expect(unprepared.x).toBeLessThan(landing.left);
  const landed = land(prepared);
  expect(landed.y + ORDINARY.height).toBe(ledge.y);
  expect(landed.x).toBeGreaterThanOrEqual(landing.left);
  expect(landed.x).toBeLessThanOrEqual(landing.right);
  expect(
    prepareLaunch(safe, ORDINARY, STEP_SECONDS, { left: 72, right: 84 }, edge.launch, 1, initial)
      .kind,
  ).toBe("unknown");
});

it("backs off and brakes on the same support to prepare an exact endpoint launch", () => {
  const span = { left: 0, right: 24 };
  const launch = { left: 24, right: 24 };
  const solids = [
    { height: 480, width: 48, x: 0, y: FLOOR * TILE },
    { height: 480, width: 200, x: 194, y: FLOOR * TILE },
  ];
  const initial: BirdState = {
    ...startBird(ORDINARY, { x: 24 + ORDINARY.width / 2, y: FLOOR * TILE }),
    grounded: true,
  };
  // Forward alone leaves the proved support before reaching witness speed.
  const forward = stepBird(
    ORDINARY,
    solids,
    [],
    STEP_SECONDS,
    { jumpHeld: false, move: 1 },
    initial,
  );
  expect(forward.x).toBeGreaterThan(span.right);
  expect(forward.vx).toBeLessThan(ORDINARY.walkSpeed);
  let prepared = initial;
  const edge = { commands: [{ jump: true, move: 1 as const }], kind: "jump" as const, launch };
  const controller = createLaunchPreparation(ORDINARY, STEP_SECONDS);
  const context = (bird = prepared) => ({
    bird,
    edge,
    grounded: bird.grounded,
    hasGoal: true,
    scripted: false,
    span,
  });
  const safe = (from: number, to: number) =>
    launchStepSafe(
      solids,
      [],
      0,
      undefined,
      { height: ORDINARY.height, width: ORDINARY.width, x: prepared.x, y: prepared.y },
      from,
      to,
    );
  const commands: number[] = [];
  for (let tick = 0; tick < 60; tick++) {
    const preparation = controller(safe, context());
    expect(preparation.kind).not.toBe("unknown");
    expect(preparation.kind).not.toBe("approach");
    if (preparation.kind === "ready") {
      break;
    }
    if (preparation.kind === "prepare") {
      commands.push(preparation.input.move);
      prepared = stepBird(ORDINARY, solids, [], STEP_SECONDS, preparation.input, prepared);
      expect(prepared.x).toBeGreaterThanOrEqual(span.left);
      expect(prepared.x).toBeLessThanOrEqual(span.right);
      expect(prepared.grounded).toBe(true);
      expect(prepared.jumpHeldFor).toBe(0);
    }
  }
  expect(commands).toEqual([...Array(10).fill(-1), ...Array(5).fill(0), ...Array(12).fill(1)]);
  expect(prepared.x).toBe(launch.left);
  expect(prepared.vx).toBe(ORDINARY.walkSpeed);
  expect(controller(safe, context())).toEqual({
    kind: "ready",
  });
  expect(
    prepareLaunch(safe, ORDINARY, STEP_SECONDS, { left: 23, right: 24 }, launch, 1, initial).kind,
  ).toBe("unknown");
  const land = (start: BirdState) => {
    let bird = start;
    for (let tick = 0; tick < 180; tick++) {
      bird = stepBird(
        ORDINARY,
        solids,
        [],
        STEP_SECONDS,
        {
          jumpHeld: tick * STEP_SECONDS < ORDINARY.jumpRiseTime,
          move: 1,
        },
        bird,
      );
      if (tick > 0 && bird.grounded) {
        return bird;
      }
    }
    throw new Error("jump did not land");
  };
  expect(land(initial).x).toBeLessThan(solids[1]!.x);
  const landed = land(prepared);
  expect(landed.x).toBeGreaterThanOrEqual(solids[1]!.x);
  expect(landed.x + ORDINARY.width).toBeLessThanOrEqual(solids[1]!.x + solids[1]!.width);
  expect(landed.y + ORDINARY.height).toBe(solids[1]!.y);
});

it("abandons launch preparation when the selected edge or actual input branch changes", () => {
  const span = { left: 0, right: 24 };
  const edge = {
    commands: [{ jump: true, move: 1 as const }],
    kind: "jump" as const,
    launch: { left: 24, right: 24 },
  };
  const floor = { height: 480, width: 48, x: 0, y: 960 };
  const initial = { ...startBird(ORDINARY, { x: 36, y: 960 }), grounded: true };
  const safe = (from: number, to: number) =>
    launchStepSafe(
      [floor],
      [],
      0,
      undefined,
      { height: ORDINARY.height, width: ORDINARY.width, x: from, y: 924 },
      from,
      to,
    );
  const context = { bird: initial, edge, grounded: true, hasGoal: true, scripted: false, span };
  const first = createLaunchPreparation(ORDINARY, STEP_SECONDS)(safe, context);
  expect(first.kind).toBe("prepare");
  if (first.kind !== "prepare") {
    throw new Error("expected grounded preparation");
  }
  const bird = stepBird(ORDINARY, [floor], [], STEP_SECONDS, first.input, initial);
  expect(bird.x).toBeLessThan(edge.launch.left);
  const changedEdge = {
    ...edge,
    commands: [{ jump: true, move: 0 as const }],
    launch: { left: bird.x, right: bird.x },
  };
  const changed = createLaunchPreparation(ORDINARY, STEP_SECONDS);
  expect(changed(safe, context).kind).toBe("prepare");
  const newPreparation = changed(safe, { ...context, bird, edge: changedEdge });
  expect(newPreparation.kind).toBe("prepare");
  if (newPreparation.kind === "prepare") {
    expect(newPreparation.input.move).toBe(0);
  }
  for (const change of [
    { edge: undefined },
    { grounded: false },
    { hasGoal: false },
    { scripted: true },
  ]) {
    const controller = createLaunchPreparation(ORDINARY, STEP_SECONDS);
    expect(controller(safe, context).kind).toBe("prepare");
    expect(controller(safe, { ...context, bird, ...change }).kind).toBe("approach");
    const obstructed = (from: number, to: number) => safe(from, to) && to >= bird.x;
    expect(controller(obstructed, { ...context, bird }).kind).toBe("unknown");
  }
});

function brakingArrival() {
  const span = { left: 0, right: 24 };
  const edge = {
    commands: [{ jump: true, move: 1 as const }],
    kind: "jump" as const,
    launch: { left: 20, right: 24 },
  };
  const floor = { height: 480, width: 48, x: 0, y: 960 };
  const bounds = { backX: -24, canExit: false, exitX: 720 };
  let bird = { ...startBird(ORDINARY, { x: 36, y: 960 }), grounded: true };
  const controller = createLaunchPreparation(ORDINARY, STEP_SECONDS);
  const context = (goal = { x: 300, y: 960 }) => ({
    bird,
    edge,
    goal,
    grounded: bird.grounded,
    hasGoal: true,
    scripted: false,
    span,
  });
  const body = (x: number) => ({ height: ORDINARY.height, width: ORDINARY.width, x, y: bird.y });
  const safe = (from: number, to: number, move: -1 | 0 | 1) =>
    boundaryInput(bounds, body(from), { jumpHeld: false, move, useHeld: false }).move === move &&
    launchStepSafe([floor], [], 0, undefined, body(from), from, to);
  for (let tick = 0; tick < 60; tick++) {
    const preparation = controller(safe, context());
    expect(preparation.kind).toBe("prepare");
    if (preparation.kind !== "prepare") {
      throw new Error("preparation ended before braking");
    }
    const actual = boundaryInput(bounds, body(bird.x), preparation.input);
    expect(actual.move).toBe(preparation.input.move);
    bird = stepBird(ORDINARY, [floor], [], STEP_SECONDS, actual, bird);
    if (actual.move === 0 && bird.vx === -168) {
      return { bird, body, context, controller, floor, safe };
    }
  }
  throw new Error("preparation never reached its braking phase");
}

it("replans a retained preparation when the route goal changes on the same edge", () => {
  const unchanged = brakingArrival();
  const changed = brakingArrival();
  expect(changed.bird).toEqual(unchanged.bird);
  const retained = unchanged.controller(unchanged.safe, unchanged.context());
  const replanned = changed.controller(changed.safe, changed.context({ x: 312, y: 960 }));
  expect(retained.kind).toBe("prepare");
  expect(replanned.kind).toBe("prepare");
  if (retained.kind === "prepare" && replanned.kind === "prepare") {
    expect(retained.input.move).toBe(0);
    expect(replanned.input.move).toBe(1);
  }
});

it("rejects a retained prefix when only a later braking step reaches observed danger", () => {
  const current = brakingArrival();
  const boss = { height: 36, width: 12, x: 0, y: 924 };
  const safe = (from: number, to: number, move: -1 | 0 | 1) =>
    current.safe(from, to, move) &&
    launchStepSafe([current.floor], [], 0, boss, current.body(from), from, to);
  const next = stepBird(
    ORDINARY,
    [current.floor],
    [],
    STEP_SECONDS,
    { jumpHeld: false, move: 0 },
    current.bird,
  );
  expect(safe(current.bird.x, next.x, 0)).toBe(true);
  expect(current.controller(safe, current.context()).kind).toBe("unknown");
});

it("aligns a wall-top launch without treating raw partial contact as a completed witness", () => {
  const map = chibiOf([ground(0, 60), rect(4, 4, FLOOR - 2, 2)]);
  const span = nodeAt(map, 1, FLOOR);
  const edge = map.edges.find(
    (candidate) =>
      candidate.kind === "wall-top" &&
      candidate.from === span.id &&
      candidate.launch.left === 24 &&
      candidate.launch.right === 24 &&
      candidate.commands[0]!.move === 1,
  )!;
  expect(edge).toBeDefined();
  expect(startsJump(edge)).toBe(true);
  const floor = { height: 480, width: 720, x: 0, y: FLOOR * TILE };
  const post = { height: 24, width: 48, x: 48, y: (FLOOR - 2) * TILE };
  const solids = [floor, post];
  const bounds = { backX: 12, canExit: false, exitX: 720 };
  let bird = {
    ...startBird(ORDINARY, { x: 12.2 + ORDINARY.width / 2, y: FLOOR * TILE }),
    grounded: true,
    vx: 24,
  };
  const initial = bird;
  const controller = createLaunchPreparation(ORDINARY, STEP_SECONDS);
  const context = () => ({
    bird,
    edge,
    grounded: bird.grounded,
    hasGoal: true,
    scripted: false,
    span,
  });
  const body = (x: number) => ({ height: ORDINARY.height, width: ORDINARY.width, x, y: bird.y });
  const safe = (from: number, to: number, move: -1 | 0 | 1) =>
    boundaryInput(bounds, body(from), { jumpHeld: false, move, useHeld: false }).move === move &&
    launchStepSafe(solids, [], 0, undefined, body(from), from, to);
  const inputs: number[] = [];
  for (let tick = 0; tick < 102; tick++) {
    const preparation = controller(safe, context());
    expect(preparation.kind, JSON.stringify(preparation)).not.toBe("unknown");
    expect(preparation.kind).not.toBe("approach");
    if (preparation.kind === "ready") {
      break;
    }
    if (preparation.kind === "prepare") {
      inputs.push(preparation.input.move);
      const actual = boundaryInput(bounds, body(bird.x), preparation.input);
      expect(actual.move).toBe(preparation.input.move);
      const before = bird;
      bird = stepBird(ORDINARY, solids, [], STEP_SECONDS, actual, bird);
      expect(bird.x).toBeGreaterThanOrEqual(before.x);
      expect(bird.x).toBeLessThanOrEqual(span.right);
      expect(bird.jumpHeldFor).toBe(0);
      expect(bird.grounded).toBe(true);
    }
  }
  expect(inputs.length).toBeGreaterThan(0);
  expect(inputs).toContain(0);
  expect(Math.abs(bird.x - edge.launch.left)).toBeLessThanOrEqual(1e-6);
  expect(bird.vx).toBe(ORDINARY.walkSpeed);
  expect(controller(safe, context()).kind).toBe("ready");
  expect(initial.x).toBeLessThan(edge.launch.left);
  let landed = false;
  for (let tick = 0; tick < edge.commands.length; tick++) {
    const command = edge.commands[tick]!;
    bird = stepBird(
      ORDINARY,
      solids,
      [],
      STEP_SECONDS,
      boundaryInput(bounds, body(bird.x), {
        jumpHeld: command.jump || tick * STEP_SECONDS < ORDINARY.jumpRiseTime,
        move: command.move,
        useHeld: false,
      }),
      bird,
    );
    if (tick > 0 && bird.grounded) {
      landed = true;
      break;
    }
  }
  expect(landed).toBe(true);
  expect(bird.y + ORDINARY.height).toBe(post.y);
  expect(bird.x).toBeLessThan(post.x);
  expect(bird.x + ORDINARY.width).toBeGreaterThan(post.x);
  expect(locate(map, birdBox(ORDINARY, bird))).toBeUndefined();
  expect(bird.x).toBeLessThan(edge.land.left);
});

it("rejects invalid launch-search inputs before advancing physics", () => {
  const safe = () => {
    throw new Error("invalid search reached a transition");
  };
  const span = { left: 0, right: 24 };
  const bird = { vx: 0, x: 24 };
  expect(prepareLaunch(safe, ORDINARY, 0, span, span, 1, bird).kind).toBe("unknown");
  expect(
    prepareLaunch(safe, { ...ORDINARY, groundAccel: 0 }, STEP_SECONDS, span, span, 1, bird).kind,
  ).toBe("unknown");
  expect(
    prepareLaunch(safe, ORDINARY, STEP_SECONDS, { ...span, right: Infinity }, span, 1, bird).kind,
  ).toBe("unknown");
  expect(
    prepareLaunch(safe, ORDINARY, STEP_SECONDS, { left: 24, right: 0 }, span, 1, bird).kind,
  ).toBe("unknown");
});

it("prepares a distant exact launch within the unchanged ordinary-search budget", () => {
  const span = { left: 0, right: 312 };
  const floor = { height: 480, width: 720, x: 0, y: 960 };
  const bounds = { backX: 12, canExit: true, exitX: 708 };
  const edge = {
    commands: [{ jump: true, move: 1 as const }],
    kind: "jump" as const,
    launch: { left: 240, right: 240 },
  };
  const controller = createLaunchPreparation(ORDINARY, STEP_SECONDS);
  let bird = { ...startBird(ORDINARY, { x: 24.2, y: 960 }), grounded: true, vx: 24 };
  const body = (x: number) => ({ height: ORDINARY.height, width: ORDINARY.width, x, y: bird.y });
  const safe = (from: number, to: number, move: -1 | 0 | 1) =>
    boundaryInput(bounds, body(from), { jumpHeld: false, move, useHeld: false }).move === move &&
    launchStepSafe([floor], [], 0, undefined, body(from), from, to);
  let work: { expansions: number; states: number; transitions: number } | undefined;
  for (let tick = 0; tick < 534; tick++) {
    const preparation = controller(safe, {
      bird,
      edge,
      grounded: bird.grounded,
      hasGoal: true,
      scripted: false,
      span,
    });
    expect(preparation.kind, JSON.stringify(preparation)).not.toBe("unknown");
    expect(preparation.kind).not.toBe("approach");
    if (preparation.kind === "ready") {
      break;
    }
    if (preparation.kind === "prepare") {
      if ("search" in preparation) {
        work = preparation.search;
      }
      const actual = boundaryInput(bounds, body(bird.x), preparation.input);
      expect(actual.move).toBe(preparation.input.move);
      const before = bird;
      bird = stepBird(ORDINARY, [floor], [], STEP_SECONDS, actual, bird);
      expect(safe(before.x, bird.x, actual.move)).toBe(true);
      expect(bird.x).toBeGreaterThanOrEqual(span.left);
      expect(bird.x).toBeLessThanOrEqual(span.right);
      expect(bird.grounded).toBe(true);
      expect(bird.jumpHeldFor).toBe(0);
    }
  }
  expect(Math.abs(bird.x - edge.launch.left)).toBeLessThanOrEqual(1e-6);
  expect(bird.vx).toBe(ORDINARY.walkSpeed);
  expect(work).toBeDefined();
  expect(work!.states).toBeLessThanOrEqual(11214);
  expect(work!.expansions).toBeLessThanOrEqual(11214);
  expect(work!.transitions).toBeLessThanOrEqual(33642);
});

it("rejects a runup whose body sweep reaches observed danger behind the launch", () => {
  const span = { left: 0, right: 24 };
  const launch = { left: 24, right: 24 };
  const body = { height: ORDINARY.height, width: ORDINARY.width, x: 24, y: 924 };
  const floor = { height: 480, width: 48, x: 0, y: 960 };
  const behind = { height: 36, width: 12, x: 0, y: 924 };
  const bird = { vx: 0, x: 24 };
  const safe =
    (solids: readonly Rect[], hazards: readonly Rect[], boss?: Rect) =>
    (from: number, to: number) =>
      launchStepSafe(solids, hazards, 0, boss, body, from, to);
  expect(
    prepareLaunch(safe([floor], [], behind), ORDINARY, STEP_SECONDS, span, launch, 1, bird).kind,
  ).toBe("unknown");
  expect(
    prepareLaunch(safe([floor, behind], []), ORDINARY, STEP_SECONDS, span, launch, 1, bird).kind,
  ).toBe("unknown");
  expect(
    prepareLaunch(safe([floor], [behind]), ORDINARY, STEP_SECONDS, span, launch, 1, bird).kind,
  ).toBe("unknown");
  expect(
    prepareLaunch(safe([floor], [], behind), ORDINARY, STEP_SECONDS, span, launch, 1, {
      ...bird,
      vx: ORDINARY.walkSpeed,
    }).kind,
  ).toBe("ready");
});

it("rejects preparation that final dispatch would clamp at an arena boundary", () => {
  const span = { left: 0, right: 24 };
  const edge = {
    commands: [{ jump: true, move: 1 as const }],
    kind: "jump" as const,
    launch: { left: 24, right: 24 },
  };
  const floor = { height: 480, width: 48, x: 0, y: 960 };
  const bounds = { backX: 12, canExit: false, exitX: 720 };
  const initial = { ...startBird(ORDINARY, { x: 36, y: 960 }), grounded: true };
  const context = (bird: BirdState) => ({
    bird,
    edge,
    grounded: bird.grounded,
    hasGoal: true,
    scripted: false,
    span,
  });
  const body = (x: number) => ({ height: ORDINARY.height, width: ORDINARY.width, x, y: initial.y });
  const clear = (from: number, to: number) =>
    launchStepSafe([floor], [], 0, undefined, body(from), from, to);
  const oldController = createLaunchPreparation(ORDINARY, STEP_SECONDS);
  let bird = initial;
  for (let tick = 0; tick < 3; tick++) {
    const preparation = oldController(clear, context(bird));
    expect(preparation.kind).toBe("prepare");
    if (preparation.kind !== "prepare") {
      throw new Error("expected unguarded preparation");
    }
    expect(preparation.input.move).toBe(-1);
    const actual = boundaryInput(bounds, body(bird.x), preparation.input);
    expect(actual.move).toBe(0);
    bird = stepBird(ORDINARY, [floor], [], STEP_SECONDS, actual, bird);
    expect(bird.x).toBe(24);
    expect(bird.vx).toBe(0);
  }
  const safe = (from: number, to: number, move: -1 | 0 | 1) =>
    boundaryInput(bounds, body(from), { jumpHeld: false, move, useHeld: false }).move === move &&
    clear(from, to);
  expect(createLaunchPreparation(ORDINARY, STEP_SECONDS)(safe, context(initial)).kind).toBe(
    "unknown",
  );
  const rightBoundary = (canExit: boolean) => (from: number, to: number, move: -1 | 0 | 1) =>
    boundaryInput({ ...bounds, canExit, exitX: 71 }, body(from), {
      jumpHeld: false,
      move,
      useHeld: false,
    }).move === move && clear(from, to);
  const ready = { ...initial, vx: ORDINARY.walkSpeed };
  expect(
    createLaunchPreparation(ORDINARY, STEP_SECONDS)(rightBoundary(false), context(ready)).kind,
  ).toBe("unknown");
  expect(
    createLaunchPreparation(ORDINARY, STEP_SECONDS)(rightBoundary(true), context(ready)).kind,
  ).toBe("ready");
});

// A street under a footbridge with a fire escape at each end and Kiwi on the far floor. From the
// mid start Chibi heads down the near fire escape by a leg through the street; when Kiwi closes in
// faster than his walk he turns back up to the bridge, a waypoint he has already visited, instead
// of keeping that leg.
it("switches off a kept leg when the boss closes faster than his walk", () => {
  const bridge = FLOOR - 18;
  const landing = (col: number, row: number) => rect(col, 6, row, 1);
  const found = gameArenaCase({
    ...ARENA_SAMPLES.find(({ boss }) => boss === "raccoon-antagonist")!,
    objects: [{ character: "raccoon-antagonist", col: 48, role: "antagonist", row: FLOOR - 4 }],
    refuges: [
      { at: { col: 14, row: FLOOR - 6 }, kind: "low-ceiling", width: 4 },
      { at: { col: 25, row: FLOOR }, kind: "low-ceiling", width: 4 },
      { at: { col: 40, row: FLOOR - 6 }, kind: "low-ceiling", width: 4 },
    ],
    routes: [
      {
        id: "loop",
        waypoints: [
          ...[17, 24, 30, 36, 43].map((col) => ({ col, row: FLOOR })),
          { col: 43, row: FLOOR - 6 },
          { col: 49, row: FLOOR - 12 },
          ...[43, 36, 30, 24, 17].map((col) => ({ col, row: bridge })),
          { col: 11, row: FLOOR - 12 },
          { col: 17, row: FLOOR - 6 },
          { col: 17, row: FLOOR },
        ],
      },
      { id: "bridge", waypoints: [20, 27, 33, 40].map((col) => ({ col, row: bridge })) },
      { id: "street", waypoints: [4, 56].map((col) => ({ col, row: FLOOR })) },
    ],
    solids: [
      ground(0, 60),
      rect(14, 32, bridge, 1),
      landing(14, FLOOR - 6),
      landing(8, FLOOR - 12),
      landing(40, FLOOR - 6),
      landing(46, FLOOR - 12),
      rect(24, 12, bridge, 10),
    ],
  });
  const layout = arenaLayout(found);
  const run = evadeRun({ found, layout, maps: arenaMaps(found, layout) }, "mid", 1);
  expect(run.death).toBeUndefined();
  expect(run.exit).toBeLessThan(60);
  expect(run.switches).toBeGreaterThan(0);
});
