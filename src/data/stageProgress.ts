// How many of a zone's latest stage entries the progress save remembers the middle chunks of.
export const RECENT_STAGES = 2;

// The most loops a flat stage holds: the times its seam row returns to its start cap's exit row
// after leaving it. Infinity sets no cap.
export const STAGE_LOOP_CAP = Infinity;

export const STAGE_PROGRESS = {
  border: 1,
  colours: {
    fill: ["yellow", "amber"],
    frame: "ink",
    track: "dslate",
  },
} as const;
