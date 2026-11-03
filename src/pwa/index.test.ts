import { afterEach, beforeEach, expect, it, vi } from "vitest";

const offline = vi.hoisted(() => {
  const play = {
    bootable: Promise.resolve(),
    flow: { accept: vi.fn(), beginOfferVisit: vi.fn(), dismissOffer: vi.fn() },
    setOfferVisible: vi.fn(),
    setRegistrationReady: vi.fn(),
  };
  return {
    play,
    start: vi.fn(
      (options: { activationPolicy?: string; onUpdateShown: (shown: boolean) => void }) => {
        void options;
        return play;
      },
    ),
  };
});
vi.mock("../platform/pwa/offlinePlay", () => ({
  browserOfflinePage: () => ({}),
  startOfflinePlay: offline.start,
}));
vi.mock("../platform/pwa/backNavigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../platform/pwa/backNavigation")>()),
  backCloseWatcher: vi.fn(() => () => new EventTarget()),
  browserCloseWatcher: vi.fn(),
  isFirefoxAndroidApp: () => true,
}));
vi.mock("../platform/pwa/installFlow", () => ({ pageRunsAsApp: () => false }));
vi.mock("../platform/pwa/storagePersistence", () => ({
  requestPersistentStorage: vi.fn(),
}));
vi.mock("../platform/pwa/wakeLock", () => ({ createScreenWakeLock: vi.fn() }));

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
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("wires manual updates to prepared registration and explicit Start visits", async () => {
  const pwa = await import("./index");
  pwa.setupPhoneApp();
  const options = offline.start.mock.calls[0]![0];
  expect(options.activationPolicy).toBe("manual");
  pwa.coverZone("loading", true);
  pwa.zoneShown();
  expect(offline.play.setRegistrationReady).not.toHaveBeenCalled();
  pwa.coverZone("loading", false);
  expect(offline.play.setRegistrationReady).toHaveBeenCalledExactlyOnceWith(true);
  expect(offline.play.setOfferVisible).not.toHaveBeenCalled();
  pwa.beginStartUpdateVisit();
  pwa.startScreenShown(true);
  expect(offline.play.flow.beginOfferVisit).toHaveBeenCalledOnce();
  expect(offline.play.setOfferVisible).toHaveBeenLastCalledWith(true);
  pwa.coverZone("startCard", true);
  pwa.coverZone("startCard", false);
  pwa.startScreenShown(false);
  pwa.startScreenShown(true);
  expect(offline.play.flow.beginOfferVisit).toHaveBeenCalledOnce();
  options.onUpdateShown(true);
  pwa.updateOffer.defer();
  expect(offline.play.flow.dismissOffer).toHaveBeenCalledOnce();
  expect(offline.play.flow.accept).not.toHaveBeenCalled();
  pwa.beginStartUpdateVisit();
  expect(offline.play.flow.beginOfferVisit).toHaveBeenCalledTimes(2);
  options.onUpdateShown(true);
  pwa.updateOffer.accept();
  expect(offline.play.flow.accept).toHaveBeenCalledOnce();
});

it.each([
  { app: false, name: "browser tab", shown: true, ua: "iPhone Safari" },
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
  "offers Start Exit only with a usable exit path: $name",
  async ({ app, historyLength = 1, shown, ua, watcher = true }) => {
    const { backCloseWatcher } = await import("../platform/pwa/backNavigation");
    vi.mocked(backCloseWatcher).mockReturnValueOnce(watcher ? () => new EventTarget() : undefined);
    const appNavigator = { maxTouchPoints: 5, standalone: app && /iPhone/.test(ua), userAgent: ua };
    Object.assign(window, {
      history: { length: historyLength },
      matchMedia: () => ({ matches: app }),
      navigator: appNavigator,
    });
    vi.stubGlobal("navigator", appNavigator);
    const pwa = await import("./index");
    pwa.setupPhoneApp();
    expect(pwa.exitShown()).toBe(shown);
  },
);
