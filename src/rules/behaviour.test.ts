import { describe, expect, it } from "vitest";

import { DUCK } from "../data/duck";
import type { Archetype, BehaviourPlan, Character, ObjectLayout, Rect } from "../data/types";
import { TEST_PURSUER, TEST_SHUTTLE } from "../testing/behaviours";
import { behaviourPose } from "../view/behaviour";
import {
  contactBox,
  layoutBehaviour,
  startBehaviour,
  stepBehaviour,
  sweptContact,
} from "./behaviour";
import { startDuck } from "./duck";
import { objectLayout } from "./tiles";

const ACTOR: Archetype = {
  collision: "hazard",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "static",
    direction: "right",
    distance: 0,
    hopHeight: 0,
    pause: 0,
    speed: 0,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const CHARACTER: Character = {
  archetype: "actor",
  art: "placeholder-actor",
  behaviour: TEST_PURSUER,
  cols: 40,
  rows: 20,
};
const AT = { x: 150, y: 280 };
const duck = (x = 120, y = 300) => ({ ...startDuck(DUCK, { x, y }), grounded: true });
const resolve = (character = CHARACTER, archetype = ACTOR, tile = 1, behaviour?: BehaviourPlan) =>
  objectLayout(
    tile,
    { archetypes: { actor: archetype }, characters: { actor: character } },
    {},
    undefined,
    {},
    { ...(behaviour && { behaviour }), character: "actor", col: 100, row: 280 },
  );
const OBJECT = resolve();
const initial = (object = OBJECT) => startBehaviour(DUCK, object, duck());

describe("behaviour plans", () => {
  it.each([null, "walk"])("moves art with animation %j", (animation) => {
    const plan = {
      ...TEST_SHUTTLE,
      states: Object.fromEntries(
        Object.entries(TEST_SHUTTLE.states).map(([key, node]) => [key, { ...node, animation }]),
      ),
    };
    const object = resolve(CHARACTER, ACTOR, 1, plan);
    const result = stepBehaviour(DUCK, object, [], 0.1, duck(), object.origin, initial(object));
    expect(result.at.y).toBeLessThan(object.origin.y);
    expect(behaviourPose(object, result.state).animation).toBe(animation ?? undefined);
  });

  it("converts signed extent, speeds and spatial conditions without changing time or graph keys", () => {
    const plan = resolve(CHARACTER, ACTOR, 12).behaviour;
    const node = plan?.states.watchRight;
    expect({
      distance: plan?.distance,
      motion: node?.motion,
      when: node?.transitions[0]?.when,
    }).toEqual({
      distance: 1200,
      motion: { direction: 1, kind: "move", speed: 240 },
      when: [
        { kind: "nearby", range: 960 },
        { kind: "same-ground", tolerance: 12 },
      ],
    });
    expect(plan?.states.brace?.transitions[0]?.when).toEqual([{ kind: "elapsed", seconds: 0.25 }]);
  });

  it("takes a composed instance plan over its character's default", () => {
    expect(resolve(CHARACTER, ACTOR, 1, { ...TEST_SHUTTLE, distance: -90 }).behaviour).toEqual({
      ...TEST_SHUTTLE,
      distance: -90,
    });
  });

  it.each<BehaviourPlan>([
    { ...TEST_PURSUER, initial: "absent" },
    { ...TEST_PURSUER, distance: Infinity },
    {
      ...TEST_PURSUER,
      states: {
        ...TEST_PURSUER.states,
        brace: {
          animation: "crouch",
          motion: { kind: "wait" },
          transitions: [{ to: "absent", when: [{ kind: "elapsed", seconds: 1 }] }],
        },
      },
    },
    {
      ...TEST_PURSUER,
      states: {
        ...TEST_PURSUER.states,
        brace: {
          animation: "crouch",
          motion: { kind: "wait" },
          transitions: [{ to: "burst", when: [{ kind: "elapsed", seconds: -1 }] }],
        },
      },
    },
  ])("refuses invalid graph data %j", (plan) => {
    expect(() => layoutBehaviour(1, plan)).toThrow("Invalid behaviour");
  });
});

describe("data-defined pursuit", () => {
  it.each([
    { grounded: true, triggered: true, x: 120, y: 300 },
    { grounded: false, triggered: false, x: 120, y: 300 },
    { grounded: true, triggered: false, x: 120, y: 250 },
    { grounded: true, triggered: false, x: 300, y: 300 },
  ])("combines nearby and same-ground conditions: %j", ({ grounded, triggered, x, y }) => {
    const result = stepBehaviour(
      DUCK,
      OBJECT,
      [],
      0.125,
      { ...duck(x, y), grounded },
      AT,
      initial(),
    );
    expect(result.state.stateKey === "brace").toBe(triggered);
  });

  it.each([
    [0.125, "brace", 150],
    [0.25, "burst", 150],
    [0.5, "burst", 100],
    [0.75, "recover", 100],
  ])("after %s seconds is %s at x%s, preserving elapsed timing at the bound", (seconds, key, x) => {
    const result = stepBehaviour(DUCK, OBJECT, [], seconds, duck(), AT, initial());
    expect({ key: result.state.stateKey, x: result.at.x }).toEqual({ key, x });
    expect(result.state.facing).toBe(-1);
  });

  it("keeps an entry-captured heading when the target moves behind it", () => {
    const first = stepBehaviour(DUCK, OBJECT, [], 0.125, duck(), AT, initial());
    const burst = stepBehaviour(DUCK, OBJECT, [], 0.5, duck(240), first.at, first.state);
    expect({ facing: burst.state.facing, key: burst.state.stateKey, x: burst.at.x }).toEqual({
      facing: -1,
      key: "burst",
      x: 100,
    });
  });

  it("stays still and uses its inactive animation until explicitly activated", () => {
    const object = { ...OBJECT, scene: "conversation" };
    const result = stepBehaviour(DUCK, object, [], 2, duck(), AT, initial(object));
    expect(result.at).toEqual(AT);
    expect(result.state.active).toBe(false);
    expect(behaviourPose(object, result.state).animation).toBe(TEST_PURSUER.inactiveAnimation);
  });

  it("rejects an instantaneous transition cycle instead of hanging a frame", () => {
    const node = {
      animation: "idle",
      motion: { kind: "wait" as const },
      transitions: [{ to: "again", when: [{ kind: "elapsed" as const, seconds: 0 }] }],
    };
    const object = {
      ...OBJECT,
      behaviour: { ...TEST_PURSUER, initial: "again", states: { again: node } },
    };
    expect(() => stepBehaviour(DUCK, object, [], 1, duck(), AT, initial(object))).toThrow(
      "Instant behaviour transition cycle",
    );
  });
});

describe("shared shuttle primitive", () => {
  it.each(["x", "y"] as const)(
    "moves, waits and returns along %s for a solid inanimate actor",
    (axis) => {
      const object = resolve(
        { ...CHARACTER, behaviour: { ...TEST_SHUTTLE, axis } },
        { ...ACTOR, collision: "solid" },
      );
      const result = stepBehaviour(
        DUCK,
        object,
        [],
        3.5,
        duck(1000),
        object.origin,
        initial(object),
      );
      expect(result.at[axis]).toBe(object.origin[axis] - 30);
      expect(result.state.stateKey).toBe("homebound");
      expect(result.state.facing).toBe(1);
    },
  );

  it("tests a boundary in the current travel direction, not the starting endpoint", () => {
    const object = resolve({ ...CHARACTER, behaviour: TEST_SHUTTLE });
    const result = stepBehaviour(DUCK, object, [], 0.5, duck(1000), object.origin, initial(object));
    expect(result.at.y).toBe(object.origin.y - 15);
    expect(result.state.stateKey).toBe("outbound");
  });

  it.each(["x", "y"] as const)("uses a facing-adjusted contact box for a %s-axis actor", (axis) => {
    const object: ObjectLayout = {
      ...OBJECT,
      behaviour: { ...TEST_PURSUER, axis },
      hitbox: { height: 12, width: 10, x: 2, y: 3 },
    };
    expect(contactBox(object, AT, -1).x).toBe(axis === "x" ? 178 : 152);
  });
});

describe("swept contact", () => {
  const box: Rect = { height: 10, width: 10, x: 0, y: 0 };
  it.each([
    { end: { x: 30, y: 0 }, other: { height: 10, width: 5, x: 20, y: 0 }, touches: true },
    { end: { x: 30, y: 0 }, other: { height: 10, width: 5, x: 20, y: 10 }, touches: false },
    { end: { x: 10, y: 0 }, other: { height: 10, width: 5, x: 20, y: 0 }, touches: false },
    { end: { x: 30, y: 30 }, other: { height: 5, width: 5, x: 20, y: 0 }, touches: false },
  ])("detects contact along the actual movement path: %j", ({ end, other, touches }) => {
    expect(sweptContact(box, end, other, other)).toBe(touches);
  });
});

describe("generic target pursuit and reachability", () => {
  const floor: Rect = { height: 40, width: 1000, x: 0, y: 300 };
  const graph = (axis: "x" | "y" = "x", distance = 200): BehaviourPlan => ({
    axis,
    distance,
    initial: "follow",
    states: {
      follow: {
        animation: "walk",
        motion: { direction: "target", kind: "move", speed: 20 },
        transitions: [{ to: "frustration", when: [{ kind: "lost-target", tolerance: 0 }] }],
      },
      frustration: {
        animation: "frustration",
        motion: { kind: "wait" },
        transitions: [
          {
            to: "follow",
            when: [
              { kind: "elapsed", seconds: 0.1 },
              { kind: "reachable", tolerance: 0 },
            ],
          },
        ],
      },
    },
  });
  it("retargets persistent movement and retries after support becomes reachable", () => {
    const object = resolve(CHARACTER, ACTOR, 1, graph());
    const first = stepBehaviour(DUCK, object, [floor], 0.1, duck(300), AT, initial(object));
    expect(first.state.stateKey).toBe("follow");
    expect(first.at.x).toBeGreaterThan(AT.x);
    const turned = stepBehaviour(DUCK, object, [floor], 0.1, duck(120), first.at, first.state);
    expect(turned.state.facing).toBe(-1);
    expect(turned.at.x).toBeLessThan(first.at.x);
    const barrier = { height: 60, width: 20, x: 200, y: 240 };
    const lost = stepBehaviour(
      DUCK,
      object,
      [floor, barrier],
      0.1,
      duck(300),
      turned.at,
      turned.state,
    );
    expect(behaviourPose(object, lost.state).animation).toBe("frustration");
    const restored = stepBehaviour(DUCK, object, [floor], 0.1, duck(300), lost.at, lost.state);
    expect(restored.state.stateKey).toBe("follow");
  });
  it("projects an ordinary jump to the same floor but loses higher one-way refuges and gaps", () => {
    const object = resolve(CHARACTER, ACTOR, 1, graph());
    const airborne = { ...duck(300, 240), grounded: false };
    expect(
      stepBehaviour(DUCK, object, [floor], 0.01, airborne, AT, initial(object)).state.stateKey,
    ).toBe("follow");
    const refuge = {
      ...OBJECT,
      collision: "ledge" as const,
      height: 12,
      origin: { x: 250, y: 250 },
      width: 100,
    };
    const world = {
      platforms: [
        {
          collision: "ledge" as const,
          owner: refuge,
          rect: { ...refuge.origin, height: refuge.height, width: refuge.width },
        },
      ],
      solids: [floor],
    };
    expect(
      stepBehaviour(DUCK, object, world, 0.01, duck(300, 250), AT, initial(object)).state.stateKey,
    ).toBe("frustration");
    const gap = [
      { ...floor, width: 200 },
      { ...floor, width: 760, x: 240 },
    ];
    expect(
      stepBehaviour(DUCK, object, gap, 0.01, duck(300), AT, initial(object)).state.stateKey,
    ).toBe("frustration");
  });
  it.each([
    { axis: "x" as const, distance: 100, target: duck(250) },
    { axis: "y" as const, distance: -100, target: duck(120, 310) },
  ])(
    "uses full possible contact envelope on $axis rather than target centre",
    ({ axis, distance, target }) => {
      const object = resolve(CHARACTER, ACTOR, 1, graph(axis, distance));
      const world = axis === "x" ? [floor] : [];
      expect(
        stepBehaviour(DUCK, object, world, 0.01, target, object.origin, initial(object)).state
          .stateKey,
      ).toBe("follow");
      if (axis === "y") {
        expect(
          stepBehaviour(DUCK, object, world, 0.01, duck(300, 310), object.origin, initial(object))
            .state.stateKey,
        ).toBe("frustration");
      }
    },
  );
});

describe("generic graph hops", () => {
  const floor: Rect = { height: 40, width: 1000, x: 0, y: 300 };
  const plan: BehaviourPlan = {
    axis: "x",
    distance: 0,
    initial: "bounce",
    states: {
      bounce: {
        animation: "frustration",
        motion: { direction: "facing", hopHeight: 20, hopSeconds: 0.4, kind: "hop", speed: 0 },
        transitions: [],
      },
    },
  };
  it("supports stationary hopping, clips ceilings and lands on actual one-way supports", () => {
    const object = resolve(CHARACTER, ACTOR, 1, plan);
    const rising = stepBehaviour(
      DUCK,
      object,
      [floor],
      0.2,
      duck(),
      object.origin,
      initial(object),
    );
    expect(rising.at).toEqual({ x: object.origin.x, y: object.origin.y - 20 });
    const landed = stepBehaviour(DUCK, object, [floor], 0.2, duck(), rising.at, rising.state);
    expect(landed.at.y).toBe(object.origin.y);
    const ceiling = { height: 20, width: 1000, x: 0, y: 250 };
    expect(
      stepBehaviour(DUCK, object, [floor, ceiling], 0.2, duck(), object.origin, initial(object)).at
        .y,
    ).toBe(270);
    const ledge = {
      ...OBJECT,
      collision: "ledge" as const,
      height: 10,
      origin: { x: 80, y: 290 },
      width: 100,
    };
    const world = {
      platforms: [
        {
          collision: "ledge" as const,
          owner: ledge,
          rect: { ...ledge.origin, height: ledge.height, width: ledge.width },
        },
      ],
      solids: [floor],
    };
    expect(
      stepBehaviour(DUCK, object, world, 0.4, duck(), object.origin, initial(object)).at.y,
    ).toBe(270);
  });
  it("scales hop geometry while retaining its time and rejects zero duration", () => {
    const converted = layoutBehaviour(2, plan).states.bounce?.motion;
    expect(converted).toMatchObject({ hopHeight: 40, hopSeconds: 0.4, speed: 0 });
    const node = plan.states.bounce;
    if (!node || node.motion.kind !== "hop") {
      throw new Error("Missing hop fixture");
    }
    const motion = node.motion;
    expect(() =>
      layoutBehaviour(1, {
        ...plan,
        states: { bounce: { ...node, motion: { ...motion, hopSeconds: 0 } } },
      }),
    ).toThrow("Invalid behaviour");
  });
});
