import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

// Logic, layout and data stay free of Phaser and the scenes, so they run in unit tests
// without a renderer. Only the scenes and the entry point may import them.
const phaserBoundary = {
  group: ["phaser", "phaser/*", "**/phaser/*", "**/scenes", "**/scenes/*"],
  message:
    "Only src/scenes/ and src/main.ts may import Phaser, the kit's phaser/ modules or a scene.",
};

const testingBoundary = {
  group: ["**/testing", "**/testing/*"],
  message: "Only tests may import src/testing/.",
};

const PHASER_FILES = ["src/main.ts", "src/scenes/**"];
const TEST_FILES = ["src/**/*.test.ts"];

// A later no-restricted-imports replaces an earlier one rather than adding to it, so each
// file matches exactly one of the configs that set it, which lists every pattern for it.
function restrictImports(patterns) {
  return { "no-restricted-imports": ["error", { patterns }] };
}

export default defineConfig(
  {
    // .claude/ holds agent worktrees: full copies of the repo that CI never checks out.
    ignores: [".claude/", ".wrangler/", "dist/", "node_modules/", "vendor/"],
  },
  js.configs.recommended,
  ts.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // The house rules, over what this ships. max-len is inert here: prettier
  // wraps at 100 in this repository, inside the 120 the rule allows.
  {
    files: ["src/**/*.ts"],
    plugins,
    rules: sourceRules,
  },
  {
    files: ["src/**/*.ts"],
    ignores: [...PHASER_FILES, ...TEST_FILES],
    rules: restrictImports([phaserBoundary, testingBoundary]),
  },
  {
    files: PHASER_FILES,
    ignores: TEST_FILES,
    rules: restrictImports([testingBoundary]),
  },
  {
    files: TEST_FILES,
    ignores: PHASER_FILES,
    rules: restrictImports([phaserBoundary]),
  },
  // Config files: they produce what ships rather than being it.
  {
    files: ["*.ts", "*.js", "*.mjs"],
    plugins,
    rules: toolingRules,
  },
);
