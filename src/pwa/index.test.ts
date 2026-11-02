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
vi.mock("../platform/pwa/appWindow", () => ({ appCannotClose: () => false }));
vi.mock("../platform/pwa/backNavigation", () => ({
  backCloseWatcher: vi.fn(),
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
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { userAgent: "" });
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
