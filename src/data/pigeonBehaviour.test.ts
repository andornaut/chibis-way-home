import { expect, it } from "vitest";

import {
  type BehaviourState,
  contactBox,
  layoutBehaviour,
  startBehaviour,
  stepBehaviour,
} from "../rules/behaviour";
import { birdBox, startBird } from "../rules/bird";
import { supportedLanding } from "../rules/flyLanding";
import { targetVisible } from "../rules/perception";
import { objectLayout } from "../rules/tiles";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import {
  BEAR_BEHAVIOUR,
  DOG_BEHAVIOUR,
  FERRET_BEHAVIOUR,
  GOOSE_BEHAVIOUR,
  PIGEON_BEHAVIOUR,
  RACCOON_BEHAVIOUR,
} from "./behaviours";
import { BIRD } from "./bird";
import { TILE } from "./screen";
const make = () =>
  objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character: "pigeon-antagonist", col: 20, row: 10 },
  );
const target = (vx = 0) => ({
  ...startBird(BIRD, { x: 264, y: floor.y - BIRD.height }),
  grounded: true,
  vx,
});
const floor = { height: 360, width: 720, x: 0, y: 360 };
const roof = { height: 12, width: 240, x: 180, y: 240 };
const world = (covered = false) => ({
  idleDecision: { namespace: "idle-roam:main:0", seed: 1 },
  solids: covered ? [floor, roof] : [floor],
  traversalFrame: {
    bounds: { height: 720, width: 720, x: 0, y: 0 },
    dtSeconds: 1 / 120,
    platforms: [],
    timeSeconds: 0,
  },
  view: { height: 360, width: 720, x: 0, y: 0 },
});
function alignedPosition(object: ReturnType<typeof make>, bird: ReturnType<typeof target>) {
  const motion = object.behaviour!.states["prepare-drop-left"]!.motion;
  if (motion.kind !== "pursue" || motion.mode !== "fly" || !motion.overhead) {
    throw Error("Expected overhead approach");
  }
  return {
    x: bird.x + BIRD.width / 2 + motion.overhead.ahead - object.width / 2,
    y: bird.y - motion.overhead.clearance - object.height,
  };
}
function initial(object: ReturnType<typeof make>, bird: ReturnType<typeof target>): BehaviourState {
  return {
    ...startBehaviour(BIRD, object, bird),
    activeAttack: { id: "drop-burst", phase: "committed" },
    anchor: alignedPosition(object, bird),
    elapsed: 0,
    flightApproachDirection: 1,
    pendingEntry: true,
    pursuit: { phase: "engaged" as const, settled: false, unreachableSeconds: 0 },
    stateKey: "align-drop-left",
  };
}
it.each([0, BIRD.walkSpeed / 2])(
  "actual Pebble burst follows current target vx=%s and releases three straight-down shots",
  (vx) => {
    const object = make();
    const align = object.behaviour!.states["align-drop-left"]!;
    const motion = align.motion;
    const arrival = align.transitions
      .find(({ to }) => to === "drop-left")!
      .when.find((condition) => condition.kind === "arrived")!;
    const interval = object
      .behaviour!.states["drop-left"]!.transitions.flatMap(({ when }) => when)
      .find((condition) => condition.kind === "elapsed")!;
    if (
      motion.kind !== "fly" ||
      motion.to !== "target-x" ||
      arrival.kind !== "arrived" ||
      interval.kind !== "elapsed"
    ) {
      throw new Error("Expected live aligned drop profile");
    }
    let bird = target(vx),
      at = alignedPosition(object, bird),
      state = initial(object, bird);
    const shots: { time: number; x: number; expected: number }[] = [];
    for (let tick = 0; tick < 240 && shots.length < 3; tick++) {
      bird = { ...bird, x: bird.x + vx / 120 };
      const step = stepBehaviour(BIRD, object, world(), 1 / 120, bird, at, state);
      at = step.at;
      state = step.state;
      for (const event of step.actions) {
        if (event.action.kind !== "spawn") {
          continue;
        }
        expect(event.action.velocity.x).toBe(0);
        const template = object.spawnTemplates![event.action.character]!;
        shots.push({
          expected:
            bird.x +
            BIRD.width / 2 +
            (motion.ahead ?? 0) +
            Math.min(motion.maxLead, vx * motion.leadSeconds),
          time: tick / 120 + event.time,
          x: event.at.x + event.action.offset.x + template.width / 2,
        });
      }
    }
    expect(shots).toHaveLength(3);
    for (const shot of shots) {
      expect(Math.abs(shot.x - shot.expected)).toBeLessThanOrEqual(arrival.tolerance + 1e-6);
    }
    expect(shots[1]!.time - shots[0]!.time).toBeGreaterThanOrEqual(interval.seconds - 1e-6);
    expect(shots[2]!.time - shots[1]!.time).toBeGreaterThanOrEqual(interval.seconds - 1e-6);
  },
);
it("actual next shot is suppressed when solid cover appears after the first release", () => {
  const object = make();
  const bird = target();
  let at = alignedPosition(object, bird),
    state = initial(object, bird),
    shots = 0;
  for (let tick = 0; tick < 120; tick++) {
    const step = stepBehaviour(BIRD, object, world(shots > 0), 1 / 120, bird, at, state);
    at = step.at;
    state = step.state;
    shots += step.actions.filter((event) => event.action.kind === "spawn").length;
  }
  expect(shots).toBe(1);
});
it("actual Pebble rejects an out-of-bounds current aim before spawning", () => {
  const object = make();
  const bird = { ...target(), x: 600 };
  const step = stepBehaviour(
    BIRD,
    object,
    world(),
    1 / 120,
    bird,
    object.origin,
    initial(object, bird),
  );
  expect(step.actions).toEqual([]);
  const recovery = object.behaviour!.states[step.state.stateKey]!;
  expect(recovery.attack).toEqual({ id: "drop-burst", phase: "committed" });
  expect(recovery.motion.kind).toBe("fly");
  expect(recovery.onEnter).toBeUndefined();
});
it("actual dive remains slower than current ground charge profiles", () => {
  const object = make();
  const dive = object.behaviour!.states["swoop-left"]!.motion;
  expect(dive.kind).toBe("fly");
  if (dive.kind !== "fly") {
    throw Error("not dive");
  }
  for (const name of [
    "dog-antagonist",
    "ferret-antagonist",
    "goose-antagonist",
    "bear-antagonist",
  ]) {
    const other = objectLayout(
      TILE,
      CATALOGUE,
      HITBOXES,
      TILESETS["tiles-street"],
      {},
      { character: name, col: 20, row: 10 },
    );
    const rush = other.behaviour!.states.rush!.motion;
    if (rush.kind !== "move") {
      throw Error("not rush");
    }
    expect(dive.speed).toBeLessThan(rush.speed);
  }
});

