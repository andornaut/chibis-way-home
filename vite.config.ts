// Node types for this config file only, so browser code type-checks without Node globals.
/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runnerImport } from "vite";
import { defineConfig } from "vitest/config";

import type * as ConfigModules from "./src/tools/viteConfigModules.ts";

// An absolute path in this repository. Vite resolves relative paths against root, which is
// pages/, so every path below goes through here instead.
function repoPath(path: string): string {
  return resolve(import.meta.dirname, path);
}

// @andornaut/game-kit/<path> is the kit's module at <path>, as in tsconfig.json's paths.
const KIT_ALIAS = { "@andornaut/game-kit": repoPath("vendor/game-kit/src") };

// Vite bundles this file without its own resolve.alias, so the repository's code, which imports
// the kit by its alias, loads through a module runner given the alias.
const {
  module: {
    ICONS,
    PHASER_BUILD,
    PHASER_ENTRY_ID,
    atlasPlugin,
    gitHead,
    hashedIconsPlugin,
    homePagePlugin,
    loadingPlugin,
    phaserBuildPlugin,
    precachePlugin,
    securityHeadersPlugin,
    shortCommit,
  },
} = await runnerImport<typeof ConfigModules>(repoPath("src/tools/viteConfigModules.ts"), {
  configFile: false,
  resolve: { alias: KIT_ALIAS },
});

const atlas = atlasPlugin();

const packageVersion: string = JSON.parse(readFileSync(repoPath("package.json"), "utf8")).version;

export default defineConfig({
  build: {
    // Outside root, so Vite would leave the previous build's files in place without emptyOutDir.
    emptyOutDir: true,
    outDir: repoPath("dist"),
    // Each page's path under pages/ is its URL. public/ is copied as-is.
    rolldownOptions: {
      input: {
        main: repoPath("pages/index.html"),
        play: repoPath("pages/play/index.html"),
      },
      // Phaser and phaserBuildPlugin's entry go in their own chunk, so a game code change keeps
      // its hashed file name and a new service worker's precache gets it from the browser's HTTP
      // cache.
      output: {
        codeSplitting: {
          groups: [
            {
              name: "phaser",
              test: (id: string) =>
                id === PHASER_ENTRY_ID || /[\\/]node_modules[\\/]phaser[\\/]/.test(id),
            },
          ],
        },
      },
    },
    // The Phaser chunk alone is about 1 MB minified, so the 500 kB default always warns.
    // Set just above it so that growth in Phaser or game code still warns.
    chunkSizeWarningLimit: 1100,
  },
  // The container name the Playwright MCP reaches the dev or preview server by,
  // over the playwright-mcp Docker network. Vite rejects any other Host header.
  preview: {
    allowedHosts: ["duck-preview"],
  },
  // The build label's version and commit (the kit's build/buildInfo.d.ts); the commit reads "dev"
  // without git. Fixed per commit, so two builds of one commit match.
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __COMMIT__: JSON.stringify(shortCommit(() => gitHead(repoPath(".")), process.env)),
  },
  // atlasPlugin, in a build only, packs every PNG art's manifest lists into atlas pages with
  // content-hashed names, and gives the game the atlas manifest that maps each art key to them.
  // phaserBuildPlugin, in a build only, bundles Phaser from its source as PHASER_BUILD sets out:
  // without the namespaces the game does not use, the Canvas renderer or sound.
  // hashedIconsPlugin writes each icon under a content-hashed name and points the pages and the
  // web app manifest there.
  // precachePlugin writes /sw.js, the service worker that precaches the game for offline play.
  // securityHeadersPlugin writes /_headers, the response headers with each page's CSP.
  plugins: [
    homePagePlugin(),
    loadingPlugin(),
    atlas,
    phaserBuildPlugin(PHASER_BUILD),
    hashedIconsPlugin({ icons: ICONS }),
    precachePlugin("play/index.html", repoPath("src/pwa/serviceWorker.ts"), atlas.api.pageUrls),
    securityHeadersPlugin(),
  ],
  publicDir: repoPath("public"),
  // The pages load their modules as /src/..., which names the repository's src/ rather than
  // pages/src/. The shared kit is a committed copy, imported as @andornaut/game-kit/<path>.
  resolve: {
    alias: {
      "/src": repoPath("src"),
      ...KIT_ALIAS,
    },
  },
  root: repoPath("pages"),
  server: {
    allowedHosts: ["duck-preview"],
    // The dev server serves src/ and node_modules/ from outside root, as /@fs/ URLs.
    fs: { allow: [repoPath(".")] },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "vendor/game-kit/src/**/*.test.ts"],
    root: repoPath("."),
  },
});
