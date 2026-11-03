import { expect, it } from "vitest";

import type { ForcedTransitLayout, ForcedTransitLayoutWindow } from "../data/types";
import { type ForcedTransitState, stepForcedTransit } from "./forcedTransit";

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
const grounded = {
  bank: { group: transit.group, id: "near" },
  grounded: true,
  ordinaryControl: true,
  riderBodyOrigin: { x: 0, y: 0 },
  safeDisembark: true,
};
function aboard(contract: ForcedTransitLayout, x: number, previous?: ForcedTransitState) {
  return stepForcedTransit(
    {
      grounded: true,
      ordinaryControl: true,
      riderBodyOrigin: { x, y: 0 },
      support: {
        index: 7,
        ordinaryTakeoffOrigin: { x, y: 36 },
        origin: { x, y: 36 },
        transit: contract,
      },
    },
    previous,
  );
}
function forced() {
  return aboard(transit, 1, aboard(transit, 0, stepForcedTransit(grounded)));
}

it("leaves boarding unprotected and defers only after certified departure", () => {
  const boarding = aboard(transit, 0, stepForcedTransit(grounded));
  expect(boarding.attackWindow).toBe("allowed");
  expect(boarding.episode?.phase).toBe("boarding");
  const departed = aboard(transit, 1, boarding);
  expect(departed.attackWindow).toBe("deferred");
  expect(departed.episode?.phase).toBe("forced");
});

it.each([2, 4])("spends the episode at forward/refuge opportunity%s while still aboard", (x) => {
  const spent = aboard(transit, x, forced());
  expect(spent.attackWindow).toBe("allowed");
  expect(spent.episode?.phase).toBe("spent");
  expect(aboard(transit, 1, spent)).toEqual(spent);
  expect(aboard(transit, 5, spent)).toEqual(spent);
});

it("does not treat retreat alone as forward egress", () => {
  const retreat = aboard(transit, 3, forced());
  expect(retreat.attackWindow).toBe("unknown");
  expect(retreat.episode?.phase).toBe("forced");
});

it("keeps unmatched and uncertified windows unknown", () => {
  expect(aboard(transit, 5, forced()).attackWindow).toBe("unknown");
  expect(aboard(transit, 9, forced()).attackWindow).toBe("unknown");
  expect(aboard(transit, 1).attackWindow).toBe("unknown");
});

it("cannot rearm by hopping or transferring without safe disembark", () => {
  const spent = aboard(transit, 2, forced());
  const airborne = stepForcedTransit(
    { grounded: false, ordinaryControl: false, riderBodyOrigin: { x: 1, y: -1 } },
    spent,
  );
  expect(aboard(transit, 1, airborne)).toEqual(spent);
  const transferred = aboard({ ...transit, leg: "next" }, 1, spent);
  expect(transferred).toEqual(spent);
});

it("requires actual safe supported disembark before a fresh leg", () => {
  const spent = aboard(transit, 2, forced());
  const falseLanding = stepForcedTransit({ ...grounded, grounded: false }, spent);
  expect(falseLanding.episode?.phase).toBe("spent");
  const landed = stepForcedTransit(grounded, spent);
  expect(landed.episode).toBeUndefined();
  expect(aboard(transit, 1, landed).attackWindow).toBe("deferred");
});

it("allows ordinary nonopt-in targets without inventing a ride episode", () => {
  const ordinary = stepForcedTransit({
    grounded: false,
    ordinaryControl: false,
    riderBodyOrigin: { x: 0, y: 0 },
  });
  expect(ordinary).toEqual({ attackWindow: "allowed" });
});

it("keeps nonordinary controls unknown without rearming a spent episode", () => {
  const observation = {
    grounded: true,
    ordinaryControl: false,
    riderBodyOrigin: { x: 2, y: 0 },
    support: { index: 7, ordinaryTakeoffOrigin: { x: 2, y: 36 }, origin: { x: 2, y: 36 }, transit },
  };
  expect(stepForcedTransit(observation, forced()).attackWindow).toBe("unknown");
  const spent = aboard(transit, 2, forced());
  expect(stepForcedTransit(observation, spent)).toEqual(spent);
});
