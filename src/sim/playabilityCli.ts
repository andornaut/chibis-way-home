import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import { ARCHETYPES } from "../data/archetypes";
import { CHARACTERS } from "../data/characters";
import { ZONE_MAP } from "../data/map";
import { RECIPES, ZONES } from "../data/zones";
import { CHUNK_LIBRARY, zonePlanFor } from "../rules/zonePlans";
import { assessPlayability, formatPlayabilityMarkdown } from "./playability";
const HELP = `npx tsx src/sim/playabilityCli.ts --seeds 1,7 --source COMMIT [--format json|markdown] [--out FILE]
Structural catalogue assessment only. No physics, bots, playthrough or reachability search.
Seeds are explicit, distinct unsigned 32-bit integers; maximum 16. All map stages are included.
Source identifies the checked checkout; data is SHA-256 of the loaded structural inputs.
Run inside the project container. JSON retains full counts/order; Markdown is a concise summary.`;
export function playabilityCli(args: readonly string[]): void {
  if (args.includes("--help")) {
    console.log(HELP);
    return;
  }
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index],
      value = args[index + 1];
    if (
      !flag ||
      !["--seeds", "--source", "--format", "--out"].includes(flag) ||
      !value ||
      Object.hasOwn(options, flag)
    ) {
      throw new Error(`Invalid or repeated option ${flag}`);
    }
    options[flag] = value;
  }
  if (!options["--seeds"] || !options["--source"]) {
    throw new Error("--seeds and --source are required");
  }
  if (!/^\d+(,\d+)*$/.test(options["--seeds"])) {
    throw new Error("--seeds must be comma-separated integers");
  }
  const format = options["--format"] ?? "json";
  if (format !== "json" && format !== "markdown") {
    throw new Error("--format must be json or markdown");
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
      provenance: { data, source: options["--source"] },
      recipes: RECIPES,
    },
    options["--seeds"].split(",").map(Number),
  );
  const output =
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatPlayabilityMarkdown(report);
  if (options["--out"]) {
    writeFileSync(options["--out"], output);
  } else {
    process.stdout.write(output);
  }
}
playabilityCli(process.argv.slice(2));
