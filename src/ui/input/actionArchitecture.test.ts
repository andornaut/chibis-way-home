import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url).pathname;
const BINDING = "ui/input/actionBinding.ts";
const COMPOUND_CONSTRUCTORS: Readonly<Record<string, readonly string[]>> = {
  "ui/dom/cheats.ts": ['element("button", "settings-row ui-press")'],
  "ui/dom/map.ts": ['document.createElement("button")'],
  "ui/dom/settings.ts": ['element("button", "settings-row ui-press")'],
  "ui/dom/stageSelect.ts": ['element("button", "stage-select-stage ui-press")'],
};

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
        ? [path]
        : [];
  });
}

function bypasses(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const compound = [...(COMPOUND_CONSTRUCTORS[path] ?? [])];
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.endsWith("/holdActions") &&
      node.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some(
        (element) => (element.propertyName ?? element.name).text === "bindHoldActions",
      ) &&
      path !== BINDING
    ) {
      found.push("hold lifecycle outside the shared action binding");
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "@andornaut/game-kit/runtime/web/ui/dom/button" &&
      !node.importClause?.isTypeOnly &&
      path !== BINDING
    ) {
      found.push("GameKit button construction outside the shared action binding");
    }
    if (
      ts.isCallExpression(node) &&
      ((ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "createElement") ||
        (ts.isIdentifier(node.expression) && node.expression.text === "element")) &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === "button"
    ) {
      const index = compound.indexOf(node.getText(source));
      if (index < 0) {
        found.push("standard button construction outside the GameKit adapter");
      } else {
        compound.splice(index, 1);
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "addEventListener" &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const event = node.arguments[0].text;
      if ((event === "click" || event === "pointerup") && path !== BINDING) {
        found.push(`${event} action outside the shared action binding`);
      }
      if (event === "change") {
        found.push("unregistered native discrete change route");
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === "onclick" &&
      node.right.kind !== ts.SyntaxKind.NullKeyword
    ) {
      found.push("click action outside the shared action binding");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

it("routes game discrete actions through one binding while retaining native and continuous owners", () => {
  const paths = ["crash", "dev", "loading", "scenes", "ui"].flatMap((path) =>
    sourceFiles(join(ROOT, path)),
  );
  const violations = paths.flatMap((path) =>
    bypasses(relative(ROOT, path), readFileSync(path, "utf8")).map((reason) => ({ path, reason })),
  );
  expect(violations).toEqual([]);
});

it("rejects a new raw button action and a second hold lifecycle", () => {
  expect(bypasses("scenes/NewScene.ts", 'document.createElement("button");')).toEqual([
    "standard button construction outside the GameKit adapter",
  ]);
  expect(
    bypasses(
      "scenes/NewScene.ts",
      'import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";',
    ),
  ).toEqual(["GameKit button construction outside the shared action binding"]);
  expect(bypasses("scenes/NewScene.ts", 'button.addEventListener("click", activate);')).toEqual([
    "click action outside the shared action binding",
  ]);
  expect(bypasses("scenes/NewScene.ts", "button.onclick = activate;")).toEqual([
    "click action outside the shared action binding",
  ]);
  expect(
    bypasses(
      "scenes/NewScene.ts",
      'import { bindHoldActions } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";',
    ),
  ).toEqual(["hold lifecycle outside the shared action binding"]);
});
