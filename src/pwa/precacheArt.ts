import {
  ART_MANIFEST_FILE,
  ART_PATH,
  type ArtManifest,
  BIRD_SHEET_URL,
  BUNDLED_ART_DATA,
} from "../assets/index.ts";
import { UI_FONT_RESOURCES } from "../ui/index.ts";

export const ART_MANIFEST_URL = `${ART_PATH}${ART_MANIFEST_FILE}`;

// The art files a build emits for caching: the data files the code does not bundle, tileset
// descriptions, standalone images, the native crash bird and the UI's two typefaces. The manifest
// and bundled data ship inside the code; other PNGs are on the build's atlas pages
// (src/tools/atlas/atlasPlugin.ts), which the build lists apart.
export function artUrls(manifest: ArtManifest): string[] {
  const files = [
    ...manifest.data.filter(({ key }) => !(key in BUNDLED_ART_DATA)).map((data) => data.json),
    ...manifest.tilesets.map((tileset) => tileset.json),
    ...manifest.images.map((image) => image.png),
  ];
  return [
    ...files.map((file) => `${ART_PATH}${file}`),
    BIRD_SHEET_URL,
    ...UI_FONT_RESOURCES.map(({ url }) => url),
  ];
}
