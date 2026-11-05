import type {
  BehaviourNode,
  Collision,
  GustPhase,
  HazardPhase,
  ObjectLayout,
  SupportPhase,
} from "../data/types";
import type { BehaviourState } from "./behaviour";

// A stationary clock: no reaction, contact, orbit, scene or actor lifecycle, and every state a
// wait with one elapsed transition, the states one ring from the initial state. label names the
// phase field every state must carry one of values for. With emits, exactly one state, the one
// labelled emits, enters with exactly one force pulse lasting that state's seconds, so its
// pulses neither overlap nor leave a gap; no other state has entry actions.
function validateClockCycle(
  clock: {
    readonly emits?: string;
    readonly label: string;
    readonly phaseOf: (node: BehaviourNode) => string | undefined;
    readonly values: readonly string[];
  },
  object: ObjectLayout,
): void {
  const plan = object.behaviour!;
  const invalid = () => {
    throw new Error(`${clock.label} require a stationary elapsed-only cycle: ${object.character}`);
  };
  if (
    object.contact ||
    object.orbit ||
    object.scene !== undefined ||
    object.reaction.kind !== "none" ||
    object.motion.algorithm !== "static" ||
    plan.distance !== 0 ||
    plan.pursuit ||
    plan.idleWatchdog ||
    plan.groundReposition ||
    plan.spotted ||
    plan.attackCooldownSeconds !== undefined
  ) {
    invalid();
  }
  let emitters = 0;
  for (const node of Object.values(plan.states)) {
    const condition = node.transitions[0]?.when[0];
    const emits = clock.emits !== undefined && clock.phaseOf(node) === clock.emits;
    if (emits) {
      emitters++;
      const pulse = node.onEnter?.[0];
      if (
        node.onEnter?.length !== 1 ||
        pulse?.kind !== "force-pulse" ||
        condition?.kind !== "elapsed" ||
        pulse.seconds !== condition.seconds
      ) {
        invalid();
      }
    }
    if (
      !clock.values.includes(clock.phaseOf(node) ?? "") ||
      node.motion.kind !== "wait" ||
      node.motion.support !== undefined ||
      node.track ||
      node.enter ||
      node.attack ||
      (!emits && (node.onEnter?.length ?? 0) > 0) ||
      node.allowIdleReposition ||
      node.allowGroundReposition ||
      node.transitions.length !== 1 ||
      node.transitions[0]!.when.length !== 1 ||
      condition?.kind !== "elapsed" ||
      !Number.isFinite(condition.seconds) ||
      condition.seconds <= 0
    ) {
      invalid();
    }
  }
  const visited = new Set<string>();
  let key = plan.initial;
  while (!visited.has(key)) {
    visited.add(key);
    const node = plan.states[key];
    if (!node) {
      invalid();
    }
    key = node!.transitions[0]!.to;
  }
  if (
    key !== plan.initial ||
    visited.size !== Object.keys(plan.states).length ||
    (clock.emits !== undefined && emitters !== 1)
  ) {
    invalid();
  }
}

// Only a fully labelled stationary clock may change lethal contact. Actor and support
// lifecycles remain outside this contract.
export function validateHazardPhases(object: ObjectLayout): void {
  const plan = object.behaviour;
  if (!plan || !Object.values(plan.states).some((node) => node.hazardPhase !== undefined)) {
    return;
  }
  if (object.collision !== "hazard") {
    throw new Error(`Hazard phases require a stationary elapsed-only cycle: ${object.character}`);
  }
  validateClockCycle(
    {
      label: "Hazard phases",
      phaseOf: (node) => node.hazardPhase,
      values: ["inactive", "warning", "active"],
    },
    object,
  );
}

