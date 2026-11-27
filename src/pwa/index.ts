// The game as an installed phone app: install and updates, the back gesture, the screen wake lock
// and persistent storage. setupPhoneApp runs once from play.ts; the scenes listen for
// PHONE_EVENTS on window and call the functions below, and the settings card follows installOffer.
// The build reads the cache policy to write the service worker's precache.
//
// The kit's launch installs the complete build under the loading bar before the game exists, and
// a fresh document already runs a complete staged build, which the router promotes silently at
// the launch navigation. During play, a newer build stages in the background and switches only
// through Update now or the newer-save guard.
import { appCannotClose, canExitApp } from "@andornaut/game-kit/runtime/web/pwa/appWindow";
import {
  backCloseWatcher,
  isFirefoxAndroidApp,
} from "@andornaut/game-kit/runtime/web/pwa/backNavigation";
import type { LaunchResult } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import {
  browserCloseWatcher,
  guardBackNavigation,
} from "@andornaut/game-kit/runtime/web/pwa/dom/backNavigation";
import { pageRunsAsApp } from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
import {
  type BrowserLaunchPreparation,
  createLaunch,
  type LaunchContext,
  prepareBrowserLaunch,
  type PreparedBrowserLaunch,
} from "@andornaut/game-kit/runtime/web/pwa/dom/launch";
import {
  createScreenWakeLock,
  type ScreenWakeLock,
} from "@andornaut/game-kit/runtime/web/pwa/dom/wakeLock";
import { requestPersistentStorage } from "@andornaut/game-kit/runtime/web/pwa/storagePersistence";

import { installationFeedback, launchLoading } from "../loading/index.ts";
import { CACHE_POLICY, SERVICE_WORKER_URL, SOUND_FORMAT } from "./cachePolicy.ts";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events.ts";
import { createNetworkPlay } from "./networkPlay.ts";
import { createRequiredUpdate } from "./requiredUpdate.ts";
import { createUpdateOffer } from "./updateOffer.ts";

export { CACHE_POLICY, SOUNDS } from "./cachePolicy.ts";
export { PHONE_EVENTS } from "./events.ts";
export { installOffer } from "./installOffer.ts";

// The history state key of the extra entry that back pops instead of leaving the game.
const BACK_GUARD_KEY = "birdBackGuard";
let launch: ReturnType<typeof createLaunch> | undefined;
// The staged update's Update now prompt, which UpdateScene shows over whatever the player is in.
export const updateOffer = createUpdateOffer();
// The forced update for a save a newer version wrote (requireNewer), as the kit reports it.
export const requiredUpdate = createRequiredUpdate();
// A device that could not install the game, which plays from the network and shows a notice.
export const networkPlay = createNetworkPlay();

// Close eligibility, captured as the page loads, before the back guard can add a history entry.
let appCloses = false;
let backLeaves = true;
let screenWakeLock: ScreenWakeLock | undefined;
interface PlatformBackExit {
  canLeave(): boolean;
  leave(): Promise<boolean>;
}
let platformBackExit: { readonly controller: PlatformBackExit } | undefined;

// A first install reports progress and failure to the page shell before the game loads.
function setupLaunch(context: LaunchContext): Promise<LaunchResult> {
  launch = createLaunch(context, {
    onFailure: (failure) => {
      launchLoading.failed();
      installationFeedback.fail({
        ...failure,
        retry: () => {
          launchLoading.retried();
          failure.retry();
        },
      });
    },
    onNetworkPlay: networkPlay.report,
    onProgress: launchLoading.report,
    onRequireNewer: requiredUpdate.report,
    onUpdateReady: updateOffer.offer,
    onUpdateState: () => undefined,
    serviceWorkerUrl: SERVICE_WORKER_URL,
    soundFormat: SOUND_FORMAT,
  });
  launchLoading.bind(launch.bootProgress);
  return launch.run();
}

// Production requires the browser capabilities used to serve the archived game. Development
// starts from the dev server. The page imports the game only after the launch resolves "play".
export function setupPhoneApp(
  preparation: BrowserLaunchPreparation,
  beforeLaunch: () => void,
): Promise<LaunchResult> | Extract<PreparedBrowserLaunch, { kind: "unsupported" }> {
  const prepared = import.meta.env.PROD
    ? prepareBrowserLaunch(preparation, CACHE_POLICY)
    : undefined;
  if (prepared?.kind === "unsupported") {
    return prepared;
  }
  beforeLaunch();
  const result = prepared ? setupLaunch(prepared.context) : Promise.resolve<LaunchResult>("play");
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // boots whatever the browser answers, or if it never does.
  void requestPersistentStorage(
    pageRunsAsApp(window),
    "storage" in navigator ? navigator.storage : undefined,
  );
  const createCloseWatcher = backCloseWatcher(navigator.userAgent, browserCloseWatcher());
  appCloses = canExitApp(createCloseWatcher, window);
  backLeaves = !appCannotClose(createCloseWatcher, window);
  // Firefox for Android's installed app keeps its own back.
  // WORKAROUND: https://bugzilla.mozilla.org/show_bug.cgi?id=2079243 (see isFirefoxAndroidApp).
  if (!isFirefoxAndroidApp(navigator.userAgent, (query) => matchMedia(query).matches)) {
    guardBackNavigation(
      {
        createCloseWatcher,
        history,
        onBack: () => dispatchPhoneEvent(window, PHONE_EVENTS.backPressed),
        stateKey: BACK_GUARD_KEY,
        timer: window,
      },
      window,
    );
  }
  screenWakeLock = createScreenWakeLock(
    window,
    document,
    "wakeLock" in navigator ? navigator.wakeLock : undefined,
  );
  return result;
}

// Ordinary discovery on return to Start. The launch owns eligibility, timing and offers.
export function requestUpdateCheck(): void {
  launch?.requestUpdateCheck();
}

// Whether the start screen shows Exit: only in an installed app's window that a script can close.
export function exitShown(): boolean {
  return appCloses;
}

// Closes the app's window, for Exit; it never navigates to another page.
export function closeApp(): void {
  window.close();
}

// The page binds the checked shared native continuation for its current launch.
export function bindPlatformBackExit(controller: PlatformBackExit): () => void {
  const binding = { controller };
  platformBackExit = binding;
  return () => {
    if (platformBackExit === binding) {
      platformBackExit = undefined;
    }
  };
}

// A missing or unsupported native continuation leaves the confirmation available.
export function leavePlatformBack(): Promise<boolean> {
  return canLeavePlatformBack() ? platformBackExit!.controller.leave() : Promise.resolve(false);
}

export function canLeavePlatformBack(): boolean {
  return platformBackExit?.controller.canLeave() ?? false;
}

// Whether back on the start screen with no card open leaves the game: a closable app's window
// closes and a browser tab goes to the site's home page. An app whose window a script cannot
// close keeps back on the start screen.
export function backLeavesGame(): boolean {
  return backLeaves;
}

// Updates to a version at least as new as the one that wrote the save, by itself and with no
// offer, reporting through requiredUpdate. Without a launch (the dev server) none can come, so it
// reports "unavailable" at once.
export function requireNewer(): void {
  if (launch === undefined) {
    requiredUpdate.report("unavailable");
  } else {
    launch.requireNewer();
  }
}

// Keep the screen on while the game is visible: during play.
export function startWakeLock(): void {
  screenWakeLock?.start();
}

// Let the screen sleep: while the pause card is open.
export function stopWakeLock(): void {
  screenWakeLock?.stop();
}
