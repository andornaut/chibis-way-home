import { describe, expect, it } from "vitest";

import { askedRecipe, askedSeed } from "./pageParams.ts";

describe("askedRecipe", () => {
  it.each([
    ["", undefined],
    ["?zone=park", "park"],
    ["?dev=1&zone=park", "park"],
  ])("reads %j as %s", (search, key) => {
    expect(askedRecipe(["park"], search)).toBe(key);
  });

  it.each(["?zone=alley", "?zone=2", "?zone="])("reports %j with the allowed keys", (search) => {
    expect(() => askedRecipe(["park", "street"], search)).toThrow("expected one of park, street");
  });
});

describe("askedSeed", () => {
  it.each([
    ["", undefined],
    ["?assembly=0", 0],
    ["?assembly=42", 42],
    ["?assembly=4294967295", 2 ** 32 - 1],
  ])("reads %j as %s", (search, seed) => {
    expect(askedSeed("assembly", search)).toBe(seed);
  });

  it.each(["?assembly=", "?assembly=4294967296", "?assembly=-1", "?assembly=1.5", "?assembly=one"])(
    "reports %j as out of range",
    (search) => {
      expect(() => askedSeed("assembly", search)).toThrow(
        `Invalid ${search}: expected a whole number from 0 to 4294967295`,
      );
    },
  );

  it("reads only its own parameter", () => {
    expect(askedSeed("seed", "?assembly=7&seed=9")).toBe(9);
    expect(askedSeed("seed", "?assembly=7")).toBeUndefined();
    expect(askedSeed("seed", "?assembly=x")).toBeUndefined();
  });
});
