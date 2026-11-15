import type { DownloadProgress } from "@andornaut/game-kit/runtime/web/pwa/downloadProgress";
import { expect, it } from "vitest";

import { backgroundProgress, loadingProgress } from "./progress.ts";
import { trackOfflineLoading } from "./serviceWorker.ts";

const snapshot = (
  operationId: string,
  phase: DownloadProgress["phase"],
  value?: number,
  version = "manifest-a",
): DownloadProgress => ({ operationId, phase, value, version });

it("uses authoritative first-precache bytes and fences old operation and version callbacks", () => {
  let background: unknown;
  let foreground: unknown;
  const off = backgroundProgress.subscribe((value) => (background = value));
  const offForeground = loadingProgress.subscribe((value) => (foreground = value));
  const boot = loadingProgress.begin();
  boot.progress(0.4);
  const loading = trackOfflineLoading();
  // The worker watcher can report its current state before the activity callback.
  loading.progress(snapshot("first", "downloading", 0.25));
  loading.activity("precaching");
  expect(background).toEqual({ active: true, value: 0.25 });
  loading.progress(snapshot("other", "complete", 1));
  loading.progress(snapshot("first", "downloading", 0.9, "manifest-b"));
  expect(background).toEqual({ active: true, value: 0.25 });
  loading.progress(snapshot("first", "verifying"));
  expect(background).toEqual({ active: true, value: undefined });
  loading.progress(snapshot("first", "complete", 1));
  expect(background).toEqual({ active: false, value: undefined });
  loading.activity("idle");
  loading.activity("precaching");
  loading.progress(snapshot("second", "downloading", 0.6, "manifest-b"));
  loading.progress(snapshot("first", "complete", 1));
  expect(background).toEqual({ active: true, value: 0.6 });
  expect(foreground).toEqual({ active: true, value: 0.4 });
  loading.activity("idle");
  boot.finish();
  off();
  offForeground();
});

it("keeps failed or ordinary update downloads from completing or replacing the playable game", () => {
  const states: { active: boolean; value: number | undefined }[] = [];
  const off = backgroundProgress.subscribe((value) => states.push(value));
  const loading = trackOfflineLoading();
  loading.activity("precaching");
  loading.progress(snapshot("first", "downloading", 0.7));
  loading.progress(snapshot("first", "failed"));
  expect(states.slice(-2)).toEqual([
    { active: true, value: undefined },
    { active: false, value: undefined },
  ]);
  const settled = states.length;
  loading.activity("updating");
  loading.progress(snapshot("update", "downloading", 0.8, "new-manifest"));
  loading.progress(snapshot("update", "complete", 1, "new-manifest"));
  loading.activity("idle");
  expect(states).toHaveLength(settled);
  off();
});
