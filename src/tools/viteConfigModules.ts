// What vite.config.ts takes from the repository's code, in one module so the config loads it
// through a single Vite module runner, which resolves @andornaut/game-kit as the app does.
export { securityHeadersPlugin } from "../headers/securityHeadersPlugin";
export { homePagePlugin } from "../homePage/html";
export { loadingPlugin } from "../loading/html";
export { ICONS } from "../pwa/icons";
export { precachePlugin } from "../pwa/precachePlugin";
export { atlasPlugin } from "./atlas/atlasPlugin";
export { PHASER_BUILD } from "./phaserBuild";
export { phaserBuildPlugin } from "@andornaut/game-kit/build/vite/phaserBuildPlugin";
export { hashedIconsPlugin } from "@andornaut/game-kit/pwa/vite/hashedIconsPlugin";
