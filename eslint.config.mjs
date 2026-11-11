import { readdirSync } from "node:fs";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { createNodeResolver } from "eslint-plugin-import-x/node-resolver";
import noCycle from "eslint-plugin-import-x/rules/no-cycle";
import noRestrictedPaths from "eslint-plugin-import-x/rules/no-restricted-paths";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

const SOURCE_FILES = ["src/**/*.ts"];
const PHASER_FILES = ["src/main.ts", "src/scenes/**"];
const TEST_FILES = ["src/**/*.test.ts"];

// The import boundaries, one row each: the files outside `except` may not import what `forbid`
// names. Logic, layout and data stay free of Phaser and the scenes, so they run in unit tests
// without a renderer.
const BOUNDARIES = [
  {
    except: PHASER_FILES,
    forbid: {
      group: ["phaser", "phaser/*", "**/phaser/*", "**/scenes", "**/scenes/*"],
      message:
        "Only src/scenes/ and src/main.ts may import Phaser, the kit's phaser/ modules or a scene.",
    },
  },
  {
    // The certification CLI runs the required-route proofs the tests define.
    except: [...TEST_FILES, "src/tools/chunkPairs.ts"],
    forbid: {
      group: ["**/testing", "**/testing/*"],
      message: "Only tests may import src/testing/.",
    },
  },
];

// The bounded contexts: the folders of src/ each context's files may import, besides its own.
// Tests are exempt, so a test may build its fixtures from any context.
// Each context imports only contexts below it, bottom first: data; core; ai and
// assets; camera and stage; rules; progress; presentation and ui; loading; pwa; the side
// pages (crash, headers, homePage, gallery, tuningPage); scenes; then the tooling (dev, sim,
// tools). "folder/module" allows one module of a folder ("folder/index" its index):
// each is an import that a later move removes, by moving the module into a context or the
// importer out of one. The boundaries above govern src/testing/.
const CONTEXTS = {
  ai: [],
  assets: ["core", "data"],
  camera: ["data"],
  core: ["data"],
  crash: ["data"],
  data: [],
  dev: ["data", "progress", "rules"],
  gallery: ["assets"],
  headers: [],
  homePage: ["data", "ui"],
  loading: ["data", "presentation", "ui"],
  presentation: ["assets", "camera", "core", "data", "progress", "rules", "stage"],
  progress: ["data"],
  pwa: ["assets", "loading", "ui"],
  rules: ["ai", "camera", "core", "data", "stage"],
  scenes: [
    "assets",
    "core",
    "data",
    "dev/mode",
    "dev/step",
    "loading",
    "presentation",
    "progress",
    "pwa",
    "rules",
    "stage",
    "ui",
  ],
  sim: ["ai", "assets", "core", "data", "presentation", "progress", "rules", "stage"],
  stage: ["data"],
  tools: ["assets", "data", "headers", "homePage", "loading", "pwa"],
  tuningPage: ["data", "gallery"],
  ui: ["data", "progress", "rules"],
};

// The components whose files outside them may import only their index.ts, so the index is the
// component's whole contract. Each lists the further modules that outside folders may import
// directly ("*" for every folder). Modules that start page state on load stay out of the
// indexes, so importing an index has no side effects, and the loading entry imports only what
// the loading strip draws, which keeps that entry small.
const INDEXED = {
  assets: {},
  camera: {},
  core: {},
  presentation: { loading: ["./zoneTheme.ts"] },
  progress: { scenes: ["./save/pageSave.ts"] },
  stage: {},
  ui: { "*": ["./dom/ui.css", "./input/frameTurn.ts"] },
};

// CLEANUP (added 2026-11-04): the files of the one value import cycle, where timedHazard imports
// behaviour and behaviourTraversal and behaviourMapPursuit import timedHazardSafe from
// timedHazard. Remove this exemption once the cycle is broken.
const CYCLE_EXEMPT_FILES = [
  "src/rules/behaviour.ts",
  "src/rules/behaviourAbilities.ts",
  "src/rules/behaviourIdle.ts",
  "src/rules/behaviourIntent.ts",
  "src/rules/behaviourMapPursuit.ts",
  "src/rules/behaviourPursuitAbilities.ts",
  "src/rules/behaviourRecoveryAbilities.ts",
  "src/rules/behaviourTraversal.ts",
  "src/rules/timedHazard.ts",
];

const IMPORT_X = { rules: { "no-cycle": noCycle, "no-restricted-paths": noRestrictedPaths } };
const IMPORT_X_SETTINGS = {
  "import-x/extensions": [".ts"],
  "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".js"] })],
};

const SRC_FOLDERS = folders("src").filter((folder) => folder !== "testing");

