// What vite.config.ts takes from the repository's code, in one module so the config loads it
// through a single Vite module runner, which resolves @andornaut/game-kit as the app does.
export { atlasPlugin } from "./atlas/atlasPlugin.ts";
export { certifiedPoolsPlugin } from "./certifiedPools.ts";
export { homePagePlugin, webManifestPlugin } from "./homePageHtml.ts";
export { ICONS } from "./icons.ts";
export { loadingPlugin } from "./loadingHtml.ts";
export { PHASER_BUILD } from "./phaserBuild.ts";
export { precachePlugin } from "./precachePlugin.ts";
export { publicFilesPlugin, UNNAMED_PUBLIC_FILES } from "./publicFiles.ts";
export { securityHeadersPlugin } from "./securityHeadersPlugin.ts";
export { hashedIconsPlugin } from "@andornaut/game-kit/build/hashedIconsPlugin";
export { phaserBuildPlugin } from "@andornaut/game-kit/build/phaserBuildPlugin";
