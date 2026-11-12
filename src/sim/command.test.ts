import { describe, expect, it } from "vitest";

import { choiceOption, numberOption, parseOptions, UsageError } from "./command.ts";

const OPTIONS = { fast: { type: "boolean" }, move: { type: "string" } } as const;

describe("parseOptions", () => {
  it.each([
    [[], {}],
    [["--fast"], { fast: true }],
    [["--no-fast"], { fast: false }],
    [["--move=-1"], { move: "-1" }],
    [["-h"], { help: true }],
  ])("reads %j as %j", (args, values) => {
    expect(parseOptions(OPTIONS, args)).toEqual(values);
  });

  it.each([
    [["--fast", "true"], "Unexpected argument"],
    [["--slow"], "Unknown option"],
    [["--move"], "argument missing"],
    [["--move", "-1"], "ambiguous"],
    [["--move", " "], "--move needs a value"],
    [["--move", "1", "--move", "0"], "Repeated option --move"],
    [["--fast", "--no-fast"], "Repeated option --fast"],
  ])("rejects %j as a usage error", (args, message) => {
    const parse = () => parseOptions(OPTIONS, args);
    expect(parse).toThrow(UsageError);
    expect(parse).toThrow(message);
  });
});

it("names a rejected value and what is allowed", () => {
  expect(() => choiceOption("simulation profile", ["quick", "validation"], "fast")).toThrow(
    "Unknown simulation profile fast; allowed: quick, validation",
  );
  expect(() => numberOption("runs", "two")).toThrow("--runs takes a number, not two");
});
