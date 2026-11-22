import {
  ObsoleteUpdateOfferError,
  type UpdateOffer,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";

// The Update now prompt's state between the kit launch and UpdateScene. The kit offers each staged
// version once a session (onUpdateReady); the prompt shows until the player chooses. Update now
// keeps it shown, so play stays paused, while the save settles and the page reloads into the
// staged build. The prompt closes if its switch fails or its offer becomes obsolete. Dismissing
// it continues play on the active build, and the next launch switches silently.
export function createUpdateOffer() {
  let current: UpdateOffer | undefined;
  let switching = false;
  let listener: ((visible: boolean) => void) | undefined;
  const hide = () => {
    current = undefined;
    switching = false;
    listener?.(false);
  };
  return {
    // Update now: saves, then switches. Ignored while no prompt shows or a switch is under way.
    accept(save: () => Promise<void>): void {
      if (current === undefined || switching) {
        return;
      }
      const offer = current;
      switching = true;
      offer.updateNow(save).catch((error: unknown) => {
        switching = false;
        if (error instanceof ObsoleteUpdateOfferError) {
          // The kit can share a pending switch with an offer for a different version.
          if (error.version === offer.version && current === offer) {
            hide();
          }
          return;
        }
        console.warn("Update now failed; play continues on this version.", error);
        if (current === offer) {
          hide();
        }
      });
    },
    // Cancel, the X, back, Escape or a tap outside the card.
    defer(): void {
      if (current === undefined || switching) {
        return;
      }
      const offer = current;
      hide();
      offer.dismiss();
    },
    // The launch's onUpdateReady.
    offer(next: UpdateOffer): void {
      if (switching) {
        return;
      }
      const shown = current !== undefined;
      current = next;
      if (!shown) {
        listener?.(true);
      }
    },
    subscribe(next: (visible: boolean) => void) {
      listener = next;
      next(current !== undefined);
      return () => {
        if (listener === next) {
          listener = undefined;
        }
      };
    },
  };
}
