import { contentHash } from "@andornaut/game-kit/build/contentHash";

// Where a build writes the atlas pages: under the path the headers and the service worker treat
// as content-hashed build output.
const HASHED_ART_DIR = "assets/art";

// An atlas page's file name in the build output, with its content hash.
export function atlasPageFileName(page: number, extension: string, bytes: Uint8Array): string {
  return `${HASHED_ART_DIR}/atlas-${page}-${contentHash(bytes)}.${extension}`;
}