it.each([
  ["Archie", DOG_BEHAVIOUR],
  ["Bini", BEAR_BEHAVIOUR],
  ["Fert", FERRET_BEHAVIOUR],
  ["Kiwi", RACCOON_BEHAVIOUR],
  ["Pebble", PIGEON_BEHAVIOUR],
  ["Trixi", GOOSE_BEHAVIOUR],
] as const)(
  "actual %s profile resolves complete attack boundaries and action-free completion gateways",
  (_name, profile) => {
    const plan = layoutBehaviour(TILE, profile);
    const gateways = Object.values(plan.states).filter(
      ({ attack }) => attack?.phase === "completed",
    );
    expect(gateways.length).toBeGreaterThan(0);
    for (const node of gateways) {
      expect(node.onEnter ?? []).toEqual([]);
      expect(node.transitions).toHaveLength(1);
      expect(node.transitions[0]!.when).toEqual([{ kind: "elapsed", seconds: 0 }]);
    }
    for (const node of Object.values(plan.states)) {
      if (node.onEnter?.length) {
        expect(node.attack?.phase).toBe("committed");
      }
      if (node.attack?.phase === "tell") {
        const durations = node.transitions.flatMap(({ when }) =>
          when.flatMap((condition) => (condition.kind === "elapsed" ? [condition.seconds] : [])),
        );
        expect(durations.length).toBeGreaterThan(0);
        expect(Math.min(...durations)).toBeGreaterThanOrEqual(0.5);
        expect(Math.max(...durations)).toBeLessThanOrEqual(1);
      }
      for (const transition of node.transitions) {
        if (plan.states[transition.to]!.attack?.phase === "tell") {
          expect(transition.when).toContainEqual({ kind: "attack-ready" });
        }
      }
    }
  },
);

