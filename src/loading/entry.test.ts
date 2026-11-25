// @vitest-environment happy-dom
import {
  createLoadingAttempts,
  LOADING_FAILURE_TEXT,
  type LoadingAttempt,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { ProgressHandle, ProgressSnapshot } from "@andornaut/game-kit/runtime/progressState";
import {
  type BrowserLaunchPreparation,
  prepareBrowserLaunch,
} from "@andornaut/game-kit/runtime/web/pwa/dom/launch";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CACHE_POLICY } from "../pwa/cachePolicy.ts";

const startup = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  importGame: vi.fn(),
  initial: undefined as ProgressHandle | undefined,
  install: vi.fn(),
  launch: vi.fn(),
  mount: vi.fn(),
  pending: vi.fn(),
}));
vi.mock("../crash/index.ts", () => ({}));
vi.mock("../pwa/index.ts", () => ({
  installOffer: startup.install,
  setupPhoneApp: startup.launch,
}));
vi.mock("../game.ts", () => {
  startup.importGame();
  return { bootstrap: startup.bootstrap };
});
vi.mock("./progress.ts", async () => {
  const { createProgressState } = await import("@andornaut/game-kit/runtime/progressState");
  const loadingProgress = createProgressState();
  startup.pending.mockImplementation(() => loadingProgress.begin());
  return {
    beginStartupChecks: startup.pending,
    loadingProgress,
    mountLoading: startup.mount,
    startupLoading: {
      finish: () => startup.initial!.finish(),
      progress: (value: number | undefined) => startup.initial!.progress(value),
    },
  };
});

