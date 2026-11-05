import { WARNED_VENT_BEHAVIOUR } from "./obstacleBehaviours";
import type { Character, HazardPhase, PhaseTiles } from "./types";

const crosswalkTiles = (phase: string): PhaseTiles => ({
  left: `crosswalk-${phase}-left`,
  middle: `crosswalk-${phase}-middle`,
  right: `crosswalk-${phase}-right`,
});

// The crosswalk strip's tiles in tiles-street: walk while inactive, then warning and traffic.
export const CROSSWALK_PHASE_TILES: Readonly<Record<HazardPhase, PhaseTiles>> = {
  active: crosswalkTiles("traffic"),
  inactive: crosswalkTiles("walk"),
  warning: crosswalkTiles("warning"),
};

// The crosswalk signal's tag for each strip state: Walk only while walking, Stop through traffic
// and recovery.
export const CROSSWALK_SIGNAL_ANIMATIONS: Readonly<Record<string, string>> = {
  active: "stop",
  inactive: "walk",
  recovery: "stop",
  warning: "warning",
};

export const OBSTACLE_CHARACTERS: Readonly<Record<string, Character>> = {
  "warned-vent": {
    archetype: "hazard",
    art: "placeholder-hazard",
    behaviour: WARNED_VENT_BEHAVIOUR,
    cols: 4,
    contactCue: "red-hazard",
    rows: 6,
  },
};
