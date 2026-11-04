import { describe, expect, it } from "vitest";

import { type PlayHold, stepAction } from "./playHold";

describe("stepAction", () => {
  it.each<[PlayHold, boolean, ReturnType<typeof stepAction>]>([
    [undefined, false, "step"],
    [undefined, true, "leave"],
    ["door", false, "hold"],
    ["fade", false, "hold"],
    // Fading out of the ended zone, or faded out and waiting for the map: the scene must not
    // leave the zone again.
    ["fade", true, "hold"],
  ])("with play held for %s and the zone ended %s: %s", (hold, ended, action) => {
    expect(stepAction(hold, ended)).toBe(action);
  });
});
