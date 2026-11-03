import { WARNED_VENT_BEHAVIOUR } from "./obstacleBehaviours";
import type { Character } from "./types";

export const OBSTACLE_CHARACTERS: Readonly<Record<string, Character>> = {
  "warned-vent": {
    archetype: "hazard",
    art: "placeholder-hazard",
    behaviour: WARNED_VENT_BEHAVIOUR,
    cols: 4,
    rows: 6,
  },
};
