import type {
  EdgeId,
  MapEdge,
  MapMask,
  MapNode,
  MovementMap,
  NodeId,
} from "@andornaut/game-kit/terrain/movementMap";
import { expect, it } from "vitest";

import { EDGE, STEP_SECONDS } from "../core/index.ts";
import type { Point, Rect } from "../data/types/index.ts";
import { birdBox, startBird, stepBird } from "../rules/bird.ts";
import { chibiMovementProfile, type MapSupport, type MapTerrain } from "../rules/movementMaps.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import {
  completedGoalHold,
  createRouteFollower,
  createRouteProgress,
  dispatchRoute,
} from "./evade.ts";

const nodeId = (id: number) => id as NodeId;
const edgeId = (id: number) => id as EdgeId;
const floor: Rect = { height: 60, width: 144, x: 0, y: 120 };
const upper: Rect = { height: 12, width: 72, x: 48, y: 60 };
const bounds: Rect = { height: 180, width: 144, x: 0, y: 0 };
const node = (
  id: number,
  left: number,
  right: number,
  support: Rect = floor,
): MapNode<MapSupport> => ({
  deps: [],
  id: nodeId(id),
  kind: "static",
  left,
  right,
  supportId: support,
  y: support.y,
});
const edge = (
  id: number,
  from: number,
  to: number,
  kind: MapEdge<MapSupport>["kind"],
): MapEdge<MapSupport> => ({
  commands: [{ jump: kind === "jump", move: 1 }],
  deps: [],
  from: nodeId(from),
  id: edgeId(id),
  kind,
  land: { left: to === 1 ? 24 : 48, right: to === 1 ? 24 : 96 },
  launch: { left: 24, right: 24 },
  seconds: 1,
  sweep: { height: 96, width: 120, x: 0, y: 24 },
  to: nodeId(to),
});
const mask: MapMask = { edge: () => true, key: "fixture", node: () => true };
const terrain: MapTerrain = {
  area: {
    blocked: () => false,
    bounds,
    colliders: [floor, upper].map((before) => ({
      after: before,
      before,
      kind: "solid",
      supportId: before,
    })),
    deps: () => [],
  },
  bounds,
  crumbling: new Set(),
  depKey: () => "fixture",
  hazards: [],
  pads: [],
  world: { solids: [floor, upper] },
};
function followerFixture(nodes = [node(0, 0, 120)], edges: readonly MapEdge<MapSupport>[] = []) {
  const map: MovementMap<MapSupport> = {
    edges,
    nodes,
    options: {
      dtSeconds: STEP_SECONDS,
      epsilon: EDGE,
      horizonSteps: 1,
      jumps: [],
      launchStride: 1,
      maxCollisionSteps: 1,
    },
    outgoing: nodes.map(({ id }) =>
      edges.filter(({ from }) => from === id).map(({ id: found }) => found),
    ),
    profile: chibiMovementProfile(ORDINARY),
    work: { steps: 0 },
  };
  const follower = createRouteFollower(ORDINARY, STEP_SECONDS, map, terrain);
  const bird = { ...startBird(ORDINARY, { x: 12, y: floor.y }), grounded: true };
  const step = (goal?: Point, safe = () => true, actual = bird) =>
    follower.step(safe, { areaWidth: bounds.width, bird: actual, goal, mask });
  return { bird, follower, step };
}

it("distinguishes an absent goal from actual supported arrival", () => {
  const subject = followerFixture();
  expect(subject.step()).toMatchObject({ input: { move: 0 }, kind: "idle" });
  expect(subject.step({ x: 12, y: floor.y })).toMatchObject({
    input: { move: 0 },
    kind: "completed",
  });
});

it.each([
  { goal: { x: 19, y: floor.y }, label: "outside the existing horizontal tolerance" },
  { goal: { x: 12, y: floor.y + 12 }, label: "at a different support height" },
])("does not declare completion $label", ({ goal }) => {
  expect(followerFixture().step(goal)).toMatchObject({ kind: "following" });
});

