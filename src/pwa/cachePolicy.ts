import type { CachePolicy } from "@andornaut/game-kit/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the service worker and the precache
// build share. Content-hashed build output is under /assets/. A controlled page loads every
// precached file, the page itself and the web app manifest among them, from its version's cache;
// a deploy reaches it only through the Update card. The install verifies each unhashed file
// against the content hash the build records, so the host must serve the built bytes unchanged.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "chibis-way-home-",
  hashedAssetPrefix: "/assets/",
};
