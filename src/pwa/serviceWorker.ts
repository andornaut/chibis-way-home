// The service worker's entry, built to /sw.js by precachePlugin: the kit's router with the game's
// cache policy. It downloads nothing; the page's launch installs and stages every build. It
// imports only modules with no browser globals at load, so the build emits it as one classic
// script with no imports.
import { runServiceWorker } from "@andornaut/game-kit/runtime/web/pwa/dom/serviceWorker";

import { CACHE_POLICY } from "./cachePolicy.ts";

runServiceWorker(CACHE_POLICY);
