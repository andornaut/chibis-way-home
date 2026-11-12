import {
  closeSync as closeOutput,
  existsSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import { parseOptions, runMain, UsageError } from "./command";
import type { PlayabilityReport } from "./playability";
import {
  assessTuning,
  formatTuningCsv,
  formatTuningMarkdown,
  type SavedTuningCase,
} from "./tuning";

export function writeTuningOutputs(prefix: string, report: ReturnType<typeof assessTuning>): void {
  const outputs = [
    [`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`],
    [`${prefix}.csv`, formatTuningCsv(report)],
    [`${prefix}.md`, formatTuningMarkdown(report)],
  ] as const;
  if (outputs.some(([file]) => existsSync(file))) {
    throw new Error("Output already exists");
  }
  // Exclusive creation also protects against concurrent writers.
  const descriptors: number[] = [];
  try {
    for (const [file] of outputs) {
      descriptors.push(openExclusive(file));
    }
    outputs.forEach(([, contents], index) => writeFileSync(descriptors[index]!, contents));
  } finally {
    descriptors.forEach((fd) => closeOutput(fd));
  }
}
const openExclusive = (path: string) => openSync(path, "wx");
const HELP = `node src/sim/tuningCli.ts --cases MANIFEST --structural JSON --out-prefix PATH
Post-processes saved case artifacts and a saved structural playability report into
PATH.json, PATH.csv and PATH.md. No physics, navigation or replay.
The manifest is a JSON array of {stage, path} entries, each path relative to the manifest.
Refuses any existing output. Exits 2 on a usage error.`;
const OPTIONS = {
  cases: { type: "string" },
  "out-prefix": { type: "string" },
  structural: { type: "string" },
} as const;
export function tuningCli(args: readonly string[]): number {
  const values = parseOptions(OPTIONS, args);
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const { cases: casesPath, "out-prefix": prefix, structural: structuralPath } = values;
  if (casesPath === undefined || prefix === undefined || structuralPath === undefined) {
    const missing = Object.keys(OPTIONS).filter(
      (name) => values[name as keyof typeof OPTIONS] === undefined,
    );
    throw new UsageError(`Missing ${missing.map((name) => `--${name}`).join(", ")}`);
  }
  const manifest = resolve(casesPath);
  const paths: { stage: string; path: string }[] = JSON.parse(readFileSync(manifest, "utf8"));
  if (
    !Array.isArray(paths) ||
    paths.some(
      (entry) => !entry || typeof entry.path !== "string" || typeof entry.stage !== "string",
    )
  ) {
    throw new Error("Cases manifest must be an array of {stage, path} entries");
  }
  const cases = paths.map(
    ({ path, stage }) =>
      ({
        ...JSON.parse(readFileSync(resolve(dirname(manifest), path), "utf8")),
        stage,
      }) as SavedTuningCase,
  );
  const structural = JSON.parse(readFileSync(structuralPath, "utf8")) as PlayabilityReport;
  writeTuningOutputs(prefix, assessTuning({ structural }, cases));
  return 0;
}
runMain(import.meta.url, HELP, tuningCli);
