import { describe, expect, it } from "vitest";

import { contactFrameAt, sweptContact } from "../core";
import { BIRD } from "../data/bird";
import type {
  Archetype,
  BehaviourCondition,
  BehaviourPlan,
  Character,
  ObjectLayout,
  Rect,
} from "../data/types";
import { behaviourPose } from "../presentation";
import { TEST_PURSUER, TEST_SHUTTLE, withAnticipationContact } from "../testing/behaviours";
import { contactBox, layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import { birdBox, startBird } from "./bird";
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
const bird = (x = 120, y = 300) => ({ ...startBird(BIRD, { x, y }), grounded: true });
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
const initial = (object = OBJECT) => startBehaviour(BIRD, object, bird());

describe("behaviour plans", () => {
  it.each([null, "walk"])("moves art with animation %j", (animation) => {
    const plan = {
      ...TEST_SHUTTLE,
      states: Object.fromEntries(
        Object.entries(TEST_SHUTTLE.states).map(([key, node]) => [key, { ...node, animation }]),
      ),
    };
    const object = resolve(CHARACTER, ACTOR, 1, plan);
    const result = stepBehaviour(BIRD, object, [], 0.1, bird(), object.origin, initial(object));
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
      BIRD,
      OBJECT,
      [],
      0.125,
      { ...bird(x, y), grounded },
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
    const result = stepBehaviour(BIRD, OBJECT, [], seconds, bird(), AT, initial());
    expect({ key: result.state.stateKey, x: result.at.x }).toEqual({ key, x });
    expect(result.state.facing).toBe(-1);
  });

  it("keeps an entry-captured heading when the target moves behind it", () => {
    const first = stepBehaviour(BIRD, OBJECT, [], 0.125, bird(), AT, initial());
    const burst = stepBehaviour(BIRD, OBJECT, [], 0.5, bird(240), first.at, first.state);
    expect({ facing: burst.state.facing, key: burst.state.stateKey, x: burst.at.x }).toEqual({
      facing: -1,
      key: "burst",
      x: 100,
    });
  });

  it("stays still and uses its inactive animation until explicitly activated", () => {
    const object = { ...OBJECT, scene: "conversation" };
    const result = stepBehaviour(BIRD, object, [], 2, bird(), AT, initial(object));
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
    expect(() => stepBehaviour(BIRD, object, [], 1, bird(), AT, initial(object))).toThrow(
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
        BIRD,
        object,
        [],
        3.5,
        bird(1000),
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
    const result = stepBehaviour(BIRD, object, [], 0.5, bird(1000), object.origin, initial(object));
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
    const first = stepBehaviour(BIRD, object, [floor], 0.1, bird(300), AT, initial(object));
    expect(first.state.stateKey).toBe("follow");
    expect(first.at.x).toBeGreaterThan(AT.x);
    const turned = stepBehaviour(BIRD, object, [floor], 0.1, bird(120), first.at, first.state);
    expect(turned.state.facing).toBe(-1);
    expect(turned.at.x).toBeLessThan(first.at.x);
    const barrier = { height: 60, width: 20, x: 200, y: 240 };
    const lost = stepBehaviour(
      BIRD,
      object,
      [floor, barrier],
      0.1,
      bird(300),
      turned.at,
      turned.state,
    );
    expect(behaviourPose(object, lost.state).animation).toBe("frustration");
    const restored = stepBehaviour(BIRD, object, [floor], 0.1, bird(300), lost.at, lost.state);
    expect(restored.state.stateKey).toBe("follow");
  });
  it("projects an ordinary jump to the same floor but loses higher one-way refuges and gaps", () => {
    const object = resolve(CHARACTER, ACTOR, 1, graph());
    const airborne = { ...bird(300, 240), grounded: false };
    expect(
      stepBehaviour(BIRD, object, [floor], 0.01, airborne, AT, initial(object)).state.stateKey,
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
      stepBehaviour(BIRD, object, world, 0.01, bird(300, 250), AT, initial(object)).state.stateKey,
    ).toBe("frustration");
    const gap = [
      { ...floor, width: 200 },
      { ...floor, width: 760, x: 240 },
    ];
    expect(
      stepBehaviour(BIRD, object, gap, 0.01, bird(300), AT, initial(object)).state.stateKey,
    ).toBe("frustration");
  });
  it.each([
    { axis: "x" as const, distance: 100, target: bird(250) },
    { axis: "y" as const, distance: -100, target: bird(120, 310) },
  ])(
    "uses full possible contact envelope on $axis rather than target centre",
    ({ axis, distance, target }) => {
      const object = resolve(CHARACTER, ACTOR, 1, graph(axis, distance));
      const world = axis === "x" ? [floor] : [];
      expect(
        stepBehaviour(BIRD, object, world, 0.01, target, object.origin, initial(object)).state
          .stateKey,
      ).toBe("follow");
      if (axis === "y") {
        expect(
          stepBehaviour(BIRD, object, world, 0.01, bird(300, 310), object.origin, initial(object))
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
      BIRD,
      object,
      [floor],
      0.2,
      bird(),
      object.origin,
      initial(object),
    );
    expect(rising.at).toEqual({ x: object.origin.x, y: object.origin.y - 20 });
    const landed = stepBehaviour(BIRD, object, [floor], 0.2, bird(), rising.at, rising.state);
    expect(landed.at.y).toBe(object.origin.y);
    const ceiling = { height: 20, width: 1000, x: 0, y: 250 };
    expect(
      stepBehaviour(BIRD, object, [floor, ceiling], 0.2, bird(), object.origin, initial(object)).at
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
      stepBehaviour(BIRD, object, world, 0.4, bird(), object.origin, initial(object)).at.y,
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

describe("entry actions and flight", () => {
  const pulse = {
    height: 3,
    kind: "force-pulse",
    range: 30,
    seconds: 0.4,
    velocity: { x: 5, y: 0 },
  } as const;
  const flight: BehaviourPlan = {
    axis: "x",
    distance: 0,
    initial: "perch",
    states: {
      fly: {
        animation: "fly",
        motion: { kind: "fly", speed: 100, to: { x: 30, y: -40 } },
        transitions: [{ to: "land", when: [{ kind: "arrived", tolerance: 0.001 }] }],
      },
      land: { animation: "land", motion: { kind: "wait" }, onEnter: [pulse], transitions: [] },
      perch: {
        animation: "idle",
        motion: { kind: "wait" },
        onEnter: [pulse],
        transitions: [{ to: "fly", when: [{ kind: "elapsed", seconds: 0.2 }] }],
      },
    },
  };

  it("emits each entry once, defers inactive entries and preserves event times", () => {
    const object = { ...resolve(CHARACTER, ACTOR, 1, flight), scene: "intro" };
    const inactive = startBehaviour(BIRD, object, bird());
    expect(stepBehaviour(BIRD, object, [], 1, bird(), object.origin, inactive).actions).toEqual([]);
    const first = stepBehaviour(BIRD, object, [], 0.1, bird(), object.origin, {
      ...inactive,
      active: true,
    });
    expect(first.actions.map((event) => event.time)).toEqual([0]);
    const second = stepBehaviour(BIRD, object, [], 0.6, bird(), first.at, first.state);
    expect(second.at).toEqual({ x: object.origin.x + 30, y: object.origin.y - 40 });
    expect(second.state.stateKey).toBe("land");
    expect(second.actions.map((event) => event.time)).toEqual([expect.closeTo(0.6)]);
    expect(stepBehaviour(BIRD, object, [], 0.1, bird(), second.at, second.state).actions).toEqual(
      [],
    );
  });

  it("converts waypoints and actions once and clips flight at solid cover", () => {
    const plan = layoutBehaviour(12, flight);
    expect(plan.states.fly?.motion).toEqual({ kind: "fly", speed: 1200, to: { x: 360, y: -480 } });
    expect(plan.states.perch?.onEnter?.[0]).toMatchObject({
      height: 36,
      range: 360,
      seconds: 0.4,
      velocity: { x: 60, y: 0 },
    });
    const object = resolve(CHARACTER, ACTOR, 1, { ...flight, initial: "fly" });
    const wall = { height: 400, width: 10, x: object.origin.x + object.width + 5, y: 0 };
    const result = stepBehaviour(
      BIRD,
      object,
      [wall],
      0.5,
      bird(),
      object.origin,
      startBehaviour(BIRD, object, bird()),
    );
    expect(result.at.x).toBe(object.origin.x + 5);
    expect(result.at.y).toBeLessThan(object.origin.y);
    expect(result.state.stateKey).toBe("fly");
  });
});

describe("composed contact attempts", () => {
  it("uses each state's own axis and extent for movement, boundary and visual facing", () => {
    const plan: BehaviourPlan = {
      axis: "y",
      distance: -40,
      initial: "charge",
      states: {
        charge: {
          animation: "rush",
          motion: { direction: 1, kind: "move", speed: 80 },
          track: { axis: "x", distance: 40 },
          transitions: [{ to: "climb", when: [{ kind: "boundary" }] }],
        },
        climb: {
          animation: "climb",
          motion: { direction: -1, kind: "move", speed: 80 },
          track: { axis: "y", distance: -40 },
          transitions: [{ to: "drop", when: [{ kind: "boundary" }] }],
        },
        drop: {
          animation: "drop",
          motion: { direction: 1, kind: "move", speed: 80 },
          transitions: [{ to: "rest", when: [{ kind: "boundary" }] }],
        },
        rest: { animation: "rest", motion: { kind: "wait" }, transitions: [] },
      },
    };
    const actor = resolve(CHARACTER, ACTOR, 1, plan);
    let result = stepBehaviour(
      BIRD,
      actor,
      [],
      0.5,
      bird(),
      actor.origin,
      startBehaviour(BIRD, actor, bird()),
    );
    expect(result.at).toEqual({ x: actor.origin.x + 40, y: actor.origin.y });
    expect(result.state).toMatchObject({ axis: "y", stateKey: "climb" });
    result = stepBehaviour(BIRD, actor, [], 0.5, bird(), result.at, result.state);
    expect(result.at).toEqual({ x: actor.origin.x + 40, y: actor.origin.y - 40 });
    result = stepBehaviour(BIRD, actor, [], 0.5, bird(), result.at, result.state);
    expect(result.at).toEqual({ x: actor.origin.x + 40, y: actor.origin.y });
    expect(result.state.stateKey).toBe("rest");
    const asymmetric = { ...actor, hitbox: { height: 20, width: 10, x: 2, y: 0 } };
    expect(contactBox(asymmetric, actor.origin, -1, "x").x).toBe(actor.origin.x + 28);
    expect(contactBox(asymmetric, actor.origin, -1, "y").x).toBe(actor.origin.x + 2);
    expect(behaviourPose(actor, { ...result.state, axis: "x", facing: -1 }).flipX).toBe(true);
    expect(layoutBehaviour(12, plan).states.charge?.track).toEqual({ axis: "x", distance: 480 });
  });

  it("locks a bounded contact-centred flight target without retargeting the next frame", () => {
    const plan: BehaviourPlan = {
      axis: "x",
      distance: 0,
      initial: "swoop",
      states: {
        rest: { animation: "rest", motion: { kind: "wait" }, transitions: [] },
        swoop: {
          animation: "fly",
          motion: {
            bounds: { height: 200, width: 300, x: -50, y: -200 },
            kind: "fly",
            speed: 400,
            to: "target",
          },
          transitions: [{ to: "rest", when: [{ kind: "arrived", tolerance: 0.001 }] }],
        },
      },
    };
    const actor = resolve(CHARACTER, ACTOR, 1, plan);
    const target = bird(200, 180);
    const contact = birdBox(BIRD, target);
    const initial = startBehaviour(BIRD, actor, target);
    const first = stepBehaviour(BIRD, actor, [], 0.05, target, actor.origin, initial);
    const captured = first.state.flightTarget;
    expect(captured).toEqual({
      x: contact.x + contact.width / 2 - actor.width / 2,
      y: contact.y + contact.height / 2 - actor.height / 2,
    });
    const arrived = stepBehaviour(BIRD, actor, [], 1, bird(0, 300), first.at, first.state);
    expect(arrived.at).toEqual(captured);
    expect(arrived.state.stateKey).toBe("rest");
    const far = startBehaviour(BIRD, actor, bird(10000, -10000));
    expect(far.flightTarget).toEqual({ x: actor.origin.x + 250, y: actor.origin.y - 200 });
    const scaled = layoutBehaviour(12, plan).states.swoop?.motion;
    expect(scaled).toMatchObject({
      bounds: { height: 2400, width: 3600, x: -600, y: -2400 },
      speed: 4800,
      to: "target",
    });
  });
});

it.each([0.6, 0.8, 1])(
  "plays a tell cue once and restarts only at a new same-tag tell after %ss",
  (seconds) => {
    const behaviour: BehaviourPlan = {
      attackCooldownSeconds: 1,
      axis: "x",
      distance: 0,
      initial: "first",
      states: {
        first: {
          animation: "anticipate-lift",
          attack: { id: "move", phase: "tell" },
          motion: { kind: "wait" },
          transitions: [{ to: "second", when: [{ kind: "elapsed", seconds }] }],
        },
        second: {
          animation: "anticipate-lift",
          attack: { id: "move", phase: "tell" },
          motion: { kind: "wait" },
          transitions: [],
        },
      },
    };
    const object = withAnticipationContact(resolve(CHARACTER, ACTOR, 1, behaviour));
    const start = startBehaviour(BIRD, object, bird());
    const held = stepBehaviour(BIRD, object, [], 0.55, bird(), object.origin, start);
    expect(held.at).toEqual(object.origin);
    expect(held.state.stateKey).toBe("first");
    expect(held.state.animationSeconds).toBeCloseTo(0.55);
    expect(held.segments.map(({ frame }) => frame)).toEqual(["load", "lift", "brace", "brace"]);
    expect(
      contactFrameAt(object.contact!, held.state.animationTag!, held.state.animationSeconds!).frame,
    ).toBe("brace");
    const restarted = stepBehaviour(BIRD, object, [], seconds - 0.5, bird(), held.at, held.state);
    expect(restarted.state.stateKey).toBe("second");
    expect(restarted.state.animationSeconds).toBeCloseTo(0.05);
    expect(
      contactFrameAt(
        object.contact!,
        restarted.state.animationTag!,
        restarted.state.animationSeconds!,
      ).frame,
    ).toBe("load");
    expect(behaviourPose(object, restarted.state).animation).toBe("anticipate-lift");
    const continued = stepBehaviour(BIRD, object, [], 0.12, bird(), restarted.at, restarted.state);
    expect(continued.state.animationSeconds).toBeCloseTo(0.17);
    expect(
      contactFrameAt(
        object.contact!,
        continued.state.animationTag!,
        continued.state.animationSeconds!,
      ).frame,
    ).toBe("lift");
  },
);

it("validates the optional takeoff tag against its paired silhouette export", () => {
  const object = withAnticipationContact(resolve());
  const physical = { ...object.contact!.frame, x: 0, y: 0 };
  const artwork = { contact: object.contact!, frame: object.contact!.frame, hitbox: physical };
  const catalogue = {
    archetypes: { actor: ACTOR },
    characters: { actor: { ...CHARACTER, behaviour: object.behaviour! } },
  };
  const place = () =>
    objectLayout(
      1,
      catalogue,
      { [CHARACTER.art]: artwork },
      undefined,
      {},
      { character: "actor", col: 0, row: 0 },
    );
  expect(place().behaviour?.takeoffAnimation).toBe("anticipate-lift");
  const { ["anticipate-lift"]: removed, ...tags } = object.contact!.tags;
  void removed;
  const missing = { ...artwork, contact: { ...object.contact!, tags } };
  expect(() =>
    objectLayout(
      1,
      catalogue,
      { [CHARACTER.art]: missing },
      undefined,
      {},
      { character: "actor", col: 0, row: 0 },
    ),
  ).toThrow("Missing silhouette animation");
});

describe("track conditions", () => {
  // A climb from the placed origin (y 280) towards its endpoint 60 above (y 220).
  const CLIMB: BehaviourPlan = {
    axis: "y",
    distance: -60,
    initial: "ground",
    states: {
      climb: {
        animation: null,
        motion: { direction: -1, kind: "move", speed: 30 },
        transitions: [
          { to: "stuck", when: [{ kind: "blocked" }] },
          { to: "top", when: [{ kind: "boundary" }] },
        ],
      },
      ground: {
        animation: null,
        motion: { kind: "wait" },
        transitions: [{ to: "climb", when: [{ kind: "track-clear", state: "climb" }] }],
      },
      stuck: { animation: null, motion: { kind: "wait" }, transitions: [] },
      top: { animation: null, motion: { kind: "wait" }, transitions: [] },
    },
  };
  // Over the climb, with its bottom 50 above the object's top.
  const CEILING: Rect = { height: 30, width: 40, x: 100, y: 200 };

  it.each([
    { ceiling: false, from: "ground", seconds: 0.1, state: "climb", y: 277 },
    { ceiling: true, from: "ground", seconds: 0.1, state: "ground", y: 280 },
    { ceiling: true, from: "climb", seconds: 1, state: "climb", y: 250 },
    { ceiling: true, from: "climb", seconds: 3, state: "stuck", y: 230 },
    { ceiling: false, from: "climb", seconds: 3, state: "top", y: 220 },
  ])(
    "from $from with ceiling=$ceiling over $seconds s ends in $state",
    ({ ceiling, from, seconds, state, y }) => {
      const object = resolve(CHARACTER, ACTOR, 1, { ...CLIMB, initial: from });
      const result = stepBehaviour(
        BIRD,
        object,
        ceiling ? [CEILING] : [],
        seconds,
        bird(),
        object.origin,
        initial(object),
      );
      expect(result.state.stateKey).toBe(state);
      expect(result.at.y).toBeCloseTo(y);
    },
  );

  const CLEAR: BehaviourCondition = { kind: "track-clear", state: "climb" };
  const NOT_CLEAR: BehaviourCondition = { condition: CLEAR, kind: "not" };
  it.each([
    { ceiling: true, condition: NOT_CLEAR, name: "not(track-clear)", state: "climb" },
    { ceiling: false, condition: NOT_CLEAR, name: "not(track-clear)", state: "ground" },
    {
      ceiling: true,
      condition: { condition: NOT_CLEAR, kind: "not" } as const,
      name: "not(not(track-clear))",
      state: "ground",
    },
    {
      ceiling: false,
      condition: { condition: NOT_CLEAR, kind: "not" } as const,
      name: "not(not(track-clear))",
      state: "climb",
    },
  ])("$name with ceiling=$ceiling ends in $state", ({ ceiling, condition, state }) => {
    const plan: BehaviourPlan = {
      ...CLIMB,
      states: {
        ...CLIMB.states,
        ground: { ...CLIMB.states.ground!, transitions: [{ to: "climb", when: [condition] }] },
      },
    };
    const object = resolve(CHARACTER, ACTOR, 1, plan);
    const result = stepBehaviour(
      BIRD,
      object,
      ceiling ? [CEILING] : [],
      0.1,
      bird(),
      object.origin,
      initial(object),
    );
    expect(result.state.stateKey).toBe(state);
  });

  it.each([
    [
      "is negated blocked without track travel",
      "ground",
      { condition: { kind: "blocked" }, kind: "not" },
    ],
    ["names a missing state", "ground", { kind: "track-clear", state: "absent" }],
    ["names a state without track travel", "ground", { kind: "track-clear", state: "top" }],
    ["is blocked without track travel", "ground", { kind: "blocked" }],
  ] as const)("refuses a track condition that %s", (_, key, condition) => {
    const plan = {
      ...CLIMB,
      states: {
        ...CLIMB.states,
        [key]: { ...CLIMB.states[key]!, transitions: [{ to: "climb", when: [condition] }] },
      },
    };
    expect(() => layoutBehaviour(1, plan)).toThrow(`Invalid track condition in ${key}`);
  });
});
