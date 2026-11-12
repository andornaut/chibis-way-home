import { TILE } from "./screen.ts";
import type { BehaviourPlan, Character, ElementBinding, Instance } from "./types/index.ts";

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

const LARGE_DEER_POSE_SECONDS = { graze: 3.25, idle: 2.36 } as const;
const LARGE_DEER_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: 0,
  initial: "idle",
  states: {
    graze: {
      animation: "graze",
      motion: { kind: "wait" },
      transitions: [
        { to: "idle", when: [{ kind: "elapsed", seconds: LARGE_DEER_POSE_SECONDS.graze }] },
      ],
    },
    idle: {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [
        { to: "graze", when: [{ kind: "elapsed", seconds: LARGE_DEER_POSE_SECONDS.idle }] },
      ],
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
  "background-deer-large": {
    archetype: "scenery",
    art: "background-deer-large",
    behaviour: LARGE_DEER_BEHAVIOUR,
    cols: 216 / TILE,
    rows: 144 / TILE,
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
    cols: 144 / TILE,
    rows: 96 / TILE,
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
    { character: "background-swallow", col: 13, parallax: { x: 1, y: 1 }, phase: 0, row: 34.5 },
  ],
  "compound-return-high": [
    { character: "background-deer-large", col: 37, parallax: { x: 1, y: 1 }, row: 38 },
  ],
  "compound-return-terrace": [
    { character: "background-reeds", col: 54, parallax: { x: 0.4, y: 1 }, row: 48 },
  ],
  "vertical-red-gate": [
    { character: "background-reeds", col: 44, parallax: { x: 0.4, y: 1 }, row: 48 },
    { character: "background-deer-large", col: 40, parallax: { x: 1, y: 1 }, row: 38 },
  ],
};
