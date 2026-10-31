import { SCREEN, TILE } from "./screen";
import type { BehaviourAction, BehaviourNode, BehaviourPlan } from "./types";

const CROSSING_PAUSE = 1;
const CROSSING_SPEED = 6;
const DOG_PATROL_PAUSE = 0.2;
const DOG_PATROL_SPEED = 3.75;
const FRUSTRATION_SECONDS = 0.8;
const RABBIT_DISTANCE = -12;
const RABBIT_PAUSE = 0.6;
const RABBIT_SPEED = 10;
const RABBIT_HOP_SECONDS = Math.abs(RABBIT_DISTANCE) / RABBIT_SPEED;

export const ANIMAL_DETECTION_RANGE = SCREEN.width / (2 * TILE);

const DETECTION = [{ kind: "nearby", range: ANIMAL_DETECTION_RANGE }] as const;
const LOST_TARGET = [{ kind: "lost-target", tolerance: 1 }] as const;

function frustrationNode(to: string): BehaviourNode {
  return {
    animation: "frustration",
    motion: { kind: "wait" },
    transitions: [{ to, when: [{ kind: "elapsed", seconds: FRUSTRATION_SECONDS }] }],
  };
}

function shuttleStates(
  speed: number,
  pause: number,
  animation: BehaviourNode["animation"],
): BehaviourPlan["states"] {
  return {
    back: {
      animation,
      motion: { direction: -1, kind: "move", speed },
      transitions: [{ to: "wait-near", when: [{ kind: "boundary" }] }],
    },
    forward: {
      animation,
      motion: { direction: 1, kind: "move", speed },
      transitions: [{ to: "wait-far", when: [{ kind: "boundary" }] }],
    },
    "wait-far": {
      animation,
      motion: { kind: "wait" },
      transitions: [{ to: "back", when: [{ kind: "elapsed", seconds: pause }] }],
    },
    "wait-near": {
      animation,
      motion: { kind: "wait" },
      transitions: [{ to: "forward", when: [{ kind: "elapsed", seconds: pause }] }],
    },
  };
}

interface PatrolChargeTuning {
  readonly attackRange: number;
  readonly patrolPause: number;
  readonly patrolSpeed: number;
  readonly preparation: "crouch" | "warn";
  readonly preparationSeconds: number;
  readonly restSeconds: number;
  readonly rushSeconds: number;
  readonly rushSpeed: number;
}

function patrolChargeStates(tuning: PatrolChargeTuning): BehaviourPlan["states"] {
  return {
    [tuning.preparation]: {
      animation: tuning.preparation,
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        {
          to: "frustration",
          when: [{ kind: "elapsed", seconds: tuning.preparationSeconds }, ...LOST_TARGET],
        },
        { to: "rush", when: [{ kind: "elapsed", seconds: tuning.preparationSeconds }] },
      ],
    },
    frustration: frustrationNode("pursuit"),
    "patrol-left": {
      animation: "walk",
      motion: { direction: -1, kind: "move", speed: tuning.patrolSpeed },
      transitions: [
        { to: tuning.preparation, when: DETECTION },
        { to: "wait-left", when: [{ kind: "boundary" }] },
      ],
    },
    "patrol-right": {
      animation: "walk",
      motion: { direction: 1, kind: "move", speed: tuning.patrolSpeed },
      transitions: [
        { to: tuning.preparation, when: DETECTION },
        { to: "wait-right", when: [{ kind: "boundary" }] },
      ],
    },
    pursuit: {
      animation: "walk",
      motion: { direction: "target", kind: "move", speed: tuning.patrolSpeed },
      transitions: [
        { to: "frustration", when: LOST_TARGET },
        { to: tuning.preparation, when: [{ kind: "nearby", range: tuning.attackRange }] },
      ],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: tuning.restSeconds }] }],
    },
    rush: {
      animation: "rush",
      motion: { direction: "facing", kind: "move", speed: tuning.rushSpeed },
      transitions: [
        { to: "frustration", when: LOST_TARGET },
        { to: "rest", when: [{ kind: "boundary" }] },
        { to: "rest", when: [{ kind: "elapsed", seconds: tuning.rushSeconds }] },
      ],
    },
    "wait-left": {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [
        { to: tuning.preparation, when: DETECTION },
        { to: "patrol-right", when: [{ kind: "elapsed", seconds: tuning.patrolPause }] },
      ],
    },
    "wait-right": {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [
        { to: tuning.preparation, when: DETECTION },
        { to: "patrol-left", when: [{ kind: "elapsed", seconds: tuning.patrolPause }] },
      ],
    },
  };
}

