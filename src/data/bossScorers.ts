// Proposed default weights for the boss scorer (`BossScorer` in `src/data/types/behaviour.ts`).
// Spatial curve ranges and move distances are tiles; seconds are active engaged seconds. Moves
// score 0.4 to 0.7 and attacks 0.9 to 1, so an attack whose gate and considerations hold wins;
// its considerations keep it for moments it can connect and Chibi can still read its tell.
import type { BossScoredAttack, BossScoredMove, BossScorer } from "./types/index.ts";

// Every boss scorer's shared cadence, pressure and hysteresis. A move holds for 0.6 to 0.9 s, so
// Chibi can read a heading and turn it; attacks are scored as soon as their gate holds. Pressure
// starts 2 s after the last attack and is full 6 s later, at a quarter weight. Attacks gain up to
// double as their 20 s (any) or 40 s (special) cadence comes due; an engagement opens with its
// special half due, so Pebble opens with the drop approach.
const SHARED = {
  decisionSeconds: { max: 0.9, min: 0.6 },
  due: { anySeconds: 20, openingSpecialSeconds: 20, specialSeconds: 40, weight: 1 },
  engaged: "pursuit",
  hysteresis: { bonus: 0.05, epsilon: 0.05, minHoldSeconds: 0 },
  pressure: { graceSeconds: 2, rampSeconds: 6, weight: 0.25 },
} as const;

// Run straight at Chibi along the movement map.
const CHASE: BossScoredMove = {
  base: 0.4,
  considerations: [],
  id: "chase",
  move: { kind: "chase" },
};

// Aim 0.5 s ahead of a running Chibi (at most 8 tiles) once he is well clear.
const CUT_OFF: BossScoredMove = {
  base: 0.5,
  considerations: [
    { curve: { from: 8, kind: "linear", to: 16 }, input: "targetSpeed" },
    { curve: { from: 3, kind: "linear", to: 8 }, input: "horizontalGap" },
  ],
  id: "cut-off",
  move: { kind: "cut-off", leadSeconds: 0.5, maxLead: 8 },
};

// Fert steps back from a Chibi within 2 tiles toward 4 tiles out, under any pressure; past 3 tiles
// the chase brings him back, so he hovers just inside his parcel's range.
const STANDOFF: BossScoredMove = {
  base: 0.7,
  considerations: [{ curve: { from: 2, kind: "inverse", to: 4 }, input: "horizontalGap" }],
  id: "standoff",
  move: { distance: 4, kind: "standoff" },
};

// Approach 10 tiles farther along Chibi's travel, for a swoop, while the special is not due and
// Pebble can see him; without sight he flies the drop approach over him instead.
const SWOOP_SETUP: BossScoredMove = {
  base: 0.5,
  considerations: [
    { curve: { from: 8, kind: "inverse", to: 14 }, input: "specialDueSeconds" },
    { curve: { from: 1, kind: "step", to: 1 }, input: "lineOfSight" },
  ],
  id: "swoop-setup",
  move: { distance: 10, kind: "ahead" },
};

export const GROUND_BOSS_SCORER: BossScorer = { ...SHARED, moves: [CHASE, CUT_OFF] };
export const FERT_SCORER: BossScorer = { ...SHARED, moves: [CHASE, CUT_OFF, STANDOFF] };
export const PEBBLE_SCORER: BossScorer = { ...SHARED, moves: [CHASE, SWOOP_SETUP] };

// A ground charge reaching `reach` tiles: not from point-blank (under 2.5 tiles it fades), not
// beyond its reach, and only at Chibi's height, so high ground counters it.
export function chargeScore(reach: number): BossScoredAttack {
  return {
    base: 1,
    considerations: [
      { curve: { from: 0.5, kind: "smooth", to: 2.5 }, input: "horizontalGap" },
      { curve: { from: 0.7 * reach, kind: "inverse", to: reach }, input: "horizontalGap" },
      { curve: { from: 1, kind: "inverse", to: 3 }, input: "heightGap" },
    ],
    special: false,
  };
}

// Archie's pounce: 1 to 8 tiles out, at any height its 3-tile hop meets.
export const POUNCE_SCORE: BossScoredAttack = {
  base: 0.9,
  considerations: [
    { curve: { from: 1, kind: "smooth", to: 3 }, input: "horizontalGap" },
    { curve: { from: 5, kind: "inverse", to: 8 }, input: "horizontalGap" },
  ],
  special: true,
};

// Fert's parcel: a lob that lands about 12 tiles out, half as likely without line of sight.
export const PARCEL_SCORE: BossScoredAttack = {
  base: 0.9,
  considerations: [
    { curve: { from: 2, kind: "smooth", to: 5 }, input: "horizontalGap" },
    { curve: { from: 11, kind: "inverse", to: 15 }, input: "distance" },
    { curve: { from: -1, kind: "linear", to: 1 }, input: "lineOfSight" },
  ],
  special: true,
};

// Trixi's trap: dropped on her own floor when Chibi is on it but not touching.
export const TRAP_SCORE: BossScoredAttack = {
  base: 0.9,
  considerations: [
    { curve: { from: 1, kind: "smooth", to: 3 }, input: "horizontalGap" },
    { curve: { from: 2, kind: "inverse", to: 5 }, input: "heightGap" },
  ],
  special: true,
};

// Kiwi's climb and drop: its gate already needs her lined up under a clear climb.
export const KIWI_DROP_SCORE: BossScoredAttack = { base: 0.9, considerations: [], special: true };

// Bini's growl: its 3-tile-high gust misses Chibi on high ground, and cover blocks it.
export const GROWL_SCORE: BossScoredAttack = {
  base: 0.9,
  considerations: [
    { curve: { from: 1.5, kind: "inverse", to: 4 }, input: "heightGap" },
    { curve: { from: -1, kind: "linear", to: 1 }, input: "lineOfSight" },
  ],
  special: true,
};

// Bini's maul: a standing swipe, only within a few tiles at his height.
export const MAUL_SCORE: BossScoredAttack = {
  base: 0.9,
  considerations: [
    { curve: { from: 2, kind: "inverse", to: 5 }, input: "horizontalGap" },
    { curve: { from: 2, kind: "inverse", to: 4 }, input: "heightGap" },
  ],
  special: true,
};

// Pebble's attacks are gated on arriving at their approach goal, so they score flat.
export const DROP_BURST_SCORE: BossScoredAttack = { base: 0.9, considerations: [], special: true };
export const SWOOP_SCORE: BossScoredAttack = { base: 1, considerations: [], special: false };
