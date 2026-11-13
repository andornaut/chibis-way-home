import type { CachePolicy } from "@andornaut/game-kit/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the service worker and the precache
// build share. Content-hashed build output is under /assets/. A controlled page loads every
// precached file from its pinned build's cache, fetching only missing files. Updates stage in
// separate caches and activate on a fresh document launch or Update now, never title or resume.
// Unhashed responses must match the active build's recorded content hashes.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "chibis-way-home-",
  hashedAssetPrefix: "/assets/",
};
