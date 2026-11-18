// What vite.config.ts takes from the repository's code, in one module so the config loads it
// through a single Vite module runner, which resolves @andornaut/game-kit as the app does.
export { securityHeadersPlugin } from "../headers/securityHeadersPlugin.ts";
export { homePagePlugin, webManifestPlugin } from "../homePage/html.ts";
export { loadingPlugin } from "../loading/html.ts";
export { ICONS } from "../pwa/icons.ts";
export { precachePlugin } from "../pwa/precachePlugin.ts";
export { atlasPlugin } from "./atlas/atlasPlugin.ts";
export { PHASER_BUILD } from "./phaserBuild.ts";
export { publicFilesPlugin, UNNAMED_PUBLIC_FILES } from "./publicFiles.ts";
export { hashedIconsPlugin } from "@andornaut/game-kit/build/hashedIconsPlugin";
export { phaserBuildPlugin } from "@andornaut/game-kit/build/phaserBuildPlugin";
