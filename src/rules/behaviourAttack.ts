import type { BehaviourNode, BehaviourPlan } from "../data/types";

export interface BehaviourAttackState {
  readonly activeAttack?: { readonly id: string; readonly phase: "tell" | "committed" };
  readonly attackCooldownRemainingSeconds?: number;
}

export function attackProtected(
  node: Pick<BehaviourNode, "attack">,
  state: BehaviourAttackState,
): boolean {
  return (
    Boolean(state.activeAttack) ||
    node.attack?.phase === "tell" ||
    node.attack?.phase === "committed"
  );
}

export function attackReady(state: BehaviourAttackState): boolean {
  return !state.activeAttack && (state.attackCooldownRemainingSeconds ?? 0) <= 0;
}

export function canEnterAttack(
  node: Pick<BehaviourNode, "attack">,
  state: BehaviourAttackState,
): boolean {
  if (node.attack?.phase !== "tell") {
    return true;
  }
  return (
    attackReady(state) ||
    (state.activeAttack?.id === node.attack.id && state.activeAttack.phase === "tell")
  );
}

export function enterAttack<State extends BehaviourAttackState>(
  plan: Pick<BehaviourPlan, "attackCooldownSeconds">,
  node: Pick<BehaviourNode, "attack">,
  state: State,
): State {
  const phase = node.attack;
  if (!phase) {
    if (state.activeAttack?.phase === "committed") {
      throw new Error("Committed attack requires an explicit completed boundary");
    }
    const next = { ...state };
    delete (next as { activeAttack?: unknown }).activeAttack;
    return next;
  }
  if (phase.phase === "completed") {
    if (!state.activeAttack) {
      return state;
    }
    if (state.activeAttack.id !== phase.id || state.activeAttack.phase !== "committed") {
      throw new Error("Attack completion requires its committed attack");
    }
    const next = { ...state, attackCooldownRemainingSeconds: plan.attackCooldownSeconds! };
    delete (next as { activeAttack?: unknown }).activeAttack;
    return next;
  }
  if (
    !canEnterAttack(node, state) ||
    (state.activeAttack && state.activeAttack.id !== phase.id) ||
    (phase.phase === "committed" && !state.activeAttack)
  ) {
    throw new Error("Attack phase cannot overlap or bypass its tell");
  }
  return { ...state, activeAttack: { id: phase.id, phase: phase.phase } };
}

export function advanceAttackClock<State extends BehaviourAttackState>(
  seconds: number,
  state: State,
): State {
  if (state.attackCooldownRemainingSeconds === undefined) {
    return state;
  }
  return {
    ...state,
    attackCooldownRemainingSeconds: Math.max(0, state.attackCooldownRemainingSeconds - seconds),
  };
}
