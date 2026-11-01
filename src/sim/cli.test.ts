import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./catalogue", () => ({ stageLoader: vi.fn(() => () => ({})) }));
vi.mock("./report", () => ({ simulateBatch: vi.fn() }));

import { stageLoader } from "./catalogue";
import { simulationCli } from "./cli";
import { playabilityCli } from "./playabilityCli";
import { type BatchResult, simulateBatch } from "./report";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

it.each([
  { args: ["--build-id", "checked"], cli: simulationCli, name: "simulation" },
  { args: ["--seeds", "1", "--source", "checked"], cli: playabilityCli, name: "structural" },
])("preserves existing $name evidence before preparing any run", ({ args, cli }) => {
  const output = join(mkdtempSync(join(tmpdir(), "simulation-output-")), "report.json");
  writeFileSync(output, "immutable");
  expect(() => cli([...args, "--out", output])).toThrow("Output already exists");
  expect(readFileSync(output, "utf8")).toBe("immutable");
  expect(stageLoader).not.toHaveBeenCalled();
  expect(simulateBatch).not.toHaveBeenCalled();
});

it("refuses a simulation output created while the run was executing", () => {
  const output = join(mkdtempSync(join(tmpdir(), "simulation-race-")), "report.json");
  vi.mocked(simulateBatch).mockImplementation(() => {
    writeFileSync(output, "other report");
    return { validation: { fullPass: true } } as BatchResult;
  });
  expect(() => simulationCli(["--build-id", "checked", "--out", output])).toThrow("EEXIST");
  expect(readFileSync(output, "utf8")).toBe("other report");
});
