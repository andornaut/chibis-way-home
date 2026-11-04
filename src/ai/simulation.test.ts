import { expect, it } from "vitest";

import { simulate, type SimulationModel } from "./simulation";

// A walker that moves by its input and finishes past a wall.
const WALKER: SimulationModel<number, number, { readonly at: number; readonly tick: number }> = {
  begin: (at) => (at < 0 ? 0 : at),
  finished: (at) => at >= 5,
  sample: (tick, _, at) => ({ at, tick }),
  step: (seconds, input, at) => at + input * seconds,
};

it("steps at the fixed clock until the model finishes, with a replayable hash", () => {
  const run = simulate(
    { maxTicks: 100, stepSeconds: 1 },
    WALKER,
    (tick) => (tick === 0 ? -2 : 2),
    1,
  );
  expect(run.ticks.map(({ at }) => at)).toEqual([-1, 2, 4, 6]);
  expect(run.state).toBe(6);
  expect(run.hash).toMatch(/^[0-9a-f]{16}:4$/);
  const again = simulate(
    { maxTicks: 100, stepSeconds: 1 },
    WALKER,
    (tick) => (tick === 0 ? -2 : 2),
    1,
  );
  expect(again.hash).toBe(run.hash);
});

it("stops at the tick budget", () => {
  const run = simulate({ maxTicks: 3, stepSeconds: 0.5 }, WALKER, () => 1, 0);
  expect(run.ticks).toHaveLength(3);
  expect(run.state).toBe(1.5);
});
