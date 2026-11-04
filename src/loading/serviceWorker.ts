import type { ProgressHandle } from "@andornaut/game-kit/progressState";
import type { OfflineActivity } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";

import { installProgress } from "./progress";

let operation: ProgressHandle | undefined;

// The shared offline lifecycle reports activity only, with no download-percentage claim.
export function offlineActivity(activity: OfflineActivity): void {
  if (activity === "idle") {
    operation?.finish();
    operation = undefined;
  } else {
    operation ??= installProgress.begin();
  }
}
