import type { ProgressHandle } from "@andornaut/game-kit/progressState";
import type { OfflineActivity } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";

import { beginPrecache } from "./progress.ts";

// The loading bar's view of the shared offline-activity callback, which reports activity only,
// with no download-percentage claim. The kit reports "precaching" for the first visit's precache,
// which the player waits for and the bar shows as unknown work. "updating" (an update's install,
// which runs in the background while the game is playable) and "idle" never show the bar.
export function trackOfflineActivity(): (activity: OfflineActivity) => void {
  let operation: ProgressHandle | undefined;
  return (activity) => {
    if (activity === "precaching") {
      operation ??= beginPrecache();
    } else {
      operation?.finish();
      operation = undefined;
    }
  };
}
