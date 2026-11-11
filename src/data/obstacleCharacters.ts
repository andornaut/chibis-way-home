import { GANTRY_BEHAVIOUR, WARNED_VENT_BEHAVIOUR } from "./obstacleBehaviours";
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
  // The swinging chandelier: a one-way brass rim, level at every pose of its swing.
  "apartment-chandelier": {
    archetype: "ledge",
    art: "apartment-chandelier",
    cols: 6,
    rows: 2,
  },
  // The chandelier's ceiling rose, whose centre is the swing's pivot.
  "apartment-chandelier-mount": {
    archetype: "scenery",
    art: "apartment-chandelier-mount",
    cols: 2,
    rows: 1,
  },
  // The gantry crane container: a one-way lid shuttling between its docks.
  "freight-crane-container": {
    archetype: "ledge",
    art: "freight-crane-container",
    behaviour: GANTRY_BEHAVIOUR,
    cols: 6,
    rows: 3,
  },
  // The gantry rail the container's cable hangs from, across the crane's pit.
  "freight-gantry-rail": {
    archetype: "scenery",
    art: "freight-gantry-rail",
    cols: 22,
    rows: 2,
  },
  "warned-vent": {
    archetype: "hazard",
    art: "placeholder-hazard",
    behaviour: WARNED_VENT_BEHAVIOUR,
    cols: 4,
    contactCue: "red-hazard",
    rows: 6,
  },
};
