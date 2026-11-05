import { candidateScore } from "@andornaut/game-kit/ai/utility";
import { expect, it } from "vitest";

import { namedStreams } from "../ai/randomStreams";
import { DOG_BEHAVIOUR } from "../data/behaviours";
import { BIRD } from "../data/bird";
import {
  chargeScore,
  FERT_SCORER,
  GROUND_BOSS_SCORER,
  GROWL_SCORE,
  MAUL_SCORE,
} from "../data/bossScorers";
import { TILE } from "../data/screen";
import type { BehaviourTransition, BossScoredAttack } from "../data/types";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { type BehaviourState, layoutBehaviour, startBehaviour, stepBehaviour } from "./behaviour";
import {
  type BossScorerValues,
  decideScored,
  INITIAL_SCORER_STATE,
  moveIntent,
  scorerPressure,
} from "./behaviourScorer";
import { birdBox, startBird } from "./bird";
import { objectLayout } from "./tiles";

// A level Chibi 6 tiles out, standing still, just after an attack.
const LEVEL: BossScorerValues = {
  distance: 8,
  heightDelta: 0,
  heightGap: 0,
  horizontalGap: 6,
  lineOfSight: 1,
  specialDueSeconds: 0,
  targetSpeed: 0,
  threatSeconds: 0,
};
const never = () => {
  throw new Error("No draw expected");
};
const score = (attack: BossScoredAttack, values: Partial<BossScorerValues>) =>
  candidateScore({ action: "attack", gate: true, ...attack, values: { ...LEVEL, ...values } });
const attack = (to: string, special = false): BehaviourTransition => ({
  score: { base: 1, considerations: [], special },
  to,
  when: [],
});

it("ramps pressure from zero after the grace to one at the end of the ramp", () => {
  const { graceSeconds, rampSeconds } = GROUND_BOSS_SCORER.pressure;
  const samples = [0, graceSeconds, graceSeconds + rampSeconds / 2, graceSeconds + rampSeconds, 60];
  const shares = samples.map((seconds) => scorerPressure(GROUND_BOSS_SCORER, seconds));
  expect(shares).toEqual([0, 0, 0.5, 1, 1]);
});

it("chooses a gated attack over every move", () => {
  const { choice } = decideScored(GROUND_BOSS_SCORER, never, true, INITIAL_SCORER_STATE, LEVEL, [
    attack("crouch"),
  ]);
  expect(choice).toMatchObject({ kind: "attack", transition: { to: "crouch" } });
});

it("chases a near Chibi and cuts off a far one running away", () => {
  const near = decideScored(GROUND_BOSS_SCORER, never, true, INITIAL_SCORER_STATE, LEVEL, []);
  expect(near.choice).toMatchObject({ kind: "move", move: { id: "chase" } });
  const running = { ...LEVEL, horizontalGap: 10, targetSpeed: BIRD.walkSpeed / TILE };
  const far = decideScored(GROUND_BOSS_SCORER, never, true, INITIAL_SCORER_STATE, running, []);
  expect(far.choice).toMatchObject({ kind: "move", move: { id: "cut-off" } });
});

it("backs Fert off from a close Chibi under any pressure, and closes in from farther out", () => {
  const { graceSeconds, rampSeconds } = FERT_SCORER.pressure;
  const pressed = graceSeconds + rampSeconds;
  for (const threatSeconds of [0, pressed]) {
    const close = { ...LEVEL, horizontalGap: 1.5, threatSeconds };
    const { choice } = decideScored(FERT_SCORER, never, true, INITIAL_SCORER_STATE, close, []);
    expect(choice).toMatchObject({ kind: "move", move: { id: "standoff" } });
  }
  const far = { ...LEVEL, horizontalGap: 6, threatSeconds: pressed };
  const { choice } = decideScored(FERT_SCORER, never, true, INITIAL_SCORER_STATE, far, []);
  expect(choice).toMatchObject({ kind: "move", move: { id: "chase" } });
});

it("raises attack scores with pressure and with their cadence coming due", () => {
  const scoreAt = (values: Partial<BossScorerValues>, special: boolean) =>
    decideScored(GROUND_BOSS_SCORER, never, false, INITIAL_SCORER_STATE, { ...LEVEL, ...values }, [
      attack("tell", special),
    ]).decision.scores[0]!.score;
  for (const special of [false, true]) {
    const scores = [0, 2, 4, 8, 20].map((seconds) =>
      scoreAt({ specialDueSeconds: seconds, threatSeconds: seconds }, special),
    );
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(scores.at(-1)!).toBeGreaterThan(scores[0]!);
  }
});

it("never lowers the chase or an attack's score as threatSeconds rises alone", () => {
  const threats = [0, 1, 2, 3, 4, 6, 10, 20];
  for (const scorer of [GROUND_BOSS_SCORER, FERT_SCORER]) {
    const scores = threats.map((threatSeconds) => {
      const { decision } = decideScored(
        scorer,
        never,
        true,
        INITIAL_SCORER_STATE,
        { ...LEVEL, threatSeconds },
        [attack("tell")],
      );
      const of = (action: string) => decision.scores.find((entry) => entry.action === action)!;
      return [of("attack:tell").score, of("move:chase").score] as const;
    });
    for (const column of [0, 1]) {
      const series = scores.map((row) => row[column]!);
      expect(series).toEqual([...series].sort((a, b) => a - b));
    }
  }
});

