import type { Archetype, Interaction, Motion, Reaction } from "./types";

export const STATIC_MOTION: Motion = {
  algorithm: "static",
  direction: "right",
  distance: 0,
  hopHeight: 0,
  pause: 0,
  speed: 0,
  variance: 0,
};
export const NO_REACTION: Reaction = { kind: "none", range: 0, speed: 0 };
export const NO_INTERACTION: Interaction = { kind: "none", range: 0 };

// How each kind of thing behaves, by name: its collision, which it always has, and the default
// motion, reaction and interaction its characters tune.
export const ARCHETYPES: Readonly<Record<string, Archetype>> = {
  // Wanders near its spot and comes toward him when he is near.
  approacher: {
    collision: "none",
    interaction: NO_INTERACTION,
    motion: {
      ...STATIC_MOTION,
      algorithm: "linear",
      distance: 4,
      pause: 1,
      speed: 2,
      variance: 0.3,
    },
    reaction: { kind: "approach", range: 10, speed: 6 },
  },
  // A doorway: Use at it shows its room.
  door: {
    collision: "use",
    interaction: NO_INTERACTION,
    motion: STATIC_MOTION,
    reaction: NO_REACTION,
  },
  // Touching it restarts the zone.
  hazard: {
    collision: "hazard",
    interaction: NO_INTERACTION,
    motion: STATIC_MOTION,
    reaction: NO_REACTION,
  },
  // A hazard going back and forth.
  "hazard-patroller": {
    collision: "hazard",
    interaction: NO_INTERACTION,
    motion: {
      ...STATIC_MOTION,
      algorithm: "linear",
      direction: "left",
      distance: 16,
      pause: 0.5,
      speed: 6,
      variance: 0.25,
    },
    reaction: NO_REACTION,
  },
  // A hazard wandering about.
  "hazard-wanderer": {
    collision: "hazard",
    interaction: NO_INTERACTION,
    motion: {
      ...STATIC_MOTION,
      algorithm: "wander",
      distance: 30,
      pause: 0.5,
      speed: 5,
      variance: 0.3,
    },
    reaction: NO_REACTION,
  },
  // Hops about and flees from him.
  "hopper-avoider": {
    collision: "none",
    interaction: NO_INTERACTION,
    motion: {
      ...STATIC_MOTION,
      algorithm: "hop",
      direction: "left",
      distance: 3,
      hopHeight: 1,
      pause: 1,
      speed: 2,
      variance: 0.5,
    },
    reaction: { kind: "avoid", range: 6, speed: 8 },
  },
  // One-way: solid only from above.
  ledge: {
    collision: "ledge",
    interaction: NO_INTERACTION,
    motion: STATIC_MOTION,
    reaction: NO_REACTION,
  },
  // A solid platform going back and forth; he rides it.
  platform: {
    collision: "solid",
    interaction: NO_INTERACTION,
    motion: { ...STATIC_MOTION, algorithm: "linear" },
    reaction: NO_REACTION,
  },
  // Drawn only.
  scenery: {
    collision: "none",
    interaction: NO_INTERACTION,
    motion: STATIC_MOTION,
    reaction: NO_REACTION,
  },
  // Solid from every side.
  solid: {
    collision: "solid",
    interaction: NO_INTERACTION,
    motion: STATIC_MOTION,
    reaction: NO_REACTION,
  },
  // Walks back and forth, paying him no attention.
  walker: {
    collision: "none",
    interaction: NO_INTERACTION,
    motion: {
      ...STATIC_MOTION,
      algorithm: "ease",
      direction: "left",
      distance: 20,
      pause: 2,
      speed: 3,
      variance: 0.4,
    },
    reaction: NO_REACTION,
  },
};
