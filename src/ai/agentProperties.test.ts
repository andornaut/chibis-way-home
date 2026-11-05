import { expect, it } from "vitest";

import {
  attackCadence,
  cooldownHonoured,
  escapeAtDistance,
  noStall,
  type Property,
  singleCommittedAttack,
  tellCancelPause,
  tellPrecedesCommit,
  tellResolves,
  travelBounded,
} from "./agentProperties";
import type { AgentSample, AgentTick, TraceAttack } from "./agentTrace";

const STEP = 0.25;

const agent = (x: number, attack?: TraceAttack, extra: Partial<AgentSample> = {}): AgentSample => ({
  at: { x, y: 0 },
  ...(attack && { attack }),
  facing: 1,
  footing: true,
  height: 1,
  id: "a",
  kind: "k",
  motion: "pursue",
  pursuit: "engaged",
  state: "s",
  supported: true,
  width: 1,
  ...extra,
});

const trace = (agents: readonly AgentSample[], targetX = 100): AgentTick[] =>
  agents.map((sample, tick) => ({
    agents: [sample],
    episode: 0,
    seconds: tick * STEP,
    target: {
      at: { x: targetX, y: 0 },
      grounded: true,
      height: 1,
      velocity: { x: 0, y: 0 },
      width: 1,
    },
    tick,
    world: undefined,
  }));

const TELL: TraceAttack = { id: "charge", phase: "tell" };
const COMMITTED: TraceAttack = { id: "charge", phase: "committed" };
const ticksOf = (property: Property<AgentTick>, ticks: AgentTick[]) =>
  property.check(ticks).map(({ tick }) => tick);

it.each([
  ["a full tell", [undefined, TELL, TELL, TELL, COMMITTED], []],
  ["a short tell", [undefined, TELL, COMMITTED], [2]],
  ["a commit without a tell", [undefined, COMMITTED], [1]],
] as const)("tell before commit: %s", (_, attacks, flagged) => {
  const property = tellPrecedesCommit("rule", STEP, () => 1);
  expect(ticksOf(property, trace(attacks.map((attack) => agent(0, attack))))).toEqual(flagged);
});

it.each([
  ["after the cooldown", 11, []],
  ["inside the cooldown", 6, [6]],
] as const)("cooldown: a tell %s", (_, tellTick, flagged) => {
  const samples = Array.from({ length: 12 }, (_, tick) =>
    tick === 0
      ? agent(0, COMMITTED)
      : agent(0, tick === tellTick ? TELL : undefined, {
          cooldownSeconds: Math.max(0, 2.5 - tick * STEP),
        }),
  );
  const property = cooldownHonoured("rule", STEP, () => 2.5);
  expect(ticksOf(property, trace(samples))).toEqual(flagged);
});

it("flags a stall once per stationary run and not a moving pursuit", () => {
  const property = noStall(
    "rule",
    STEP,
    1,
    () => 0.5,
    () => true,
  );
  const still = Array.from({ length: 10 }, () => agent(3));
  const moving = Array.from({ length: 10 }, (_, tick) => agent(tick));
  expect(ticksOf(property, trace(still))).toEqual([0]);
  expect(ticksOf(property, trace(moving))).toEqual([]);
});

it("requires escape exactly beyond the distance at the start of the step", () => {
  const property = escapeAtDistance("rule", () => 10);
  const late = [agent(0), agent(0)];
  const early = [agent(95), agent(95, undefined, { pursuit: "escaped" })];
  expect(ticksOf(property, trace(late, 20))).toEqual([1]);
  expect(ticksOf(property, trace(early))).toEqual([1]);
});

it.each([
  ["regular tells", [4, 9], () => true, []],
  ["no tell", [], () => true, [6]],
  ["no tell with ineligible time paused", [], (tick: number) => tick % 2 === 0, [12]],
] as const)("attack cadence: %s", (_, tells, eligible, flagged) => {
  const property = attackCadence(
    "cadence",
    "rule",
    STEP,
    1.5,
    () => true,
    ({ tick }) => eligible(tick),
  );
  const samples = Array.from({ length: 14 }, (_, tick) =>
    agent(0, (tells as readonly number[]).includes(tick) ? TELL : undefined),
  );
  expect(ticksOf(property, trace(samples))).toEqual(flagged);
});

it.each([
  ["within the limit", [0, 1, 2, 3, 3], 1, []],
  ["past the limit", [0, 1, 2, 3, 4, 5], 1, [4]],
  ["against its heading", [0, -1], 1, [1]],
  ["leftwards within the limit", [0, -1, -3], -1, []],
] as const)("travel bound: a stay %s", (_, xs, facing, flagged) => {
  const property = travelBounded("rule", ({ state }) => (state === "slide" ? 3 : undefined));
  const samples = [
    agent(-50, undefined, { state: "rush" }),
    ...xs.map((x) => agent(x, undefined, { facing, state: "slide" })),
  ];
  expect(ticksOf(property, trace(samples)).map((tick) => tick - 1)).toEqual(flagged);
});

const OTHER_TELL: TraceAttack = { id: "pounce", phase: "tell" };
const RETELL: TraceAttack = { continues: true, id: "charge", phase: "tell" };
type Sample = TraceAttack | "escaped" | "cooldown" | undefined;
const samplesOf = (attacks: readonly Sample[]) =>
  attacks.map((attack) =>
    attack === "escaped"
      ? agent(0, undefined, { pursuit: "escaped" })
      : attack === "cooldown"
        ? agent(0, undefined, { cooldownSeconds: 2.5 })
        : agent(0, attack),
  );

it.each([
  [
    "a tell after the pause",
    [undefined, TELL, undefined, TELL, undefined, undefined, undefined, TELL],
    [],
  ],
  ["a tell inside the pause", [undefined, TELL, undefined, TELL, undefined, undefined, TELL], [6]],
  [
    "a commit between cancels",
    [undefined, TELL, undefined, TELL, COMMITTED, "cooldown", TELL, undefined, TELL],
    [],
  ],
  [
    "an escape between cancels",
    [undefined, TELL, undefined, "escaped", undefined, TELL, undefined, TELL],
    [],
  ],
  ["a cancel into another tell", [undefined, TELL, undefined, TELL, OTHER_TELL], [4]],
  [
    "a continuing tell that ends",
    [undefined, TELL, COMMITTED, RETELL, undefined, TELL, undefined, TELL],
    [],
  ],
] as const)("tell cancel pause: %s", (_, attacks, flagged) => {
  const property = tellCancelPause("rule", STEP, () => ({ cancels: 2, seconds: 1 }));
  expect(ticksOf(property, trace(samplesOf(attacks)))).toEqual(flagged);
});

it.each([
  ["its own commit", [TELL, COMMITTED], []],
  ["a cancel and another tell in one tick", [TELL, OTHER_TELL], []],
  ["another attack's action", [TELL, { id: "pounce", phase: "committed" }], [1]],
] as const)("tell resolves: %s", (_, attacks, flagged) => {
  expect(ticksOf(tellResolves("rule"), trace(samplesOf(attacks)))).toEqual(flagged);
});

it.each([
  ["its own continuing tell", [TELL, COMMITTED, RETELL, COMMITTED], []],
  ["a fresh tell", [TELL, COMMITTED, TELL], [2]],
] as const)("single committed attack through %s", (_, attacks, flagged) => {
  expect(ticksOf(singleCommittedAttack("rule"), trace(samplesOf(attacks)))).toEqual(flagged);
});