interface VerticalDropTuning {
  readonly dropSpeed: number;
  readonly preparationSeconds: number;
  readonly restSeconds: number;
  readonly returnSpeed: number;
  readonly returnState: "climb" | "return";
}

function verticalDropStates(tuning: VerticalDropTuning): BehaviourPlan["states"] {
  return {
    [tuning.returnState]: {
      animation: tuning.returnState,
      motion: { direction: -1, kind: "move", speed: tuning.returnSpeed },
      transitions: [{ to: "prepare", when: [{ kind: "boundary" }] }],
    },
    drop: {
      animation: "drop",
      motion: { direction: 1, kind: "move", speed: tuning.dropSpeed },
      transitions: [{ to: "rest", when: [{ kind: "boundary" }] }],
    },
    frustration: frustrationNode("prepare"),
    prepare: {
      animation: "prepare",
      motion: { kind: "wait" },
      transitions: [
        {
          to: "frustration",
          when: [{ kind: "elapsed", seconds: tuning.preparationSeconds }, ...LOST_TARGET],
        },
        { to: "drop", when: [{ kind: "elapsed", seconds: tuning.preparationSeconds }] },
      ],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [
        { to: tuning.returnState, when: [{ kind: "elapsed", seconds: tuning.restSeconds }] },
      ],
    },
    watch: {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [{ to: tuning.returnState, when: DETECTION }],
    },
  };
}

export const BOAT_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: 30,
  initial: "forward",
  states: shuttleStates(CROSSING_SPEED, CROSSING_PAUSE, "idle"),
};

export const CITY_GROUND_HAZARD_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: 10,
  initial: "forward",
  states: shuttleStates(5, 0.4, null),
};

export const CITY_LIFT_BEHAVIOUR: BehaviourPlan = {
  axis: "y",
  distance: -12,
  initial: "back",
  states: shuttleStates(4, 0.6, null),
};

export const CITY_SHUTTLE_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: 30,
  initial: "forward",
  states: shuttleStates(CROSSING_SPEED, CROSSING_PAUSE, null),
};

export const DOG_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: -18,
  inactiveAnimation: "idle",
  initial: "patrol-left",
  states: patrolChargeStates({
    attackRange: 14,
    patrolPause: DOG_PATROL_PAUSE,
    patrolSpeed: DOG_PATROL_SPEED,
    preparation: "crouch",
    preparationSeconds: 0.45,
    restSeconds: 0.65,
    rushSeconds: 0.6,
    rushSpeed: 25,
  }),
};

export const GOOSE_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: -12,
  inactiveAnimation: "idle",
  initial: "patrol-left",
  states: {
    ...patrolChargeStates({
      attackRange: 10,
      patrolPause: 0.35,
      patrolSpeed: 2.5,
      preparation: "warn",
      preparationSeconds: 0.65,
      restSeconds: 1,
      rushSeconds: 0.45,
      rushSpeed: 17.5,
    }),
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "set-trap", when: [{ kind: "elapsed", seconds: 1 }] }],
    },
    "set-trap": {
      animation: "set-trap",
      motion: { kind: "wait" },
      onEnter: [
        {
          armSeconds: 0.8,
          armingAnimation: "warning",
          character: "goose-trap",
          gravity: 0,
          kind: "spawn",
          lifeSeconds: 5,
          maxAlive: 3,
          offset: { x: 1, y: 3 },
          velocity: { x: 0, y: 0 },
        },
      ],
      transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.48 }] }],
    },
  },
};

export const OWL_BEHAVIOUR: BehaviourPlan = {
  axis: "y",
  distance: -15,
  initial: "watch",
  states: verticalDropStates({
    dropSpeed: 15,
    preparationSeconds: 0.65,
    restSeconds: 0.6,
    returnSpeed: 5,
    returnState: "return",
  }),
};

export const RABBIT_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: RABBIT_DISTANCE,
  initial: "watch",
  states: {
    frustration: frustrationNode("prepare"),
    hop: {
      animation: "hop",
      motion: {
        direction: "facing",
        hopHeight: 3,
        hopSeconds: RABBIT_HOP_SECONDS,
        kind: "hop",
        speed: RABBIT_SPEED,
      },
      transitions: [
        {
          to: "prepare",
          when: [{ kind: "elapsed", seconds: RABBIT_HOP_SECONDS }],
        },
      ],
    },
    prepare: {
      animation: "rest",
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        { to: "frustration", when: [{ kind: "elapsed", seconds: RABBIT_PAUSE }, ...LOST_TARGET] },
        { to: "hop", when: [{ kind: "elapsed", seconds: RABBIT_PAUSE }] },
      ],
    },
    watch: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare", when: DETECTION }],
    },
  },
};

