import ts from "typescript";
import { expect, it } from "vitest";

import {
  cycles,
  directionFindings,
  type Edge,
  entryFindings,
  graphProblems,
  reconcile,
  resolveSpecifier,
  specifiers,
  unplacedGroups,
} from "./graph.ts";

const NONE = { direction: [], entry: [], unplaced: [] };

// CLEANUP (added 2026-11-25): remove with the imports check (cwh-0310).
function parse(text: string): ts.SourceFile {
  return ts.createSourceFile("module.ts", text, ts.ScriptTarget.Latest);
}

function edge(from: string, to: string, typeOnly = false): Edge {
  return { from, to, typeOnly };
}

it("reads static, type-only, re-exported, dynamic and import-type specifiers", () => {
  const file = parse(
    [
      'import { a } from "./a.ts";',
      'import type { B } from "../b.ts";',
      'import { type C, type D } from "./c.ts";',
      'import e, { type F } from "./e.ts";',
      'export { g } from "./g.ts";',
      'export type { H } from "./h.ts";',
      'export * from "./i.ts";',
      'import "./side.ts";',
      'import { join } from "node:path";',
      'const later = import("./later.ts");',
      'let shape: import("./shape.ts").Shape;',
    ].join("\n"),
  );
  expect(specifiers(file)).toEqual([
    { text: "./a.ts", typeOnly: false },
    { text: "../b.ts", typeOnly: true },
    { text: "./c.ts", typeOnly: true },
    { text: "./e.ts", typeOnly: false },
    { text: "./g.ts", typeOnly: false },
    { text: "./h.ts", typeOnly: true },
    { text: "./i.ts", typeOnly: false },
    { text: "./side.ts", typeOnly: false },
    { text: "./later.ts", typeOnly: false },
    { text: "./shape.ts", typeOnly: true },
  ]);
  expect(resolveSpecifier("src/rules/zone/zone.ts", "../../core/index.ts")).toBe(
    "src/core/index.ts",
  );
  expect(resolveSpecifier("src/ui/dom/map.ts", "./map.css")).toBe("src/ui/dom/map.css");
});

it("finds a direct, a longer and a self cycle and passes a chain", () => {
  const modules = ["a", "b", "c", "d", "e", "f", "g"];
  const edges = [
    edge("a", "b"),
    edge("b", "a"),
    edge("c", "d"),
    edge("d", "e"),
    edge("e", "c"),
    edge("e", "f"),
    edge("f", "outside"),
    edge("g", "g"),
  ];
  expect(cycles(modules, edges)).toEqual([["a", "b"], ["c", "d", "e"], ["g"]]);
  expect(cycles(["a", "b"], [edge("a", "b")])).toEqual([]);
});

it("fails an import sideways, upward or into a group no layer places, outside the tests", () => {
  const edges = [
    edge("src/rules/zone/zone.ts", "src/core/index.ts"),
    edge("src/rules/zone/zone.ts", "src/rules/bird/index.ts"),
    edge("src/rules/zone/zone.ts", "src/rules/zone/death.ts"),
    edge("src/rules/zone/zone.ts", "src/progress/index.ts"),
    edge("src/rules/bird/bird.ts", "src/rules/zone/index.ts"),
    edge("src/core/step.ts", "src/scenes/save.ts"),
    edge("src/core/step.ts", "src/unknown/thing.ts"),
    edge("src/core/step.test.ts", "src/scenes/save.ts"),
    edge("src/tools/chunkPairs.ts", "src/testing/pairCertify.ts"),
  ];
  expect(directionFindings(edges)).toEqual([
    "src/core/step.ts -> src/scenes/save.ts",
    "src/core/step.ts -> src/unknown/thing.ts",
    "src/rules/bird/bird.ts -> src/rules/zone/index.ts",
    "src/rules/zone/zone.ts -> src/progress/index.ts",
  ]);
  expect(unplacedGroups(["src/core/step.ts", "src/unknown/thing.ts", "src/stray.ts"])).toEqual([
    "stray.ts",
    "unknown",
  ]);
});

it("fails a reach past another group's entry, except into data and from the tests", () => {
  const edges = [
    edge("src/scenes/MapScene.ts", "src/ui/index.ts"),
    edge("src/scenes/MapScene.ts", "src/ui/dom/map.ts"),
    edge("src/scenes/BootScene.ts", "src/ui/dom/map.ts"),
    edge("src/scenes/MapScene.ts", "src/data/map.ts"),
    edge("src/scenes/MapScene.test.ts", "src/ui/dom/map.ts"),
    edge("src/ui/dom/map.ts", "src/ui/layout/map.ts"),
    edge("src/play.ts", "src/main.ts"),
    edge("src/rules/zone/zone.ts", "src/rules/boss/behaviour.ts"),
    edge("src/rules/zone/zone.ts", "src/rules/zone/death.ts"),
  ];
  expect(entryFindings(edges)).toEqual([
    "rules/zone -> src/rules/boss/behaviour.ts",
    "scenes -> src/ui/dom/map.ts",
  ]);
});

it("names each new finding, each known violation that no longer exists and a misordered list", () => {
  expect(reconcile("rule", ["a", "b"], ["a", "b"])).toEqual([]);
  expect(reconcile("rule", ["b", "a"], ["a", "c"])).toEqual([
    "rule: c",
    "rule: the known violation no longer exists: b",
    "rule: the known violations are not in alphabetical order",
  ]);
});

it("fails a cycle at run time or across bands and allows a type-only one inside a band", () => {
  const modules = ["src/rules/zone/a.ts", "src/rules/zone/b.ts"];
  const typed = [edge(modules[0]!, modules[1]!), edge(modules[1]!, modules[0]!, true)];
  expect(graphProblems(NONE, modules, typed)).toEqual([]);
  const run = typed.map((each) => ({ ...each, typeOnly: false }));
  expect(graphProblems(NONE, modules, run)).toEqual([
    "import cycle at run time: src/rules/zone/a.ts, src/rules/zone/b.ts",
  ]);
  const across = ["src/rules/zone/a.ts", "src/scenes/b.ts"];
  const upward = "src/rules/zone/a.ts -> src/scenes/b.ts";
  expect(
    graphProblems({ ...NONE, direction: [upward] }, across, [
      edge(across[0]!, across[1]!, true),
      edge(across[1]!, across[0]!),
    ]),
  ).toEqual([
    "import past an entry: rules/zone -> src/scenes/b.ts",
    "import past an entry: scenes -> src/rules/zone/a.ts",
    "import cycle across bands: src/rules/zone/a.ts, src/scenes/b.ts",
  ]);
});
