// Art's files as the game reads them: the manifest and json-hash sprite sheets, the build's atlas
// manifest, sprite contact silhouettes and the bird's frame size.
export {
  ART_MANIFEST_FILE,
  ART_MANIFEST_KEY,
  ART_PATH,
  artHitboxes,
  type ArtManifest,
  sheetFrameSize,
} from "./aseprite.ts";
export {
  asepriteSheetOf,
  type AtlasFrame,
  type AtlasManifest,
  atlasPageKey,
  type AtlasTexture,
  BASE_FRAME,
} from "./atlasManifest.ts";
export { BIRD_FRAME } from "./birdFrame.ts";
export { CONTACT_SILHOUETTES, spriteContacts } from "./spriteContacts.ts";
