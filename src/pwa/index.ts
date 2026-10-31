// The game as an installed phone app: offline play and updates, the back gesture, the screen
// wake lock and persistent storage. setupPhoneApp runs once from main.ts; the scenes listen for
// PHONE_EVENTS on window and call the functions below.
//
// Offline play registers the service worker (serviceWorker.ts) and follows the kit's update
// flow. The game page is the only screen, so it counts as the home screen: a newer version takes
// over at once before the player has interacted, and after that an ordinary game modal offers
// it. The flow checks on each load and when the page comes back into view (an installed app
// resumed without relaunching). The game loads meanwhile:
// only its first screen and any save wait for the check (launchReady).
import { appCannotClose } from "@andornaut/game-kit/pwa/appWindow";
import {
  backCloseWatcher,
  browserCloseWatcher,
  guardBackNavigation,
  isFirefoxAndroidApp,
} from "@andornaut/game-kit/pwa/backNavigation";
import { pageRunsAsApp } from "@andornaut/game-kit/pwa/installFlow";
import { browserOfflinePage, startOfflinePlay } from "@andornaut/game-kit/pwa/offlinePlay";
import { serviceWorkerUrl } from "@andornaut/game-kit/pwa/serviceWorkerUrl";
import { requestPersistentStorage } from "@andornaut/game-kit/pwa/storagePersistence";
import { createScreenWakeLock, type ScreenWakeLock } from "@andornaut/game-kit/pwa/wakeLock";

import { withInstallProgress } from "../loading/serviceWorker";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";
import { type HomeCover, type HomeScreen, trackHomeScreen } from "./homeScreen";
import { createUpdateOffer } from "./updateOffer";

export { PHONE_EVENTS } from "./events";

// The history state key of the extra entry that back pops instead of leaving the game.
const BACK_GUARD_KEY = "birdBackGuard";
const SERVICE_WORKER_URL = "/sw.js";
let acceptWaitingUpdate: () => void = () => undefined;
export const updateOffer = createUpdateOffer(() => acceptWaitingUpdate());

// How long a fresh load holds the first screen and the save for a newer version to be checked for
// and installed, so it reloads into that version before the zone draws; the game loads
// meanwhile.
const BOOT_WAIT_MS = 4000;

// An installed app whose window the game cannot close (the kit's appCannotClose) shows no Exit.
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
      bootWaitMs: BOOT_WAIT_MS,
      onUpdateShown: updateOffer.eligibility,
      serviceWorkerUrl: serviceWorkerUrl(SERVICE_WORKER_URL, undefined),
    },
    withInstallProgress(page),
  );
  acceptWaitingUpdate = () => play.flow.accept();
  home = trackHomeScreen(play.setOnHome);
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
  // Read before the back guard pushes its entry, which would stop the window closing.
  exitHidden = appCannotClose(createCloseWatcher, window);
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
// tab can always leave for the site's home page; an installed app only where its window closes.
export function exitShown(): boolean {
  return !exitHidden;
}

// Resolves once the game may show its first screen and write a save: at once, or after a fresh
// load has checked for a newer version, for at most BOOT_WAIT_MS (it never resolves for a page
// that reloads into one first).
export function launchReady(): Promise<void> {
  return ready;
}

// The zone's first frame has shown: the game page is now the home screen, where the update
// modal may show and a first visit registers the service worker.
export function zoneShown(): void {
  home?.shown();
}

// Something covers the zone, so the update modal waits until it is gone.
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