beforeEach(() => {
  vi.resetModules();
  startup.bootstrap.mockReset();
  startup.importGame.mockClear();
  startup.install.mockClear();
  startup.launch.mockReset().mockResolvedValue("play");
  startup.mount.mockClear();
  startup.pending.mockClear();
  vi.spyOn(window.location, "reload").mockImplementation(() => {});
});
afterEach(() => {
  window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
  document.getElementById("game")?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const settle = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
function host(progress: Pick<typeof import("./progress.ts"), "loadingProgress">) {
  startup.initial = progress.loadingProgress.begin();
  const element = document.createElement("div");
  element.id = "game";
  Object.defineProperties(element, {
    offsetHeight: { value: 360 },
    offsetWidth: { value: 720 },
  });
  document.body.append(element);
  return element;
}

it.each(["play", "reloading", "disposed"] as const)(
  "defers the game import through the launch fence on %s",
  async (outcome) => {
    let finish!: (result: "play" | "reloading") => void;
    startup.launch.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    host(await import("./progress.ts"));
    await import("../play.ts");
    await settle();
    expect(startup.launch).toHaveBeenCalledOnce();
    expect(startup.mount.mock.invocationCallOrder[0]).toBeLessThan(
      startup.launch.mock.invocationCallOrder[0]!,
    );
    expect(startup.importGame).not.toHaveBeenCalled();
    if (outcome === "disposed") {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    }
    finish(outcome === "reloading" ? "reloading" : "play");
    await settle();
    expect(startup.importGame).toHaveBeenCalledTimes(outcome === "play" ? 1 : 0);
    expect(startup.bootstrap).toHaveBeenCalledTimes(outcome === "play" ? 1 : 0);
  },
);

it("shows the shared terminal failure without progress, gameplay or install setup", async () => {
  vi.stubGlobal("caches", undefined);
  startup.launch.mockImplementationOnce((preparation: BrowserLaunchPreparation) =>
    prepareBrowserLaunch(preparation, CACHE_POLICY),
  );
  const progress = await import("./progress.ts");
  let current: ProgressSnapshot | undefined;
  const off = progress.loadingProgress.subscribe((value) => {
    current = value;
  });
  const element = host(progress);
  await import("../play.ts");
  await settle();

  const failure = element.querySelector<HTMLElement>(".loading-failure")!;
  expect(failure.hidden).toBe(false);
  expect(failure.textContent).toContain(LOADING_FAILURE_TEXT.title);
  expect(failure.querySelector("button")).toBeNull();
  expect(current).toEqual({ active: false, value: undefined });
  expect(startup.importGame).not.toHaveBeenCalled();
  expect(startup.install).not.toHaveBeenCalled();
  expect(window.location.reload).not.toHaveBeenCalled();

  window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
  expect(element.querySelector(".loading-failure")).toBeNull();
  off();
});

it("reloads only explicit startup-entry Retry and coalesces pending navigation", async () => {
  const partial = vi.fn();
  const progress = await import("./progress.ts");
  let current: ProgressSnapshot | undefined;
  const off = progress.loadingProgress.subscribe((value) => {
    current = value;
  });
  startup.bootstrap.mockImplementationOnce(async (attempt: LoadingAttempt) => {
    attempt.onCancel(partial);
    throw new Error("Private startup failure");
  });
  const element = host(progress);
  await import("../play.ts");
  await settle();
  const failure = element.querySelector<HTMLElement>(".loading-failure")!;
  const retry = failure.querySelector<HTMLButtonElement>("button")!;
  expect(failure.hidden).toBe(false);
  expect(failure.textContent).toContain(LOADING_FAILURE_TEXT.title);
  expect(failure.textContent).not.toContain("Private startup failure");
  expect(partial).toHaveBeenCalledOnce();
  expect(current).toEqual({ active: false, value: undefined });
  expect(window.location.reload).not.toHaveBeenCalled();
  vi.mocked(window.location.reload).mockImplementationOnce(() => {
    throw new Error("Navigation unavailable");
  });
  retry.click();
  await settle();
  expect(failure.hidden).toBe(false);
  expect(retry.disabled).toBe(false);
  expect(current).toEqual({ active: false, value: undefined });
  const { requiredLoading } = await import("./required.ts");
  const pending = requiredLoading.retry();
  expect(requiredLoading.retry()).toBe(pending);
  retry.click();
  await settle();
  expect(window.location.reload).toHaveBeenCalledTimes(2);
  expect(startup.bootstrap).toHaveBeenCalledOnce();
  expect(element.querySelector(".loading-failure")).toBe(failure);
  expect(failure.hidden).toBe(false);
  expect(retry.disabled).toBe(true);
  expect(startup.mount).toHaveBeenCalledOnce();
  expect(startup.pending).toHaveBeenCalledTimes(2);
  expect(current).toEqual({ active: true, value: undefined });
  window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
  await pending;
  await settle();
  expect(requiredLoading.state.kind).toBe("disposed");
  expect(current).toEqual({ active: false, value: undefined });
  expect(partial).toHaveBeenCalledOnce();
  expect(startup.bootstrap).toHaveBeenCalledOnce();
  off();
});

it("retries a failed font in place after committed entry without reloading or retiring newer work", async () => {
  const retained = vi.fn();
  const progress = await import("./progress.ts");
  let current: ProgressSnapshot | undefined;
  const off = progress.loadingProgress.subscribe((value) => {
    current = value;
  });
  let boot!: ProgressHandle;
  startup.bootstrap.mockImplementationOnce(async (attempt: LoadingAttempt) => {
    attempt.onCancel(retained);
    boot = progress.loadingProgress.begin();
    boot.progress(0.4);
  });
  const element = host(progress);
  await import("../play.ts");
  await settle();
  const { observeRequiredAttempt, requiredLoading } = await import("./required.ts");
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("Font failed"))
    .mockResolvedValueOnce(undefined);
  const fonts = createLoadingAttempts({ load, onState: () => requiredLoading.invalidate() });
  const stopFonts = observeRequiredAttempt(() => fonts.retry(), fonts);
  await fonts.start();
  const failure = element.querySelector<HTMLElement>(".loading-failure")!;
  expect(failure.hidden).toBe(false);
  failure.querySelector<HTMLButtonElement>("button")!.click();
  await settle();
  expect(load).toHaveBeenCalledTimes(2);
  expect(failure.hidden).toBe(true);
  expect(window.location.reload).not.toHaveBeenCalled();
  expect(startup.bootstrap).toHaveBeenCalledOnce();
  expect(startup.pending).not.toHaveBeenCalled();
  window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
  expect(current).toEqual({ active: true, value: 0.4 });
  expect(retained).not.toHaveBeenCalled();
  stopFonts();
  fonts.dispose();
  boot.finish();
  off();
});

it("finishes only its own token when an incomplete entry is disposed", async () => {
  let finish!: () => void;
  const cancelled = vi.fn();
  startup.bootstrap.mockImplementation(async (attempt: LoadingAttempt) => {
    attempt.onCancel(cancelled);
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    expect(attempt.isCurrent()).toBe(false);
  });
  const progress = await import("./progress.ts");
  let current: ProgressSnapshot | undefined;
  const off = progress.loadingProgress.subscribe((value) => {
    current = value;
  });
  host(progress);
  await import("../play.ts");
  await settle();
  expect(current).toEqual({ active: true, value: undefined });
  window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
  expect(cancelled).toHaveBeenCalledOnce();
  expect(current).toEqual({ active: false, value: undefined });
  finish();
  await settle();
  expect(current).toEqual({ active: false, value: undefined });
  off();
});
