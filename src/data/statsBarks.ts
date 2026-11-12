import type { DialogueLine } from "./types/index.ts";

export const STATS_BARKS = {
  apartment: {
    clear: { line: "stats-clear-fert", speaker: "ferret" },
    retry: { line: "stats-retry-fert", speaker: "ferret" },
  },
  "blue-cityscape": {
    clear: { line: "stats-clear-archie", speaker: "dog" },
    retry: { line: "stats-retry-archie", speaker: "dog" },
  },
  countryside: {
    clear: { line: "stats-clear-trixi", speaker: "goose" },
    retry: { line: "stats-retry-trixi", speaker: "goose" },
  },
  "home-city": {
    clear: { line: "stats-clear-kiwi", speaker: "raccoon" },
    retry: { line: "stats-retry-kiwi", speaker: "raccoon" },
  },
  industrial: {
    clear: { line: "stats-clear-pebble", speaker: "pigeon" },
    retry: { line: "stats-retry-pebble", speaker: "pigeon" },
  },
  woodland: {
    clear: { line: "stats-clear-bini", speaker: "bear" },
    retry: { line: "stats-retry-bini", speaker: "bear" },
  },
} satisfies Readonly<
  Record<string, { readonly retry: DialogueLine; readonly clear: DialogueLine }>
>;