it("does not declare an airborne or unrepresented contact completed", () => {
  const subject = followerFixture();
  const goal = { x: 12, y: floor.y };
  expect(subject.step(goal, () => true, { ...subject.bird, grounded: false }).kind).toBe(
    "following",
  );
  const unsupported = followerFixture([]).step(goal);
  expect(unsupported.kind).toBe("unsupported");
  expect(unsupported.problem).toBeDefined();
});

it("distinguishes an unsafe selected step from bounded launch uncertainty", () => {
  const nodes = [node(0, 0, 24), node(1, 24, 24), node(2, 48, 96, upper)];
  const walk = edge(0, 0, 1, "walk");
  const jump = edge(1, 1, 2, "jump");
  const selected = followerFixture(nodes, [walk, jump]);
  expect(selected.step({ x: 72, y: upper.y }, () => false)).toMatchObject({ kind: "unsafe" });
  const uncertain = followerFixture(nodes, [{ ...jump, from: nodeId(0), id: edgeId(0) }]);
  const outcome = uncertain.step({ x: 72, y: upper.y }, () => false);
  expect(outcome.kind).toBe("unknown");
  expect(outcome.problem).toBeDefined();
});

it("reset preserves the reporting contract without turning a missing witness into success", () => {
  const nodes = [node(0, 0, 24), node(1, 48, 96, upper)];
  const invalid = { ...edge(0, 0, 1, "drop"), commands: [], land: { left: 48, right: 96 } };
  const subject = followerFixture(nodes, [invalid]);
  const actual = { ...subject.bird, x: 24 };
  expect(subject.step({ x: 72, y: upper.y }, () => true, actual)).toMatchObject({
    kind: "unsupported",
  });
  subject.follower.reset();
  expect(subject.step()).toMatchObject({ kind: "idle" });
  expect(subject.step({ x: 72, y: upper.y }, () => true, actual)).toMatchObject({
    kind: "unsupported",
  });
});

it("keeps near goals unreached until actual supported arrival, independently of target indices", () => {
  const goal = { point: { x: 240, y: 120 }, support: floor };
  const progress = createRouteProgress([goal]);
  expect(progress.arrived({ ...goal, point: { x: 223, y: 120 } }, goal)).toBe(false);
  expect(progress.arrived({ ...goal, point: { x: 231, y: 120 } }, goal)).toBe(false);
  expect(progress.arrived(undefined, goal)).toBe(false);
  expect(progress.arrived({ ...goal, support: upper }, goal)).toBe(false);
  expect(progress.arrived({ ...goal, point: { x: 240, y: 108 } }, goal)).toBe(false);
  expect(progress.arrived({ ...goal, point: { x: 234, y: 120 } }, goal)).toBe(true);
});

it("breaks completed waypoint alternation without banning necessary safe backtracking", () => {
  const goals = [120, 240, 360].map((x) => ({ point: { x, y: 120 }, support: floor }));
  const progress = createRouteProgress(goals);
  const ranked = [0, 2].map((index) => ({ goal: goals[index]!, value: index }));
  progress.observe(goals[0]);
  progress.observe(goals[1]);
  expect(progress.select("ordinary", ranked)).toBe(2);
  expect(progress.select("ordinary", ranked.slice(0, 1))).toBe(0);
  expect(progress.select("ordinary", [])).toBeUndefined();
  expect(progress.select("reaction", ranked)).toBe(0);
  progress.reset();
  expect(progress.select("ordinary", ranked)).toBe(0);
});

