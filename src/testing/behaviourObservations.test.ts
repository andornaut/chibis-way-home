import { expect, it } from "vitest";

import { createBehaviourObservations } from "./behaviourObservations.ts";

it("reports only measured counters and retains stable reports", () => {
  const observations = createBehaviourObservations();
  const before = observations.report();
  observations.observer.record({ amount: 2, kind: "work", metric: "map_search_calls" });
  observations.observer.record({ amount: 1, kind: "work", metric: "map_search_calls" });
  observations.observer.record({ amount: 0, kind: "work", metric: "route_cache_hits" });
  expect(before.work.map_search_calls).toEqual({ status: "not_evaluated" });
  expect(before.diagnostics.recordedEvents).toBe(0);
  const after = observations.report();
  expect(after.work.map_search_calls).toEqual({ status: "captured", value: 3 });
  expect(after.work.route_cache_hits).toEqual({ status: "captured", value: 0 });
  expect(after.work.traversal_steps).toEqual({ status: "not_evaluated" });
  expect(after.diagnostics).toEqual({ deliveryFailures: [], recordedEvents: 3 });
  expect(after).not.toHaveProperty("observations");
});

it("surfaces invalid diagnostic work through the actual report without counting it", () => {
  const observations = createBehaviourObservations({ retain: true });
  observations.observer.record({ amount: -1, kind: "work", metric: "traversal_steps" });
  observations.observer.record({ amount: 1, kind: "work", metric: "simulation_ticks" });
  const report = observations.report();
  expect(report.diagnostics.deliveryFailures).toEqual([
    { eventKind: "work", message: "Behaviour work amount must be a nonnegative safe integer" },
  ]);
  expect(report.diagnostics.recordedEvents).toBe(1);
  expect(report.work.traversal_steps).toEqual({ status: "not_evaluated" });
  expect(report.observations).toEqual([{ amount: 1, kind: "work", metric: "simulation_ticks" }]);
});

it("keeps an actual scorer choice separate from the preceding pursuit snapshot", () => {
  const observations = createBehaviourObservations({ retain: true });
  const choice = {
    action: "close",
    choice: "move",
    kind: "choice",
    scoring: {
      decision: {
        action: "move:close",
        reason: "best",
        scores: [{ action: "move:close", score: 1 }],
      },
      sampledHoldSeconds: 0.75,
      streamKey: "scorer:0",
      values: {
        distance: 48,
        heightDelta: 0,
        heightGap: 0,
        horizontalGap: 4,
        lineOfSight: 1,
        specialDueSeconds: 0,
        targetSpeed: 0,
        threatSeconds: 0,
      },
    },
    state: "pursuit",
  } as const;
  observations.observer.record(choice);
  const report = observations.report();
  expect(report.lastChoice).toEqual(choice);
  Object.assign(choice.scoring.values, { horizontalGap: 8 });
  Object.assign(choice.scoring.decision.scores[0], { score: 0 });
  expect(report.lastChoice?.scoring.values.horizontalGap).toBe(4);
  expect(report.lastChoice?.scoring.decision.scores[0]?.score).toBe(1);
  expect(Object.isFrozen(report.lastChoice?.scoring.decision.scores[0])).toBe(true);
  expect(report).not.toHaveProperty("lastPursuit");
  expect(report.work.map_search_calls).toEqual({ status: "not_evaluated" });
});
