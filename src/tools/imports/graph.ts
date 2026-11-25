// The import graph of src/ and the rules the imports check holds it to. Reads sources with the
// TypeScript parser, so type-only imports, re-exports, dynamic imports and import types are edges.
// CLEANUP (added 2026-11-25): remove when the known-violations table is empty and ESLint guards
// the layers (cwh-0310).
import ts from "typescript";

import { bandOf, groupOf, layerOf, LAYERS, OPEN_GROUPS } from "./layers.ts";

/** One relative specifier a module names. */
export type Specifier = { readonly text: string; readonly typeOnly: boolean };

/** One import between two modules of src/, each a path relative to the repository. */
export type Edge = { readonly from: string; readonly to: string; readonly typeOnly: boolean };

/** The violations the check still finds: each list names exactly the present ones of its rule. */
export type KnownViolations = {
  readonly direction: readonly string[];
  readonly entry: readonly string[];
  readonly unplaced: readonly string[];
};

export function isTest(path: string): boolean {
  return path.endsWith(".test.ts");
}

function namedTypeOnly(
  whole: boolean,
  elements: readonly { readonly isTypeOnly: boolean }[] | undefined,
): boolean {
  return (
    whole || (elements !== undefined && elements.length > 0 && elements.every((e) => e.isTypeOnly))
  );
}

/** Every relative specifier of a parsed module. */
export function specifiers(file: ts.SourceFile): Specifier[] {
  const found: Specifier[] = [];
  const add = (text: string, typeOnly: boolean): void => {
    if (text.startsWith(".")) {
      found.push({ text, typeOnly });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const named =
        bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : undefined;
      add(
        node.moduleSpecifier.text,
        clause !== undefined &&
          (clause.isTypeOnly || (clause.name === undefined && namedTypeOnly(false, named))),
      );
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.exportClause;
      const named = clause !== undefined && ts.isNamedExports(clause) ? clause.elements : undefined;
      add(node.moduleSpecifier.text, namedTypeOnly(node.isTypeOnly, named));
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      add(node.arguments[0].text, false);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      add(node.argument.literal.text, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** The path a specifier in `from` names, normalized, relative to the repository. */
export function resolveSpecifier(from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== ".") {
      parts.push(part);
    }
  }
  return parts.join("/");
}

/** Each strongly connected set of more than one module, or a module importing itself. */
export function cycles(modules: readonly string[], edges: readonly Edge[]): string[][] {
  const targets = new Map<string, string[]>(modules.map((path) => [path, []]));
  for (const { from, to } of edges) {
    if (targets.has(to)) {
      targets.get(from)?.push(to);
    }
  }
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const found: string[][] = [];
  const visit = (node: string): void => {
    index.set(node, index.size);
    low.set(node, index.get(node)!);
    stack.push(node);
    onStack.add(node);
    for (const next of targets.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node)!, low.get(next)!));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node)!, index.get(next)!));
      }
    }
    if (low.get(node) === index.get(node)) {
      const component: string[] = [];
      let member: string | undefined;
      do {
        member = stack.pop();
        if (member !== undefined) {
          onStack.delete(member);
          component.push(member);
        }
      } while (member !== undefined && member !== node);
      if (component.length > 1 || (targets.get(node) ?? []).includes(node)) {
        found.push(component.sort());
      }
    }
  };
  for (const node of [...modules].sort()) {
    if (!index.has(node)) {
      visit(node);
    }
  }
  return found.sort((a, b) => a[0]!.localeCompare(b[0]!));
}

/** The groups under src/ that no layer places. */
export function unplacedGroups(modules: readonly string[]): string[] {
  return unique(modules.filter((path) => layerOf(path) < 0).map(groupOf));
}

/**
 * Each import outside the tests that leaves its group for one in the same layer, a higher layer
 * or no layer.
 */
export function directionFindings(edges: readonly Edge[]): string[] {
  return unique(
    edges
      .filter(
        ({ from, to }) =>
          !isTest(from) &&
          groupOf(from) !== groupOf(to) &&
          !(layerOf(to) >= 0 && layerOf(to) < layerOf(from)),
      )
      .map(({ from, to }) => `${from} -> ${to}`),
  );
}

/** The entry of the group a path belongs to: its index.ts, or the file itself directly in src/. */
export function entryOf(path: string): string {
  const group = groupOf(path);
  return group.endsWith(".ts") ? `src/${group}` : `src/${group}/index.ts`;
}

/**
 * Each reach from outside the tests into another group past its entry, as the importing group
 * and the module reached.
 */
export function entryFindings(edges: readonly Edge[]): string[] {
  return unique(
    edges
      .filter(
        ({ from, to }) =>
          !isTest(from) &&
          groupOf(from) !== groupOf(to) &&
          !OPEN_GROUPS.includes(groupOf(to)) &&
          to !== entryOf(to),
      )
      .map(({ from, to }) => `${groupOf(from)} -> ${to}`),
  );
}

/** What differs between a rule's findings and its known violations, as problems to print. */
export function reconcile(
  rule: string,
  known: readonly string[],
  found: readonly string[],
): string[] {
  const sorted = [...known].sort();
  return [
    ...found.filter((item) => !known.includes(item)).map((item) => `${rule}: ${item}`),
    ...known
      .filter((item) => !found.includes(item))
      .map((item) => `${rule}: the known violation no longer exists: ${item}`),
    ...(known.every((item, at) => item === sorted[at])
      ? []
      : [`${rule}: the known violations are not in alphabetical order`]),
  ];
}

/**
 * Every finding the known violations do not name, and every known violation that no longer
 * exists. A cycle at run time always fails; type-only imports may form one inside a band.
 */
export function graphProblems(
  known: KnownViolations,
  modules: readonly string[],
  edges: readonly Edge[],
): string[] {
  const group = (members: readonly string[]): string => members.join(", ");
  return [
    ...reconcile("no layer places the group", known.unplaced, unplacedGroups(modules)),
    ...reconcile("import against the layers", known.direction, directionFindings(edges)),
    ...reconcile("import past an entry", known.entry, entryFindings(edges)),
    ...cycles(
      modules,
      edges.filter(({ typeOnly }) => !typeOnly),
    ).map((members) => `import cycle at run time: ${group(members)}`),
    ...cycles(modules, edges)
      .filter((members) => new Set(members.map(bandOf)).size > 1)
      .map((members) => `import cycle across bands: ${group(members)}`),
    ...LAYERS.flatMap(({ groups }) => groups)
      .filter((name, at, all) => all.indexOf(name) !== at)
      .map((name) => `two layers place the group: ${name}`),
  ];
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items)].sort();
}
