// The game as an installed phone app: offline play and updates, the back gesture, the screen
// wake lock and persistent storage. setupPhoneApp runs once from main.ts; the scenes listen for
// PHONE_EVENTS on window and call the functions below.
//
// A fresh document may apply a complete waiting version before constructing the game or reading
// saves. During play, newer versions stage separately and switch only through Update now or the
// newer-save guard. Returning to Start or showing the page never activates them.
import { appCannotClose } from "@andornaut/game-kit/web/pwa/appWindow";
import { backCloseWatcher, isFirefoxAndroidApp } from "@andornaut/game-kit/web/pwa/backNavigation";
import {
  browserCloseWatcher,
  guardBackNavigation,
} from "@andornaut/game-kit/web/pwa/dom/backNavigation";
import { pageRunsAsApp } from "@andornaut/game-kit/web/pwa/dom/installFlow";
import {
  browserOfflinePage,
  type LaunchResult,
  type OfflinePlay,
  startOfflinePlay,
} from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import {
  createScreenWakeLock,
  type ScreenWakeLock,
} from "@andornaut/game-kit/web/pwa/dom/wakeLock";
import { serviceWorkerUrl } from "@andornaut/game-kit/web/pwa/serviceWorkerUrl";
import { requestPersistentStorage } from "@andornaut/game-kit/web/pwa/storagePersistence";

import { trackOfflineActivity } from "../loading/serviceWorker.ts";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events.ts";
import { type HomeCover, type HomeScreen, trackHomeScreen } from "./homeScreen.ts";
import { createRequiredUpdate } from "./requiredUpdate.ts";
import { createUpdateOffer } from "./updateOffer.ts";

export { PHONE_EVENTS } from "./events.ts";

// The history state key of the extra entry that back pops instead of leaving the game.
const BACK_GUARD_KEY = "birdBackGuard";
const SERVICE_WORKER_URL = "/sw.js";
let offlinePlay: OfflinePlay | undefined;
export const updateOffer = createUpdateOffer(
  () => offlinePlay?.flow.accept(),
  () => offlinePlay?.flow.dismissOffer(),
);
// The forced update for a save a newer version wrote (requireNewer), as the kit reports it.
export const requiredUpdate = createRequiredUpdate();

// Capture close eligibility before the back guard can add a history entry.
let exitHidden = false;
let home: HomeScreen | undefined;
let screenWakeLock: ScreenWakeLock | undefined;

// The production build only: the dev server has no sw.js, and a worker would serve stale
// modules over hot reloads. A page a version controls registers now, so its update check runs
// in the background while the game loads; a first visit registers once the zone shows, so the precache does not
// compete with the game's own downloads (registrationReady). The loading bar shows only the
// kit's "precaching", that first visit's precache; an update installs in the background with no
// bar (trackOfflineActivity).
function setupOfflinePlay(): Promise<LaunchResult> {
  const page = import.meta.env.PROD ? browserOfflinePage() : undefined;
  if (page === undefined) {
    return Promise.resolve("continue");
  }
  const play = startOfflinePlay(
    {
      onOfflineActivity: trackOfflineActivity(),
      onRequireNewer: requiredUpdate.report,
      onUpdateShown: updateOffer.setVisible,
      serviceWorkerUrl: serviceWorkerUrl(SERVICE_WORKER_URL, undefined),
    },
    page,
  );
  offlinePlay = play;
  home = trackHomeScreen(
    play.flow.setOfferVisible,
    () => play.registrationReady(),
    () => play.flow.arriveHome(),
  );
  return play.launchReady();
}

// The launch result settles before game construction; an unsuccessful switch keeps this build.
export function setupPhoneApp(): Promise<LaunchResult> {
  const launch = setupOfflinePlay();
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // boots whatever the browser answers, or if it never does.
  void requestPersistentStorage(
    pageRunsAsApp(window),
    "storage" in navigator ? navigator.storage : undefined,
  );
  const createCloseWatcher = backCloseWatcher(navigator.userAgent, browserCloseWatcher());
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
    window,
    document,
    "wakeLock" in navigator ? navigator.wakeLock : undefined,
  );
  return launch;
}

// Whether the start screen offers to leave the game: Exit, and back with no card open. A browser
// tab can always leave for the site's home page; app windows need a supported close path.
export function exitShown(): boolean {
  return !exitHidden;
}

// Updates to a version at least as new as the one that wrote the save, by itself and with no
// offer, reporting through requiredUpdate. Without offline play (the dev server) none can come,
// so it reports "unavailable" at once.
export function requireNewer(): void {
  if (offlinePlay === undefined) {
    requiredUpdate.report("unavailable");
  } else {
    offlinePlay.flow.requireNewer();
  }
}

// The existing prepared-zone signal controls first-install registration, not update offers.
export function zoneShown(): void {
  home?.shown();
}

export function startScreenShown(shown: boolean): void {
  home?.startShown(shown);
}

// A game or Start-owned card suppresses offers without changing their dismissal.
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
