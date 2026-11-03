import type { BehaviourPlan } from "./types";

export const WARNED_VENT_SECONDS = {
  active: 0.6,
  inactive: 2,
  recovery: 1.2,
  warning: 0.8,
} as const;

export const WARNED_VENT_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: 0,
  initial: "inactive",
  states: {
    active: {
      animation: null,
      hazardPhase: "active",
      motion: { kind: "wait" },
      transitions: [
        { to: "recovery", when: [{ kind: "elapsed", seconds: WARNED_VENT_SECONDS.active }] },
      ],
    },
    inactive: {
      animation: null,
      hazardPhase: "inactive",
      motion: { kind: "wait" },
      transitions: [
        { to: "warning", when: [{ kind: "elapsed", seconds: WARNED_VENT_SECONDS.inactive }] },
      ],
    },
    recovery: {
      animation: null,
      hazardPhase: "inactive",
      motion: { kind: "wait" },
      transitions: [
        { to: "inactive", when: [{ kind: "elapsed", seconds: WARNED_VENT_SECONDS.recovery }] },
      ],
    },
    warning: {
      animation: null,
      hazardPhase: "warning",
      motion: { kind: "wait" },
      transitions: [
        { to: "active", when: [{ kind: "elapsed", seconds: WARNED_VENT_SECONDS.warning }] },
      ],
    },
  },
};
