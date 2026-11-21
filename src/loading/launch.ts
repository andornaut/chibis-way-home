import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import type { LaunchProgress } from "@andornaut/game-kit/runtime/web/pwa/buildContract";

import { loadingProgress, startupLoading } from "./progress.ts";

// The boot reads' sink, the kit launch's bootProgress, as the boot file load reports its share.
export type BootProgress = (done: number, total: number) => void;

// The one loading bar over the kit launch's first install and BootScene's file load. The launch
// reports one determinate value over both (LaunchProgress), which drives the foreground handle
// showing: the pre-script startupLoading during the install, then the boot file load's own. The
// file load's settled share goes to the launch, never straight to the bar, so the bar never moves
// back between the install and the boot reads. Without a launch (the development server, or a
// browser without service workers) the file load shows its own share. Once the launch reports
// "ready", a later waited load, such as a required file's retry, shows its own share again.
export function createLaunchLoading(context: {
  readonly progress: { begin(): ProgressHandle };
  readonly startup: ProgressHandle;
}) {
  const { progress } = context;
  let shown = context.startup;
  let sink: BootProgress | undefined;
  let value: number | undefined;
  let booted = false;
  return {
    // The launch's bootProgress, once a launch exists.
    bind(bootProgress: BootProgress): void {
      sink = bootProgress;
    },
    // The progress source for BootScene's loader watch.
    boot: {
      begin(): ProgressHandle {
        const handle = progress.begin();
        if (sink === undefined || booted) {
          return handle;
        }
        const report = sink;
        shown = handle;
        if (value !== undefined) {
          handle.progress(value);
        }
        return {
          finish: () => handle.finish(),
          progress: (share) => {
            if (share !== undefined) {
              report(share, 1);
            }
          },
        };
      },
    },
    // A first install that failed: the bar ends without a full hold, since its work did not
    // finish, and Loading failed shows.
    failed(): void {
      shown.progress(undefined);
      shown.finish();
    },
    // The launch's onProgress.
    report(next: LaunchProgress): void {
      value = next.value;
      shown.progress(next.value);
      if (next.phase === "ready") {
        booted = true;
      }
    },
    // Retry of a failed first install: a new load on the same bar, resuming at the last value.
    retried(): void {
      shown = progress.begin();
      if (value !== undefined) {
        shown.progress(value);
      }
    },
  };
}

export const launchLoading = createLaunchLoading({
  progress: loadingProgress,
  startup: startupLoading,
});
