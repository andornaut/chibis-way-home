// Art's files as the game reads them: the manifest and json-hash sprite sheets, the build's atlas
// manifest, sprite contact silhouettes and the bird's frame size.
export {
  ART_MANIFEST_FILE,
  ART_MANIFEST_KEY,
  ART_PATH,
  artHitboxes,
  type ArtManifest,
  sheetFrameSize,
} from "./aseprite";
export {
  asepriteSheetOf,
  type AtlasFrame,
  type AtlasManifest,
  atlasPageKey,
  type AtlasTexture,
  BASE_FRAME,
} from "./atlasManifest";
export { BIRD_FRAME } from "./birdFrame";
export { CONTACT_SILHOUETTES, spriteContacts } from "./spriteContacts";
