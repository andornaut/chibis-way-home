import { bundleDependencies } from "@andornaut/game-kit/build/precacheList";
import { precachePlugin as kitPrecachePlugin } from "@andornaut/game-kit/build/precachePlugin";
import type { Plugin } from "vite";

import type { ArtManifest } from "../assets/index.ts";
import { CACHE_POLICY, SOUNDS } from "./cachePolicy.ts";
import { FILE_READ_CONCURRENCY, mapBounded } from "./mapBounded.ts";
import { ART_MANIFEST_URL, artUrls, bootArtUrls } from "./precacheArt.ts";

// The kit's precache plugin with the game's cache policy, building the router /sw.js from
// serviceWorkerSource (serviceWorker.ts) and writing the build's manifest of the game page at
// pageHtmlFile and what it loads, with its pointer /.game-kit/build.json. BootScene loads the art
// at runtime rather than linking it, and the kit lists only build output beyond the page's links,
// so a first plugin emits every file it loads from public/art/ into the build output at its own
// path, asking the atlas which keys and pages the build packs. The boot files, which the
// launch counts into the first install's one progress value, are the atlas pages and the art
// BootScene's file load reads.
export function precachePlugin(
  pageHtmlFile: string,
  serviceWorkerSource: string,
  atlas: {
    pageUrls(): readonly string[];
    textureKeys(): readonly string[];
  },
): Plugin[] {
  let urls: string[] = [];
  let boot: string[] = [];
  const deferred = new Set<string>();
  // Keep the static entry closure and crash resources direct. The game import runs only after
  // the launch selects its routed build.
  const archiveOnly = (url: string) =>
    deferred.has(url) ||
    atlas.pageUrls().includes(url) ||
    (url.endsWith(".json") && boot.includes(url));
  const emitArt: Plugin = {
    apply: "build",
    async generateBundle(_options, bundle) {
      const entries = Object.values(bundle).filter((file) => file.type === "chunk" && file.isEntry);
      const game = Object.values(bundle).find(
        (file) => file.type === "chunk" && file.facadeModuleId?.endsWith("/src/main.ts"),
      );
      if (game === undefined) {
        this.error("The deferred game entry is missing");
      }
      const staticFiles = Object.fromEntries(
        Object.entries(bundle).map(([name, file]) => [
          name,
          file.type === "chunk" ? { ...file, dynamicImports: [] } : file,
        ]),
      );
      const direct = new Set(
        bundleDependencies(
          staticFiles,
          entries.map(({ fileName }) => fileName),
        ),
      );
      for (const name of bundleDependencies(bundle, [game.fileName])) {
        if (!direct.has(name)) {
          deferred.add(`/${name}`);
        }
      }
      const { publicDir } = this.environment.config;
      const read = (url: string) => this.fs.readFile(`${publicDir}${url}`);
      const manifest = JSON.parse(
        new TextDecoder().decode(await read(ART_MANIFEST_URL)),
      ) as ArtManifest;
      boot = bootArtUrls(new Set(atlas.textureKeys()), manifest);
      urls = artUrls(boot);
      const files = await mapBounded(
        FILE_READ_CONCURRENCY,
        async (url) => [url, await read(url)] as const,
        urls,
      );
      for (const [url, source] of files) {
        this.emitFile({ fileName: url.slice(1), source, type: "asset" });
      }
    },
    name: "chibis-way-home-precache-art",
  };
  return [
    emitArt,
    kitPrecachePlugin({
      boot: () => [...boot, ...atlas.pageUrls()],
      groupedFirstInstall: { archiveOnly },
      hashedFiles: () => ({ sounds: SOUNDS, urls: [...urls, ...atlas.pageUrls()] }),
      pageHtmlFile,
      policy: CACHE_POLICY,
      serviceWorkerSource,
      updateGroup: (url) => {
        if (url.startsWith("/assets/phaser-")) {
          return "engine";
        }
        if (deferred.has(url)) {
          return "game";
        }
        if (archiveOnly(url)) {
          return "game-art";
        }
        return "shell";
      },
    }),
  ];
}
