// The build's atlas manifest, which src/tools/atlas/atlasPlugin.ts writes: null on the dev
// server, where each art file loads on its own.
declare module "virtual:atlas-manifest" {
  const manifest: import("./atlasManifest.ts").AtlasManifest | null;
  export default manifest;
}
