// The rules advance in fixed steps of this many seconds, whatever the frame rate, so a run
// replays exactly from its inputs. 120 a second halves the wait for a press to take effect.
export const STEP_SECONDS = 1 / 120;
export const STEP_MS = STEP_SECONDS * 1000;
