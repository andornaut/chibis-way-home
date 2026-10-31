import { describe, expect, it } from "vitest";

import { landingCorridor, phaseCount, phaseStarts } from "./walkPhases";

const local = { cycleSteps: 120, index: 1, left: 100, right: 140 };
const remote = { cycleSteps: 960, index: 2, left: 9000, right: 9100 };

describe("local walk phases", () => {
  it.each([
    { count: 1, movers: [remote], name: "remote cycle", required: [] },
    {
      count: 5,
      movers: [local, remote],
      name: "local cycle with a longer remote cycle",
      required: [],
    },
    {
      count: 33,
      movers: [local, remote],
      name: "required moving support",
      required: [remote.index],
    },
  ])("uses $name without waiting for unrelated movers", ({ count, movers, required }) => {
    const corridor = landingCorridor(20, 120, [200, 220], { left: -10000, right: 10000 });
    expect(corridor).toEqual({ left: 80, right: 360 });
    expect(phaseCount(30, 0, required, movers, corridor)).toBe(count);
  });

  it("extends exact cached states and never resamples an exhausted wait", () => {
    const initial = { phase: 0 };
    let calls = 0;
    const starts = phaseStarts((previous: { phase: number }) => {
      calls++;
      return previous.phase === 3 ? undefined : { phase: previous.phase + 1 };
    }, initial);
    const first = starts(3);
    expect(starts(1)[0]).toBe(initial);
    expect(calls).toBe(2);
    const extended = starts(6);
    expect(extended.map(({ phase }) => phase)).toEqual([0, 1, 2, 3]);
    expect(extended[1]).toBe(first[1]);
    expect(starts(33)).toEqual(extended);
    expect(calls).toBe(4);
  });
});
