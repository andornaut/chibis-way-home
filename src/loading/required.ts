import {
  createRequiredLoading,
  type LoadingAttempts,
  type LoadingAttemptState,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import {
  type LoadingFailurePresentationView,
  mountLoadingFailure,
} from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import type { LaunchFailure } from "@andornaut/game-kit/runtime/web/pwa/buildContract";

import { SCREEN } from "../data/screen.ts";
import { bindFactoryAction } from "../ui/input/actionBinding.ts";
import { loadingFailurePresentation, loadingUnit } from "./presentation.ts";

// One page registry shares the kit's required-resource failure and explicit Retry lifecycle.
export const requiredLoading = createRequiredLoading();

// The first install's state, apart from the required resources' registry: the kit launch's
// onFailure reports a failed install, and its Retry resumes the install. Background updates have
// no state here; they never show Loading failed.
let installationState: LoadingAttemptState | undefined;
let installationRetry: (() => void) | undefined;
let installationAttempts = 0;
const installationListeners = new Set<() => void>();
const changedInstallation = () => installationListeners.forEach((listener) => listener());

export const installationFeedback = {
  // The launch's onFailure, which can come before any view is mounted.
  fail(failure: LaunchFailure): void {
    installationState = { attempt: ++installationAttempts, error: failure.reason, kind: "failed" };
    installationRetry = failure.retry;
    changedInstallation();
  },
  // Retry: resumes the install once, and Loading failed hides until another failure.
  retry(): Promise<void> {
    const retry = installationRetry;
    installationRetry = undefined;
    if (installationState?.kind === "failed") {
      installationState = { attempt: ++installationAttempts, kind: "loading" };
    }
    retry?.();
    changedInstallation();
    return Promise.resolve();
  },
  get state(): LoadingAttemptState | undefined {
    return installationState;
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
  const frame = parent.closest<HTMLElement>("#game") ?? parent;
  let requiredState = requiredLoading.state;
  let state: LoadingAttemptState = requiredState;
  let revision = 0;
  let owner: "required" | "installation" = "required";
  let pending: Promise<unknown> | undefined;
  let pendingOwner: "required" | "installation" | undefined;
  let unit: number | undefined;
  let view: LoadingFailurePresentationView | undefined;
  const onRetry = () => {
    let flight: Promise<unknown>;
    try {
      pendingOwner = owner;
      flight = owner === "installation" ? installationFeedback.retry() : requiredLoading.retry();
      pending = flight;
    } catch (error) {
      pendingOwner = undefined;
      throw error;
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
    if (!live || (state.kind !== "failed" && view === undefined)) {
      return;
    }
    const nextUnit = loadingUnit(frame);
    if (!Number.isFinite(nextUnit) || nextUnit <= 0) {
      return;
    }
    parent.style.setProperty("--failure-frame-width", `${SCREEN.width * nextUnit}px`);
    parent.style.setProperty("--failure-frame-height", `${SCREEN.height * nextUnit}px`);
    if (view !== undefined && unit === nextUnit) {
      return;
    }
    unit = nextUnit;
    const presentation = loadingFailurePresentation(unit);
    if (view !== undefined) {
      view.setPresentation(presentation);
      return;
    }
    view = mountLoadingFailure(
      {
        bindHoldAction: bindFactoryAction,
        onRetry,
        presentation,
      },
      parent,
    );
    view.update(state);
  };
  const render = () => {
    // The first install runs before the required resources can load or fail, so its failure
    // shows unless a required failure or Retry is under way.
    const nextOwner =
      requiredState.kind !== "failed" &&
      pendingOwner !== "required" &&
      (installationState?.kind === "failed" || pendingOwner === "installation")
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
  const observer = new ResizeObserver(refit);
  observer.observe(frame);
  window?.addEventListener("resize", refit);
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
    observer.disconnect();
    pending = undefined;
    view?.dispose();
    view = undefined;
  };
}
