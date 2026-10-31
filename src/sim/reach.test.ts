import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { REACH } from "../data/reach";
import { TILE } from "../data/screen";
import { measureReaches } from "./reach";

const MEASURED = measureReaches(BIRD, TILE);

describe("measureReaches", () => {
  it(`measures gap ${MEASURED.gap}, hop ${MEASURED.hop} and jump ${MEASURED.jump}, as reach.ts sets them`, () => {
    expect(MEASURED).toEqual(REACH);
  });
});
