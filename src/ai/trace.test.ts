import { type Random, randomStream } from "@andornaut/game-kit/random";
import { describe, expect, it } from "vitest";

import { canonicalTrace, fnv1a64, traceRecorder } from "./trace";

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
  const recorder = traceRecorder({ retain: true });
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
    const none = () => undefined;
    expect(canonicalTrace(none, { a: 1, b: undefined })).toBe(
      canonicalTrace(
        none,
        Object.fromEntries([
          ["b", undefined],
          ["a", 1],
        ]),
      ),
    );
    expect(canonicalTrace(none, 0.1 + 0.2)).not.toBe(canonicalTrace(none, 0.3));
    expect(canonicalTrace(none, -0)).not.toBe(canonicalTrace(none, 0));
  });

  it("tags non-JSON values apart from every string and treats holes as undefined", () => {
    const none = () => undefined;
    const tagged = [Infinity, -Infinity, NaN, undefined].map((value) =>
      canonicalTrace(none, [value]),
    );
    expect(new Set(tagged).size).toBe(4);
    for (const text of ["Infinity", "-Infinity", "NaN", "#NaN", "null"]) {
      expect(tagged).not.toContain(canonicalTrace(none, [text]));
    }
    expect(canonicalTrace(none, [undefined])).not.toBe(canonicalTrace(none, [null]));
    // eslint-disable-next-line no-sparse-arrays
    expect(canonicalTrace(none, [1, , 3])).toBe(canonicalTrace(none, [1, undefined, 3]));
  });

  it("hashes with FNV-1a 64 over UTF-8 bytes", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325");
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
    expect(fnv1a64("foobar")).toBe("85944171f73967e8");
    expect(fnv1a64("\u00e9")).toBe("0ac21707b7181e01");
    expect(fnv1a64("ab\u0800")).toBe("c255cd2ff071d90e");
    expect(fnv1a64("\u{1f600}")).toBe("feff073875020288");
    const recorder = traceRecorder({ retain: false });
    recorder.record("foobar");
    expect(recorder.hash()).toBe(`${fnv1a64("foobar\n")}:1`);
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
