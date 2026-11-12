import * as kit from "@andornaut/game-kit/web/headers/vite/securityHeadersPlugin";
import type { Plugin } from "vite";

import {
  BASE_DIRECTIVES,
  COMMON_RULE,
  FILE_RULES,
  HASHED_ASSET_PATH,
  PAGE_RULES,
  pageProblem,
} from "./securityPolicy.ts";

const HEADING =
  "Written by the build from src/headers/securityPolicy.ts and the hashes of each page's inline " +
  "blocks.";

// The kit's security headers plugin with the game's policy (securityPolicy.ts): writes
// dist/_headers with the common headers, the file rules and a Content-Security-Policy per page.
export function securityHeadersPlugin(): Plugin {
  return kit.securityHeadersPlugin({
    base: BASE_DIRECTIVES,
    checkPage: pageProblem,
    fileRules: [COMMON_RULE, ...FILE_RULES],
    hashedAssetPath: HASHED_ASSET_PATH,
    heading: HEADING,
    pageRules: PAGE_RULES,
  });
}
