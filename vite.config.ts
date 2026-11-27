// Node types for this config file only, so browser code type-checks without Node globals.
/// <reference types="node" />

import { globSync, readFileSync } from "node:fs";

import { gameViteConfig } from "@andornaut/game-kit/build/gameConfig";

import type * as ConfigModules from "./src/build/index.ts";

const TESTS = "src/**/*.test.ts";
const DOM_ENVIRONMENT = "// @vitest-environment happy-dom\n";

// The tests that declare the happy-dom environment on their first line. Vitest reads every test
// file's environment comment at once and runs a file whose read fails, as past the check
// container's open-file limit, in the default environment; these are read here one at a time and
// run in their own project, so each always gets happy-dom.
const DOM_TESTS = globSync(TESTS, { cwd: import.meta.dirname }).filter((path) =>
  readFileSync(new URL(path, import.meta.url), "utf8").startsWith(DOM_ENVIRONMENT),
);

export default gameViteConfig<typeof ConfigModules>({
  chunkSizeWarningLimit: 1100,
  configModules: "src/build/index.ts",
  // The player's pages. The development server also serves the gallery (pages/art/) and tuning
  // (pages/tuning/), which the build leaves out.
  pages: {
    main: "pages/index.html",
    play: "pages/play/index.html",
  },
  plugins: (
    {
      ICONS,
      PHASER_BUILD,
      UNNAMED_PUBLIC_FILES,
      atlasPlugin,
      certifiedPoolsPlugin,
      hashedIconsPlugin,
      homePagePlugin,
      loadingPlugin,
      phaserBuildPlugin,
      precachePlugin,
      publicFilesPlugin,
      securityHeadersPlugin,
      webManifestPlugin,
    },
    repoPath,
    metadata,
  ) => {
    const atlas = atlasPlugin();
    return [
      certifiedPoolsPlugin(repoPath("src/data/certified")),
      homePagePlugin(),
      loadingPlugin(),
      atlas,
      phaserBuildPlugin(PHASER_BUILD),
      hashedIconsPlugin({ icons: ICONS }),
      webManifestPlugin(),
      publicFilesPlugin(UNNAMED_PUBLIC_FILES),
      precachePlugin(
        metadata.buildId,
        "play/index.html",
        repoPath("src/pwa/serviceWorker.ts"),
        atlas.api,
      ),
      securityHeadersPlugin(),
    ];
  },
  previewHost: "chibi-preview",
  repoRoot: import.meta.dirname,
  // Preserve Vitest's existing Node per-test default.
  testTimeout: 5_000,
}).then((config) => ({
  ...config,
  // The public files the output names ship instead (publicFilesPlugin), so per-file art the build
  // packs into atlas pages and other development-only copies stay out of the deployment.
  build: { ...config.build, copyPublicDir: false },
  test: {
    ...config.test,
    // Each project names its own tests, since a project extends the root include list.
    include: [],
    // Each worker's V8 sizes its heap from the whole container's memory, so four workers let
    // garbage grow past the check container's limit together. The suite's largest live heap is
    // about 250 MB; the cap makes each worker collect well before the four reach the limit.
    execArgv: ["--max-old-space-size=512"],
    maxWorkers: 4,
    projects: [
      { extends: true, test: { exclude: DOM_TESTS, include: [TESTS], name: "node" } },
      { extends: true, test: { environment: "happy-dom", include: DOM_TESTS, name: "dom" } },
    ],
    // game-kit's Phaser adapters import phaser at runtime; inlining them lets a test's phaser mock apply.
    server: { deps: { inline: ["@andornaut/game-kit"] } },
  },
}));
