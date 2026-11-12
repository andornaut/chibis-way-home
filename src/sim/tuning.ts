import { STEP_SECONDS } from "../core/index.ts";
import type { PlayabilityReport } from "./playability.ts";
import type { RunResult } from "./simulate.ts";

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
interface TuningContext {
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
      } else if (run.config.policy.move !== 0) {
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
    result.capturedTicks === run.steps &&
    witness.steps === run.steps;
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
    const inputStats = inputs(run);
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
      firstAttemptFullPass:
        run.fullPass &&
        run.retries === 0 &&
        run.deaths === 0 &&
        inputStats.coverage === "complete" &&
        run.witness?.retries === 0 &&
        run.witness.segments.every((segment) => segment.attempt === 0) &&
        run.coverage.path.every((entry) => entry.attempt === 0) &&
        run.failures.length === 0,
      fullPass: run.fullPass,
      id: saved.stage,
      inputs: inputStats,
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
type TuningReport = ReturnType<typeof assessTuning>;
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const fraction = (ticks: number, total: number) => (total === 0 ? null : ticks / total);
const bottlenecks = (stage: TuningReport["stages"][number]) =>
  stage.chunks.filter((chunk, index) => index < 5 || chunk.visits > 1);
export function formatTuningCsv(report: TuningReport): string {
  const columns = [
    "recordType",
    "stage",
    "zone",
    "status",
    "firstAttemptFullPass",
    "allAttemptActiveSeconds",
    "successfulAttemptSeconds",
    "inputCoverage",
    "capturedInputTicks",
    "noDirectionFraction",
    "reverseFraction",
    "jumpHeldFraction",
    "area",
    "chunkIndex",
    "chunkId",
    "residenceTicks",
    "visits",
    "mechanicsPresent",
    "comparisonFirst",
    "comparisonSecond",
    "jaccardPresence",
    "frequencyDifferencePer100Cols",
  ];
  const records: Record<string, unknown>[] = report.stages.flatMap((stage) => [
    {
      allAttemptActiveSeconds: stage.recordedActiveSeconds,
      capturedInputTicks: stage.inputs.capturedTicks,
      firstAttemptFullPass: stage.firstAttemptFullPass,
      inputCoverage: stage.inputs.coverage,
      jumpHeldFraction: fraction(stage.inputs.jumpHeldTicks, stage.inputs.capturedTicks),
      mechanicsPresent: stage.mechanicsPresentInVisitedChunks.join(";"),
      noDirectionFraction: fraction(stage.inputs.noDirectionTicks, stage.inputs.capturedTicks),
      recordType: "stage",
      reverseFraction: fraction(stage.inputs.reverseTicks, stage.inputs.capturedTicks),
      stage: stage.id,
      status: stage.status,
      successfulAttemptSeconds: stage.successfulAttemptSeconds,
      zone: stage.zone,
    },
    ...bottlenecks(stage).map((chunk) => ({
      area: chunk.area,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      recordType: "chunk-residence",
      residenceTicks: chunk.recordedResidenceTicks,
      stage: stage.id,
      visits: chunk.visits,
      zone: stage.zone,
    })),
  ]);
  records.push(
    ...report.structuralComparisons.map((comparison) => ({
      comparisonFirst: comparison.first,
      comparisonSecond: comparison.second,
      frequencyDifferencePer100Cols: comparison.meanFrequencyDifferencePer100Cols,
      jaccardPresence: comparison.jaccardPresence,
      recordType: "structural-zone-comparison",
    })),
  );
  return `${[
    columns.join(","),
    ...records.map((record) => columns.map((column) => csv(record[column])).join(",")),
  ].join("\n")}\n`;
}
const mdRow = (values: readonly unknown[]) =>
  `| ${values
    .map((value) =>
      String(value ?? "unknown")
        .replaceAll("|", "\\|")
        .replaceAll("\n", " "),
    )
    .join(" | ")} |`;
const ratio = (ticks: number, total: number) => (total === 0 ? "unknown" : `${ticks}/${total}`);
export function formatTuningMarkdown(report: TuningReport): string {
  return [
    "# Recorded tuning assessment",
    "",
    "Input ratios use captured ticks only. Incomplete coverage excludes unknown ticks.",
    "Replay verification is independent of the first-attempt recording flag and remains in JSON.",
    "",
    mdRow([
      "Stage",
      "Status",
      "First-attempt full pass",
      "All-attempt active seconds",
      "Successful-attempt seconds",
      "Input coverage",
      "No-direction input",
      "Reverse input",
      "Jump-held input",
    ]),
    mdRow(["---", "---", "---", "---:", "---:", "---", "---", "---", "---"]),
    ...report.stages.map((stage) =>
      mdRow([
        stage.id,
        stage.status,
        stage.firstAttemptFullPass,
        stage.recordedActiveSeconds,
        stage.successfulAttemptSeconds,
        stage.inputs.coverage,
        ratio(stage.inputs.noDirectionTicks, stage.inputs.capturedTicks),
        ratio(stage.inputs.reverseTicks, stage.inputs.capturedTicks),
        ratio(stage.inputs.jumpHeldTicks, stage.inputs.capturedTicks),
      ]),
    ),
    "",
    "## Slow and revisited recorded chunks",
    "",
    "Top five residence totals per stage and every revisited chunk. These totals include all attempts.",
    "",
    mdRow(["Stage", "Area", "Chunk index", "Chunk ID", "Residence ticks", "Visits"]),
    mdRow(["---", "---", "---:", "---", "---:", "---:"]),
    ...report.stages.flatMap((stage) =>
      bottlenecks(stage).map((chunk) =>
        mdRow([
          stage.id,
          chunk.area,
          chunk.chunkIndex,
          chunk.chunkId,
          chunk.recordedResidenceTicks,
          chunk.visits,
        ]),
      ),
    ),
    "",
    "## Visited structural inventory",
    "",
    mdRow(["Stage", "Join", "Mechanics present (usage unknown)", "Unvisited chunks"]),
    mdRow(["---", "---", "---", "---:"]),
    ...report.stages.map((stage) =>
      mdRow([
        stage.id,
        stage.structuralJoin.status,
        stage.mechanicsPresentInVisitedChunks.join(", ") || "unknown or none",
        stage.unvisitedStructuralChunks?.length ?? null,
      ]),
    ),
    "",
    "## Structural zone comparisons",
    "",
    mdRow([
      "First zone",
      "Second zone",
      "Jaccard presence",
      "Mean frequency difference per 100 columns",
    ]),
    mdRow(["---", "---", "---:", "---:"]),
    ...report.structuralComparisons.map((comparison) =>
      mdRow([
        comparison.first,
        comparison.second,
        comparison.jaccardPresence,
        comparison.meanFrequencyDifferencePer100Cols,
      ]),
    ),
    "",
    ...report.limitations.map((line) => `- ${line}`),
    "",
  ].join("\n");
}
