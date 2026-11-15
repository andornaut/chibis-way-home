import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import type { OfflineActivity } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";
import type { DownloadProgress } from "@andornaut/game-kit/runtime/web/pwa/downloadProgress";

import { beginPrecache } from "./progress.ts";

// Only first-install precaching may show this background bar. Worker identities are opaque;
// download callbacks never describe module, font, Phaser or CPU preparation work.
export function trackOfflineLoading() {
  let activity: OfflineActivity = "idle";
  let operation: ProgressHandle | undefined;
  let current: Pick<DownloadProgress, "operationId" | "version"> | undefined;
  let pending: DownloadProgress | undefined;
  const closed = new Set<string>();
  const finish = () => {
    operation?.finish();
    operation = undefined;
    if (current !== undefined) {
      closed.add(current.operationId);
    }
  };
  const progress = (snapshot: DownloadProgress) => {
    if (closed.has(snapshot.operationId)) {
      return;
    }
    if (activity !== "precaching") {
      if (activity === "idle") {
        pending = snapshot;
      }
      return;
    }
    if (operation === undefined) {
      return;
    }
    current ??= { operationId: snapshot.operationId, version: snapshot.version };
    if (snapshot.operationId !== current.operationId || snapshot.version !== current.version) {
      return;
    }
    operation.progress(snapshot.phase === "downloading" ? snapshot.value : undefined);
    if (snapshot.phase === "complete") {
      operation.progress(1);
      finish();
    } else if (snapshot.phase === "failed") {
      finish();
    }
  };
  return {
    activity(next: OfflineActivity) {
      if (activity === next) {
        return;
      }
      activity = next;
      if (next === "precaching") {
        current = undefined;
        operation = beginPrecache();
        if (pending !== undefined) {
          progress(pending);
        }
      } else {
        // An incomplete or unobserved operation ending must not manufacture a full-bar hold.
        operation?.progress(undefined);
        finish();
        current = undefined;
      }
      pending = undefined;
    },
    progress,
  };
}

// Activity-only consumers keep their existing indeterminate first-precache behaviour.
export function trackOfflineActivity(): (activity: OfflineActivity) => void {
  return trackOfflineLoading().activity;
}
