import { STEP_SECONDS } from "../rules/step";
import type { PlayabilityReport } from "./playability";
import type { RunResult } from "./simulate";

export interface SavedTuningCase {
  readonly stage: string;
  readonly sourceCommit?: string;
  readonly readinessCommit?: string;
  readonly replay?: unknown;
  readonly run: Pick<
    RunResult,
    | "config"
    | "coverage"
    | "deaths"
    | "failures"
    | "fullPass"
    | "provenance"
    | "retries"
    | "seeds"
    | "status"
    | "steps"
    | "successfulAttemptSeconds"
    | "witness"
  >;
}
export interface TuningContext {
  readonly structural: PlayabilityReport;
  readonly expectedStages?: readonly string[];
}

function inputs(run: SavedTuningCase["run"]) {
  const witness = run.witness;
  const result = {
    capturedTicks: 0,
    directionalTicks: 0,
    forwardTicks: 0,
    jumpHeldTicks: 0,
    jumpPresses: 0,
    leftTicks: 0,
    noDirectionTicks: 0,
    reverseTicks: 0,
    rightTicks: 0,
  };
  let held = false;
  let attempt: number | undefined;
  for (const segment of witness?.segments ?? []) {
    if (!Number.isSafeInteger(segment.ticks) || segment.ticks < 1) {
      throw new Error("Invalid witness segment ticks");
    }
    if (attempt !== undefined && segment.attempt < attempt) {
      throw new Error("Invalid witness attempt order");
    }
    if (![-1, 0, 1].includes(segment.input.move)) {
      throw new Error("Invalid witness direction");
    }
    if (segment.attempt !== attempt) {
      held = false;
    }
    attempt = segment.attempt;
    result.capturedTicks += segment.ticks;
    if (segment.input.move === -1) {
      result.leftTicks += segment.ticks;
    }
    if (segment.input.move === 1) {
      result.rightTicks += segment.ticks;
    }
    if (segment.input.move === 0) {
      result.noDirectionTicks += segment.ticks;
    } else {
      result.directionalTicks += segment.ticks;
      if (segment.input.move === run.config.policy.move) {
        result.forwardTicks += segment.ticks;
      } else {
        result.reverseTicks += segment.ticks;
      }
    }
    if (segment.input.jumpHeld) {
      result.jumpHeldTicks += segment.ticks;
      if (!held) {
        result.jumpPresses++;
      }
    }
    held = segment.input.jumpHeld;
  }
  if (result.capturedTicks > run.steps) {
    throw new Error("Witness exceeds executed ticks");
  }
  const complete =
    witness !== undefined &&
    !witness.truncated &&
    witness.capturedTicks === result.capturedTicks &&
    result.capturedTicks === run.steps;
  return {
    ...result,
    coverage: witness === undefined ? "absent" : complete ? "complete" : "incomplete",
    truncated: witness?.truncated ?? null,
    unknownTicks: run.steps - result.capturedTicks,
  };
}

