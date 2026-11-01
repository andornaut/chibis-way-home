import {
  closeSync as closeOutput,
  existsSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

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
export function tuningCli(args: readonly string[]): void {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index],
      value = args[index + 1];
    if (
      !key ||
      !value ||
      !["--cases", "--structural", "--out-prefix"].includes(key) ||
      options.has(key)
    ) {
      throw new Error("Expected --cases MANIFEST --structural JSON --out-prefix PATH");
    }
    options.set(key, value);
  }
  if (options.size !== 3) {
    throw new Error("All three options are required");
  }
  const manifest = resolve(options.get("--cases")!);
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
  const structural = JSON.parse(
    readFileSync(options.get("--structural")!, "utf8"),
  ) as PlayabilityReport;
  writeTuningOutputs(options.get("--out-prefix")!, assessTuning({ structural }, cases));
}
if (process.argv[1]?.endsWith("tuningCli.ts")) {
  tuningCli(process.argv.slice(2));
}
