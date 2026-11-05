// The rules advance in fixed steps of this many seconds, whatever the frame rate, so a run
// replays exactly from its inputs. 120 a second halves the wait for a press to take effect.
export const STEP_SECONDS = 1 / 120;
export const STEP_MS = STEP_SECONDS * 1000;
// The active-play clock's frame limits, shared by the zone and the rooms behind its doors: after
// a stall, bank at most maxFrameMs at once rather than lurching ahead.
export const PLAY_STEP_LIMITS = { maxFrameMs: 250, stepMs: STEP_MS } as const;
