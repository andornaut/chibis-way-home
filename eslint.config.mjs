import { readdirSync } from "node:fs";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { createNodeResolver } from "eslint-plugin-import-x/node-resolver";
import noCycle from "eslint-plugin-import-x/rules/no-cycle";
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
    except: TEST_FILES,
    forbid: {
      group: ["**/testing", "**/testing/*"],
      message: "Only tests may import src/testing/.",
    },
  },
];

// The bounded contexts: the folders of src/ each context's files may import, besides its own.
// Each context imports only contexts below it, bottom first: data; platform, ai, assets and
// settings; rules; save; dialogue; layout; input; view; pause; loading; pwa; the side pages
// (crash, headers, homePage, gallery, tuningPage); scenes; then the tooling (dev, sim, tools).
// "folder/module" allows one module of a folder: each is an import that a later move removes,
// by moving the module into a context or the importer out of one. The boundaries above govern
// src/testing/.
const CONTEXTS = {
  ai: [],
  assets: [],
  crash: ["data", "platform"],
  data: [
    "ai/randomStreams",
    "rules/assemble",
    "rules/behaviour",
    "rules/behaviourReach",
    "rules/behaviourTraversal",
    "rules/bird",
    "rules/chunk",
    "rules/effectiveCollision",
    "rules/elementBinding",
    "rules/flyLanding",
    "rules/map",
    "rules/mapDestinations",
    "rules/perception",
    "rules/stageCompletion",
    "rules/step",
    "rules/tiles",
    "rules/timedHazard",
    "rules/zone",
    "rules/zonePlans",
    "sim/catalogue",
    "sim/zoneWalk",
    "view/aseprite",
    "view/backgroundGround",
    "view/bird",
    "view/chunkParallax",
    "view/crumblingPresentation",
    "view/objectArt",
    "view/tiles",
  ],
  dev: ["data", "platform", "rules"],
  dialogue: ["data", "layout/dialogueScreen", "layout/hitAreas", "pause/focusInput"],
  gallery: ["view"],
  headers: ["platform"],
  homePage: ["data", "layout", "platform", "rules", "view"],
  input: ["data", "layout", "pause/focusInput", "platform"],
  layout: [
    "data",
    "dialogue",
    "input/intent",
    "input/mapInput",
    "platform",
    "rules",
    "save",
    "view/actionHelp",
    "view/death",
    "view/mapDestinations",
    "view/mapPath",
    "view/statsStatement",
  ],
  loading: ["data", "layout", "platform", "view"],
  pause: [],
  platform: [],
  pwa: ["loading", "platform", "view"],
  rules: [
    "ai",
    "data",
    "dialogue/conversation",
    "save/progress",
    "sim/behaviourBounds",
    "sim/zoneWalk",
    "view/behaviour",
    "view/bird",
    "view/camera",
    "view/chunkParallax",
    "view/objectArt",
    "view/tiles",
  ],
  save: ["data", "dev/mode", "platform", "rules", "view/bird"],
  scenes: [
    "assets",
    "data",
    "dev/mode",
    "dev/step",
    "dialogue",
    "input",
    "layout",
    "loading",
    "pause",
    "platform",
    "pwa",
    "rules",
    "save",
    "settings",
    "view",
  ],
  settings: [],
  sim: ["data", "rules", "view"],
  tools: ["assets", "data", "headers", "homePage", "loading", "platform", "pwa", "view"],
  tuningPage: ["data", "gallery"],
  view: ["ai", "data", "dialogue", "input", "layout", "rules"],
};

// CLEANUP (added 2026-11-04): the boss behaviour and timed hazard modules import each other's
// values. Remove this exemption once the timedHazard/behaviour cycle is broken.
const CYCLE_EXEMPT_FILES = ["src/ai/**", "src/rules/behaviour*", "src/rules/timedHazard.ts"];

const SRC_FOLDERS = folders("src").filter((folder) => folder !== "testing");

function folders(path) {
  return readdirSync(new URL(path, import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

// An import names a folder only by its path, so `./view/x` inside src/rules/ reads the same as
// `../view/x` from elsewhere: a context's own subfolders are never forbidden to it. The pattern
// matches only a relative path that climbs straight into a forbidden folder, so a subfolder of
// an allowed folder (`../platform/view/x`) or a package subpath (`@andornaut/game-kit/save/x`)
// that shares a forbidden folder's name stays allowed.
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
    return `${escapeRegex(folder)}(?:/${rest}|$)`;
  });
  return {
    files: [`src/${context}/**/*.ts`],
    forbid: {
      message:
        allowed.length === 0
          ? `src/${context}/ may import nothing from src/.`
          : `src/${context}/ may import only ${allowed.join(", ")} from src/.`,
      regex: `^(?:\\.\\.?/)+(?:${forbidden.join("|")})`,
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
    plugins: { "import-x": { rules: { "no-cycle": noCycle } } },
    rules: { "import-x/no-cycle": "error" },
    settings: {
      "import-x/extensions": [".ts"],
      "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".js"] })],
    },
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
    files: ["*.ts", "*.js", "*.mjs"],
    plugins,
    rules: toolingRules,
  },
);
