import type {
  BehaviourNode,
  BehaviourPlan,
  HazardPhase,
  SupportCycleSeconds,
  SupportPhase,
  WarnedCycleSeconds,
} from "./types";

export const WARNED_VENT_SECONDS = {
  active: 0.6,
  inactive: 2,
  recovery: 1.2,
  warning: 0.8,
} as const;

// The awning's out, warning (shudder, partial roll-up), retracted and extending seconds.
export const AWNING_SECONDS = {
  extending: 0.4,
  out: 1.6,
  retracted: 1.2,
  warning: 0.6,
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

const supportWait = (
  phase: SupportPhase,
  key: string,
  seconds: number,
  to: string,
): BehaviourNode => ({
  animation: key,
  motion: { kind: "wait" },
  supportPhase: phase,
  transitions: [{ to, when: [{ kind: "elapsed", seconds }] }],
});

// A stationary clocked support's fixed cycle, each state playing the tag of its name: out and
// warning collide, retracted and extending do not. initial offsets neighbouring placements.
export function awningCycle(
  seconds: SupportCycleSeconds,
  initial: keyof SupportCycleSeconds = "out",
): BehaviourPlan {
  return {
    axis: "x",
    distance: 0,
    initial,
    states: {
      extending: supportWait("absent", "extending", seconds.extending, "out"),
      out: supportWait("present", "out", seconds.out, "warning"),
      retracted: supportWait("absent", "retracted", seconds.retracted, "extending"),
      warning: supportWait("warning", "warning", seconds.warning, "retracted"),
    },
  };
}

export const AWNING_BEHAVIOUR: BehaviourPlan = awningCycle(AWNING_SECONDS);
