import { expect, it } from "vitest";

import { STEP_SECONDS } from "../core";
import { TILE } from "../data/screen";
import type { Instance, TerrainRect } from "../data/types";
import { type BirdState, startBird, stepBird } from "../rules/bird";
import { proveArena } from "./arenaCertify";
import { arenaLayout, arenaMaps, gameArenaCase } from "./arenas";
import { ARENA_SAMPLES } from "./arenaSamples";
import { ORDINARY } from "./encounterLayouts";
import { fullJump, prepareLaunch, spanGoal, standingPoint, touchesBoss } from "./evade";

// Each sample's arena proof: static checks, required route, path out and every evade run, with
// its hash over the evade trace hashes.
const HASHES: Readonly<Record<string, string>> = {
  "arena-bear-sample": "29ebd6c4230607f2",
  "arena-dog-sample": "7484ff49e2af42ca",
  "arena-ferret-sample": "119418e03fcc8106",
  "arena-goose-sample": "1bc30ba0ff52f83d",
  "arena-pigeon-sample": "211c49005bc820ca",
  "arena-raccoon-sample": "f80cad6ac3ec0234",
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
  let ticks = 0;
  for (; ticks < 60; ticks++) {
    const preparation = prepareLaunch(ORDINARY, STEP_SECONDS, span, edge.launch, 1, prepared);
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
    prepareLaunch(ORDINARY, STEP_SECONDS, { left: 72, right: 84 }, edge.launch, 1, initial).kind,
  ).toBe("unknown");
});
