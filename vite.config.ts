// Node types for this config file only, so browser code type-checks without Node globals.
/// <reference types="node" />

import type * as ConfigModules from "./src/tools/viteConfigModules.ts";
import { gameViteConfig } from "./vendor/game-kit/src/build/vite/gameConfig";

export default gameViteConfig<typeof ConfigModules>({
  chunkSizeWarningLimit: 1100,
  configModules: "src/tools/viteConfigModules.ts",
  pages: { main: "pages/index.html", play: "pages/play/index.html" },
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
      precachePlugin("play/index.html", repoPath("src/pwa/serviceWorker.ts"), atlas.api.pageUrls),
      securityHeadersPlugin(),
    ];
  },
  previewHost: "duck-preview",
  repoRoot: import.meta.dirname,
  // Preserve Vitest's existing Node per-test default.
  testTimeout: 5_000,
});
