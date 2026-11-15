import {
  createRequiredLoading,
  type LoadingAttempts,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { mountLoadingFailure } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

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
  const view = mountLoadingFailure({ onRetry: () => requiredLoading.retry() }, parent);
  const stop = requiredLoading.subscribe((state) => view.update(state));
  return () => {
    stop();
    view.dispose();
  };
}
