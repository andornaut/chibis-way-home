import {
  scoreActions,
  type ScoreCandidate,
  type ScoreDecision,
} from "@andornaut/game-kit/ai/utility";
import { clamp01 } from "@andornaut/game-kit/numbers";
import type { Random } from "@andornaut/game-kit/random";

import type {
  BehaviourTransition,
  BirdTuning,
  BossMove,
  BossScoredMove,
  BossScorer,
  BossScorerInput,
  ChaseRelief,
  ObjectLayout,
  Point,
  SecondsRange,
} from "../data/types/index.ts";
import type { PursuitIntentState } from "./behaviourIntent.ts";
import { birdBox, type BirdState } from "./bird.ts";

// The scorer's own clocks and held move. threatSeconds and specialDueSeconds count engaged
// seconds outside attacks since the scorer last chose any attack and a special; pressureSeconds
// also restarts after a chase pause, and chaseSeconds counts them since the last pause or the
// engagement's start.
export interface BehaviourScorerState {
  readonly chaseSeconds: number;
  // Decisions drawn so far: the next decision's stream key.
  readonly decision: number;
  readonly heldSeconds: number;
  readonly move?: string;
  // Chase pauses taken so far: the next pause's stream key.
  readonly pauses: number;
  readonly pressureSeconds: number;
  // Seconds since the last chase pause ended and since the last tell or committed attack, once
  // there was one.
  readonly sincePauseSeconds?: number;
  readonly sinceAttackSeconds?: number;
  readonly specialDueSeconds: number;
  readonly threatSeconds: number;
}

export type BossScorerValues = Readonly<Record<BossScorerInput, number>>;

export const INITIAL_SCORER_STATE: BehaviourScorerState = {
  chaseSeconds: 0,
  decision: 0,
  heldSeconds: 0,
  pauses: 0,
  pressureSeconds: 0,
  specialDueSeconds: 0,
  threatSeconds: 0,
};

// The state an engagement opens with: its special already part due.
export function openingScorerState(scorer: BossScorer): BehaviourScorerState {
  return { ...INITIAL_SCORER_STATE, specialDueSeconds: scorer.due.openingSpecialSeconds };
}

const attackAction = (transition: BehaviourTransition) => `attack:${transition.to}`;
const moveAction = (move: BossScoredMove) => `move:${move.id}`;

// The pressure share in [0, 1]: 0 within the grace after the last attack or chase pause, rising
// to 1 over the ramp.
export function scorerPressure(scorer: BossScorer, pressureSeconds: number): number {
  const { graceSeconds, rampSeconds } = scorer.pressure;
  return rampSeconds > 0
    ? clamp01((pressureSeconds - graceSeconds) / rampSeconds)
    : pressureSeconds >= graceSeconds
      ? 1
      : 0;
}

// The caller's multiplier for an attack: pressure, then how due its cadence is.
function attackMultiplier(
  scorer: BossScorer,
  pressureSeconds: number,
  values: BossScorerValues,
  transition: BehaviourTransition,
): number {
  const pressure = 1 + scorer.pressure.weight * scorerPressure(scorer, pressureSeconds);
  const due = transition.score!.special
    ? values.specialDueSeconds / scorer.due.specialSeconds
    : values.threatSeconds / scorer.due.anySeconds;
  return pressure * (1 + scorer.due.weight * clamp01(due));
}

// Pressure raises every move that closes on Chibi; a standoff, which sets up a ranged attack,
// keeps its score.
function moveMultiplier(scorer: BossScorer, pressureSeconds: number, move: BossMove): number {
  return move.kind === "standoff"
    ? 1
    : 1 + scorer.pressure.weight * scorerPressure(scorer, pressureSeconds);
}

export type BossScorerChoice =
  | { readonly kind: "attack"; readonly transition: BehaviourTransition }
  | { readonly kind: "keep" }
  | { readonly kind: "move"; readonly move: BossScoredMove };