it.each([
  ["prepare-drop-left", "drop-burst", "burst-rest-left"],
  ["prepare-drop-right", "drop-burst", "burst-rest-right"],
  ["prepare-swoop-left", "swoop", "swoop-rest-left"],
  ["prepare-swoop-right", "swoop", "swoop-rest-right"],
] as const)("physically completes %s only after supported recovery", (entry, attack, rest) => {
  const object = make();
  const bird = {
    ...target(),
    facing: entry.endsWith("left") ? (1 as const) : (-1 as const),
    y: 132,
  };
  const physical = { ...world(), solids: [{ height: 552, width: 720, x: 0, y: 168 }] };
  const approach = entry.includes("swoop")
    ? "pursuit-swoop-left"
    : entry.endsWith("left")
      ? "pursuit"
      : "pursuit-burst-right";
  const component = { ...object, behaviour: { ...object.behaviour!, initial: approach } };
  let at = object.origin;
  let state = startBehaviour(BIRD, component, bird);
  let rested = 0;
  let committed = false;
  let completed = false;
  let told = false;
  for (let tick = 0; tick < 2400; tick++) {
    const before = { at, state };
    const step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
    at = step.at;
    state = step.state;
    if (state.stateKey === entry) {
      told = true;
    }
    if (state.activeAttack?.phase === "committed") {
      expect(told).toBe(true);
      committed = true;
      expect(state.activeAttack.id).toBe(attack);
    }
    if (state.stateKey === rest) {
      expect(supportedLanding(object, physical, at)).toBe(true);
      rested++;
    }
    if ((state.attackCooldownRemainingSeconds ?? 0) > 0) {
      expect(committed).toBe(true);
      expect(rested).toBeGreaterThanOrEqual(40);
      expect(before.state.stateKey).toBe(rest);
      expect(supportedLanding(object, physical, before.at)).toBe(true);
      completed = true;
      break;
    }
  }
  expect(completed, `Incomplete ${entry}: ${state.stateKey}`).toBe(true);
});

it.each([
  ["pursuit", "prepare-drop-left", { x: 650, y: 324 }],
  ["pursuit-swoop-left", "prepare-swoop-left", { x: 264, y: 5 }],
] as const)(
  "actual %s aborts an invalid moving tell through supported rest and a fresh approach",
  (entry, tell, invalid) => {
    const object = make(),
      bird = target(),
      physical = world();
    const component = { ...object, behaviour: { ...object.behaviour!, initial: entry } };
    let at = object.origin,
      state = startBehaviour(BIRD, component, bird);
    for (let tick = 0; tick < 1200 && state.stateKey !== tell; tick++) {
      const step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
      at = step.at;
      state = step.state;
    }
    expect(state.stateKey).toBe(tell);
    const blocked = { ...bird, ...invalid };
    let step = stepBehaviour(BIRD, object, physical, 1 / 120, blocked, at, state);
    expect(step.state.stateKey).toBe("return-high");
    expect(step.state.activeAttack).toBeUndefined();
    expect(step.state.attackCooldownRemainingSeconds ?? 0).toBe(0);
    at = step.at;
    state = step.state;
    for (let tick = 0; tick < 1200 && state.stateKey !== "rest"; tick++) {
      step = stepBehaviour(BIRD, object, physical, 1 / 120, blocked, at, state);
      expect(step.actions).toEqual([]);
      expect(step.state.activeAttack).toBeUndefined();
      at = step.at;
      state = step.state;
    }
    expect(state.stateKey).toBe("rest");
    expect(supportedLanding(object, physical, at)).toBe(true);
    let approached = false;
    for (let tick = 0; tick < 1200 && state.stateKey !== "prepare-drop-left"; tick++) {
      step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
      expect(step.actions).toEqual([]);
      approached ||= step.state.stateKey === "pursuit";
      at = step.at;
      state = step.state;
    }
    expect(approached).toBe(true);
    expect(state.stateKey).toBe("prepare-drop-left");
    expect(state.elapsed).toBeLessThan(1 / 120);
    expect(state.activeAttack?.phase).toBe("tell");
  },
);

