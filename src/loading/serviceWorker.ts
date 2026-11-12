import type { ProgressHandle } from "@andornaut/game-kit/progressState";
import type { OfflineActivity } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";

import { beginPrecache } from "./progress";

// The loading bar's view of the shared offline-activity callback, which reports activity only,
// with no download-percentage claim. firstVisit is whether no service worker controlled the page
// when it loaded. The player waits for the first install on such a page, the precache, which the
// bar shows as unknown work. Every other registration or install (an update check or an update's
// install, on a page a version already controls or after the precache has ended) runs in the
// background while the game is playable and never shows the bar.
export function trackOfflineActivity(firstVisit: boolean): (activity: OfflineActivity) => void {
  let waited = firstVisit;
  let operation: ProgressHandle | undefined;
  return (activity) => {
    if (activity !== "idle") {
      if (waited) {
        operation ??= beginPrecache();
      }
    } else if (operation !== undefined) {
      operation.finish();
      operation = undefined;
      waited = false;
    }
  };
}