export const RACCOON_BEHAVIOUR: BehaviourPlan = {
  axis: "y",
  distance: -15,
  initial: "watch",
  states: verticalDropStates({
    dropSpeed: 15,
    preparationSeconds: 0.6,
    restSeconds: 0.8,
    returnSpeed: 3.75,
    returnState: "climb",
  }),
};

export const BEAR_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: -18,
  inactiveAnimation: "idle",
  initial: "watch",
  states: {
    frustration: frustrationNode("prepare-growl"),
    growl: {
      animation: "growl",
      motion: { kind: "wait" },
      onEnter: [
        {
          height: 3,
          kind: "force-pulse",
          range: 42,
          seconds: 0.35,
          velocity: { x: 20, y: 0 },
          visual: { animation: "pulse", art: "bear-growl-wave", offset: { x: 3, y: 0.5 } },
        },
      ],
      transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.35 }] }],
    },
    maul: {
      animation: "maul",
      motion: { kind: "wait" },
      transitions: [{ to: "rest", when: [{ kind: "elapsed", seconds: 0.45 }] }],
    },
    "prepare-charge": {
      animation: "prepare",
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        { to: "frustration", when: [{ kind: "elapsed", seconds: 0.6 }, ...LOST_TARGET] },
        { to: "rush", when: [{ kind: "elapsed", seconds: 0.6 }] },
      ],
    },
    "prepare-growl": {
      animation: "prepare",
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [{ to: "growl", when: [{ kind: "elapsed", seconds: 0.9 }] }],
    },
    pursuit: {
      animation: "walk",
      motion: { direction: "target", kind: "move", speed: 4 },
      transitions: [
        { to: "frustration", when: LOST_TARGET },
        { to: "prepare-charge", when: [{ kind: "nearby", range: 10 }] },
      ],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare-growl", when: [{ kind: "elapsed", seconds: 1 }] }],
    },
    rush: {
      animation: "rush",
      motion: { direction: "facing", kind: "move", speed: 25 },
      transitions: [
        { to: "maul", when: [{ kind: "boundary" }] },
        { to: "maul", when: [{ kind: "elapsed", seconds: 0.55 }] },
      ],
    },
    watch: {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare-growl", when: DETECTION }],
    },
  },
};

const PIGEON_POOP: BehaviourAction = {
  armSeconds: 0,
  character: "pigeon-poop",
  gravity: 30,
  kind: "spawn",
  lifeSeconds: 3,
  maxAlive: 3,
  offset: { x: 1.5, y: 4 },
  velocity: { x: 0, y: 0 },
};

export const PIGEON_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: 24,
  initial: "watch",
  states: {
    "drop-left": {
      animation: "drop",
      motion: { kind: "wait" },
      onEnter: [PIGEON_POOP],
      transitions: [{ to: "fly-right", when: [{ kind: "elapsed", seconds: 0.2 }] }],
    },
    "drop-right": {
      animation: "drop",
      motion: { kind: "wait" },
      onEnter: [PIGEON_POOP],
      transitions: [{ to: "return", when: [{ kind: "elapsed", seconds: 0.2 }] }],
    },
    "fly-left": {
      animation: "fly",
      motion: { kind: "fly", speed: 16, to: { x: -12, y: -8 } },
      transitions: [
        { to: "drop-left", when: [{ kind: "arrived", tolerance: 0.1 }] },
        { to: "frustration", when: [{ kind: "elapsed", seconds: 3 }] },
      ],
    },
    "fly-right": {
      animation: "fly",
      motion: { kind: "fly", speed: 16, to: { x: 12, y: -8 } },
      transitions: [
        { to: "drop-right", when: [{ kind: "arrived", tolerance: 0.1 }] },
        { to: "frustration", when: [{ kind: "elapsed", seconds: 3 }] },
      ],
    },
    frustration: frustrationNode("return"),
    prepare: {
      animation: "prepare",
      motion: { kind: "wait" },
      transitions: [{ to: "fly-left", when: [{ kind: "elapsed", seconds: 0.4 }] }],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare", when: [{ kind: "elapsed", seconds: 1 }] }],
    },
    return: {
      animation: "fly",
      motion: { kind: "fly", speed: 16, to: { x: 0, y: 0 } },
      transitions: [
        { to: "rest", when: [{ kind: "arrived", tolerance: 0.1 }] },
        { to: "frustration", when: [{ kind: "elapsed", seconds: 3 }] },
      ],
    },
    watch: {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare", when: DETECTION }],
    },
  },
};
