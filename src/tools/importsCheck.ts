// The structure of src/, checked in lint: every module sits in a layer and imports only downward
// and through entries, apart from the known violations, and nothing forms a cycle at run time.
// CLEANUP (added 2026-11-25): remove when the known-violations table is empty and ESLint guards
// the layers (cwh-0310).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { type Edge, graphProblems, resolveSpecifier, specifiers } from "./imports/graph.ts";
import { KNOWN_VIOLATIONS } from "./imports/knownViolations.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function main(): number {
  const started = process.hrtime.bigint();
  const modules = (readdirSync(join(ROOT, "src"), { recursive: true }) as string[])
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `src/${name}`)
    .sort();
  const known = new Set(modules);
  const edges: Edge[] = [];
  const problems: string[] = [];
  for (const path of modules) {
    const text = readFileSync(join(ROOT, path), "utf8");
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest);
    for (const { text: specifier, typeOnly } of specifiers(file)) {
      const to = resolveSpecifier(path, specifier);
      if (to.endsWith(".css")) {
        // A stylesheet loads beside the code that mounts what it styles; it is not a module.
        continue;
      }
      if (known.has(to) || (to.startsWith("src/") && existsSync(join(ROOT, to)))) {
        edges.push({ from: path, to, typeOnly });
      } else if (to.startsWith("src/")) {
        problems.push(`import of a missing file: ${path} -> ${to}`);
      }
    }
  }
  problems.push(...graphProblems(KNOWN_VIOLATIONS, modules, edges));
  const seconds = (Number(process.hrtime.bigint() - started) / 1e9).toFixed(1);
  const counts = [
    `${KNOWN_VIOLATIONS.direction.length} against the layers`,
    `${KNOWN_VIOLATIONS.unplaced.length} unplaced`,
    `${KNOWN_VIOLATIONS.entry.length} past an entry`,
  ].join(", ");
  for (const problem of problems) {
    console.error(problem);
  }
  console.log(
    `imports: ${modules.length} modules, ${edges.length} imports, ${problems.length} problems, ` +
      `known violations: ${counts} (${seconds} s)`,
  );
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main();
