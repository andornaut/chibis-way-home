import { expect, it } from "vitest";

import {
  attackCadence,
  cooldownHonoured,
  escapeAtDistance,
  noStall,
  type Property,
  tellPrecedesCommit,
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