function folders(path) {
  return readdirSync(new URL(path, import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

// An import names a folder only by its path, so the pattern matches only a relative path that
// climbs straight into a forbidden folder (`../scenes/x`). A module beside the importer
// (`./camera`), a subfolder of an allowed folder (`../data/scenes/x`) and a package subpath
// (`@andornaut/game-kit/save/x`) that share a forbidden folder's name stay allowed, and a
// context's own subfolders are never forbidden to it.
function contextBoundary(context) {
  const allowed = CONTEXTS[context];
  const own = [context, ...folders(`src/${context}`)];
  const modules = allowed.filter((entry) => entry.includes("/"));
  const forbidden = SRC_FOLDERS.filter(
    (folder) => !own.includes(folder) && !allowed.includes(folder),
  ).map((folder) => {
    const exceptions = modules
      .filter((entry) => entry.startsWith(`${folder}/`))
      .map((entry) => escapeRegex(entry.slice(folder.length + 1)));
    const rest = exceptions.length === 0 ? "" : `(?!(?:${exceptions.join("|")})$)`;
    const index = exceptions.includes("index") ? "" : "|$";
    return `${escapeRegex(folder)}(?:/${rest}${index})`;
  });
  return {
    files: [`src/${context}/**/!(*.test).ts`],
    forbid: {
      message:
        allowed.length === 0
          ? `src/${context}/ may import nothing from src/.`
          : `src/${context}/ may import only ${allowed.join(", ")} from src/.`,
      regex: `^(?:\\.\\./)+(?:${forbidden.join("|")})`,
    },
  };
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Every way to pick some of the items, the empty pick included.
function subsets(items) {
  return items.reduce((picks, item) => [...picks, ...picks.map((pick) => [...pick, item])], [[]]);
}

// A files entry that matches only what matches one glob from each list: within a list the globs
// are alternatives, and a nested files array requires all of its globs.
function allOf(globLists) {
  return globLists
    .reduce(
      (combos, globs) => combos.flatMap((combo) => globs.map((glob) => [...combo, glob])),
      [[]],
    )
    .map((combo) => (combo.length === 1 ? combo[0] : combo));
}

// A later no-restricted-imports replaces an earlier one rather than adding to it, so the configs
// partition the files: one config per context (or none) and set of boundaries that binds a file,
// listing the patterns of the context and of every boundary in the set.
function boundaryConfigs() {
  const contexts = Object.keys(CONTEXTS).map(contextBoundary);
  return [undefined, ...contexts].flatMap((context) =>
    subsets(BOUNDARIES)
      .filter((binding) => context !== undefined || binding.length > 0)
      .map((binding) => {
        const exempt = BOUNDARIES.filter((boundary) => !binding.includes(boundary));
        return {
          files: allOf([context?.files ?? SOURCE_FILES, ...exempt.map(({ except }) => except)]),
          ignores: [
            ...binding.flatMap(({ except }) => except),
            ...(context === undefined ? contexts.flatMap(({ files }) => files) : []),
          ],
          rules: {
            "no-restricted-imports": [
              "error",
              { patterns: [...binding, ...(context ? [context] : [])].map(({ forbid }) => forbid) },
            ],
          },
        };
      }),
  );
}

export default defineConfig(
  {
    // .claude/ and .worktrees/ hold agent and role worktrees: full copies of the repo that CI
    // never checks out.
    ignores: [".claude/", ".worktrees/", ".wrangler/", "dist/", "node_modules/"],
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
    files: SOURCE_FILES,
    plugins,
    rules: sourceRules,
  },
  ...boundaryConfigs(),
  // No import cycles: a module in a cycle can run before what it imports has loaded. Type-only
  // imports are erased at build time, so they never form one.
  {
    files: SOURCE_FILES,
    ignores: CYCLE_EXEMPT_FILES,
    plugins: { "import-x": IMPORT_X },
    rules: { "import-x/no-cycle": "error" },
    settings: IMPORT_X_SETTINGS,
  },
  // Index-only components: resolved paths, so a relative path of any depth is caught.
  {
    files: SOURCE_FILES,
    plugins: { "import-x": IMPORT_X },
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: Object.entries(INDEXED).flatMap(([component, { "*": all = [], ...byFolder }]) => {
            const zone = (target, exposed) => ({
              except: ["./index.ts", ...all, ...exposed],
              from: `./src/${component}`,
              message: `Import src/${component}/ through its index.ts.`,
              target,
            });
            const others = [component, ...Object.keys(byFolder)].join("|");
            return [
              zone(["./src/*.ts", `./src/!(${others})/**`], []),
              ...Object.entries(byFolder).map(([folder, exposed]) =>
                zone(`./src/${folder}/**`, exposed),
              ),
            ];
          }),
        },
      ],
    },
    settings: IMPORT_X_SETTINGS,
  },
  // Rules and the agent core replay from explicit seeds and step inputs, never ambient entropy
  // or wall-clock time.
  {
    files: ["src/ai/**/*.ts", "src/rules/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { message: "Pass time in as a step input.", name: "Date" },
        { message: "Pass time in as a step input.", name: "performance" },
      ],
      "no-restricted-properties": [
        "error",
        { message: "Use a seeded game-kit random stream.", object: "Math", property: "random" },
        { message: "Pass time in as a step input.", object: "globalThis", property: "Date" },
        { message: "Pass time in as a step input.", object: "globalThis", property: "performance" },
      ],
    },
  },
  // Config files: they produce what ships rather than being it.
  {
    files: ["*.ts", "*.js", "*.mjs", "art/tools/**/*.ts"],
    plugins,
    rules: toolingRules,
  },
);
