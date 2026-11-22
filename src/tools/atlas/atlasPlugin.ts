import { encodeLosslessWebp } from "@andornaut/art-kit/build/webp";
import type { Plugin } from "vite";

import {
  ART_MANIFEST_FILE,
  ART_PATH,
  type ArtManifest,
  type AtlasManifest,
} from "../../assets/index.ts";
import { STAGE_PREVIEWS } from "../../data/stagePreviews.ts";
import { buildAtlas } from "./atlasBuild.ts";
import { atlasPageFileName } from "./hashedArt.ts";

// The module whose default export is the build's AtlasManifest, or null on the dev server.
export const ATLAS_MODULE = "virtual:atlas-manifest";
// Vite's prefix for a module id that names no file.
const RESOLVED_ATLAS_MODULE = `\0${ATLAS_MODULE}`;

interface AtlasPluginApi {
  // The URLs of the build's atlas pages, once buildStart has run.
  pageUrls(): readonly string[];
  // The keys supplied by the loaded pages instead of standalone game files.
  textureKeys(): readonly string[];
}

// Writes the shared art and the stage previews to separate groups of lossless WebP pages.
// The atlas module maps every packed key and frame to its page and rect. The dev server
// loads each file under public/art/ on its own.
export function atlasPlugin(): Plugin & { api: AtlasPluginApi } {
  let manifest: AtlasManifest | null = null;
  return {
    api: {
      pageUrls: () => manifest?.pages.map(({ url }) => url) ?? [],
      textureKeys: () => manifest?.textures.map(({ key }) => key) ?? [],
    },
    async buildStart() {
      const { config, logger } = this.environment;
      if (config.command !== "build") {
        return;
      }
      const artDir = `${config.publicDir}${ART_PATH}`;
      const readArt = async (path: string) => this.fs.readFile(`${artDir}${path}`);
      const art = JSON.parse(
        new TextDecoder().decode(await readArt(ART_MANIFEST_FILE)),
      ) as ArtManifest;
      const dependencies = { encode: encodeLosslessWebp, readArt };
      const shared = await buildAtlas(dependencies, { ...art, images: [] });
      const previewKeys = new Set(Object.values(STAGE_PREVIEWS));
      const previews = await buildAtlas(dependencies, {
        backdrops: [],
        images: art.images.filter(({ key }) => previewKeys.has(key)),
        sprites: [],
        tilesets: [],
      });
      manifest = {
        pages: [...shared.pages, ...previews.pages].map(({ bytes: source, image }, page) => {
          const fileName = atlasPageFileName(page, "webp", source);
          this.emitFile({ fileName, source, type: "asset" });
          logger.info(`atlas: ${fileName} ${image.width}x${image.height}, ${source.length} B`);
          return { height: image.height, url: `/${fileName}`, width: image.width };
        }),
        textures: [
          ...shared.textures,
          ...previews.textures.map((texture) => ({
            ...texture,
            page: texture.page + shared.pages.length,
          })),
        ],
      };
    },
    load(id) {
      return id === RESOLVED_ATLAS_MODULE
        ? `export default ${JSON.stringify(manifest)};`
        : undefined;
    },
    name: "bird-atlas",
    resolveId(id) {
      return id === ATLAS_MODULE ? RESOLVED_ATLAS_MODULE : undefined;
    },
  };
}
