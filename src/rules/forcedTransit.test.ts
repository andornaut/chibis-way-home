import { expect, it } from "vitest";

import type { ForcedTransitLayout, ForcedTransitLayoutWindow } from "../data/types";
import {
  forcedTransitBankAdmissions,
  type ForcedTransitObservation,
  type ForcedTransitState,
  stepForcedTransit,
} from "./forcedTransit";

const window = (
  certification: ForcedTransitLayoutWindow["certification"],
  x: number,
  result: ForcedTransitLayoutWindow["result"],
): ForcedTransitLayoutWindow => ({
  certification,
  result,
  riderOnSupport: { x: [0, 0], y: [-36, -36] },
  supportOrigin: { x: [x, x], y: [36, 36] },
});
const transit: ForcedTransitLayout = {
  banks: [
    { id: "near", purpose: "retreat", width: 72, x: 0, y: 36 },
    { id: "far", purpose: "forward", width: 72, x: 200, y: 36 },
    { id: "refuge", purpose: "refuge", width: 72, x: 100, y: 36 },
  ],
  boardingBanks: ["near"],
  group: "chunk0:crossing",
  leg: "forward",
  windows: [
    window("ordinary", 0, { bankId: "near", kind: "egress" }),
    window("ordinary", 1, { kind: "forced" }),
    window("ordinary", 2, { bankId: "far", kind: "egress" }),
    window("ordinary", 3, { bankId: "near", kind: "egress" }),
    window("ordinary", 4, { bankId: "refuge", kind: "egress" }),
    window("uncertified", 5, { bankId: "far", kind: "egress" }),
  ],
};
// A second ride whose boarding bank is the first ride's forward bank.
const second: ForcedTransitLayout = {
  ...transit,
  banks: [
    { id: "middle", purpose: "retreat", width: 72, x: 200, y: 36 },
    { id: "end", purpose: "forward", width: 72, x: 400, y: 36 },
  ],
  boardingBanks: ["middle"],
  group: "chunk1:crossing",
  windows: [window("ordinary", 1, { kind: "forced" })],
};
const ground = (
  bankAdmissions: ForcedTransitObservation["bankAdmissions"],
): ForcedTransitObservation => ({
  bankAdmissions,
  grounded: true,
  ordinaryControl: true,
  riderBodyOrigin: { x: 0, y: 0 },
  safeGround: true,
});
const nearBank = ground([{ group: transit.group, id: "near" }]);
const airborne: ForcedTransitObservation = {
  bankAdmissions: [],
  grounded: false,
  ordinaryControl: false,
  riderBodyOrigin: { x: 1, y: -1 },
  safeGround: false,
};
function aboard(
  contract: ForcedTransitLayout,
  x: number,
  previous?: ForcedTransitState,
  straddle: Partial<ForcedTransitObservation> = {},
) {
  return stepForcedTransit(
    {
      bankAdmissions: [],
      grounded: true,
      ordinaryControl: true,
      riderBodyOrigin: { x, y: 0 },
      safeGround: false,
      ...straddle,
      support: {
        index: 7,
        ordinaryJumpApexFeetY: 0,
        ordinaryTakeoffOrigin: { x, y: 36 },
        origin: { x, y: 36 },
        transit: contract,
      },
    },
    previous,
  );
}
function forced() {
  return aboard(transit, 1, aboard(transit, 0, stepForcedTransit(nearBank)));
}

it("leaves boarding unprotected and defers only after certified departure", () => {
  const boarding = aboard(transit, 0, stepForcedTransit(nearBank));
  expect(boarding.attackWindow).toBe("allowed");
  expect(boarding.episode?.phase).toBe("boarding");
  const departed = aboard(transit, 1, boarding);
  expect(departed).toMatchObject({ attackWindow: "deferred", evidence: "certified" });
  expect(departed.episode?.phase).toBe("forced");
});

it.each([
  ["unlisted ground", ground([])],
  ["another group's bank", ground([{ group: second.group, id: "near" }])],
  ["an unlisted bank", ground([{ group: transit.group, id: "refuge" }])],
])("follows ordinary attack rules after boarding from %s", (_, origin) => {
  const boarding = aboard(transit, 0, stepForcedTransit(origin));
  expect(boarding.episode?.boardingBank).toBeUndefined();
  expect(aboard(transit, 1, boarding).attackWindow).toBe("allowed");
});

it.each([2, 4])("spends the episode at forward/refuge opportunity %s while still aboard", (x) => {
  const spent = aboard(transit, x, forced());
  expect(spent.attackWindow).toBe("allowed");
  expect(spent.episode?.phase).toBe("spent");
  expect(aboard(transit, 1, spent)).toEqual(spent);
  expect(aboard(transit, 5, spent)).toEqual(spent);
});

it("keeps deferral through a retreat opportunity and airborne retreat", () => {
  const retreat = aboard(transit, 3, forced());
  expect(retreat).toMatchObject({ attackWindow: "deferred", evidence: "unknown" });
  expect(retreat.episode?.phase).toBe("forced");
  expect(stepForcedTransit(airborne, retreat).attackWindow).toBe("deferred");
});

it("follows the last certified state while ride state is unknown", () => {
  for (const x of [5, 9]) {
    expect(aboard(transit, x, forced())).toMatchObject({
      attackWindow: "deferred",
      evidence: "unknown",
    });
  }
  const boarding = aboard(transit, 0, stepForcedTransit(nearBank));
  expect(aboard(transit, 9, boarding)).toMatchObject({
    attackWindow: "allowed",
    evidence: "unknown",
  });
});