it("actual close swoop tell retreats to overhead range and restarts its full tell", () => {
  const object = make(),
    physical = world();
  let bird = target();
  const component = {
    ...object,
    behaviour: { ...object.behaviour!, initial: "pursuit-swoop-left" },
  };
  let at = object.origin,
    state = startBehaviour(BIRD, component, bird);
  for (let tick = 0; tick < 1200 && state.stateKey !== "prepare-swoop-left"; tick++) {
    const step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
    at = step.at;
    state = step.state;
  }
  expect(state.stateKey).toBe("prepare-swoop-left");
  bird = { ...bird, x: at.x };
  let step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
  expect(step.state.stateKey).toBe("pursuit-swoop-left");
  expect(step.state.activeAttack).toBeUndefined();
  expect(step.state.attackCooldownRemainingSeconds ?? 0).toBe(0);
  at = step.at;
  state = step.state;
  for (let tick = 0; tick < 1200 && state.stateKey !== "prepare-swoop-left"; tick++) {
    step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
    expect(step.actions).toEqual([]);
    at = step.at;
    state = step.state;
  }
  expect(state.stateKey).toBe("prepare-swoop-left");
  expect(state.elapsed).toBeLessThan(1 / 120);
  const tell = object.behaviour!.states["prepare-swoop-left"]!;
  const duration = tell.transitions
    .flatMap(({ when }) => when)
    .find((condition) => condition.kind === "elapsed")!;
  if (duration.kind !== "elapsed") {
    throw Error("Expected tell duration");
  }
  let elapsed = state.elapsed;
  for (let tick = 0; tick < 240 && state.activeAttack?.phase !== "committed"; tick++) {
    step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
    at = step.at;
    state = step.state;
    elapsed += 1 / 120;
    expect(step.actions).toEqual([]);
  }
  expect(state.activeAttack?.phase).toBe("committed");
  expect(elapsed).toBeGreaterThanOrEqual(duration.seconds - 1e-6);
});

