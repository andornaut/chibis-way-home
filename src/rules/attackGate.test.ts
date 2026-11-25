import { describe, expect, it } from "vitest";

import { TILE } from "../data/screen.ts";
import type { BehaviourCondition, BehaviourTransition, ObjectLayout } from "../data/types/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import { attackGate, type AttackGateState } from "./attackGate.ts";
import { objectLayout } from "./tiles.ts";

function boss(character: string): ObjectLayout {
  return objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character, col: 22, row: 46 },
  );
}

const archie = boss("dog-antagonist");
const kiwi = boss("raccoon-antagonist");
const plan = archie.behaviour!;
const clearance = plan.pursuit!.relief!.pause.tellClearanceSeconds;
// Archie's scored attacks: the charge gated by range alone and the pounce by range and sight.
const scored = plan.states.pursuit!.transitions.filter(({ score }) => score);
const charge = scored.find(({ when }) => when.every(({ kind }) => kind !== "line-of-sight"))!;
const pounce = scored.find(({ when }) => when.some(({ kind }) => kind === "line-of-sight"))!;
const opening = plan.states[plan.initial]!.transitions[0]!;
const tell = plan.states[charge.to]!.attack!;

const holds = () => true;
const except = (kind: BehaviourCondition["kind"]) => (condition: BehaviourCondition) =>
  condition.kind !== kind;
const refusal = (reason: string) => ({ admitted: false, reason });
const underWay: AttackGateState = { activeAttack: { id: tell.id, phase: "tell" } };
const blocked: readonly (readonly [string, AttackGateState])[] = [
  ["active-attack", { activeAttack: { id: "other", phase: "committed" } }],
  ["cooldown", { attackCooldownRemainingSeconds: plan.attackCooldownSeconds! }],
  ["tell-cancel-pause", { tellPauseRemainingSeconds: plan.tellCancelPause!.seconds }],
];

it("reads the charge, the pounce and the opening from Archie's plan", () => {
  expect(tell).toEqual({ id: tell.id, phase: "tell" });
  expect(opening.to).toBe(charge.to);
  expect(opening.score).toBeUndefined();
  expect(charge.when.map(({ kind }) => kind)).toEqual([
    "nearby",
    "attack-ready",
    "horizontal-gap",
    "horizontal-gap",
    "height-gap",
    "track-moves",
  ]);
  expect(pounce.when.map(({ kind }) => kind)).toEqual(["nearby", "line-of-sight", "attack-ready"]);
  expect(opening.when.map(({ kind }) => kind)).toEqual(["visible", "attack-ready"]);
});

describe.each([
  ["scored charge", charge],
  ["opening", opening],
] as const)("the %s", (_, transition) => {
  it("is admitted when ready with its conditions holding", () => {
    expect(attackGate(holds, archie, {}, transition)).toEqual({ admitted: true });
  });

  it.each(blocked)("is refused for %s", (reason, state) => {
    expect(attackGate(holds, archie, state, transition)).toEqual(refusal(reason));
  });

  it("is refused for active-attack while its own tell is under way", () => {
    expect(attackGate(holds, archie, underWay, transition)).toEqual(refusal("active-attack"));
  });
});

describe("the scored charge", () => {
  it("is refused inside the pause clearance and admitted from it", () => {
    const inside: AttackGateState = { scorer: { sincePauseSeconds: clearance / 2 } };
    const clear: AttackGateState = { scorer: { sincePauseSeconds: clearance } };
    expect(attackGate(holds, archie, inside, charge)).toEqual(refusal("pause-clearance"));
    expect(attackGate(holds, archie, clear, charge)).toEqual({ admitted: true });
  });

  it("tests the pause clearance before readiness", () => {
    const state: AttackGateState = { ...blocked[1]![1], scorer: { sincePauseSeconds: 0 } };
    expect(attackGate(holds, archie, state, charge)).toEqual(refusal("pause-clearance"));
  });

  it("is refused for engagement outside its range", () => {
    expect(attackGate(except("nearby"), archie, {}, charge)).toEqual(refusal("engagement"));
  });

  it.each(["horizontal-gap", "height-gap"] as const)(
    "is refused for band outside its %s",
    (kind) => {
      expect(attackGate(except(kind), archie, {}, charge)).toEqual(refusal("band"));
    },
  );

  it("is refused for no-room when its rush cannot move", () => {
    expect(attackGate(except("track-moves"), archie, {}, charge)).toEqual(refusal("no-room"));
  });

  it("refuses the pounce for condition without a line of sight", () => {
    expect(attackGate(except("line-of-sight"), archie, {}, pounce)).toEqual(refusal("condition"));
  });
});

describe("the opening", () => {
  it("skips the pause clearance and has no range", () => {
    const state: AttackGateState = { scorer: { sincePauseSeconds: 0 } };
    expect(attackGate(except("nearby"), archie, state, opening)).toEqual({ admitted: true });
  });

  it("is refused for condition while Chibi is unseen", () => {
    expect(attackGate(except("visible"), archie, {}, opening)).toEqual(refusal("condition"));
  });
});

describe("a tell entered without attack-ready", () => {
  const bare: BehaviourTransition = { to: charge.to, when: [{ kind: "elapsed", seconds: 0 }] };

  it("is admitted while the same tell is under way", () => {
    expect(attackGate(holds, archie, underWay, bare)).toEqual({ admitted: true });
  });

  it.each(blocked)("is refused for %s", (reason, state) => {
    expect(attackGate(holds, archie, state, bare)).toEqual(refusal(reason));
  });
});

describe("Kiwi's continuing tell", () => {
  const states = Object.entries(kiwi.behaviour!.states);
  const [key, retell] = states.find(([, node]) => node.attack?.continues)!;
  const transition = states.flatMap(([, node]) => node.transitions).find(({ to }) => to === key)!;
  const attack = retell.attack!;

  it("is admitted with its own attack under way", () => {
    const state: AttackGateState = { activeAttack: { id: attack.id, phase: "committed" } };
    expect(attackGate(holds, kiwi, state, transition)).toEqual({ admitted: true });
  });

  it.each([
    ["no attack", {}],
    ["another attack", { activeAttack: { id: `not-${attack.id}`, phase: "committed" } }],
  ] as const)("is refused for outside-sequence with %s", (_, state) => {
    expect(attackGate(holds, kiwi, state, transition)).toEqual(refusal("outside-sequence"));
  });
});

it("admits a transition to a state outside any attack on its conditions alone", () => {
  const rest = Object.values(plan.states)
    .flatMap((node) => node.transitions)
    .find(({ to }) => !plan.states[to]!.attack)!;
  const state: AttackGateState = { ...blocked[0]![1], scorer: { sincePauseSeconds: 0 } };
  expect(attackGate(holds, archie, state, rest)).toEqual({ admitted: true });
  expect(attackGate(() => false, archie, state, rest)).toEqual(refusal("condition"));
});