it("ends the protected leg on any safe grounded surface, authored bank or not", () => {
  for (const previous of [forced(), aboard(transit, 2, forced())]) {
    const landed = stepForcedTransit(ground([]), previous);
    expect(landed).toEqual({ attackWindow: "allowed", evidence: "certified" });
    expect(stepForcedTransit(airborne, landed)).toEqual(landed);
    expect(aboard(transit, 1, aboard(transit, 0, landed)).attackWindow).toBe("allowed");
  }
  expect(stepForcedTransit({ ...nearBank, grounded: false }, forced()).episode?.phase).toBe(
    "forced",
  );
});

it("ends the protected leg on safe ground straddled while the ride still supports her", () => {
  const bank = [{ group: transit.group, id: "near" }];
  expect(aboard(transit, 1, forced(), { bankAdmissions: bank, safeGround: true })).toEqual({
    attackWindow: "allowed",
    boardingAdmissions: bank,
    evidence: "certified",
  });
  expect(aboard(transit, 1, forced()).attackWindow).toBe("deferred");
});

it("keeps deferral through a direct hop onto another ride until safe ground", () => {
  const exits: ForcedTransitLayout = {
    ...second,
    windows: [window("ordinary", 2, { bankId: "end", kind: "egress" })],
  };
  const hopped = aboard(exits, 2, stepForcedTransit(airborne, forced()));
  expect(hopped).toMatchObject({ attackWindow: "deferred", evidence: "unknown" });
  expect(hopped.episode).toMatchObject({ group: transit.group, phase: "forced" });
  expect(stepForcedTransit(ground([]), hopped).attackWindow).toBe("allowed");
});

it("starts a fresh leg after re-boarding from a listed bank", () => {
  const landed = stepForcedTransit(nearBank, aboard(transit, 2, forced()));
  expect(landed.episode).toBeUndefined();
  expect(aboard(transit, 1, landed).attackWindow).toBe("deferred");
});

it("lets one safe middle bank admit the next ride's fresh leg", () => {
  const middle = ground([
    { group: transit.group, id: "far" },
    { group: second.group, id: "middle" },
  ]);
  const landed = stepForcedTransit(middle, aboard(transit, 2, forced()));
  expect(landed.boardingAdmissions).toEqual(middle.bankAdmissions);
  const fresh = aboard(second, 1, landed);
  expect(fresh).toMatchObject({ attackWindow: "deferred", evidence: "certified" });
  expect(fresh.episode).toMatchObject({ boardingBank: "middle", group: second.group });
});

it("never re-arms protection by hopping directly between rides", () => {
  const spent = aboard(transit, 2, forced());
  expect(aboard(transit, 1, stepForcedTransit(airborne, spent))).toEqual(spent);
  expect(aboard(second, 1, stepForcedTransit(airborne, spent))).toEqual(spent);
  expect(aboard({ ...transit, leg: "next" }, 1, spent)).toEqual(spent);
  const boarding = aboard(transit, 0, stepForcedTransit(nearBank));
  expect(aboard(second, 1, boarding).attackWindow).toBe("allowed");
});

it("allows ordinary nonopt-in targets without inventing a ride episode", () => {
  expect(stepForcedTransit(airborne)).toEqual({ attackWindow: "allowed", evidence: "certified" });
});

it("keeps nonordinary controls unknown without rearming a spent episode", () => {
  const observation = {
    bankAdmissions: [],
    grounded: true,
    ordinaryControl: false,
    riderBodyOrigin: { x: 2, y: 0 },
    safeGround: false,
    support: {
      index: 7,
      ordinaryJumpApexFeetY: 0,
      ordinaryTakeoffOrigin: { x: 2, y: 36 },
      origin: { x: 2, y: 36 },
      transit,
    },
  };
  expect(stepForcedTransit(observation, forced())).toMatchObject({
    attackWindow: "deferred",
    evidence: "unknown",
  });
  const spent = aboard(transit, 2, forced());
  expect(stepForcedTransit(observation, spent)).toEqual(spent);
});

it("filters certified egress when native apex evidence is absent or below the bank", () => {
  const observation = {
    bankAdmissions: [],
    grounded: true,
    ordinaryControl: true,
    riderBodyOrigin: { x: 2, y: 0 },
    safeGround: false,
    support: {
      index: 7,
      ordinaryJumpApexFeetY: 36,
      ordinaryTakeoffOrigin: { x: 2, y: 36 },
      origin: { x: 2, y: 36 },
      transit,
    },
  };
  for (const apex of [undefined, Infinity, 36.001]) {
    expect(
      stepForcedTransit(
        { ...observation, support: { ...observation.support, ordinaryJumpApexFeetY: apex } },
        forced(),
      ),
    ).toMatchObject({ attackWindow: "deferred", evidence: "unknown" });
  }
  expect(stepForcedTransit(observation, forced()).episode?.phase).toBe("spent");
});

it("admits every touched bank once per group, including partial footing", () => {
  const twin = { ...transit, banks: [transit.banks[0]!, transit.banks[0]!] };
  const feet = (x: number, bottom: number) => ({ height: 36, width: 24, x, y: bottom - 36 });
  expect(forcedTransitBankAdmissions([transit, twin, second], feet(60, 36))).toEqual([
    { group: transit.group, id: "near" },
  ]);
  expect(forcedTransitBankAdmissions([transit, second], feet(250, 36))).toEqual([
    { group: transit.group, id: "far" },
    { group: second.group, id: "middle" },
  ]);
  expect(forcedTransitBankAdmissions([transit], feet(72, 36))).toEqual([]);
  expect(forcedTransitBankAdmissions([transit], feet(30, 37))).toEqual([]);
});
