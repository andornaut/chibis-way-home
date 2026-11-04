import { describe, expect, it } from "vitest";

import { askedAssemblySeed, askedRecipe } from "./pageParams";

describe("askedRecipe", () => {
  it.each([
    ["", undefined],
    ["?zone=park", "park"],
    ["?dev=1&zone=park", "park"],
    ["?zone=alley", undefined],
    ["?zone=2", undefined],
  ])("reads %j as %s", (search, key) => {
    expect(askedRecipe(["park"], search)).toBe(key);
  });
});

describe("askedAssemblySeed", () => {
  it.each([
    ["", undefined],
    ["?assembly=", undefined],
    ["?assembly=0", 0],
    ["?assembly=42", 42],
    ["?assembly=4294967295", 2 ** 32 - 1],
    ["?assembly=4294967296", undefined],
    ["?assembly=-1", undefined],
    ["?assembly=1.5", undefined],
    ["?assembly=one", undefined],
  ])("reads %j as %s", (search, seed) => {
    expect(askedAssemblySeed(search)).toBe(seed);
  });
});