it("marks physical aliases together, survives follower resets and recycles finite coverage", () => {
  const first = { point: { x: 12, y: 120 }, support: floor };
  const alias = { point: { x: 12, y: 120 }, support: floor };
  const other = { point: { x: 96, y: 120 }, support: floor };
  const goals = [first, alias, other];
  const progress = createRouteProgress(goals);
  const ranked = goals.map((goal, value) => ({ goal, value }));
  progress.observe(first);
  followerFixture().follower.reset();
  expect(progress.select("ordinary", ranked)).toBe(2);
  progress.observe(other);
  expect(progress.select("ordinary", ranked)).toBe(0);
});

it("preserves completion across ordinary selection modes and unknown candidates, but resets semantic intent", () => {
  const goals = [120, 240].map((x) => ({ point: { x, y: 120 }, support: floor }));
  const progress = createRouteProgress(goals);
  const ranked = goals.map((goal, value) => ({ goal, value }));
  progress.enter("ordinary");
  progress.observe(goals[0]);
  progress.enter("ordinary");
  expect(progress.select("ordinary", [])).toBeUndefined();
  expect(progress.select("ordinary", ranked)).toBe(1);
  progress.enter("reaction");
  expect(progress.select("reaction", ranked)).toBe(0);
  progress.enter("ordinary");
  expect(progress.select("ordinary", ranked)).toBe(0);
});

it("retains side-route coverage when the eligible subset shrinks and expands", () => {
  const goals = [120, 240, 360, 480].map((x) => ({ point: { x, y: 120 }, support: floor }));
  const progress = createRouteProgress(goals);
  const candidates = goals.map((goal, value) => ({ goal, value }));
  progress.enter("ordinary");
  progress.observe(goals[0]);
  progress.observe(goals[1]);
  progress.observe(goals[2]);
  expect(progress.select("ordinary", [candidates[1]!, candidates[2]!])).toBe(1);
  progress.enter("ordinary");
  progress.observe(goals[1]);
  expect(progress.select("ordinary", [candidates[0]!, candidates[3]!])).toBe(3);
  progress.observe(goals[3]);
  expect(progress.select("ordinary", [candidates[0]!, candidates[3]!])).toBe(0);
});

it("holds an actually arrived supported goal with ordinary neutral braking only", () => {
  const bird = { ...startBird(ORDINARY, { x: 12, y: floor.y }), grounded: true, vx: 96 };
  const goal = { point: { x: 12, y: floor.y }, support: floor };
  const result = completedGoalHold(ORDINARY, STEP_SECONDS, terrain, () => true, {
    bird,
    bounds: { backX: 0, exitX: 144 },
    goal,
    maskValid: true,
    node: node(0, 0, 120),
    projectilesKnown: true,
  });
  expect(result.kind).toBe("hold");
  if (result.kind !== "hold") {
    throw new Error(result.problem);
  }
  expect(result.input).toEqual({ jumpHeld: false, move: 0, useHeld: false });
  const next = stepBird(ORDINARY, terrain.world.solids, [], STEP_SECONDS, result.input, bird);
  expect(next.grounded).toBe(true);
  expect(next.vx).toBeLessThan(bird.vx);
});

it("rejects unarrived, invalid, unsafe and unknown-model holds without completing a route", () => {
  const bird = { ...startBird(ORDINARY, { x: 12, y: floor.y }), grounded: true, vx: 96 };
  const context = {
    bird,
    bounds: { backX: 0, exitX: 144 },
    goal: { point: { x: 12, y: floor.y }, support: floor },
    maskValid: true,
    node: node(0, 0, 120),
    projectilesKnown: true,
  };
  const check = (changes: Partial<typeof context>, safe = () => true) =>
    completedGoalHold(ORDINARY, STEP_SECONDS, terrain, safe, { ...context, ...changes });
  expect(check({ bird: { ...bird, x: 24 } }).kind).toBe("unsafe");
  expect(check({ bird: { ...bird, grounded: false } }).kind).toBe("unsafe");
  expect(check({ maskValid: false }).kind).toBe("unsafe");
  expect(check({}, () => false).kind).toBe("unsafe");
  expect(check({ projectilesKnown: false }).kind).toBe("unknown");
  expect(
    check({
      bird: { ...bird, vx: 240, x: 120 },
      goal: { point: { x: 132, y: floor.y }, support: floor },
    }).kind,
  ).toBe("unsafe");
});

