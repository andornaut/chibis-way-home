import { ART_MANIFEST_FILE, ART_PATH, type ArtManifest } from "../assets/index.ts";
import { UI_FONT_RESOURCES } from "../ui/index.ts";

export const ART_MANIFEST_URL = `${ART_PATH}${ART_MANIFEST_FILE}`;

// Standalone manifest resources and the UI's two explicit typefaces are emitted for caching.
// Boot loads data and tileset descriptions; site images remain standalone.
// Other PNGs are on the build's atlas pages
// (src/tools/atlas/atlasPlugin.ts), which the build lists apart.
export function artUrls(manifest: ArtManifest): string[] {
  const files = [
    ...manifest.data.map((data) => data.json),
    ...manifest.tilesets.map((tileset) => tileset.json),
    ...manifest.images.map((image) => image.png),
  ];
  return [
    ART_MANIFEST_URL,
    ...files.map((file) => `${ART_PATH}${file}`),
    ...UI_FONT_RESOURCES.map(({ url }) => url),
  ];
}
