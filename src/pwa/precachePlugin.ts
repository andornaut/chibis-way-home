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
// path, for the kit's to name with the atlas pages atlasPageUrls gives. The boot files, which the
// launch counts into the first install's one progress value, are the atlas pages and the art
// BootScene's file load reads.
export function precachePlugin(
  pageHtmlFile: string,
  serviceWorkerSource: string,
  atlasPageUrls: () => readonly string[],
): Plugin[] {
  let urls: string[] = [];
  let boot: string[] = [];
  const emitArt: Plugin = {
    apply: "build",
    async generateBundle() {
      const { publicDir } = this.environment.config;
      const read = (url: string) => this.fs.readFile(`${publicDir}${url}`);
      const manifest = JSON.parse(
        new TextDecoder().decode(await read(ART_MANIFEST_URL)),
      ) as ArtManifest;
      urls = artUrls(manifest);
      boot = bootArtUrls(manifest);
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
      boot: () => [...boot, ...atlasPageUrls()],
      hashedFiles: () => ({ sounds: SOUNDS, urls: [...urls, ...atlasPageUrls()] }),
      pageHtmlFile,
      policy: CACHE_POLICY,
      serviceWorkerSource,
    }),
  ];
}