export function assessTuning(context: TuningContext, savedCases: readonly SavedTuningCase[]) {
  const seen = new Set<string>();
  const stages = savedCases.map((saved) => {
    if (seen.has(saved.stage)) {
      throw new Error(`Duplicate stage case: ${saved.stage}`);
    }
    seen.add(saved.stage);
    const run = saved.run;
    const inventory = context.structural.stages.filter(
      (stage) => stage.id === saved.stage && stage.seed === run.seeds.layout,
    );
    const reasons: string[] = [];
    if (inventory.length !== 1) {
      reasons.push("missing or ambiguous stage/layout seed");
    }
    if (!saved.sourceCommit || saved.sourceCommit !== context.structural.provenance.source) {
      reasons.push("source mismatch or absent source");
    }
    if (saved.sourceCommit && run.provenance.build !== saved.sourceCommit) {
      reasons.push("runtime/source mismatch");
    }
    const structure = reasons.length === 0 ? inventory[0] : undefined;
    const path = run.coverage.path;
    let previous = -1;
    const residence = path.map((entry, index) => {
      if (!Number.isSafeInteger(entry.tick) || entry.tick < previous || entry.tick > run.steps) {
        throw new Error("Invalid recorded path tick order");
      }
      previous = entry.tick;
      const end = path[index + 1]?.tick ?? run.steps;
      if (index > 0 && entry.attempt < path[index - 1]!.attempt) {
        throw new Error("Invalid path attempt order");
      }
      if (end < entry.tick) {
        throw new Error("Invalid recorded path interval");
      }
      const authored = structure?.chunks.filter((chunk) => chunk.area === entry.area)[
        entry.chunk ?? -1
      ];
      const joined =
        authored !== undefined && entry.chunkId !== undefined && authored.id === entry.chunkId;
      return {
        area: entry.area,
        attempt: entry.attempt,
        chunkId: entry.chunkId ?? null,
        chunkIndex: entry.chunk ?? null,
        endTick: end,
        mechanicsPresent: joined ? authored.mechanics : null,
        recordedResidenceTicks: end - entry.tick,
        startTick: entry.tick,
        structuralJoin: joined ? "matched" : "unknown",
        structuralJoinReason: joined
          ? null
          : structure
            ? "area/chunk index or identity mismatch"
            : "stage source/layout unavailable",
      };
    });
    const chunks = new Map<
      string,
      {
        area: string;
        chunkId: string | null;
        chunkIndex: number | null;
        recordedResidenceTicks: number;
        visits: number;
      }
    >();
    for (const visit of residence) {
      const key = JSON.stringify([visit.area, visit.chunkIndex, visit.chunkId]);
      const item = chunks.get(key) ?? {
        area: visit.area,
        chunkId: visit.chunkId,
        chunkIndex: visit.chunkIndex,
        recordedResidenceTicks: 0,
        visits: 0,
      };
      item.recordedResidenceTicks += visit.recordedResidenceTicks;
      item.visits++;
      chunks.set(key, item);
    }
    const mechanicsPresentInVisitedChunks = [
      ...new Set(residence.flatMap((visit) => visit.mechanicsPresent ?? [])),
    ].sort();
    return {
      chunks: [...chunks.values()].sort(
        (a, b) => b.recordedResidenceTicks - a.recordedResidenceTicks,
      ),
      config: run.config,
      deathLocations: run.failures.map(
        ({ area, attempt, chunk, chunkId, deathReason, tick, x, y }) => ({
          area,
          attempt,
          chunkId: chunkId ?? null,
          chunkIndex: chunk ?? null,
          deathReason,
          tick,
          x,
          y,
        }),
      ),
      deaths: run.deaths,
      firstAttemptFullPass: run.fullPass && run.retries === 0 && run.deaths === 0,
      fullPass: run.fullPass,
      id: saved.stage,
      inputs: inputs(run),
      mechanicsPresentInVisitedChunks,
      provenance: {
        readinessCommit: saved.readinessCommit ?? null,
        runtime: run.provenance,
        sourceCommit: saved.sourceCommit ?? null,
        structural: context.structural.provenance,
      },
      recordedActiveSeconds: run.steps * STEP_SECONDS,
      recordedResidence: residence,
      recordedTicks: run.steps,
      replay: saved.replay ?? null,
      retries: run.retries,
      seeds: run.seeds,
      status: run.status,
      structuralJoin: { reasons, status: structure ? "matched" : "unknown" },
      successfulAttemptSeconds: run.successfulAttemptSeconds ?? null,
      unknownResidenceTicks: path[0]?.tick ?? run.steps,
      unvisitedStructuralChunks:
        structure?.chunks.filter((chunk) => {
          const chunkIndex = structure.chunks
            .filter((item) => item.area === chunk.area)
            .indexOf(chunk);
          return !residence.some(
            (visit) =>
              visit.area === chunk.area &&
              visit.chunkIndex === chunkIndex &&
              visit.structuralJoin === "matched",
          );
        }) ?? null,
      witness: run.witness
        ? {
            contextHash: run.witness.contextHash,
            provenance: run.witness.provenance,
          }
        : null,
      zone: structure?.zone ?? null,
    };
  });
  const zoneIds = [
    ...new Set(stages.flatMap((stage) => (stage.zone === null ? [] : [stage.zone]))),
  ].sort();
  return {
    limitations: [
      "Recorded input direction is not physical movement; no-direction input is not stationary time.",
      "Recorded path residence uses centre-based chunk transition ticks, not distance or airtime.",
      "Structural mechanics present are not evidence of actual use, fun or human difficulty.",
      "Structural and runtime hashes identify different input domains and are retained separately.",
      "Missing or mismatched structural joins remain unknown; sampled trace is not used for deaths.",
    ],
    missingStages: [
      ...new Set(context.expectedStages ?? context.structural.stages.map((stage) => stage.id)),
    ].filter((id) => !seen.has(id)),
    schema: 1,
    stages,
    structuralComparisons: context.structural.comparisons,
    zones: zoneIds.map((id) => {
      const members = stages.filter((stage) => stage.zone === id);
      return {
        deaths: members.reduce((n, stage) => n + stage.deaths, 0),
        firstAttemptFullPasses: members.filter((stage) => stage.firstAttemptFullPass).length,
        id,
        recordedTicks: members.reduce((n, stage) => n + stage.recordedTicks, 0),
        stages: members.map((stage) => stage.id),
      };
    }),
  };
}
export type TuningReport = ReturnType<typeof assessTuning>;
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export function formatTuningCsv(report: TuningReport): string {
  return `${[
    "stage,zone,status,firstAttemptFullPass,recordedTicks,deaths,retries,inputCoverage",
    ...report.stages.map((stage) =>
      [
        stage.id,
        stage.zone,
        stage.status,
        stage.firstAttemptFullPass,
        stage.recordedTicks,
        stage.deaths,
        stage.retries,
        stage.inputs.coverage,
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n")}\n`;
}
export function formatTuningMarkdown(report: TuningReport): string {
  return [
    "# Recorded tuning assessment",
    "",
    "| Stage | Status | First-attempt full pass | Active seconds | Deaths | Input coverage |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...report.stages.map((stage) =>
      [
        "",
        stage.id.replaceAll("|", "\\|"),
        stage.status,
        stage.firstAttemptFullPass,
        stage.recordedActiveSeconds.toFixed(2),
        stage.deaths,
        stage.inputs.coverage,
        "",
      ].join(" | "),
    ),
    "",
    ...report.limitations.map((line) => `- ${line}`),
    "",
  ].join("\n");
}
