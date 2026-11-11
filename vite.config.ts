// Node types for this config file only, so browser code type-checks without Node globals.
/// <reference types="node" />

import { globSync, readFileSync } from "node:fs";

import { gameViteConfig } from "@andornaut/game-kit/web/build/vite/gameConfig";

import type * as ConfigModules from "./src/tools/viteConfigModules.ts";

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
  configModules: "src/tools/viteConfigModules.ts",
  pages: {
    art: "pages/art/index.html",
    main: "pages/index.html",
    play: "pages/play/index.html",
    tuning: "pages/tuning/index.html",
  },
  plugins: (
    {
      ICONS,
      PHASER_BUILD,
      atlasPlugin,
      hashedIconsPlugin,
      homePagePlugin,
      loadingPlugin,
      phaserBuildPlugin,
      precachePlugin,
      securityHeadersPlugin,
      webManifestPlugin,
    },
    repoPath,
  ) => {
    const atlas = atlasPlugin();
    return [
      homePagePlugin(),
      loadingPlugin(),
      atlas,
      phaserBuildPlugin(PHASER_BUILD),
      hashedIconsPlugin({ icons: ICONS }),
      webManifestPlugin(),
      precachePlugin("play/index.html", repoPath("src/pwa/serviceWorker.ts"), atlas.api.pageUrls),
      securityHeadersPlugin(),
    ];
  },
  previewHost: "chibi-preview",
  repoRoot: import.meta.dirname,
  // Preserve Vitest's existing Node per-test default.
  testTimeout: 5_000,
}).then((config) => ({
  ...config,
  test: {
    ...config.test,
    // Each project names its own tests, since a project extends the root include list.
    include: [],
    maxWorkers: 4,
    projects: [
      { extends: true, test: { exclude: DOM_TESTS, include: [TESTS], name: "node" } },
      { extends: true, test: { environment: "happy-dom", include: DOM_TESTS, name: "dom" } },
    ],
    // game-kit's Phaser adapters import phaser at runtime; inlining them lets a test's phaser mock apply.
    server: { deps: { inline: ["@andornaut/game-kit"] } },
  },
}));
