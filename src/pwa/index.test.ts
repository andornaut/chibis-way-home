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
  { displayApp: false, iosApp: false, name: "browser tab", shown: true },
  { displayApp: false, iosApp: true, name: "iOS Home Screen app", shown: false },
  { displayApp: true, iosApp: false, name: "display-mode app window", shown: false },
])("shows Start Exit only in a browser tab: $name", async ({ displayApp, iosApp, shown }) => {
  Object.assign(window, {
    matchMedia: () => ({ matches: displayApp }),
    navigator: {
      maxTouchPoints: 5,
      standalone: iosApp,
      userAgent: iosApp ? "iPhone Safari" : "Chrome/142.0",
    },
  });
  const pwa = await import("./index");
  pwa.setupPhoneApp();
  expect(pwa.exitShown()).toBe(shown);
});
