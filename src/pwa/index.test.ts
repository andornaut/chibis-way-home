import type {
  OfflinePage,
  OfflinePlay,
  OfflinePlayOptions,
} from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const offline = vi.hoisted(() => {
  const play = {
    flow: {
      accept: vi.fn(),
      beginOfferVisit: vi.fn(),
      dismissOffer: vi.fn(),
      requireNewer: vi.fn(),
      setOfferVisible: vi.fn(),
    },
    registrationReady: vi.fn(),
  };
  return {
    page: {} as unknown,
    play,
    start: vi.fn((options: OfflinePlayOptions, page: OfflinePage): OfflinePlay => {
      void options;
      void page;
      return play as unknown as OfflinePlay;
    }),
  };
});
vi.mock("@andornaut/game-kit/web/pwa/dom/offlinePlay", () => ({
  browserOfflinePage: () => offline.page,
  startOfflinePlay: offline.start,
}));
vi.mock("@andornaut/game-kit/web/pwa/backNavigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@andornaut/game-kit/web/pwa/backNavigation")>()),
  backCloseWatcher: vi.fn(() => () => new EventTarget()),
  isFirefoxAndroidApp: () => true,
}));
vi.mock("@andornaut/game-kit/web/pwa/dom/backNavigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@andornaut/game-kit/web/pwa/dom/backNavigation")>()),
  browserCloseWatcher: vi.fn(),
}));
vi.mock("@andornaut/game-kit/web/pwa/dom/installFlow", () => ({ pageRunsAsApp: () => false }));
vi.mock("@andornaut/game-kit/web/pwa/storagePersistence", () => ({
  requestPersistentStorage: vi.fn(),
}));
vi.mock("@andornaut/game-kit/web/pwa/dom/wakeLock", () => ({ createScreenWakeLock: vi.fn() }));

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
  offline.page = {};
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("wires updates to prepared registration and explicit Start visits", async () => {
  const pwa = await import("./index");
  pwa.setupPhoneApp();
  const options = offline.start.mock.calls[0]![0];
  pwa.coverZone("loading", true);
  pwa.zoneShown();
  expect(offline.play.registrationReady).not.toHaveBeenCalled();
  pwa.coverZone("loading", false);
  expect(offline.play.registrationReady).toHaveBeenCalledOnce();
  expect(offline.play.flow.setOfferVisible).not.toHaveBeenCalled();
  pwa.beginStartUpdateVisit();
  pwa.startScreenShown(true);
  expect(offline.play.flow.beginOfferVisit).toHaveBeenCalledOnce();
  expect(offline.play.flow.setOfferVisible).toHaveBeenLastCalledWith(true);
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

it("forwards a forced update to the kit and its reports to requiredUpdate", async () => {
  const pwa = await import("./index");
  pwa.setupPhoneApp();
  const options = offline.start.mock.calls[0]![0];
  const states: string[] = [];
  pwa.requiredUpdate.subscribe((state) => states.push(state));
  pwa.requireNewer();
  expect(offline.play.flow.requireNewer).toHaveBeenCalledOnce();
  options.onRequireNewer("updating");
  options.onRequireNewer("unavailable");
  expect(states).toEqual(["updating", "unavailable"]);
});

it("reports a forced update unavailable without offline play", async () => {
  vi.stubEnv("PROD", false);
  const pwa = await import("./index");
  pwa.setupPhoneApp();
  const states: string[] = [];
  pwa.requiredUpdate.subscribe((state) => states.push(state));
  pwa.requireNewer();
  expect(states).toEqual(["unavailable"]);
});

// A page for the kit's own offline play: controller is the page's controller when it loaded, and
// install starts a worker installing on its registration, which finish then installs, leaving it
// waiting when waits is set.
function kitPage(controller: unknown) {
  const registration = Object.assign(new EventTarget(), {
    active: null,
    installing: null as (EventTarget & { postMessage(): void; state: string }) | null,
    update: () => Promise.resolve(),
    waiting: null as (EventTarget & { postMessage(): void; state: string }) | null,
  });
  const container = Object.assign(new EventTarget(), {
    controller,
    register: vi.fn(() => Promise.resolve(registration)),
  });
  const install = () => {
    registration.installing = Object.assign(new EventTarget(), {
      postMessage: () => undefined,
      state: "installing",
    });
  };
  const finish = (waits = false) => {
    const worker = registration.installing!;
    worker.state = "installed";
    registration.installing = null;
    if (waits) {
      registration.waiting = worker;
    }
    worker.dispatchEvent(new Event("statechange"));
  };
  const page: OfflinePage = {
    container,
    eventTarget: new EventTarget(),
    now: () => 0,
    online: () => true,
    reload: () => undefined,
    session: undefined,
    visibilitySource: Object.assign(new EventTarget(), { visibilityState: "visible" as const }),
  };
  return { container, finish, install, page, registration };
}

// Resolves once pending promise callbacks, such as a registration's, have run.
function settled(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// The phone app set up on the kit's own offline play, with whether the loading bar showed the
// precache at each change.
async function precacheShown(controller: unknown) {
  const kit = await vi.importActual<typeof import("@andornaut/game-kit/web/pwa/dom/offlinePlay")>(
    "@andornaut/game-kit/web/pwa/dom/offlinePlay",
  );
  offline.start.mockImplementationOnce(kit.startOfflinePlay);
  const fake = kitPage(controller);
  offline.page = fake.page;
  const { precacheProgress } = await import("../loading/progress");
  const pwa = await import("./index");
  const shown: boolean[] = [];
  precacheProgress.subscribe(({ active }) => shown.push(active));
  pwa.setupPhoneApp();
  await settled();
  return { fake, pwa, shown };
}

it("shows a first visit's precache from registration until its install ends", async () => {
  const { fake, pwa, shown } = await precacheShown(null);
  fake.install();
  expect(shown.at(-1)).toBe(false);
  pwa.zoneShown();
  expect(shown.at(-1)).toBe(true);
  await settled();
  expect(shown.at(-1)).toBe(true);
  fake.finish();
  expect(shown.at(-1)).toBe(false);
  fake.install();
  fake.registration.dispatchEvent(new Event("updatefound"));
  expect(shown.at(-1)).toBe(false);
});

it("never shows registration or an update's install on a controlled page", async () => {
  const { fake, shown } = await precacheShown({});
  expect(fake.container.register).toHaveBeenCalledOnce();
  fake.install();
  fake.registration.dispatchEvent(new Event("updatefound"));
  fake.finish();
  expect(shown.every((active) => !active)).toBe(true);
});

// Whether the Update card showed at each change, with the Start screen shown and uncovered.
async function offerShownOnStart(controller: unknown) {
  const { fake, pwa } = await precacheShown(controller);
  const offered: boolean[] = [];
  pwa.updateOffer.subscribe((visible) => offered.push(visible));
  pwa.zoneShown();
  pwa.beginStartUpdateVisit();
  pwa.startScreenShown(true);
  await settled();
  fake.install();
  fake.registration.dispatchEvent(new Event("updatefound"));
  return { fake, offered };
}

it("offers a controlled page's update only once the new version is stored", async () => {
  const { fake, offered } = await offerShownOnStart({});
  expect(offered.at(-1)).toBe(false);
  fake.finish(true);
  expect(offered.at(-1)).toBe(true);
});

it("never offers an update on a page no version controls", async () => {
  const { fake, offered } = await offerShownOnStart(null);
  fake.finish(true);
  expect(offered.every((visible) => !visible)).toBe(true);
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
    const { backCloseWatcher } = await import("@andornaut/game-kit/web/pwa/backNavigation");
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
