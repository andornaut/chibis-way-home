import { TILE } from "./screen";
import type { BehaviourPlan, Character, ElementBinding, Instance } from "./types";

const DEER_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: 0,
  initial: "idle",
  states: {
    graze: {
      animation: "graze",
      motion: { kind: "wait" },
      transitions: [{ to: "idle", when: [{ kind: "elapsed", seconds: 1.2 }] }],
    },
    idle: {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [{ to: "graze", when: [{ kind: "elapsed", seconds: 3.6 }] }],
    },
  },
};

export const WOODLAND_SCENERY_CHARACTERS: Readonly<Record<string, Character>> = {
  "background-deer": {
    archetype: "scenery",
    art: "background-deer",
    behaviour: DEER_BEHAVIOUR,
    cols: 32 / TILE,
    rows: 24 / TILE,
  },
  "background-reeds": {
    animations: { idle: "sway" },
    archetype: "scenery",
    art: "background-reeds",
    cols: 24 / TILE,
    rows: 24 / TILE,
  },
  "background-swallow": {
    animations: { idle: "flight" },
    archetype: "scenery",
    art: "background-swallow",
    cols: 24 / TILE,
    rows: 12 / TILE,
    tuning: {
      motion: {
        algorithm: "hop",
        direction: "right",
        distance: 72,
        hopHeight: 2,
        pause: 0,
        playback: "once-visible",
        speed: 9,
        variance: 0,
      },
    },
  },
};

export function woodlandSpecies(
  far: string,
  middle: string,
): Readonly<Record<string, ElementBinding>> {
  return {
    "woodland-far": { character: "street-city-far", skin: { art: far, tileset: null } },
    "woodland-mid": { character: "street-city-mid", skin: { art: middle, tileset: null } },
  };
}

export function woodlandDepth(layers: readonly Instance[]): readonly Instance[] {
  return layers.map((layer) => ({
    ...layer,
    ...(layer.role === "far-background" ? { role: "woodland-far" } : {}),
    ...(layer.role === "mid-background" ? { role: "woodland-mid" } : {}),
  }));
}

// Wildlife follows world coordinates; rooted flora retains its decorative parallax.
export const WOODLAND_SCENERY: Readonly<Record<string, readonly Instance[]>> = {
  "compound-low-ceiling-shuttle": [
    { character: "background-swallow", col: 18, parallax: { x: 1, y: 1 }, phase: 0, row: 38 },
  ],
  "compound-return-high": [
    { character: "background-deer", col: 45, parallax: { x: 1, y: 1 }, row: 48 },
  ],
  "compound-return-terrace": [
    { character: "background-reeds", col: 54, parallax: { x: 0.4, y: 1 }, row: 48 },
  ],
  "growl-cover-middle": [
    { character: "background-swallow", col: 38, parallax: { x: 1, y: 1 }, phase: 0, row: 38 },
  ],
  "vertical-red-gate": [
    { character: "background-deer", col: 10, parallax: { x: 1, y: 1 }, row: 48 },
    { character: "background-reeds", col: 44, parallax: { x: 0.4, y: 1 }, row: 48 },
  ],
};
