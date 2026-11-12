import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird.ts";
import { REACH } from "../data/reach.ts";
import { TILE } from "../data/screen.ts";
import { measureReaches } from "./reach.ts";

const MEASURED = measureReaches(BIRD, TILE);

describe("measureReaches", () => {
  it(`measures gap ${MEASURED.gap}, hop ${MEASURED.hop} and jump ${MEASURED.jump}, as reach.ts sets them`, () => {
    expect(MEASURED).toEqual(REACH);
  });
});
