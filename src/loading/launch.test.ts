import {
  createProgressState,
  type ProgressSnapshot,
} from "@andornaut/game-kit/runtime/progressState";
import type { LaunchProgress } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import { expect, it, vi } from "vitest";

import { createLaunchLoading } from "./launch.ts";

const at = (phase: LaunchProgress["phase"], value: number): LaunchProgress => ({
  phase,
  receivedBytes: 0,
  totalBytes: 0,
  value,
});

// A launch loading over its own bar state, with the snapshots the bar was shown.
function bar() {
  const progress = createProgressState();
  const shown: ProgressSnapshot[] = [];
  progress.subscribe((snapshot) => shown.push(snapshot));
  const startup = progress.begin();
  return { loading: createLaunchLoading({ progress, startup }), shown };
}

it("shows a first install and the boot's file load as the launch's one rising value", () => {
  const { loading, shown } = bar();
  const bootProgress = vi.fn((done: number, total: number) =>
    loading.report(at(done >= total ? "ready" : "booting", 0.6 + 0.4 * (done / total))),
  );
  loading.bind(bootProgress);
  loading.report(at("installing", 0.3));
  loading.report(at("installing", 0.6));
  expect(shown.at(-1)).toEqual({ active: true, value: 0.6 });
  const files = loading.boot.begin();
  expect(shown.at(-1)).toEqual({ active: true, value: 0.6 });
  files.progress(undefined);
  files.progress(0.5);
  expect(bootProgress).toHaveBeenLastCalledWith(0.5, 1);
  expect(shown.at(-1)).toEqual({ active: true, value: 0.8 });
  files.progress(1);
  expect(shown.at(-1)).toEqual({ active: true, value: 1 });
  files.finish();
  expect(shown.at(-1)).toEqual({ active: false, value: undefined });
  expect(bootProgress).toHaveBeenCalledTimes(2);
  // A later waited load, such as a required file's retry, shows its own share.
  const retry = loading.boot.begin();
  retry.progress(0.25);
  expect(shown.at(-1)).toEqual({ active: true, value: 0.25 });
  expect(bootProgress).toHaveBeenCalledTimes(2);
  retry.finish();
});

it("shows the file load's own share without a launch", () => {
  const { loading, shown } = bar();
  const files = loading.boot.begin();
  files.progress(0.4);
  expect(shown.at(-1)).toEqual({ active: true, value: 0.4 });
  files.finish();
});

it("ends a failed install's bar without a full hold and resumes it at the same value on Retry", () => {
  const { loading, shown } = bar();
  loading.bind(vi.fn());
  loading.report(at("installing", 0.4));
  loading.failed();
  expect(shown.at(-1)).toEqual({ active: false, value: undefined });
  expect(shown.some(({ value }) => value === 1)).toBe(false);
  loading.retried();
  expect(shown.at(-1)).toEqual({ active: true, value: 0.4 });
  loading.report(at("installing", 0.7));
  expect(shown.at(-1)).toEqual({ active: true, value: 0.7 });
});
