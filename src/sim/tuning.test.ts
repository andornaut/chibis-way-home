import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { PlayabilityReport } from "./playability";
import {
  assessTuning,
  formatTuningCsv,
  formatTuningMarkdown,
  type SavedTuningCase,
} from "./tuning";
import { tuningCli, writeTuningOutputs } from "./tuningCli";

function fixture(): { structural: PlayabilityReport; saved: SavedTuningCase } {
  const chunks = ["a", "b"].map((id, col) => ({
    area: "main",
    cap: false,
    col,
    cols: 1,
    difficulty: 3,
    encounters: 0,
    id,
    mechanics: [id === "a" ? "lift" : "gap"],
  }));
  const structural = {
    comparisons: [],
    provenance: { data: "structural-hash", source: "commit" },
    stages: [{ chunks, id: "stage", seed: 1, zone: "zone" }],
  } as unknown as PlayabilityReport;
  const run = {
    config: { policy: { move: 1 } },
    coverage: {
      path: [
        { area: "main", attempt: 0, chunk: 0, chunkId: "a", tick: 0 },
        { area: "main", attempt: 0, chunk: 1, chunkId: "b", tick: 3 },
        { area: "main", attempt: 1, chunk: 0, chunkId: "a", tick: 5 },
      ],
    },
    deaths: 1,
    failures: [
      {
        area: "main",
        attempt: 0,
        chunk: 1,
        chunkId: "b",
        deathReason: "hazard",
        tick: 5,
        x: 12,
        y: 24,
      },
    ],
    fullPass: true,
    provenance: { build: "commit", data: "runtime-hash" },
    retries: 1,
    seeds: { bot: 3, layout: 1, motion: 2 },
    status: "cleared",
    steps: 8,
    witness: {
      capturedTicks: 8,
      config: { policy: { move: 1 } },
      contextHash: "layout-hash",
      finalArea: "main",
      provenance: { build: "commit", data: "runtime-hash" },
      retries: 1,
      seeds: { bot: 3, layout: 1, motion: 2 },
      segments: [
        { attempt: 0, input: { jumpHeld: true, move: 1 }, ticks: 3 },
        { attempt: 0, input: { jumpHeld: true, move: -1 }, ticks: 2 },
        { attempt: 1, input: { jumpHeld: true, move: 0 }, ticks: 3 },
      ],
      steps: 8,
      truncated: false,
    },
  } as unknown as SavedTuningCase["run"];
  return { saved: { run, sourceCommit: "commit", stage: "stage" }, structural };
}
describe("saved tuning assessment", () => {
  it("partitions recorded residence across revisits and retries and counts input edges", () => {
    const { saved, structural } = fixture();
    const report = assessTuning({ structural }, [saved]);
    const stage = report.stages[0]!;
    expect(stage.recordedResidence.map((visit) => visit.recordedResidenceTicks)).toEqual([3, 2, 3]);
    expect(stage.chunks[0]).toMatchObject({ chunkId: "a", recordedResidenceTicks: 6, visits: 2 });
    expect(stage.inputs).toMatchObject({
      coverage: "complete",
      forwardTicks: 3,
      jumpHeldTicks: 8,
      jumpPresses: 2,
      noDirectionTicks: 3,
      reverseTicks: 2,
    });
    expect(stage.firstAttemptFullPass).toBe(false);
    expect(stage.deathLocations).toHaveLength(1);
    expect(stage.mechanicsPresentInVisitedChunks).toEqual(["gap", "lift"]);
  });
  it("keeps missing witnesses and mismatched identities unknown and rejects duplicate candidates", () => {
    const { saved, structural } = fixture();
    const run = { ...saved.run };
    delete run.witness;
    const stage = assessTuning({ expectedStages: ["stage", "missing"], structural }, [
      { ...saved, run, sourceCommit: "other" },
    ]).stages[0]!;
    expect(stage.inputs).toMatchObject({ coverage: "absent", unknownTicks: 8 });
    expect(stage.structuralJoin.status).toBe("unknown");
    expect(stage.recordedResidence.every((visit) => visit.mechanicsPresent === null)).toBe(true);
    expect(() => assessTuning({ structural }, [saved, saved])).toThrow("Duplicate stage");
    const partial = assessTuning({ structural }, [
      { ...saved, run: { ...saved.run, witness: { ...saved.run.witness!, truncated: true } } },
    ]).stages[0]!;
    expect(partial.inputs.coverage).toBe("incomplete");
  });
  it("refuses an existing output before creating siblings", () => {
    const { saved, structural } = fixture();
    const prefix = join(mkdtempSync(join(tmpdir(), "tuning-")), "report");
    writeFileSync(`${prefix}.csv`, "immutable");
    expect(() => writeTuningOutputs(prefix, assessTuning({ structural }, [saved]))).toThrow(
      "already exists",
    );
    expect(readFileSync(`${prefix}.csv`, "utf8")).toBe("immutable");
    expect(() => readFileSync(`${prefix}.json`)).toThrow();
  });
  it("reads explicit saved case manifests and writes three reports without replay", () => {
    const { saved, structural } = fixture();
    const directory = mkdtempSync(join(tmpdir(), "tuning-cli-"));
    writeFileSync(join(directory, "case.json"), JSON.stringify(saved));
    writeFileSync(join(directory, "inventory.json"), JSON.stringify(structural));
    writeFileSync(
      join(directory, "cases.json"),
      JSON.stringify([{ path: "case.json", stage: "stage" }]),
    );
    const prefix = join(directory, "result");
    tuningCli([
      "--cases",
      join(directory, "cases.json"),
      "--structural",
      join(directory, "inventory.json"),
      "--out-prefix",
      prefix,
    ]);
    expect(JSON.parse(readFileSync(`${prefix}.json`, "utf8")).stages[0].inputs.jumpPresses).toBe(2);
    expect(readFileSync(`${prefix}.csv`, "utf8")).toContain('"stage","zone"');
    expect(readFileSync(`${prefix}.md`, "utf8")).toContain("Recorded tuning assessment");
  });
  it("requires a complete zero-retry attempt-zero witness for a first-attempt flag", () => {
    const { saved, structural } = fixture();
    const witness = {
      ...saved.run.witness!,
      retries: 0,
      segments: saved.run.witness!.segments.map((segment) => ({ ...segment, attempt: 0 })),
    };
    const run = {
      ...saved.run,
      coverage: {
        ...saved.run.coverage,
        path: saved.run.coverage.path.map((entry) => ({ ...entry, attempt: 0 })),
      },
      deaths: 0,
      failures: [],
      retries: 0,
      witness,
    };
    expect(assessTuning({ structural }, [{ ...saved, run }]).stages[0]!.firstAttemptFullPass).toBe(
      true,
    );
    for (const recorded of [
      undefined,
      { ...witness, truncated: true },
      { ...witness, capturedTicks: 7 },
      { ...witness, retries: 1 },
    ]) {
      const partial: {
        -readonly [Key in keyof SavedTuningCase["run"]]: SavedTuningCase["run"][Key];
      } = { ...run };
      if (recorded) {
        partial.witness = recorded;
      } else {
        delete partial.witness;
      }
      expect(
        assessTuning({ structural }, [{ ...saved, run: partial }]).stages[0]!.firstAttemptFullPass,
      ).toBe(false);
    }
  });
  it("formats successful time separately and exposes exact ratios and residence bottlenecks", () => {
    const { saved, structural } = fixture();
    const report = assessTuning({ structural }, [
      { ...saved, run: { ...saved.run, successfulAttemptSeconds: 0.025 } },
    ]);
    const markdown = formatTuningMarkdown(report);
    expect(markdown).toContain("Successful-attempt seconds");
    expect(markdown).toContain("3/8");
    expect(markdown).toContain("2/8");
    expect(markdown).toContain("8/8");
    expect(markdown).toContain("| stage | main | 0 | a | 6 | 2 |");
    expect(markdown).toContain("gap, lift");
    const csv = formatTuningCsv(report);
    expect(csv).toContain("capturedInputTicks,noDirectionFraction");
    expect(csv).toContain('"0.025"');
    expect(csv).toContain('"chunk-residence"');
  });
});