it("rejects residual braking across engine boundaries while accepting exact boundary contact", () => {
  const check = (x: number, vx: number) => {
    const bird = { ...startBird(ORDINARY, { x: x + 12, y: floor.y }), grounded: true, vx };
    return completedGoalHold(ORDINARY, STEP_SECONDS, terrain, () => true, {
      bird,
      bounds: { backX: 12, exitX: 132 },
      goal: { point: { x: x + 12, y: floor.y }, support: floor },
      maskValid: true,
      node: node(0, 0, 120),
      projectilesKnown: true,
    });
  };
  expect(check(12.1, -96)).toMatchObject({
    kind: "unsafe",
    problem: "completed-goal braking step crosses the area boundary",
  });
  expect(check(107.9, 96)).toMatchObject({
    kind: "unsafe",
    problem: "completed-goal braking step crosses the area boundary",
  });
  expect(check(12, 0).kind).toBe("hold");
  expect(check(108, 0).kind).toBe("hold");
});

it("dispatches completed HOLD through resumed graph movement and higher-priority exit", () => {
  const subject = followerFixture();
  let bird = subject.bird;
  const goal = { point: { x: 12, y: floor.y }, support: floor };
  const calls = { exit: 0, follow: 0, hold: 0, shelter: 0, unknown: 0 };
  const actions = {
    exit: () => {
      calls.exit++;
      return subject.step({ x: bounds.width + 12, y: floor.y }, () => true, bird).input;
    },
    follow: () => {
      calls.follow++;
      return subject.step({ x: 96, y: floor.y }, () => true, bird).input;
    },
    hold: () => {
      calls.hold++;
      const result = completedGoalHold(ORDINARY, STEP_SECONDS, terrain, () => true, {
        bird,
        bounds: { backX: 0, exitX: bounds.width },
        goal,
        maskValid: true,
        node: node(0, 0, 120),
        projectilesKnown: true,
      });
      if (result.kind !== "hold") {
        throw new Error(result.problem);
      }
      return result.input;
    },
    shelter: () => {
      calls.shelter++;
      return subject.step().input;
    },
    unknown: () => {
      calls.unknown++;
      return undefined;
    },
  };
  const held = {
    arrived: true,
    exiting: false,
    onward: false,
    sheltered: false,
    threatened: false,
  };
  expect(dispatchRoute(actions, held)?.move).toBe(0);
  expect(calls).toEqual({ exit: 0, follow: 0, hold: 1, shelter: 0, unknown: 0 });
  const onward = dispatchRoute(actions, { ...held, onward: true });
  expect(onward?.move).toBe(1);
  if (!onward) {
    throw new Error("onward dispatch did not produce ordinary input");
  }
  const before = birdBox(ORDINARY, bird);
  bird = stepBird(ORDINARY, terrain.world.solids, [], STEP_SECONDS, onward, bird);
  const after = birdBox(ORDINARY, bird);
  expect(after.x).toBeGreaterThan(before.x);
  expect(bird.grounded).toBe(true);
  expect(after.x).toBeGreaterThanOrEqual(floor.x);
  expect(after.x + after.width).toBeLessThanOrEqual(floor.x + floor.width);
  expect(after.y + after.height).toBe(floor.y);
  expect(calls.hold).toBe(1);
  expect(calls.follow).toBe(1);
  expect(dispatchRoute(actions, { ...held, exiting: true })?.move).toBe(1);
  expect(calls.exit).toBe(1);
  expect(calls.hold).toBe(1);
  expect(dispatchRoute(actions, { ...held, threatened: true })).toBeUndefined();
  expect(calls.unknown).toBe(1);
});
