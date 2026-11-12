// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LOADING_TIMING } from "./style";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

// A fresh module, so its startup load is the current operation, mounted on a game element.
async function mounted() {
  const loading = await import("./progress");
  const parent = document.createElement("div");
  document.body.append(parent);
  const unmount = loading.mountLoading(parent);
  const bar = () => parent.querySelector<HTMLElement>(".progress-bar")!;
  return { bar, loading, unmount };
}

it("fills the measured file load to full and hides it before the startup checks' pending phase", async () => {
  const { bar, loading, unmount } = await mounted();
  loading.startupLoading.progress(0.5);
  expect(bar().dataset.state).toBe("determinate");
  const checks = loading.beginStartupChecks();
  expect([bar().dataset.state, bar().getAttribute("aria-valuenow")]).toEqual(["complete", "1"]);
  vi.advanceTimersByTime(LOADING_TIMING.fullMs - 1);
  expect(bar().dataset.state).toBe("complete");
  vi.advanceTimersByTime(1);
  expect([bar().dataset.state, bar().hidden]).toEqual(["pending", false]);
  checks.finish();
  expect([bar().dataset.state, bar().hidden]).toEqual(["idle", true]);
  unmount();
});

it("holds a full bar through background installing, which shows once the hold ends", async () => {
  const { bar, loading, unmount } = await mounted();
  const install = loading.installProgress.begin();
  loading.startupLoading.progress(0.5);
  loading.startupLoading.progress(1);
  loading.startupLoading.finish();
  expect(bar().dataset.state).toBe("complete");
  vi.advanceTimersByTime(LOADING_TIMING.fullMs);
  expect(bar().dataset.state).toBe("pending");
  install.finish();
  expect(bar().hidden).toBe(true);
  unmount();
});

it("holds a full bar through a stage's restyle, which applies once the hold ends", async () => {
  const { bar, loading, unmount } = await mounted();
  loading.startupLoading.progress(0.5);
  loading.beginStartupChecks();
  const held = bar();
  loading.beginStageLoading("apartment");
  expect([bar(), bar().dataset.state]).toEqual([held, "complete"]);
  vi.advanceTimersByTime(LOADING_TIMING.fullMs);
  expect(bar()).not.toBe(held);
  expect(bar().dataset.state).toBe("pending");
  unmount();
});
