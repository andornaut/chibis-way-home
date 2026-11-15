import {
  createRequiredLoading,
  type LoadingAttempts,
  type LoadingAttemptState,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import {
  type LoadingFailureView,
  mountLoadingFailure,
} from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import type { InstallationState } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";
import { readUnit } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { CARD_CONTENT, TEXT_BUTTON } from "../data/layout.ts";

// One page registry shares the kit's required-resource failure and explicit Retry lifecycle.
export const requiredLoading = createRequiredLoading();

let installationState: InstallationState | undefined;
let installationRetry: (() => Promise<InstallationState>) | undefined;
let installationSuppressed = false;
const installationListeners = new Set<() => void>();
const changedInstallation = () => installationListeners.forEach((listener) => listener());

// Presentation retains the kit's identity even when its initial callback precedes handle binding.
export const installationFeedback = {
  bind(retry: () => Promise<InstallationState>): void {
    installationRetry = retry;
    changedInstallation();
  },
  report(state: InstallationState): void {
    installationState = state;
    changedInstallation();
  },
  get state(): InstallationState | undefined {
    return installationState;
  },
  suppress(): void {
    installationSuppressed = true;
    changedInstallation();
  },
};

// The caller chooses recovery; the registry owns failed-only singleflight Retry.
export function observeRequiredAttempt(
  retry: () => void | PromiseLike<void>,
  attempt: LoadingAttempts,
): () => void {
  return requiredLoading.observe({
    retry,
    status: () => {
      const kind = attempt.state.kind;
      return kind === "failed"
        ? "failed"
        : kind === "ready" || kind === "disposed"
          ? "ready"
          : "loading";
    },
  });
}

// The parent is outside the game's font/art reveal gates and modal inert ownership.
export function mountRequiredLoading(parent: HTMLElement): () => void {
  const document = parent.ownerDocument;
  const window = document.defaultView;
  let live = true;
  let listening = false;
  let requiredState = requiredLoading.state;
  let state: LoadingAttemptState = requiredState;
  let revision = 0;
  let owner: "required" | "installation" = "required";
  let pending: Promise<unknown> | undefined;
  let pendingOwner: "required" | "installation" | undefined;
  let startingRetry = false;
  let unit: number | undefined;
  let view: LoadingFailureView | undefined;
  const onRetry = () => {
    let flight: Promise<unknown>;
    startingRetry = true;
    try {
      pendingOwner = owner;
      flight = owner === "installation" ? installationRetry!() : requiredLoading.retry();
      pending = flight;
    } catch (error) {
      pendingOwner = undefined;
      throw error;
    } finally {
      startingRetry = false;
    }
    const settled = () => {
      if (live && pending === flight) {
        pending = undefined;
        pendingOwner = undefined;
        render();
      }
    };
    void flight.then(settled, settled);
    return flight.then(() => undefined);
  };
  const refit = () => {
    if (!live || state.kind !== "failed" || startingRetry || pending !== undefined) {
      return;
    }
    const nextUnit = readUnit(parent.closest("#game")?.querySelector(".ui-layer") ?? parent);
    if (view !== undefined && unit === nextUnit) {
      return;
    }
    const focused = view?.element.querySelector("button") === document.activeElement;
    view?.dispose();
    unit = nextUnit;
    view = mountLoadingFailure(
      {
        layout: {
          actionAlign: "end",
          gapPx: CARD_CONTENT.gap * unit,
          minActionSizePx: TEXT_BUTTON.height * unit,
          paddingPx: CARD_CONTENT.padding * unit,
        },
        onRetry,
      },
      parent,
    );
    view.update(state);
    if (focused) {
      view.element.querySelector("button")?.focus({ preventScroll: true });
    }
    if (!listening) {
      window?.addEventListener("resize", refit);
      listening = true;
    }
  };
  const render = () => {
    const nextOwner =
      requiredState.kind === "ready" &&
      pendingOwner !== "required" &&
      !installationSuppressed &&
      installationState !== undefined &&
      installationRetry !== undefined
        ? "installation"
        : "required";
    let restoreFocus = false;
    if (owner !== nextOwner) {
      restoreFocus = view?.element.querySelector("button") === document.activeElement;
      owner = nextOwner;
      pending = undefined;
      pendingOwner = undefined;
      view?.dispose();
      view = undefined;
    }
    const selected = owner === "installation" ? installationState! : requiredState;
    // View ordering is independent of the two owners' attempt counters and operation identities.
    state = { ...selected, attempt: ++revision };
    refit();
    view?.update(state);
    if (restoreFocus && state.kind === "failed") {
      view?.element.querySelector("button")?.focus({ preventScroll: true });
    }
  };
  const stop = requiredLoading.subscribe((next) => {
    requiredState = next;
    render();
  });
  installationListeners.add(render);
  return () => {
    live = false;
    stop();
    installationListeners.delete(render);
    window?.removeEventListener("resize", refit);
    pending = undefined;
    view?.dispose();
    view = undefined;
  };
}
