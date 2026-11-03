// The game as an installed phone app: offline play and updates, the back gesture, the screen
// wake lock and persistent storage. setupPhoneApp runs once from main.ts; the scenes listen for
// PHONE_EVENTS on window and call the functions below.
//
// Offline registration retains its prepared-zone timing. Waiting updates activate only through
// the explicit Start-screen offer, never automatically before input or during gameplay.
import { offlineActivity } from "../loading/serviceWorker";
import { runsInAppWindow } from "../platform/pwa/appWindow";
import {
  backCloseWatcher,
  browserCloseWatcher,
  guardBackNavigation,
  isFirefoxAndroidApp,
} from "../platform/pwa/backNavigation";
import { pageRunsAsApp } from "../platform/pwa/installFlow";
import {
  browserOfflinePage,
  type OfflinePlay,
  startOfflinePlay,
} from "../platform/pwa/offlinePlay";
import { serviceWorkerUrl } from "../platform/pwa/serviceWorkerUrl";
import { requestPersistentStorage } from "../platform/pwa/storagePersistence";
import { createScreenWakeLock, type ScreenWakeLock } from "../platform/pwa/wakeLock";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";
import { type HomeCover, type HomeScreen, trackHomeScreen } from "./homeScreen";
import { createUpdateOffer } from "./updateOffer";

export { PHONE_EVENTS } from "./events";

// The history state key of the extra entry that back pops instead of leaving the game.
const BACK_GUARD_KEY = "birdBackGuard";
const SERVICE_WORKER_URL = "/sw.js";
let offlinePlay: OfflinePlay | undefined;
export const updateOffer = createUpdateOffer(
  () => offlinePlay?.flow.accept(),
  () => offlinePlay?.flow.dismissOffer(),
);

// A startup check may hold the first screen and saves for this long; activation remains manual.
const BOOT_WAIT_MS = 4000;

// Installed app windows retain Settings on Start without an Exit action.
let exitHidden = false;
let home: HomeScreen | undefined;
// Resolves once the game may show its first screen and write a save (UpdateFlow.bootable).
let ready: Promise<void> = Promise.resolve();
let screenWakeLock: ScreenWakeLock | undefined;

// The production build only: the dev server has no sw.js, and a worker would serve stale
// modules over hot reloads. A page a version controls registers now, so its update check runs
// while the game loads; a first visit registers once the zone shows, so the precache does not
// compete with the game's own downloads (registerWhenDue).
function setupOfflinePlay(): void {
  const page = import.meta.env.PROD ? browserOfflinePage() : undefined;
  if (page === undefined) {
    return;
  }
  const play = startOfflinePlay(
    {
      activationPolicy: "manual",
      bootWaitMs: BOOT_WAIT_MS,
      onOfflineActivity: offlineActivity,
      onUpdateShown: updateOffer.setVisible,
      serviceWorkerUrl: serviceWorkerUrl(SERVICE_WORKER_URL, undefined),
    },
    page,
  );
  offlinePlay = play;
  home = trackHomeScreen(play.setOfferVisible, () => play.setRegistrationReady(true));
  ready = play.bootable;
}

// Sets up offline play and the phone app's behaviour. The game is constructed at once and waits
// on launchReady only for its first screen and any save.
export function setupPhoneApp(): void {
  setupOfflinePlay();
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // boots whatever the browser answers, or if it never does.
  void requestPersistentStorage(
    pageRunsAsApp(window),
    "storage" in navigator ? navigator.storage : undefined,
  );
  const createCloseWatcher = backCloseWatcher(navigator.userAgent, browserCloseWatcher());
  exitHidden = runsInAppWindow(window);
  // Firefox for Android's installed app keeps its own back.
  // WORKAROUND: https://bugzilla.mozilla.org/show_bug.cgi?id=2079243 (see isFirefoxAndroidApp).
  if (!isFirefoxAndroidApp(navigator.userAgent, (query) => matchMedia(query).matches)) {
    guardBackNavigation(
      {
        onBack: () => dispatchPhoneEvent(window, PHONE_EVENTS.backPressed),
        stateKey: BACK_GUARD_KEY,
      },
      window,
      window,
      createCloseWatcher,
      history,
    );
  }
  screenWakeLock = createScreenWakeLock(
    "wakeLock" in navigator ? navigator.wakeLock : undefined,
    document,
  );
}

// Whether the start screen offers to leave the game: Exit, and back with no card open. A browser
// tab can always leave for the site's home page; installed app windows never show Exit.
export function exitShown(): boolean {
  return !exitHidden;
}

// Resolves once the game may show its first screen and write a save: at once, or after a fresh
// load has checked for a newer version, for at most BOOT_WAIT_MS (it never resolves for a page
// that reloads into one first).
export function launchReady(): Promise<void> {
  return ready;
}

// The existing prepared-zone signal controls first-install registration, not update offers.
export function zoneShown(): void {
  home?.shown();
}

// A new Start scene begins a visit; resuming it or closing a covering card does not.
export function beginStartUpdateVisit(): void {
  offlinePlay?.flow.beginOfferVisit();
}

export function startScreenShown(shown: boolean): void {
  home?.startShown(shown);
}

// A game or Start-owned card suppresses offers without changing their visit dismissal.
export function coverZone(what: HomeCover, covering: boolean): void {
  home?.cover(what, covering);
}

// Keep the screen on while the game is visible: during play.
export function startWakeLock(): void {
  screenWakeLock?.start();
}

// Let the screen sleep: while the pause card is open.
export function stopWakeLock(): void {
  screenWakeLock?.stop();
}
