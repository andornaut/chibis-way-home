import type { CachePolicy } from "@andornaut/game-kit/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the service worker and the precache
// build share. Content-hashed build output is under /assets/. The unhashed files every page loads
// (the web app manifest, the nav bar and the page frame) are fetched network-first, so a deploy
// shows on the next load: a page fetched from the network must not get the files of the deploy
// the running worker precached.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "chibis-way-home-",
  hashedAssetPrefix: "/assets/",
  revalidatedUrls: ["/manifest.webmanifest", "/nav.css", "/nav.js", "/site.css"],
};
