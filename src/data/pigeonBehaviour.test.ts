import { expect, it } from "vitest";

import {
  type BehaviourState,
  layoutBehaviour,
  startBehaviour,
  stepBehaviour,
} from "../rules/behaviour";
import { startBird } from "../rules/bird";
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
const target = (vx = 0) => ({ ...startBird(BIRD, { x: 264, y: 360 }), grounded: true, vx });
const floor = { height: 360, width: 720, x: 0, y: 360 };
const roof = { height: 12, width: 240, x: 180, y: 240 };
const world = (covered = false) => ({
  solids: covered ? [floor, roof] : [floor],
  view: { height: 360, width: 720, x: 0, y: 0 },
});
function initial(object: ReturnType<typeof make>, bird: ReturnType<typeof target>): BehaviourState {
  return {
    ...startBehaviour(BIRD, object, bird),
    activeAttack: { id: "drop-burst", phase: "committed" },
    anchor: object.origin,
    elapsed: 0,
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
      at = object.origin,
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
          expected: bird.x + BIRD.width / 2 + Math.min(motion.maxLead, vx * motion.leadSeconds),
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
  let at = object.origin,
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