// Only a one-way ledge on a fully labelled stationary clock may come and go, so a support that
// appears inside a body never pushes or crushes it; it is never lethal.
export function validateSupportPhases(object: ObjectLayout): void {
  const plan = object.behaviour;
  if (!plan || !Object.values(plan.states).some((node) => node.supportPhase !== undefined)) {
    return;
  }
  if (
    object.collision !== "ledge" ||
    Object.values(plan.states).some((node) => node.hazardPhase !== undefined)
  ) {
    throw new Error(`Support phases require a stationary one-way ledge: ${object.character}`);
  }
  validateClockCycle(
    {
      label: "Support phases",
      phaseOf: (node) => node.supportPhase,
      values: ["present", "warning", "absent"],
    },
    object,
  );
}

// Only scenery on a fully labelled stationary clock may emit gusts: one force pulse per cycle,
// pushing Chibi alone; it never collides and is never lethal.
export function validateGustPhases(object: ObjectLayout): void {
  const plan = object.behaviour;
  if (!plan || !Object.values(plan.states).some((node) => node.gustPhase !== undefined)) {
    return;
  }
  if (
    object.collision !== "none" ||
    Object.values(plan.states).some(
      (node) => node.hazardPhase !== undefined || node.supportPhase !== undefined,
    )
  ) {
    throw new Error(`Gust phases require stationary scenery: ${object.character}`);
  }
  validateClockCycle(
    {
      emits: "gust",
      label: "Gust phases",
      phaseOf: (node) => node.gustPhase,
      values: ["calm", "warning", "gust"],
    },
    object,
  );
}

// A gust emitter's phase in a state, its initial state's before its behaviour starts.
export function effectiveGustPhase(
  object: ObjectLayout,
  state: Pick<BehaviourState, "stateKey"> | undefined,
): GustPhase | undefined {
  const plan = object.behaviour;
  if (!plan) {
    return undefined;
  }
  const node = plan.states[state?.stateKey ?? plan.initial];
  if (!node) {
    throw new Error(`Missing behaviour state for ${object.character}`);
  }
  return node.gustPhase;
}

export function effectiveHazardPhase(
  object: ObjectLayout,
  state: Pick<BehaviourState, "stateKey"> | undefined,
): HazardPhase | undefined {
  const plan = object.behaviour;
  if (!plan) {
    return undefined;
  }
  const node = plan.states[state?.stateKey ?? plan.initial];
  if (!node) {
    throw new Error(`Missing behaviour state for ${object.character}`);
  }
  return node.hazardPhase;
}

// A clocked support's presence in a state, its initial state's before its behaviour starts.
export function effectiveSupportPhase(
  object: ObjectLayout,
  state: Pick<BehaviourState, "stateKey"> | undefined,
): SupportPhase | undefined {
  const plan = object.behaviour;
  if (!plan) {
    return undefined;
  }
  const node = plan.states[state?.stateKey ?? plan.initial];
  if (!node) {
    throw new Error(`Missing behaviour state for ${object.character}`);
  }
  return node.supportPhase;
}

const CLOCKED = new WeakMap<ObjectLayout, boolean>();

// Whether an object is a clocked support: a ledge whose every behaviour state carries a
// supportPhase.
export function clockedSupport(object: ObjectLayout): boolean {
  let clocked = CLOCKED.get(object);
  if (clocked === undefined) {
    clocked = Object.values(object.behaviour?.states ?? {}).some(
      (node) => node.supportPhase !== undefined,
    );
    CLOCKED.set(object, clocked);
  }
  return clocked;
}

// Whether a support collides in a behaviour state: a clocked support only while present or
// warning, every other support always.
export function clockPresent(
  object: ObjectLayout,
  state: Pick<BehaviourState, "stateKey"> | undefined,
): boolean {
  return !clockedSupport(object) || effectiveSupportPhase(object, state) !== "absent";
}

// A dead boss has no collision; a timed hazard collides only while active, and a clocked support
// only while present or warning.
export function effectiveCollision(
  object: ObjectLayout,
  state: Pick<BehaviourState, "defeat" | "stateKey"> | undefined,
): Collision {
  if (state?.defeat) {
    return "none";
  }
  if (effectiveSupportPhase(object, state) === "absent") {
    return "none";
  }
  const phase = effectiveHazardPhase(object, state);
  return phase === undefined ? object.collision : phase === "active" ? "hazard" : "none";
}
