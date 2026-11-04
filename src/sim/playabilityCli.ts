import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

import { ARCHETYPES } from "../data/archetypes";
import { CHARACTERS } from "../data/characters";
import { ZONE_MAP } from "../data/map";
import { RECIPES, ZONES } from "../data/zones";
import { CHUNK_LIBRARY, zonePlanFor } from "../rules/zonePlans";
import { choiceOption, parseOptions, runMain, UsageError } from "./command";
import { assessPlayability, formatPlayabilityMarkdown } from "./playability";
const HELP = `npx tsx src/sim/playabilityCli.ts --seeds 1,7 --source COMMIT [--format json|markdown] [--out FILE]
Structural catalogue assessment only. No physics, bots, playthrough or reachability search.
Seeds are explicit, distinct unsigned 32-bit integers; maximum 16. All map stages are included.
Source identifies the checked checkout; data is SHA-256 of the loaded structural inputs.
--out refuses an existing file. Exits 2 on a usage error.
Run inside the project container. JSON retains full counts/order; Markdown is a concise summary.`;
const OPTIONS = {
  format: { type: "string" },
  out: { type: "string" },
  seeds: { type: "string" },
  source: { type: "string" },
} as const;
const FORMATS = ["json", "markdown"] as const;
export function playabilityCli(args: readonly string[]): number {
  const values = parseOptions(OPTIONS, args);
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const { out, seeds, source } = values;
  if (seeds === undefined || source === undefined) {
    throw new UsageError("--seeds and --source are required");
  }
  if (!/^\d+(,\d+)*$/.test(seeds)) {
    throw new UsageError(`--seeds takes comma-separated whole numbers, not ${seeds}`);
  }
  const format =
    values.format === undefined ? "json" : choiceOption("format", FORMATS, values.format);
  if (out !== undefined && existsSync(out)) {
    throw new Error(`Output already exists: ${out}`);
  }
  const catalogue = ZONE_MAP.destinations;
  const data = `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        archetypes: ARCHETYPES,
        catalogue,
        characters: CHARACTERS,
        library: CHUNK_LIBRARY,
        recipes: RECIPES,
        zones: ZONES,
      }),
    )
    .digest("hex")}`;
  const report = assessPlayability(
    {
      archetypes: ARCHETYPES,
      catalogue,
      library: { ...CHUNK_LIBRARY, characters: CHARACTERS },
      load: zonePlanFor,
      provenance: { data, source },
      recipes: RECIPES,
    },
    seeds.split(",").map(Number),
  );
  const output =
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatPlayabilityMarkdown(report);
  if (out === undefined) {
    process.stdout.write(output);
  } else {
    writeFileSync(out, output, { flag: "wx" });
  }
  return 0;
}
runMain(import.meta.url, HELP, playabilityCli);
