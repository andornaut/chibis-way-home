import { existsSync, readdirSync, readFileSync } from "node:fs";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { createNodeResolver } from "eslint-plugin-import-x/node-resolver";
import extensions from "eslint-plugin-import-x/rules/extensions";
import noCycle from "eslint-plugin-import-x/rules/no-cycle";
import noRestrictedPaths from "eslint-plugin-import-x/rules/no-restricted-paths";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

const SOURCE_FILES = ["src/**/*.ts"];
const PHASER_FILES = ["src/game.ts", "src/scenes/**"];
const TEST_FILES = ["src/**/*.test.ts"];
const CONFIG_FILES = ["*.ts", "*.js", "*.mjs", "art/tools/**/*.ts"];

// The import boundaries, one row each: the files outside `except` may not import what `forbid`
// names. Logic, layout and data stay free of Phaser and the scenes, so they run in unit tests
// without a renderer.
const BOUNDARIES = [
  {
    except: PHASER_FILES,
    forbid: {
      group: ["phaser", "phaser/*", "**/phaser/*", "**/scenes", "**/scenes/*"],
      message:
        "Only src/scenes/ and src/game.ts may import Phaser, the kit's phaser/ modules or a scene.",
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

// The source bands, lowest first, each a list of layers lowest first. A group is a file directly in
// src/ (`game.ts`), a folder of src/ (`ui`) or an area: a subfolder that is a group of its own
// (`ui/binding`), which its folder does not hold. Outside the tests a module imports its own group
// and the groups of lower layers, type-only imports, re-exports and dynamic imports included: never
// another group of its own layer or a higher one, and a folder or area only through its index.ts,
// `data` excepted. The areas presentation/zoneTheme, ui/binding and ui/dim are what the page's
// first chunk loads, held apart from their folders' entries, which would pull the game's modules
// into that chunk.
const SOURCE_BANDS = [
  ["Foundation", [["data"], ["ai", "buildLabel.ts", "camera", "core", "stage"]]],
  ["Model", [["assets", "rules/bird"], ["rules/boss"], ["rules/stage"], ["rules/zone"]]],
  ["Saving", [["progress"], ["save"]]],
  [
    "Presentation",
    [
      ["presentation/zoneTheme", "ui/binding", "ui/dim"],
      ["presentation", "ui"],
    ],
  ],
  ["Platform", [["crash", "dev"], ["loading"], ["pwa"]]],
  ["Engine and views", [["scenes"], ["game.ts"]]],
  ["Entries", [["gallery", "homePage", "play.ts", "tuningPage"]]],
  ["Support", [["sim"], ["testing"], ["build", "tools"]]],
];
// The groups whose every module is its own entry: one table to a file.
const OPEN_GROUPS = ["data"];
// The bands whose modules use no ambient entropy or wall-clock time.
const PURE_BANDS = ["Foundation", "Model", "Saving", "Presentation"];

const LAYERS = SOURCE_BANDS.flatMap(([, layers]) => layers);
const GROUPS = LAYERS.flat();
const isFile = (group) => group.endsWith(".ts");

// The group of a module, given as a path relative to src/.
function groupOf(module) {
  const [folder, area, ...rest] = module.split("/");
  return rest.length > 0 && GROUPS.includes(`${folder}/${area}`) ? `${folder}/${area}` : folder;
}

// Every module of src/, tests included, is in exactly one group, so none escapes the zones below.
const unplaced = readdirSync(new URL("src", import.meta.url), { encoding: "utf8", recursive: true })
  .map((name) => name.replaceAll("\\", "/"))
  .filter((name) => name.endsWith(".ts") && !GROUPS.includes(groupOf(name)));
const placedTwice = GROUPS.filter((group, at) => GROUPS.indexOf(group) !== at);
if (unplaced.length > 0 || placedTwice.length > 0) {
  throw new Error(
    `Place each src/ module in one SOURCE_BANDS group: ${[...unplaced, ...placedTwice].join(", ")}`,
  );
}

// The globs over a folder or area's modules, or over those past its index.ts.
function groupGlobs(group, pastEntry = false) {
  const areas = GROUPS.filter((other) => other.startsWith(`${group}/`)).map((other) =>
    other.slice(group.length + 1),
  );
  const folders = areas.length === 0 ? "*" : `!(${areas.join("|")})`;
  return [`src/${group}/${pastEntry ? "!(index)" : "*"}.ts`, `src/${group}/${folders}/**/*.ts`];
}

// What each group may not import. A zone takes either globs or plain paths, so the file groups of
// its own and later layers get a zone of their own. Stylesheets load beside the code that mounts
// what they style, so the globs name only modules.
const LAYER_ZONES = LAYERS.flatMap((groups, layer) =>
  groups.flatMap((group) => {
    const target = isFile(group) ? `src/${group}` : groupGlobs(group);
    const direction = `src/${group} imports only its own group and lower layers (SOURCE_BANDS).`;
    const later = LAYERS.slice(layer)
      .flat()
      .filter((other) => other !== group);
    const earlierFolders = LAYERS.slice(0, layer)
      .flat()
      .filter((other) => !isFile(other) && !OPEN_GROUPS.includes(other));
    const zones = [
      { from: later.filter((other) => !isFile(other)).flatMap((other) => groupGlobs(other)) },
      { from: later.filter(isFile).map((other) => `src/${other}`) },
    ].map(({ from }) => ({ from, message: direction, target }));
    zones.push({
      from: earlierFolders.flatMap((other) => groupGlobs(other, true)),
      message: `src/${group} imports another folder or area only through its index.ts.`,
      target,
    });
    return zones.filter(({ from }) => from.length > 0);
  }),
);

// The modules of the pure bands, tests included.
const PURE_FILES = SOURCE_BANDS.filter(([band]) => PURE_BANDS.includes(band))
  .flatMap(([, layers]) => layers.flat())
  .map((group) => (isFile(group) ? `src/${group}` : `src/${group}/**/*.ts`));
// The sites in the pure bands that may read the clock: a wall-clock budget on a test's loop.
const AMBIENT_SITES = ["src/data/verticalRoutes.test.ts"];

// The size ratchet: every shipped and support module stays within SIZE_LIMIT lines and each of
// its functions within FUNCTION_LIMIT, except the modules SIZE_CEILINGS names, held at their
// present size. A ceiling only falls: lower it when its module shrinks, and remove it once the
// module is within the limit. A file ceiling above its module's present size fails the config.
const SIZE_LIMIT = 500;
const FUNCTION_LIMIT = 150;
const SIZE_CEILINGS = {
  "src/ai/agentProperties.ts": { file: 659 },
  "src/data/behaviours.ts": { file: 1302 },
  "src/data/chunks.ts": { file: 1858 },
  "src/data/types/behaviour.ts": { file: 519 },
  "src/data/types/stage.ts": { file: 558 },
  "src/progress/save/stats.ts": { function: 249 },
  "src/rules/bird/bird.ts": { file: 675, function: 254 },
  "src/rules/boss/behaviour.ts": { file: 2008, function: 208 },
  "src/rules/boss/behaviourInterludes.ts": { function: 156 },
  "src/rules/boss/behaviourLayout.ts": { file: 615, function: 606 },
  "src/rules/boss/behaviourMapPursuit.ts": { file: 520 },
  "src/rules/boss/behaviourPursuitAbilities.ts": { function: 166 },
  "src/rules/boss/behaviourReach.ts": { file: 588 },
  "src/rules/boss/behaviourTraversal.ts": { file: 1264, function: 333 },
  "src/rules/boss/flyLanding.ts": { file: 549 },
  "src/rules/boss/hazardOccupancy.ts": { function: 237 },
  "src/rules/boss/movementMaps.ts": { file: 642 },
  "src/rules/boss/transients.ts": { function: 155 },
  "src/rules/stage/assemble.ts": { file: 1776, function: 253 },
  "src/rules/stage/chunk.ts": { function: 175 },
  "src/rules/stage/tiles.ts": { file: 504, function: 276 },
  "src/rules/zone/zone.ts": { file: 1838, function: 227 },
  "src/save/pageSave.ts": { file: 674 },
  "src/scenes/MapScene.ts": { file: 616, function: 184 },
  "src/scenes/PauseScene.ts": { file: 924 },
  "src/scenes/zoneObjectArt.ts": { file: 764, function: 211 },
  "src/scenes/ZoneScene.ts": { file: 1684 },
  "src/sim/bossProperties.ts": { file: 1024, function: 247 },
  "src/sim/cli.ts": { function: 217 },
  "src/sim/navigation.ts": { file: 1341, function: 563 },
  "src/sim/playability.ts": { file: 638, function: 259 },
  "src/sim/simulate.ts": { file: 826, function: 422 },
  "src/sim/tuning.ts": { function: 182 },
  "src/sim/zoneWalk.ts": { file: 1769, function: 408 },
  "src/testing/bossScenarios.ts": { file: 644 },
  "src/testing/chunks.ts": { file: 677 },
  "src/testing/continuousRequiredRoute.ts": { function: 247 },
  "src/testing/evade.ts": { file: 1767, function: 748 },
  "src/testing/evadeLaunch.ts": { function: 279 },
  "src/testing/evadeProjectileAvoidance.ts": { function: 194 },
  "src/testing/groundedGapController.ts": { function: 248 },
  "src/testing/pairCertify.ts": { file: 842 },
  "src/testing/requiredRouteIntent.ts": { function: 171 },
  "src/tools/chunkPairs.ts": { file: 830, function: 209 },
  "src/tools/stagePreviewCapture.ts": { file: 570 },
};

// max-lines counts every line, so a module's size is its count of line ends.
const staleCeilings = Object.entries(SIZE_CEILINGS)
  .filter(([, { file }]) => file !== undefined)
  .filter(([path, { file }]) => {
    const url = new URL(path, import.meta.url);
    return !existsSync(url) || readFileSync(url, "utf8").split("\n").length - 1 < file;
  })
  .map(([path]) => path);
if (staleCeilings.length > 0) {
  throw new Error(`Lower or remove the SIZE_CEILINGS file ceiling of ${staleCeilings.join(", ")}`);
}

function sizeRules(file = SIZE_LIMIT, fn = FUNCTION_LIMIT) {
  return { "max-lines": ["error", file], "max-lines-per-function": ["error", fn] };
}

const IMPORT_X = {
  rules: { extensions, "no-cycle": noCycle, "no-restricted-paths": noRestrictedPaths },
};
const IMPORT_X_SETTINGS = {
  "import-x/extensions": [".ts"],
  "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".js"] })],
};

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
// partition the files: one config per set of boundaries that binds a file, listing the patterns
// of every boundary in the set.
function boundaryConfigs() {
  return subsets(BOUNDARIES)
    .filter((binding) => binding.length > 0)
    .map((binding) => {
      const exempt = BOUNDARIES.filter((boundary) => !binding.includes(boundary));
      return {
        files: allOf([SOURCE_FILES, ...exempt.map(({ except }) => except)]),
        ignores: binding.flatMap(({ except }) => except),
        rules: {
          "no-restricted-imports": ["error", { patterns: binding.map(({ forbid }) => forbid) }],
        },
      };
    });
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
  // No runtime import cycles: a module in a cycle can run before what it imports has loaded.
  // Type-only imports are erased at build time, so they may form one, and the layers keep it
  // within one group.
  {
    files: SOURCE_FILES,
    plugins: { "import-x": IMPORT_X },
    rules: { "import-x/no-cycle": "error" },
    settings: IMPORT_X_SETTINGS,
  },
  // The layers, by resolved path, so a relative path of any depth is caught. Tests may import any
  // module.
  {
    files: SOURCE_FILES,
    ignores: TEST_FILES,
    plugins: { "import-x": IMPORT_X },
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        { basePath: import.meta.dirname, zones: LAYER_ZONES },
      ],
      // `import("...")` in a type is no import the layer rule sees.
      "no-restricted-syntax": [
        "error",
        "WithStatement",
        {
          message: "Import types with `import type`, which the layer rule checks.",
          selector: "TSImportType",
        },
      ],
    },
    settings: IMPORT_X_SETTINGS,
  },
  // A declaration file keeps `import("...")` types: a top-level import would turn its ambient
  // module into an augmentation.
  {
    files: ["src/**/*.d.ts"],
    rules: { "no-restricted-syntax": ["error", "WithStatement"] },
  },
  // Every relative import names its file, ./x.ts or ./dir/index.ts, so plain node runs the source
  // with type stripping and no resolver. Package imports keep their exported subpaths.
  {
    files: [...SOURCE_FILES, ...CONFIG_FILES],
    plugins: { "import-x": IMPORT_X },
    rules: { "import-x/extensions": ["error", "ignorePackages", { checkTypeImports: true }] },
    settings: IMPORT_X_SETTINGS,
  },
  // The pure bands replay from explicit seeds and step inputs, never ambient entropy or wall-clock
  // time. Each allowed site is named in AMBIENT_SITES.
  {
    files: PURE_FILES,
    ignores: AMBIENT_SITES,
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
  // The size ratchet, over every module of src/ but the tests.
  {
    files: SOURCE_FILES,
    ignores: TEST_FILES,
    rules: sizeRules(),
  },
  ...Object.entries(SIZE_CEILINGS).map(([path, { file, function: fn }]) => ({
    files: [path],
    rules: sizeRules(file, fn),
  })),
  // Config files: they produce what ships rather than being it.
  {
    files: CONFIG_FILES,
    plugins,
    rules: toolingRules,
  },
);