it("actual Pebble cancels a blocked-sight tell on time and returns to support without cooldown", () => {
  const object = make(),
    bird = target();
  const component = { ...object, behaviour: { ...object.behaviour!, initial: "pursuit" } };
  let at = object.origin,
    state = startBehaviour(BIRD, component, bird);
  for (let tick = 0; tick < 120 && state.stateKey !== "prepare-drop-left"; tick++) {
    const step = stepBehaviour(BIRD, object, world(), 1 / 120, bird, at, state);
    at = step.at;
    state = step.state;
  }
  expect(state.stateKey).toBe("prepare-drop-left");
  const covered = world(true);
  expect(
    targetVisible(covered, object, contactBox(object, at, state.facing), birdBox(BIRD, bird)),
  ).toBe(false);
  const duration = object
    .behaviour!.states["prepare-drop-left"]!.transitions.flatMap(({ when }) => when)
    .find((condition) => condition.kind === "elapsed");
  if (duration?.kind !== "elapsed") {
    throw Error("Expected bounded tell");
  }
  let step = stepBehaviour(BIRD, object, covered, 1 / 120, bird, at, state);
  // The sight blocker leaves the overhead flight route valid, so this is not an immediate route abort.
  expect(step.state.stateKey).toBe("prepare-drop-left");
  at = step.at;
  state = step.state;
  for (
    let tick = 1;
    tick <= Math.ceil(duration.seconds * 120) + 1 && state.stateKey === "prepare-drop-left";
    tick++
  ) {
    step = stepBehaviour(BIRD, object, covered, 1 / 120, bird, at, state);
    expect(step.actions).toEqual([]);
    expect(step.state.activeAttack?.phase).not.toBe("committed");
    at = step.at;
    state = step.state;
  }
  expect(state.stateKey).toBe("return-high");
  expect(state.activeAttack).toBeUndefined();
  expect(state.attackCooldownRemainingSeconds ?? 0).toBe(0);
  for (let tick = 0; tick < 120 && state.stateKey !== "rest"; tick++) {
    step = stepBehaviour(BIRD, object, covered, 1 / 120, bird, at, state);
    expect(step.actions).toEqual([]);
    expect(step.state.activeAttack).toBeUndefined();
    expect(step.state.attackCooldownRemainingSeconds ?? 0).toBe(0);
    at = step.at;
    state = step.state;
  }
  expect(state.stateKey).toBe("rest");
  expect(supportedLanding(object, covered, at)).toBe(true);
});

it("actual Pebble takes off to a varied supported perch before checking another attack", () => {
  const object = make(),
    bird = target(),
    physical = { ...world(), idleDecision: { namespace: "pebble-perch-profile", seed: 1 } };
  const component = { ...object, behaviour: { ...object.behaviour!, initial: "return-high" } };
  const relocation = object.behaviour!.states.relocate!.motion;
  if (relocation.kind !== "fly" || relocation.to !== "support" || !relocation.selection) {
    throw Error("Expected varied supported flight");
  }
  const origin = { x: 48, y: floor.y - object.height };
  let at = origin,
    state = startBehaviour(BIRD, component, bird),
    movedHorizontally = false,
    rested = false,
    landed = false,
    highest = origin.y;
  expect(supportedLanding(object, physical, at)).toBe(true);
  for (let tick = 0; tick < 900 && !landed; tick++) {
    const step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
    at = step.at;
    state = step.state;
    expect(step.actions).toEqual([]);
    expect(state.activeAttack).toBeUndefined();
    expect(state.attackCooldownRemainingSeconds ?? 0).toBe(0);
    rested ||= state.stateKey === "rest";
    highest = Math.min(highest, at.y);
    if (!movedHorizontally && Math.abs(at.x - origin.x) > 1e-6) {
      expect(at.y).toBeLessThan(origin.y);
      movedHorizontally = true;
    }
    landed = state.stateKey === "relocation-rest";
  }
  expect(rested).toBe(true);
  expect(landed, `Incomplete relocation: ${state.stateKey} at ${at.x},${at.y}`).toBe(true);
  expect(movedHorizontally).toBe(true);
  expect(highest).toBeLessThanOrEqual(origin.y - relocation.selection.clearance + 1e-6);
  expect(Math.abs(at.x - origin.x)).toBeGreaterThanOrEqual(relocation.selection.minDistance - 1e-6);
  expect(Math.abs(at.x - origin.x)).toBeLessThanOrEqual(relocation.selection.distance + 1e-6);
  expect(supportedLanding(object, physical, at)).toBe(true);
  let approached = false;
  for (let tick = 0; tick < 60 && !approached; tick++) {
    const step = stepBehaviour(BIRD, object, physical, 1 / 120, bird, at, state);
    at = step.at;
    state = step.state;
    approached = state.stateKey === "pursuit";
  }
  expect(approached).toBe(true);
});
