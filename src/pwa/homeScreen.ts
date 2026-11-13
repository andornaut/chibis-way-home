// Registration follows the first prepared zone; offers belong only to the visible Start screen.
export type HomeCover = "death" | "dialogue" | "loading" | "pauseCard" | "room" | "startCard";

export interface HomeScreen {
  cover(what: HomeCover, covering: boolean): void;
  shown(): void;
  startShown(shown: boolean): void;
}

export function trackHomeScreen(
  onOfferVisible: (visible: boolean) => void,
  onRegistrationReady: () => void,
  onArrival: () => void = () => undefined,
): HomeScreen {
  let zoneShown = false;
  let startShown = false;
  let registered = false;
  const covers = new Set<HomeCover>();
  let last = false;
  const update = () => {
    if (!registered && zoneShown && [...covers].every((cover) => cover === "startCard")) {
      registered = true;
      onRegistrationReady();
    }
    const now = startShown && covers.size === 0;
    if (now !== last) {
      last = now;
      onOfferVisible(now);
    }
  };
  return {
    cover(what, covering) {
      if (covering) {
        covers.add(what);
      } else {
        covers.delete(what);
      }
      update();
    },
    shown() {
      zoneShown = true;
      update();
    },
    startShown(shown) {
      const arriving = shown && !startShown;
      startShown = shown;
      update();
      if (arriving) {
        onArrival();
      }
    },
  };
}
