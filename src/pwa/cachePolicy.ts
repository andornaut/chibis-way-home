import type { CachePolicy } from "@andornaut/game-kit/runtime/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the router worker, the page's
// launch and the build share. Content-hashed build output is under /assets/. Each build installs
// complete and verified into its own cache; the router serves a window its pinned build, or the
// active one, and a staged update becomes active at the next launch or through Update now.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "chibis-way-home-",
  hashedAssetPrefix: "/assets/",
};

// The game's sounds, each with its format alternatives, which the build lists in its manifest:
// none, since the game has no sound (Phaser is built without it, src/build/phaserBuild.ts).
export const SOUNDS: Readonly<Record<string, readonly string[]>> = {};
// The sound format the launch installs, the extension of the alternatives the game plays. With no
// sounds there is no format to choose, so it is undefined, which installs every listed file.
export const SOUND_FORMAT: string | undefined = undefined;

// The router worker the build writes (precachePlugin.ts), which the game page's launch and the
// home page register with scope "/".
export const SERVICE_WORKER_URL = "/sw.js";
