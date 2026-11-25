// How many of a zone's latest stage entries the progress save remembers the middle chunks of.
export const RECENT_STAGES = 2;

export const STAGE_PROGRESS = {
  border: 1,
  colours: {
    fill: ["yellow", "amber"],
    frame: "ink",
    track: "dslate",
  },
} as const;
