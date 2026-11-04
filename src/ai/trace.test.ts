import { type Random, randomStream } from "@andornaut/game-kit/random";
import { describe, expect, it } from "vitest";

import { canonicalTrace, traceRecorder } from "./trace";

interface Walker {
  readonly decision: number;
  readonly heading: -1 | 1;
  readonly x: number;
}

// A synthetic agent: each tick it may reverse, drawing from a per-decision stream.
function stepWalker(streams: (key: string) => Random, walker: Walker): Walker {
  const random = streams(`turn:${walker.decision}`);
  const heading = random() < 0.2 ? (-walker.heading as -1 | 1) : walker.heading;
  return { decision: walker.decision + 1, heading, x: walker.x + heading * 0.25 };
}

function walkTrace(seed: number, ticks: number, perturbAt?: number) {
  const recorder = traceRecorder(true);
  const streams = (key: string) => randomStream(seed, `walker:${key}`);
  let walker: Walker = { decision: 0, heading: 1, x: 0 };
  for (let tick = 0; tick < ticks; tick++) {
    walker = stepWalker(streams, walker);
    if (tick === perturbAt) {
      walker = { ...walker, x: walker.x + 1e-9 };
    }
    recorder.record(canonicalTrace(() => undefined, { tick, walker }));
  }
  return recorder;
}

describe("agent trace", () => {
  it("hashes a replayed synthetic agent identically and a one-tick perturbation differently", () => {
    const first = walkTrace(7, 400);
    expect(walkTrace(7, 400).hash()).toBe(first.hash());
    expect(first.hash()).toMatch(/^[0-9a-f]{16}:400$/);
    const perturbed = walkTrace(7, 400, 250);
    expect(perturbed.hash()).not.toBe(first.hash());
    const divergence = first.lines()!.findIndex((line, tick) => perturbed.lines()![tick] !== line);
    expect(divergence).toBe(250);
    expect(walkTrace(8, 400).hash()).not.toBe(first.hash());
  });

  it("ignores key order and undefined members but keeps exact numbers", () => {
    expect(canonicalTrace(() => undefined, { a: 1, b: undefined, c: [undefined, -0] })).toBe(
      canonicalTrace(
        () => undefined,
        Object.fromEntries([
          ["c", [null, -0]],
          ["a", 1],
        ]),
      ),
    );
    expect(canonicalTrace(() => undefined, 0.1 + 0.2)).not.toBe(
      canonicalTrace(() => undefined, 0.3),
    );
    expect(canonicalTrace(() => undefined, -0)).not.toBe(canonicalTrace(() => undefined, 0));
  });

  it("names shared references and rejects cycles and opaque values", () => {
    const shared = { large: [1, 2, 3] };
    const reference = (value: object) => (value === shared ? "shared" : undefined);
    expect(canonicalTrace(reference, { one: shared, two: shared })).toBe(
      '{"one":@"shared","two":@"shared"}',
    );
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalTrace(() => undefined, cyclic)).toThrow("Cyclic");
    expect(() => canonicalTrace(() => undefined, { at: new Map() })).toThrow("class instance");
    expect(() => canonicalTrace(() => undefined, { step: () => 0 })).toThrow("function");
  });
});
