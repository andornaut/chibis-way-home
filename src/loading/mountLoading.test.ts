// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LOADING_CSS } from "./html.ts";
import { LOADING_TIMING, modalProgressStyle, stageProgressStyle } from "./style.ts";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["clearTimeout", "setTimeout"] });
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

// A fresh module, so its startup load is the current operation, mounted on a game element.
async function mounted() {
  const loading = await import("./progress.ts");
  const parent = document.createElement("div");
  document.body.append(parent);
  const unmount = loading.mountLoading(parent);
  const bar = () => parent.querySelector<HTMLElement>(".progress-bar")!;
  return { bar, loading, parent, unmount };
}

// A finished measured bar holds full and then fades; the background shows once both have passed.
const FADED_MS = LOADING_TIMING.fullMs + LOADING_TIMING.fadeMs;

// The boot's waited file load, as BootScene's loader watch reports it: its share, then 1.
function bootFiles(loading: typeof import("./progress.ts"), shares: readonly number[]) {
  const boot = loading.loadingProgress.begin();
  shares.forEach((share) => boot.progress(share));
  return boot;
}

it("fills the waited file load, whose full hold the startup checks cut short", async () => {
  const { bar, loading, unmount } = await mounted();
  expect(bar().dataset.state).toBe("pending");
  const boot = bootFiles(loading, [0.5]);
  expect([bar().dataset.state, bar().getAttribute("aria-valuenow")]).toEqual([
    "determinate",
    "0.5",
  ]);
  expect(
    ["--progress-bar-full", "--progress-bar-fade"].map((name) =>
      bar().style.getPropertyValue(name),
    ),
  ).toEqual([`${LOADING_TIMING.fullMs}ms`, `${LOADING_TIMING.fadeMs}ms`]);
  boot.progress(1);
  boot.finish();
  expect(bar().dataset.state).toBe("complete");
  const checks = loading.beginStartupChecks();
  expect([bar().dataset.state, bar().hidden]).toEqual(["pending", false]);
  checks.finish();
  expect([bar().dataset.state, bar().hidden]).toEqual(["idle", true]);
  unmount();
});

it("holds a full bar through the first visit's precache, which shows once the hold ends", async () => {
  const { bar, loading, unmount } = await mounted();
  const install = loading.beginPrecache();
  bootFiles(loading, [0.5, 1]).finish();
  expect(bar().dataset.state).toBe("complete");
  vi.advanceTimersByTime(FADED_MS - 1);
  expect(bar().dataset.state).toBe("complete");
  vi.advanceTimersByTime(1);
  expect(bar().dataset.state).toBe("pending");
  install.finish();
  expect(bar().hidden).toBe(true);
  unmount();
});

it("shows a waited load's share over the first visit's precache", async () => {
  const { bar, loading, unmount } = await mounted();
  loading.startupLoading.finish();
  const install = loading.beginPrecache();
  expect(bar().dataset.state).toBe("pending");
  const files = bootFiles(loading, [0.25]);
  expect([bar().dataset.state, bar().getAttribute("aria-valuenow")]).toEqual([
    "determinate",
    "0.25",
  ]);
  files.finish();
  install.finish();
  unmount();
});

it("restyles the bar for a stage and shows its entry at once", async () => {
  const { bar, loading, unmount } = await mounted();
  const held = bar();
  loading.beginStageLoading("apartment");
  expect(bar()).not.toBe(held);
  expect(bar().dataset.state).toBe("pending");
  unmount();
});

// The bar once boot and its startup checks have ended, while the zone plays.
async function playing() {
  const mount = await mounted();
  bootFiles(mount.loading, [0.5, 1]).finish();
  mount.loading.beginStartupChecks().finish();
  vi.advanceTimersByTime(FADED_MS);
  return mount;
}

it("shows a forced update as the pending segment once boot's checks have ended", async () => {
  const { bar, loading, unmount } = await playing();
  expect(bar().hidden).toBe(true);
  const update = loading.beginRequiredUpdate();
  expect([bar().dataset.state, bar().hidden]).toEqual(["pending", false]);
  update.finish();
  expect(bar().hidden).toBe(true);
  unmount();
});

// The colours the bar's frame, track and fill segment are painted in, as the page reads them.
function painted(bar: HTMLElement) {
  const [track, band] = bar.children;
  return [bar, track, band?.firstElementChild].map(
    (box) => (box as HTMLElement).style.backgroundColor,
  );
}

it("keeps a forced update's bar painted over the canvas, in the modal dim, while a modal is open", async () => {
  const { bar, loading, parent, unmount } = await playing();
  parent.prepend(document.createElement("canvas"));
  const update = loading.beginRequiredUpdate();
  const held = bar();
  const lit = painted(held);
  const css = (colour: number) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `#${colour.toString(16).padStart(6, "0")}`;
    return probe.style.backgroundColor;
  };
  const { fills, frame, track } = modalProgressStyle(stageProgressStyle());
  parent.toggleAttribute("data-modal-open", true);
  await Promise.resolve();
  expect(bar()).toBe(held);
  expect([held.dataset.state, held.hidden, held.style.pointerEvents]).toEqual([
    "pending",
    false,
    "none",
  ]);
  expect(painted(held)).toEqual([frame, track, fills[0]!].map(css));
  expect(painted(held)).not.toEqual(lit);
  expect(LOADING_CSS).not.toMatch(/canvas/u);
  parent.toggleAttribute("data-modal-open", false);
  await Promise.resolve();
  expect(painted(held)).toEqual(lit);
  update.finish();
  unmount();
});

it("shows zone entry as the pending segment until the zone is ready", async () => {
  const { bar, loading, unmount } = await playing();
  expect(bar().hidden).toBe(true);
  const stage = loading.beginStageLoading("apartment");
  expect([bar().dataset.state, bar().hidden]).toEqual(["pending", false]);
  stage.finish();
  expect(bar().hidden).toBe(true);
  unmount();
});

it("never shows an update's install or idle offline activity while the game plays", async () => {
  const { bar, unmount } = await playing();
  const { trackOfflineActivity } = await import("./serviceWorker.ts");
  const offlineActivity = trackOfflineActivity();
  const states: (string | undefined)[] = [];
  for (const activity of ["idle", "updating", "idle", "updating"] as const) {
    offlineActivity(activity);
    states.push(bar().hidden ? undefined : bar().dataset.state);
  }
  expect(states).toEqual([undefined, undefined, undefined, undefined]);
  unmount();
});

it("shows the first visit's precache while the zone plays, but no update after it", async () => {
  const { bar, unmount } = await playing();
  const { trackOfflineActivity } = await import("./serviceWorker.ts");
  const offlineActivity = trackOfflineActivity();
  offlineActivity("precaching");
  expect([bar().dataset.state, bar().hidden]).toEqual(["pending", false]);
  offlineActivity("idle");
  expect(bar().hidden).toBe(true);
  offlineActivity("updating");
  expect(bar().hidden).toBe(true);
  unmount();
});
