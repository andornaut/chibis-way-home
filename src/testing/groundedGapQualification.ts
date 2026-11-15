import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import type { ZoneLayout } from "../data/types/index.ts";
import type { WalkRouteTarget } from "../sim/zoneWalk.ts";
import { controlledRequiredRoute } from "./continuousRequiredRoute.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import { createGroundedGapController, GROUNDED_GAP_CONTROLLER } from "./groundedGapController.ts";
export interface QualificationSource {
  // Revision identity is supplied by the owner; content is independently checked below.
  readonly revision: string;
  readonly files: Readonly<Record<string, string>>;
  readonly themes: readonly string[];
}
const root = fileURLToPath(new URL("../../", import.meta.url));
const digest = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
// Conservative source closure includes type imports, literal dynamic imports and package pins.
export function groundedGapSourceFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const visit = (name: string) => {
    const key = relative(root, name).replaceAll("\\", "/");
    if (key.startsWith("../")) {
      throw new Error("Qualification source escapes checkout");
    }
    if (files[key] !== undefined) {
      return;
    }
    const text = readFileSync(name, "utf8");
    files[key] = digest(text);
    if (!name.endsWith(".ts")) {
      return;
    }
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    const walk = (node: ts.Node) => {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : undefined;
      if (specifier !== undefined) {
        if (!ts.isStringLiteral(specifier)) {
          throw new Error("Unknown qualification import");
        }
        if (specifier.text.startsWith(".")) {
          visit(resolve(dirname(name), specifier.text));
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  };
  visit(fileURLToPath(import.meta.url));
  visit(resolve(root, "package.json"));
  visit(resolve(root, "package-lock.json"));
  return Object.fromEntries(
    Object.entries(files).sort(([left], [right]) => left.localeCompare(right)),
  );
}
export function qualifyGroundedGapRoute(
  source: QualificationSource | undefined,
  layout: ZoneLayout,
  targets: readonly WalkRouteTarget[],
) {
  const metadata = {
    layout,
    layoutSha256: digest(JSON.stringify(layout)),
    orderedTargets: targets,
    ordinaryTuning: ORDINARY,
    physics: {
      basis: "full-layout-plus-ordinary-tuning",
      sha256: digest(JSON.stringify({ layout, tuning: ORDINARY })),
    },
    retries: 0,
    seed: 1,
    themes: source?.themes,
    tickLimit: 600,
  } as const;
  let files: Readonly<Record<string, string>>;
  try {
    files = groundedGapSourceFiles();
    if (
      !source ||
      !/^[a-f0-9]{40}$/.test(source.revision) ||
      !Array.isArray(source.themes) ||
      source.themes.length === 0 ||
      source.themes.some((theme) => typeof theme !== "string" || theme.trim() === "") ||
      Object.keys(source.files).length !== Object.keys(files).length ||
      Object.entries(files).some(([name, hash]) => source.files[name] !== hash)
    ) {
      throw new Error("Missing or mismatched qualification source manifest");
    }
  } catch {
    return {
      controller: GROUNDED_GAP_CONTROLLER,
      kind: "qualification" as const,
      metadata,
      reason: "source-unavailable" as const,
      source: { status: "unavailable" as const },
      status: "not-proven" as const,
    };
  }
  const { controller, decisions, events, failure, guardEvents } = createGroundedGapController(
    ORDINARY,
    layout,
  );
  const route = controlledRequiredRoute(controller, layout, targets);
  return {
    controller: GROUNDED_GAP_CONTROLLER,
    decisions,
    events,
    guardEvents,
    kind: "qualification" as const,
    metadata,
    reason: failure() ?? route.reason,
    route,
    source: {
      files,
      revision: source.revision,
      revisionAuthority: "caller" as const,
      status: "content-verified" as const,
      transitiveSha256: digest(JSON.stringify(files)),
    },
    status: failure() === undefined ? route.status : ("not-proven" as const),
  };
}
