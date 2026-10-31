// Whether the game's home screen is in front, for the kit's update flow: the game page counts as
// the home screen once the zone's first frame shows, except while something covers it: the pause
// card, a conversation, death, or a room in the zone's place.
export type HomeCover = "death" | "dialogue" | "loading" | "pauseCard" | "room";

export interface HomeScreen {
  // Something starts or stops covering the zone.
  cover(what: HomeCover, covering: boolean): void;
  // The zone's first frame has shown.
  shown(): void;
}

// Calls onChange with whether the home screen is in front, on each change only.
export function trackHomeScreen(onChange: (onHome: boolean) => void): HomeScreen {
  let zoneShown = false;
  const covers = new Set<HomeCover>();
  let last = false;
  const update = () => {
    const now = zoneShown && covers.size === 0;
    if (now !== last) {
      last = now;
      onChange(now);
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
  };
}
