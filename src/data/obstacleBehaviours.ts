import type { BehaviourNode, BehaviourPlan, HazardPhase, WarnedCycleSeconds } from "./types";

export const WARNED_VENT_SECONDS = {
  active: 0.6,
  inactive: 2,
  recovery: 1.2,
  warning: 0.8,
} as const;

// The crosswalk's walk (inactive), warning, traffic (active) and recovery seconds.
export const CROSSWALK_SECONDS = {
  active: 1.4,
  inactive: 2,
  recovery: 0.5,
  warning: 0.9,
} as const;

const wait = (phase: HazardPhase, seconds: number, to: string): BehaviourNode => ({
  animation: null,
  hazardPhase: phase,
  motion: { kind: "wait" },
  transitions: [{ to, when: [{ kind: "elapsed", seconds }] }],
});

// A stationary timed hazard's fixed cycle, starting inactive.
export function warnedCycle(seconds: WarnedCycleSeconds): BehaviourPlan {
  return {
    axis: "x",
    distance: 0,
    initial: "inactive",
    states: {
      active: wait("active", seconds.active, "recovery"),
      inactive: wait("inactive", seconds.inactive, "warning"),
      recovery: wait("inactive", seconds.recovery, "inactive"),
      warning: wait("warning", seconds.warning, "active"),
    },
  };
}

export const WARNED_VENT_BEHAVIOUR: BehaviourPlan = warnedCycle(WARNED_VENT_SECONDS);

export const CROSSWALK_BEHAVIOUR: BehaviourPlan = warnedCycle(CROSSWALK_SECONDS);
