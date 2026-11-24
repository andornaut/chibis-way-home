import type {
  LaunchProgress,
  UpdateOffer,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import type {
  BrowserLaunchPreparation,
  createLaunch,
  LaunchOptions,
} from "@andornaut/game-kit/runtime/web/pwa/dom/launch";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { PHASER_BUILD } from "../tools/phaserBuild.ts";
import { SOUND_FORMAT, SOUNDS } from "./cachePolicy.ts";

const kit = vi.hoisted(() => {
  const launch = {
    bootProgress: vi.fn(),
    dispose: vi.fn(),
    requestUpdateCheck: vi.fn(),
    requireNewer: vi.fn(),
    run: vi.fn<ReturnType<typeof createLaunch>["run"]>(async () => "play"),
  };
  return {
    context: {} as unknown,
    create: vi.fn((context: unknown, options: LaunchOptions): ReturnType<typeof createLaunch> => {
      void context;
      void options;
      return launch;
    }),
    launch,
    prepare: vi.fn(),
  };
});
const feedback = vi.hoisted(() => ({ fail: vi.fn() }));
const loading = vi.hoisted(() => ({
  bind: vi.fn(),
  failed: vi.fn(),
  report: vi.fn(),
  retried: vi.fn(),
}));
vi.mock("../loading/required.ts", () => ({ installationFeedback: feedback }));
vi.mock("../loading/launch.ts", () => ({ launchLoading: loading }));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/launch", () => ({
  createLaunch: kit.create,
  prepareBrowserLaunch: kit.prepare,
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/backNavigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@andornaut/game-kit/runtime/web/pwa/backNavigation")>()),
  backCloseWatcher: vi.fn(() => () => new EventTarget()),
  isFirefoxAndroidApp: () => true,
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/backNavigation", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@andornaut/game-kit/runtime/web/pwa/dom/backNavigation")
  >()),
  browserCloseWatcher: vi.fn(),
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/installFlow", () => ({
  pageRunsAsApp: () => false,
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/storagePersistence", () => ({
  requestPersistentStorage: vi.fn(),
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/wakeLock", () => ({
  createScreenWakeLock: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("PROD", true);
  const navigator = { maxTouchPoints: 0, userAgent: "" };
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      history: { length: 1 },
      matchMedia: () => ({ matches: false }),
      navigator,
    }),
  );
  vi.stubGlobal("navigator", navigator);
  vi.stubGlobal("document", {});
  kit.context = {};
  kit.prepare.mockReturnValue({ context: kit.context, kind: "supported" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const preparation: BrowserLaunchPreparation = {
  onUnsupported: () => undefined,
  parent: {} as HTMLElement,
};
const beforeLaunch = vi.fn();

// The options setupPhoneApp gave the kit's launch.
const launchOptions = () => kit.create.mock.calls[0]![1];

it.each(["play", "reloading"] as const)(
  "runs the launch once, registering the router, and returns its result %s",
  async (result) => {
    kit.launch.run.mockResolvedValueOnce(result);
    const pwa = await import("./index.ts");
    expect(await pwa.setupPhoneApp(preparation, beforeLaunch)).toBe(result);
    expect(kit.create).toHaveBeenCalledOnce();
    expect(kit.create.mock.calls[0]![0]).toBe(kit.context);
    expect(launchOptions().serviceWorkerUrl).toBe("/sw.js");
    // The game has no sound, so the launch installs every listed file: no format is chosen.
    expect(Object.keys(launchOptions())).toContain("soundFormat");
    expect(launchOptions().soundFormat).toBe(SOUND_FORMAT);
    expect([SOUND_FORMAT, SOUNDS, PHASER_BUILD.flags.FEATURE_SOUND]).toEqual([
      undefined,
      {},
      false,
    ]);
    expect(kit.launch.run).toHaveBeenCalledOnce();
    expect(kit.launch.requestUpdateCheck).not.toHaveBeenCalled();
    expect(loading.bind).toHaveBeenCalledExactlyOnceWith(kit.launch.bootProgress);
  },
);

it("plays from the development server without checking browser capabilities", async () => {
  vi.stubEnv("PROD", false);
  const pwa = await import("./index.ts");
  expect(await pwa.setupPhoneApp(preparation, beforeLaunch)).toBe("play");
  expect(kit.prepare).not.toHaveBeenCalled();
  expect(kit.create).not.toHaveBeenCalled();
  pwa.requestUpdateCheck();
  expect(kit.launch.requestUpdateCheck).not.toHaveBeenCalled();
  const states: string[] = [];
  pwa.requiredUpdate.subscribe((state) => states.push(state));
  pwa.requireNewer();
  expect(states).toEqual(["unavailable"]);
});

it("returns the terminal Kit view before installing or creating the launch", async () => {
  const pwa = await import("./index.ts");
  const failure = { failure: {}, kind: "unsupported" };
  kit.prepare.mockReturnValueOnce(failure);
  expect(pwa.setupPhoneApp(preparation, beforeLaunch)).toBe(failure);
  expect(kit.prepare).toHaveBeenCalledWith(preparation, expect.any(Object));
  expect(beforeLaunch).not.toHaveBeenCalled();
  expect(kit.create).not.toHaveBeenCalled();
});

it("shows first-install progress on the bar, and a failure as Loading failed whose Retry resumes", async () => {
  const pwa = await import("./index.ts");
  void pwa.setupPhoneApp(preparation, beforeLaunch);
  const progress: LaunchProgress = {
    phase: "installing",
    receivedBytes: 5,
    totalBytes: 10,
    value: 0.5,
  };
  launchOptions().onProgress(progress);
  expect(loading.report).toHaveBeenCalledExactlyOnceWith(progress);
  const retry = vi.fn();
  launchOptions().onFailure({ reason: "verification", retry });
  expect(loading.failed).toHaveBeenCalledOnce();
  const shown = feedback.fail.mock.calls[0]![0] as { reason: string; retry: () => void };
  expect(shown.reason).toBe("verification");
  expect(retry).not.toHaveBeenCalled();
  shown.retry();
  expect(loading.retried.mock.invocationCallOrder[0]).toBeLessThan(
    retry.mock.invocationCallOrder[0]!,
  );
  expect(retry).toHaveBeenCalledOnce();
});

it("plays from the network where the device cannot install, arming its notice once", async () => {
  kit.launch.run.mockImplementationOnce(async () => {
    launchOptions().onNetworkPlay({ reason: "quota" });
    launchOptions().onNetworkPlay({ reason: "unsupported" });
    return "play";
  });
  const pwa = await import("./index.ts");
  expect(await pwa.setupPhoneApp(preparation, beforeLaunch)).toBe("play");
  expect([pwa.networkPlay.take(), pwa.networkPlay.take()]).toEqual([true, false]);
  expect(loading.failed).not.toHaveBeenCalled();
  expect(feedback.fail).not.toHaveBeenCalled();
  // Loading failed has no unsupported or quota path: those reasons reach only onNetworkPlay.
  // @ts-expect-error onFailure receives only "network" or "verification"
  launchOptions().onFailure({ reason: "quota", retry: vi.fn() });
  // @ts-expect-error onFailure receives only "network" or "verification"
  launchOptions().onFailure({ reason: "unsupported", retry: vi.fn() });
});

it("keeps background update states off the bar and Loading failed", async () => {
  const pwa = await import("./index.ts");
  void pwa.setupPhoneApp(preparation, beforeLaunch);
  for (const state of [
    { phase: "staging", value: 0.5, version: "b" },
    { phase: "failed", version: "b" },
    { phase: "ready", version: "b" },
  ] as const) {
    launchOptions().onUpdateState(state);
  }
  expect(loading.report).not.toHaveBeenCalled();
  expect(loading.failed).not.toHaveBeenCalled();
  expect(feedback.fail).not.toHaveBeenCalled();
});

it("shows a staged update's prompt from the launch", async () => {
  const pwa = await import("./index.ts");
  void pwa.setupPhoneApp(preparation, beforeLaunch);
  const shown: boolean[] = [];
  pwa.updateOffer.subscribe((visible) => shown.push(visible));
  const offer: UpdateOffer = { dismiss: vi.fn(), updateNow: vi.fn(), version: "b" };
  launchOptions().onUpdateReady(offer);
  expect(shown).toEqual([false, true]);
  pwa.updateOffer.defer();
  expect(offer.dismiss).toHaveBeenCalledOnce();
  expect(shown).toEqual([false, true, false]);
});

it("forwards an ordinary update check without taking the forced update path", async () => {
  const pwa = await import("./index.ts");
  await pwa.setupPhoneApp(preparation, beforeLaunch);
  pwa.requestUpdateCheck();
  expect(kit.launch.requestUpdateCheck).toHaveBeenCalledOnce();
  expect(kit.launch.requireNewer).not.toHaveBeenCalled();
});

it("forwards a forced update to the launch and its reports to requiredUpdate", async () => {
  const pwa = await import("./index.ts");
  void pwa.setupPhoneApp(preparation, beforeLaunch);
  const states: string[] = [];
  pwa.requiredUpdate.subscribe((state) => states.push(state));
  pwa.requireNewer();
  expect(kit.launch.requireNewer).toHaveBeenCalledOnce();
  launchOptions().onRequireNewer!("updating");
  launchOptions().onRequireNewer!("unavailable");
  expect(states).toEqual(["updating", "unavailable"]);
});

it.each([
  { app: false, name: "browser tab", shown: false, ua: "iPhone Safari" },
  { app: false, name: "Chrome Android tab", shown: false, ua: "Android Chrome/142.0" },
  { app: false, name: "desktop Chrome tab", shown: false, ua: "Chrome/142.0" },
  { app: true, name: "Chrome Android app", shown: true, ua: "Android Chrome/142.0" },
  { app: true, name: "desktop Chrome app", shown: true, ua: "Chrome/142.0" },
  { app: true, name: "desktop Edge app", shown: true, ua: "Chrome/142.0 Edg/142.0" },
  { app: true, name: "iOS Home Screen app", shown: false, ua: "iPhone Safari" },
  { app: true, name: "Firefox Android app", shown: false, ua: "Android Firefox/149.0" },
  { app: true, name: "Edge Android app", shown: false, ua: "Android Chrome/142.0 EdgA/142.0" },
  { app: true, name: "Samsung app", shown: false, ua: "Android Chrome/142.0 SamsungBrowser/29" },
  { app: true, name: "unknown app", shown: false, ua: "Other" },
  {
    app: true,
    historyLength: 2,
    name: "Chrome app with earlier history",
    shown: false,
    ua: "Android Chrome/142.0",
  },
  {
    app: true,
    name: "Chrome app requiring a history back guard",
    shown: false,
    ua: "Android Chrome/119.0",
    watcher: false,
  },
])(
  "shows Start Exit only in an app window that closes: $name",
  async ({ app, historyLength = 1, shown, ua, watcher = true }) => {
    const { backCloseWatcher } = await import("@andornaut/game-kit/runtime/web/pwa/backNavigation");
    vi.mocked(backCloseWatcher).mockReturnValueOnce(watcher ? () => new EventTarget() : undefined);
    const appNavigator = { maxTouchPoints: 5, standalone: app && /iPhone/.test(ua), userAgent: ua };
    Object.assign(window, {
      history: { length: historyLength },
      matchMedia: () => ({ matches: app }),
      navigator: appNavigator,
    });
    vi.stubGlobal("navigator", appNavigator);
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp(preparation, beforeLaunch);
    expect(pwa.exitShown()).toBe(shown);
    // Back leaves from a browser tab, and from an app only where its window closes.
    expect(pwa.backLeavesGame()).toBe(app ? shown : true);
  },
);

it("closes the window for Exit and never navigates, even once the page shows in a tab", async () => {
  const close = vi.fn();
  const assign = vi.fn();
  Object.assign(window, { close, location: { assign } });
  const pwa = await import("./index.ts");
  pwa.closeApp();
  expect(close).toHaveBeenCalledOnce();
  expect(assign).not.toHaveBeenCalled();
});
