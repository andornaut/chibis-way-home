import type { BehaviourNode, BehaviourPlan } from "../data/types";

export interface BehaviourAttackState {
  readonly activeAttack?: {
    readonly continues?: true;
    readonly id: string;
    readonly phase: "tell" | "committed";
  };
  readonly attackCooldownRemainingSeconds?: number;
  // Consecutive cancelled tells since the last commit, tell pause or escape; omitted at 0.
  readonly cancelledTells?: number;
  // The tell pause after the cancel cap: no tell starts while it runs; omitted at 0.
  readonly tellPauseRemainingSeconds?: number;
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
  return (
    !state.activeAttack &&
    (state.attackCooldownRemainingSeconds ?? 0) <= 0 &&
    (state.tellPauseRemainingSeconds ?? 0) <= 0
  );
}

export function canEnterAttack(
  node: Pick<BehaviourNode, "attack">,
  state: BehaviourAttackState,
): boolean {
  if (node.attack?.phase !== "tell") {
    return true;
  }
  if (node.attack.continues) {
    return state.activeAttack?.id === node.attack.id;
  }
  return (
    attackReady(state) ||
    (state.activeAttack?.id === node.attack.id &&
      state.activeAttack.phase === "tell" &&
      !state.activeAttack.continues)
  );
}

function withoutTellCancels<State extends BehaviourAttackState>(state: State): State {
  const next = { ...state };
  delete (next as { cancelledTells?: number }).cancelledTells;
  delete (next as { tellPauseRemainingSeconds?: number }).tellPauseRemainingSeconds;
  return next;
}

// Escape ends the consecutive-cancel count and any tell pause.
export function clearTellCancels<State extends BehaviourAttackState>(state: State): State {
  return state.cancelledTells === undefined && state.tellPauseRemainingSeconds === undefined
    ? state
    : withoutTellCancels(state);
}

// One more consecutive cancel; reaching the cap starts the tell pause and resets the count.
function countCancel<State extends BehaviourAttackState>(
  plan: Pick<BehaviourPlan, "tellCancelPause">,
  state: State,
): State {
  const pause = plan.tellCancelPause;
  if (!pause) {
    return state;
  }
  const cancels = (state.cancelledTells ?? 0) + 1;
  if (cancels < pause.cancels) {
    return { ...state, cancelledTells: cancels };
  }
  const next = withoutTellCancels(state);
  return pause.seconds > 0 ? { ...next, tellPauseRemainingSeconds: pause.seconds } : next;
}

export function enterAttack<
  State extends BehaviourAttackState & { readonly pursuit?: { readonly phase: string } },
>(
  plan: Pick<BehaviourPlan, "attackCooldownSeconds" | "tellCancelPause">,
  node: Pick<BehaviourNode, "attack">,
  state: State,
): State {
  const phase = node.attack;
  const active = state.activeAttack;
  if (!phase) {
    if (active?.phase === "committed") {
      throw new Error("Committed attack requires an explicit completed boundary");
    }
    if (active?.continues) {
      throw new Error("Continuing tell requires its committed attack or completion");
    }
    const next = { ...state };
    delete (next as { activeAttack?: unknown }).activeAttack;
    // A cancel caused by escape does not count; escape has already cleared the count.
    return active?.phase === "tell" && state.pursuit?.phase !== "escaped"
      ? countCancel(plan, next)
      : next;
  }
  if (phase.phase === "completed") {
    if (!active) {
      return state;
    }
    if (active.id !== phase.id || (active.phase !== "committed" && !active.continues)) {
      throw new Error("Attack completion requires its committed attack");
    }
    const next = { ...state, attackCooldownRemainingSeconds: plan.attackCooldownSeconds! };
    delete (next as { activeAttack?: unknown }).activeAttack;
    return next;
  }
  if (
    !canEnterAttack(node, state) ||
    (active && active.id !== phase.id) ||
    (phase.phase === "committed" && !active)
  ) {
    throw new Error("Attack phase cannot overlap or bypass its tell");
  }
  const next = {
    ...state,
    activeAttack: {
      id: phase.id,
      phase: phase.phase,
      ...(phase.continues ? { continues: true as const } : {}),
    },
  };
  if (phase.phase === "committed") {
    delete (next as { cancelledTells?: number }).cancelledTells;
  }
  return next;
}

export function advanceAttackClock<State extends BehaviourAttackState>(
  seconds: number,
  state: State,
): State {
  let next = state;
  if (state.attackCooldownRemainingSeconds !== undefined) {
    next = {
      ...next,
      attackCooldownRemainingSeconds: Math.max(0, state.attackCooldownRemainingSeconds - seconds),
    };
  }
  if (state.tellPauseRemainingSeconds !== undefined) {
    const remaining = state.tellPauseRemainingSeconds - seconds;
    next = { ...next, tellPauseRemainingSeconds: remaining };
    if (remaining <= 0) {
      delete (next as { tellPauseRemainingSeconds?: number }).tellPauseRemainingSeconds;
    }
  }
  return next;
}
