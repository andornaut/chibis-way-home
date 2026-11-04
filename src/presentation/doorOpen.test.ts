import { describe, expect, it } from "vitest";

import { doorPhase } from "./doorOpen";

// The park gate's open tag: 4 frames at 80 ms.
const GATE_MS = 320;

describe("doorPhase", () => {
  it.each<[string, number | undefined, number, ReturnType<typeof doorPhase>]>([
    ["a door without an open tag, at once", undefined, 0, "room"],
    ["the gate as Use goes down", GATE_MS, 0, "opening"],
    ["the gate on its last frame", GATE_MS, GATE_MS - 1, "opening"],
    ["the gate once its tag has run", GATE_MS, GATE_MS, "room"],
    ["the gate long after", GATE_MS, 5000, "room"],
  ])("shows %s: %s", (_, openMs, sinceMs, phase) => {
    expect(doorPhase(openMs, sinceMs)).toBe(phase);
  });
});
