import {
  createRequiredLoading,
  type LoadingAttempts,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import {
  type LoadingFailureView,
  mountLoadingFailure,
} from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import { readUnit } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { CARD_CONTENT, TEXT_BUTTON } from "../data/layout.ts";

// One page registry shares the kit's required-resource failure and explicit Retry lifecycle.
export const requiredLoading = createRequiredLoading();

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
  let state = requiredLoading.state;
  let pending: Promise<void> | undefined;
  let startingRetry = false;
  let unit: number | undefined;
  let view: LoadingFailureView | undefined;
  const onRetry = () => {
    let flight: Promise<void>;
    startingRetry = true;
    try {
      flight = requiredLoading.retry();
      pending = flight;
    } finally {
      startingRetry = false;
    }
    const settled = () => {
      if (live && pending === flight) {
        pending = undefined;
        refit();
      }
    };
    void flight.then(settled, settled);
    return flight;
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
  const stop = requiredLoading.subscribe((next) => {
    state = next;
    refit();
    view?.update(state);
  });
  return () => {
    live = false;
    stop();
    window?.removeEventListener("resize", refit);
    pending = undefined;
    view?.dispose();
    view = undefined;
  };
}
