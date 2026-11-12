// The service worker's entry, built to /sw.js by precachePlugin: the kit's worker with the game's
// cache policy. It imports only modules with no browser globals at load, so the build emits it as
// one classic script with no imports.
import { runServiceWorker } from "@andornaut/game-kit/web/pwa/dom/serviceWorker";
import type { PrecacheManifest } from "@andornaut/game-kit/web/pwa/precacheList";

import { CACHE_POLICY } from "./cachePolicy.ts";

// Replaced with the precache manifest's JSON when the build writes sw.js.
declare const GAME_KIT_PRECACHE_MANIFEST: PrecacheManifest;

runServiceWorker(CACHE_POLICY, GAME_KIT_PRECACHE_MANIFEST);