// Scores the gated attacks against the moves and returns the winner with the kit's decision.
// With `moves` false only the held move competes, so an attack must outscore it; a held move
// that wins is kept. `gated` lists the engaged state's scored transitions whose gate holds.
export function decideScored(
  scorer: BossScorer,
  random: Random,
  moves: boolean,
  state: BehaviourScorerState,
  values: BossScorerValues,
  gated: readonly BehaviourTransition[],
): { readonly choice: BossScorerChoice; readonly decision: ScoreDecision<string> } {
  const competing = moves ? scorer.moves : scorer.moves.filter(({ id }) => id === state.move);
  const candidates: ScoreCandidate<BossScorerInput, string>[] = [
    ...gated.map((transition) => ({
      action: attackAction(transition),
      base: transition.score!.base,
      considerations: transition.score!.considerations,
      gate: true,
      multiplier: attackMultiplier(scorer, state.pressureSeconds, values, transition),
      values,
    })),
    ...competing.map((move) => ({
      action: moveAction(move),
      base: move.base,
      considerations: move.considerations,
      gate: true,
      multiplier: moveMultiplier(scorer, state.pressureSeconds, move.move),
      values,
    })),
  ];
  const previous =
    state.move === undefined
      ? undefined
      : { action: `move:${state.move}`, heldSeconds: state.heldSeconds };
  const decision = scoreActions({ hysteresis: scorer.hysteresis }, random, previous, candidates);
  const attack = gated.find((transition) => attackAction(transition) === decision.action);
  if (attack) {
    return { choice: { kind: "attack", transition: attack }, decision };
  }
  const move = competing.find((entry) => moveAction(entry) === decision.action);
  return {
    choice: move && moves ? { kind: "move", move } : { kind: "keep" },
    decision,
  };
}

// The held target of a move: Chibi's box shifted by the move's offset, held for `seconds`.
export function moveIntent(
  tuning: BirdTuning,
  bird: BirdState,
  move: BossMove,
  seconds: number,
  facing: -1 | 1,
  object: ObjectLayout,
  at: Point,
): PursuitIntentState {
  const box = birdBox(tuning, bird);
  const travelDirection = bird.vx === 0 ? bird.facing : bird.vx < 0 ? -1 : 1;
  const mine = at.x + object.width / 2;
  const theirs = box.x + box.width / 2;
  const side = mine === theirs ? (facing === 1 ? -1 : 1) : mine < theirs ? -1 : 1;
  const offset =
    move.kind === "chase"
      ? 0
      : move.kind === "cut-off"
        ? Math.max(-move.maxLead, Math.min(move.maxLead, bird.vx * move.leadSeconds))
        : move.kind === "ahead"
          ? travelDirection * move.distance
          : side * move.distance;
  const target = { ...box, x: box.x + offset };
  const dx = target.x + target.width / 2 - mine;
  return {
    facing: dx === 0 ? facing : dx < 0 ? -1 : 1,
    offset,
    remainingSeconds: seconds,
    target,
    travelDirection,
  };
}

// Advances the scorer's clocks by one slice: engaged time outside an attack counts toward
// pressure, cadence and the next chase pause, and a held move ages. A slice in an attack
// restarts the time since an attack.
export function advanceScorer(
  engaged: boolean,
  attacking: boolean,
  seconds: number,
  state: BehaviourScorerState,
): BehaviourScorerState {
  const next = engaged
    ? {
        ...state,
        chaseSeconds: state.chaseSeconds + seconds,
        heldSeconds: state.heldSeconds + seconds,
        pressureSeconds: state.pressureSeconds + seconds,
        specialDueSeconds: state.specialDueSeconds + seconds,
        threatSeconds: state.threatSeconds + seconds,
      }
    : state;
  return {
    ...next,
    ...(next.sincePauseSeconds !== undefined && {
      sincePauseSeconds: next.sincePauseSeconds + seconds,
    }),
    ...(attacking
      ? { sinceAttackSeconds: 0 }
      : next.sinceAttackSeconds !== undefined && {
          sinceAttackSeconds: next.sinceAttackSeconds + seconds,
        }),
  };
}

// The seeded chase pause after `pauses` earlier ones: the chase seconds before it, its length
// and the give-up roll in [0, 1).
export function chasePauseDraw(
  random: Random,
  relief: ChaseRelief,
): { readonly afterSeconds: number; readonly seconds: number } {
  const between = ({ max, min }: SecondsRange) => min + random() * (max - min);
  const afterSeconds = between(relief.pause.afterSeconds);
  const seconds = between(relief.pause.seconds);
  return { afterSeconds, seconds };
}

// The scorer state after choosing an attack: the held move ends and the chosen cadence restarts.
export function scorerAttacked(
  transition: BehaviourTransition,
  state: BehaviourScorerState,
): BehaviourScorerState {
  const next: BehaviourScorerState = {
    ...state,
    heldSeconds: 0,
    pressureSeconds: 0,
    threatSeconds: 0,
    ...(transition.score!.special && { specialDueSeconds: 0 }),
  };
  delete (next as { move?: string }).move;
  return next;
}