it("keeps the held move when an attack's considerations veto it between decisions", () => {
  const held = { ...INITIAL_SCORER_STATE, heldSeconds: 0.1, move: "chase" };
  const vetoed: BehaviourTransition = {
    score: chargeScore(15),
    to: "crouch",
    when: [],
  };
  const { choice } = decideScored(
    GROUND_BOSS_SCORER,
    never,
    false,
    held,
    { ...LEVEL, heightGap: 5 },
    [vetoed],
  );
  expect(choice).toEqual({ kind: "keep" });
});

it("charges only at Chibi's height and within its reach, and never from point-blank", () => {
  const charge = chargeScore(15);
  expect(score(charge, {})).toBe(1);
  expect(score(charge, { heightGap: 3 })).toBe(0);
  expect(score(charge, { horizontalGap: 15 })).toBe(0);
  expect(score(charge, { horizontalGap: 0.5 })).toBe(0);
});

it("growls only near Chibi's height and mauls only up close", () => {
  expect(score(GROWL_SCORE, {})).toBeGreaterThan(0);
  expect(score(GROWL_SCORE, { heightGap: 4 })).toBe(0);
  expect(score(GROWL_SCORE, { lineOfSight: 0 })).toBeLessThan(score(GROWL_SCORE, {}));
  expect(score(MAUL_SCORE, { horizontalGap: 1 })).toBeGreaterThan(0);
  expect(score(MAUL_SCORE, { horizontalGap: 5 })).toBe(0);
});

it("aims each move at its offset from Chibi", () => {
  const object = dog();
  const bird = { ...startBird(BIRD, { x: 600, y: 300 }), vx: BIRD.walkSpeed };
  const box = birdBox(BIRD, bird);
  const at = { x: 300, y: 300 - object.height };
  const offset = (move: Parameters<typeof moveIntent>[2]) =>
    moveIntent(BIRD, bird, move, 0.25, 1, object, at).target.x - box.x;
  expect(offset({ kind: "chase" })).toBe(0);
  expect(offset({ kind: "cut-off", leadSeconds: 0.5, maxLead: 8 * TILE })).toBe(8 * TILE);
  expect(offset({ distance: 10 * TILE, kind: "ahead" })).toBe(10 * TILE);
  expect(offset({ distance: 7 * TILE, kind: "standoff" })).toBe(-7 * TILE);
});

it("rejects scored transitions outside the scorer's engaged state", () => {
  const states = { ...DOG_BEHAVIOUR.states };
  states.rest = { ...states.rest!, transitions: [...states.rest!.transitions, attack("crouch")] };
  expect(() => layoutBehaviour(TILE, { ...DOG_BEHAVIOUR, states })).toThrow(/engaged state/);
});

const boss = (character: string) =>
  objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character, col: 20, row: 10 },
  );
const dog = () => boss("dog-antagonist");

const floor = { height: 360, width: 2400, x: -600, y: 360 };
const world = {
  decisions: namedStreams(1, "scorer-test"),
  solids: [floor],
  targetedAttackWindow: "allowed" as const,
  traversalFrame: {
    bounds: { height: 720, width: 2400, x: -600, y: 0 },
    dtSeconds: 1 / 120,
    platforms: [],
    timeSeconds: 0,
  },
  view: { height: 360, width: 720, x: 0, y: 0 },
};

function engaged(
  object: ReturnType<typeof boss>,
  bird: ReturnType<typeof startBird>,
  patch: Partial<BehaviourState> = {},
): BehaviourState {
  return {
    ...startBehaviour(BIRD, object, bird),
    pendingEntry: false,
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    stateKey: "pursuit",
    ...patch,
  };
}

it("starts Archie's charge tell at once against a level Chibi in range", () => {
  const object = dog();
  const at = { x: 240, y: floor.y - object.height };
  const bird = startBird(BIRD, { x: 240 + object.width + 6 * TILE, y: floor.y });
  const step = stepBehaviour(BIRD, object, world, 1 / 120, bird, at, engaged(object, bird));
  expect(step.state.stateKey).toBe("crouch");
  expect(step.state.activeAttack).toEqual({ id: "charge", phase: "tell" });
  expect(step.state.scorer).toMatchObject({ decision: 1, threatSeconds: 0 });
});

it("holds a cut-off ahead of a running Chibi while the attack cools down, then replays it", () => {
  const object = dog();
  const at = { x: 0, y: floor.y - object.height };
  const bird = {
    ...startBird(BIRD, { x: 20 * TILE + object.width, y: floor.y }),
    vx: BIRD.walkSpeed,
  };
  const state = engaged(object, bird, { attackCooldownRemainingSeconds: 2 });
  const run = () => stepBehaviour(BIRD, object, world, 1 / 120, bird, at, state);
  const step = run();
  expect(step.state.stateKey).toBe("pursuit");
  expect(step.state.scorer?.move).toBe("cut-off");
  expect(step.state.intent!.target.x).toBeGreaterThan(birdBox(BIRD, bird).x);
  expect(run()).toEqual(step);
});

it("keeps Fert out at his standoff while his attacks cool down", () => {
  const object = boss("ferret-antagonist");
  const at = { x: 240, y: floor.y - object.height };
  const bird = startBird(BIRD, { x: 240 + object.width + 2 * TILE, y: floor.y });
  const state = engaged(object, bird, { attackCooldownRemainingSeconds: 2 });
  const step = stepBehaviour(BIRD, object, world, 1 / 120, bird, at, state);
  expect(step.state.scorer?.move).toBe("standoff");
  expect(step.state.intent!.target.x).toBe(birdBox(BIRD, bird).x - 4 * TILE);
});
