import type { RequiredUpdateState } from "@andornaut/game-kit/web/pwa/updateReady";

// The forced update's state, which the kit reports (onRequireNewer) and the boot scene shows:
// each report reaches the listener, and a new listener gets the latest at once.
export function createRequiredUpdate() {
  let state: RequiredUpdateState | undefined;
  let listener: ((state: RequiredUpdateState) => void) | undefined;
  return {
    report(next: RequiredUpdateState) {
      state = next;
      listener?.(next);
    },
    subscribe(next: (state: RequiredUpdateState) => void) {
      listener = next;
      if (state !== undefined) {
        next(state);
      }
      return () => {
        if (listener === next) {
          listener = undefined;
        }
      };
    },
  };
}
