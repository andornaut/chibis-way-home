import { EDGE } from "../core/index.ts";
import type { BehaviourCondition, BehaviourTransition, ObjectLayout } from "../data/types/index.ts";
import { attackReady, type BehaviourAttackState, canEnterAttack } from "./behaviourAttack.ts";
import { nodeOf } from "./behaviourTrack.ts";

// Why the gate refused a transition:
// - active-attack: an attack is under way.
// - condition: one of the transition's `when` conditions other than its range does not hold.
// - cooldown: the cooldown after a completed attack is running.
// - engagement: Chibi is outside the transition's `nearby` range.
// - outside-sequence: a continuing tell without its own attack under way.
// - pause-clearance: a scored attack within the tell clearance after a chase pause.
// - tell-cancel-pause: the pause after the plan's consecutive cancelled tells is running.
export type AttackGateRefusal =
  | "active-attack"
  | "condition"
  | "cooldown"
  | "engagement"
  | "outside-sequence"
  | "pause-clearance"
  | "tell-cancel-pause";

export type AttackGateResult =
  { readonly admitted: true } | { readonly admitted: false; readonly reason: AttackGateRefusal };

export interface AttackGateState extends BehaviourAttackState {
  readonly scorer?: { readonly sincePauseSeconds?: number };
}

const ADMITTED: AttackGateResult = { admitted: true };

function refused(reason: AttackGateRefusal): AttackGateResult {
  return { admitted: false, reason };
}

function unready(state: BehaviourAttackState): AttackGateRefusal {
  return state.activeAttack
    ? "active-attack"
    : (state.attackCooldownRemainingSeconds ?? 0) > 0
      ? "cooldown"
      : "tell-cancel-pause";
}

// The one admission test of a transition, consulted by the scored decision and by the graph
// transition walk before the transition is taken. `matches` evaluates one `when` condition for
// the caller's perception and position. The transition's own data selects the tests, in this
// order:
// 1. A scored transition waits out the plan's tell clearance after a chase pause. An unscored
//    one, such as the wander state's opening, does not.
// 2. A transition into a tell needs no attack, cooldown or tell-cancel pause, or the same tell
//    under way; a continuing tell needs its own attack under way.
// 3. Every `when` condition holds, in authored order.
export function attackGate(
  matches: (condition: BehaviourCondition) => boolean,
  object: ObjectLayout,
  state: AttackGateState,
  transition: BehaviourTransition,
): AttackGateResult {
  if (transition.score) {
    const clearance = object.behaviour?.pursuit?.relief?.pause.tellClearanceSeconds ?? 0;
    const sincePause = state.scorer?.sincePauseSeconds;
    if (sincePause !== undefined && sincePause < clearance - EDGE) {
      return refused("pause-clearance");
    }
  }
  const tell = nodeOf(object, transition.to);
  if (!canEnterAttack(tell, state)) {
    return refused(tell.attack?.continues ? "outside-sequence" : unready(state));
  }
  for (const condition of transition.when) {
    if (condition.kind === "attack-ready") {
      if (!attackReady(state)) {
        return refused(unready(state));
      }
    } else if (!matches(condition)) {
      return refused(condition.kind === "nearby" ? "engagement" : "condition");
    }
  }
  return ADMITTED;
}
