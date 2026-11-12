// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LOADING_TIMING } from "./style";

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["cancelAnimationFrame", "clearTimeout", "requestAnimationFrame", "setTimeout"],
  });
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

// A finished measured bar holds full and then fades, both counted from the first frame after it
// turned complete; the next state shows once it has faded.
const FADED_MS = LOADING_TIMING.fullMs + LOADING_TIMING.fadeMs;
const fade = () => {
  vi.advanceTimersToNextFrame();
  vi.advanceTimersByTime(FADED_MS);
};

it("fills, holds and fades the measured file load before the startup checks' pending phase", async () => {
  const { bar, loading, unmount } = await mounted();
  loading.startupLoading.progress(0.5);
  expect(bar().dataset.state).toBe("determinate");
  expect(
    ["--progress-bar-full", "--progress-bar-fade"].map((name) =>
      bar().style.getPropertyValue(name),
    ),
  ).toEqual([`${LOADING_TIMING.fullMs}ms`, `${LOADING_TIMING.fadeMs}ms`]);
  const checks = loading.beginStartupChecks();
  const held = bar();
  expect([held.dataset.state, held.getAttribute("aria-valuenow")]).toEqual(["complete", "1"]);
  vi.advanceTimersToNextFrame();
  vi.advanceTimersByTime(FADED_MS - 1);
  expect([bar(), bar().dataset.state, bar().hidden]).toEqual([held, "complete", false]);
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
  fade();
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
  fade();
  expect(bar()).not.toBe(held);
  expect(bar().dataset.state).toBe("pending");
  unmount();
});
