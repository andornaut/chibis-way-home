import { shuttleStates } from "./behaviours.ts";
import {
  GUST_PULSE,
  OBSTACLE_MOVER_PAUSE,
  OBSTACLE_MOVER_SPEED,
  RAVINE_GUST_PULSE,
} from "./obstacleTuning.ts";
import type {
  BehaviourAction,
  BehaviourNode,
  BehaviourPlan,
  GustCycleSeconds,
  GustPhase,
  HazardPhase,
  SupportCycleSeconds,
  SupportPhase,
  WarnedCycleSeconds,
} from "./types/index.ts";

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

// The ravine gust's calm, warning (leaf stream) and gust seconds.
export const GUST_SECONDS = {
  calm: 1.6,
  gust: 1,
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

// The gantry crane container's travel in tiles, near dock to far dock: its 22-col pit less its own
// 6 cols.
export const GANTRY_DISTANCE = 16;

// The gantry crane container shuttles between its docks at the obstacle mover speed, pausing at
// each, starting with the near dock's pause.
export const GANTRY_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: GANTRY_DISTANCE,
  initial: "wait-near",
  states: shuttleStates(OBSTACLE_MOVER_SPEED, OBSTACLE_MOVER_PAUSE, "idle"),
};

// A stationary gust emitter's fixed cycle, each state playing the tag of its name: calm, warning,
// then gust, which enters with pulse for the gust's seconds. facing is the side it blows toward;
// initial offsets neighbouring placements.
export function gustCycle(
  seconds: GustCycleSeconds,
  pulse: Omit<Extract<BehaviourAction, { kind: "force-pulse" }>, "kind" | "seconds">,
  facing: -1 | 1,
  initial: GustPhase = "calm",
): BehaviourPlan {
  const state = (
    phase: GustPhase,
    to: GustPhase,
    onEnter?: readonly BehaviourAction[],
  ): BehaviourNode => ({
    animation: phase,
    gustPhase: phase,
    motion: { kind: "wait" },
    ...(onEnter && { onEnter }),
    transitions: [{ to, when: [{ kind: "elapsed", seconds: seconds[phase] }] }],
  });
  return {
    axis: "x",
    distance: 0,
    facing,
    initial,
    states: {
      calm: state("calm", "warning"),
      gust: state("gust", "calm", [{ ...pulse, kind: "force-pulse", seconds: seconds.gust }]),
      warning: state("warning", "gust"),
    },
  };
}

// Ravine gusts blow against the route, which runs left to right, so the emitter faces left.
export const GUST_BEHAVIOUR: BehaviourPlan = gustCycle(GUST_SECONDS, GUST_PULSE, -1);

// A ravine module's emitter: the gust cycle with the module's 21-tile band, blowing left.
export const RAVINE_GUST_BEHAVIOUR: BehaviourPlan = gustCycle(GUST_SECONDS, RAVINE_GUST_PULSE, -1);
