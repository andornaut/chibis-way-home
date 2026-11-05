import { describe, expect, it } from "vitest";

import type { BehaviourState } from "./behaviour";
import { defeatBoss } from "./bossDefeat";
import type { ZoneState } from "./zone";
import { zoneStepRecord } from "./zoneRecords";

const pursuit = (phase: "engaged" | "escaped") =>
  ({ pursuit: { phase, settled: false, unreachableSeconds: 0 } }) as BehaviourState;
const DASH = { airUsed: false, cooldownRemainingSeconds: 0, direction: 1 as const, ordinaryVx: 0 };
const state = (
  behaviours: readonly (BehaviourState | undefined)[],
  bird: Partial<ZoneState["bird"]> = {},
  fields: Partial<ZoneState> = {},
): ZoneState =>
  ({
    area: "main",
    behaviours,
    bird: { airJumpUsed: false, dash: { ...DASH, remainingSeconds: 0 }, ...bird },
    death: undefined,
    ...fields,
  }) as ZoneState;
const DEATH = {
  position: { x: 0, y: 0 },
  reason: "hazard",
  support: undefined,
  velocity: { x: 0, y: 0 },
} as unknown as ZoneState["death"];

describe("what a live step does for the achievement records", () => {
  it.each<[string, ZoneState, ZoneState, readonly number[]]>([
    [
      "an engaged boss escapes",
      state([undefined, pursuit("engaged")]),
      state([undefined, pursuit("escaped")]),
      [1],
    ],
    ["a boss stays escaped", state([pursuit("escaped")]), state([pursuit("escaped")]), []],
    [
      "a boss acquires straight into escape",
      state([{} as BehaviourState]),
      state([pursuit("escaped")]),
      [],
    ],
    [
      "a boss escapes on the step he dies",
      state([pursuit("engaged")]),
      state([pursuit("escaped")], {}, { death: DEATH }),
      [],
    ],
    [
      "a boss dies, which ends its pursuit without an escape",
      state([pursuit("engaged")]),
      state([defeatBoss(pursuit("engaged"))]),
      [],
    ],
    [
      "he walks into another area",
      state([pursuit("engaged")]),
      state([pursuit("escaped")], {}, { area: "upper" }),
      [],
    ],
  ])("counts escapes when %s", (_, before, after, escaped) => {
    expect(zoneStepRecord(before, after).escaped).toEqual(escaped);
  });

  it.each<[string, Partial<ZoneState["bird"]>, Partial<ZoneState["bird"]>, boolean]>([
    ["a dash starts", {}, { dash: { ...DASH, remainingSeconds: 0.2 } }, true],
    [
      "a dash goes on",
      { dash: { ...DASH, remainingSeconds: 0.2 } },
      { dash: { ...DASH, remainingSeconds: 0.18 } },
      false,
    ],
    ["the air jump is used", {}, { airJumpUsed: true }, true],
    ["the air jump stays used", { airJumpUsed: true }, { airJumpUsed: true }, false],
    ["he only walks", {}, {}, false],
    ["he has no dash", { dash: undefined }, { dash: undefined }, false],
  ])("counts skill use when %s", (_, before, after, used) => {
    expect(zoneStepRecord(state([], before), state([], after)).skillUsed).toBe(used);
  });

  it("counts a skill used on the step he dies", () => {
    const after = state([], { airJumpUsed: true }, { death: DEATH });
    expect(zoneStepRecord(state([]), after)).toEqual({ escaped: [], skillUsed: true });
  });
});
