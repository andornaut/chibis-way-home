import { SCREEN, TILE } from "./screen";
import type { BehaviourAction, BehaviourNode, BehaviourPlan, Point } from "./types";

const CROSSING_PAUSE = 1;
const CROSSING_SPEED = 6;
const DOG_PATROL_PAUSE = 0.14;
const DOG_PATROL_SPEED = 4.6875;
const FRUSTRATION_SECONDS = 0.55;

export const ATTACK_ANTICIPATION_SECONDS = 0.12;
const RABBIT_DISTANCE = -12;
const RABBIT_PAUSE = 0.6;
const RABBIT_SPEED = 10;
const RABBIT_HOP_SECONDS = Math.abs(RABBIT_DISTANCE) / RABBIT_SPEED;

export const ANIMAL_DETECTION_RANGE = SCREEN.width / TILE;
export const ANIMAL_INTERACTION_RANGE = SCREEN.width / (2 * TILE);

const DETECTION = [{ kind: "visible" }] as const;
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

const GROUND_CHARGE: PatrolChargeTuning = {
  attackRange: ANIMAL_DETECTION_RANGE,
  patrolPause: DOG_PATROL_PAUSE,
  patrolSpeed: DOG_PATROL_SPEED,
  preparation: "crouch",
  preparationSeconds: ATTACK_ANTICIPATION_SECONDS,
  restSeconds: 0.25,
  rushSeconds: 0.48,
  rushSpeed: 31.25,
};

export const DOG_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: -18,
  inactiveAnimation: "idle",
  initial: "patrol-left",
  spotted: { line: "archie-spotted", speaker: "dog" },
  states: {
    ...patrolChargeStates(GROUND_CHARGE),
    pounce: {
      animation: "pounce",
      motion: { direction: "facing", hopHeight: 3, hopSeconds: 0.48, kind: "hop", speed: 12.5 },
      transitions: [{ to: "pounce-rest", when: [{ kind: "elapsed", seconds: 0.48 }] }],
    },
    "pounce-rest": {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.3 }] }],
    },
    "prepare-pounce": {
      animation: "crouch",
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        {
          to: "frustration",
          when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }, ...LOST_TARGET],
        },
        { to: "pounce", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare-pounce", when: [{ kind: "elapsed", seconds: 0.25 }] }],
    },
  },
};

export const FERRET_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: -18,
  inactiveAnimation: "idle",
  initial: "patrol-left",
  spotted: { line: "furt-spotted", speaker: "ferret" },
  states: {
    ...patrolChargeStates(GROUND_CHARGE),
    "prepare-throw": {
      animation: "crouch",
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        { to: "throw", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare-throw", when: [{ kind: "elapsed", seconds: 0.25 }] }],
    },
    throw: {
      animation: "throw",
      motion: { kind: "wait" },
      onEnter: [
        {
          armSeconds: 0,
          character: "ferret-parcel",
          gravity: 24,
          kind: "spawn",
          lifeSeconds: 3,
          maxAlive: 2,
          mirrorWithFacing: true,
          offset: { x: 2.25, y: 5 / 6 },
          velocity: { x: 14, y: -10 },
        },
      ],
      transitions: [{ to: "throw-rest", when: [{ kind: "elapsed", seconds: 0.14 }] }],
    },
    "throw-rest": {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.3 }] }],
    },
  },
};

export const GOOSE_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: -12,
  inactiveAnimation: "idle",
  initial: "patrol-left",
  spotted: { line: "trixi-spotted", speaker: "goose" },
  states: {
    ...patrolChargeStates({
      attackRange: ANIMAL_DETECTION_RANGE,
      patrolPause: 0.25,
      patrolSpeed: 3.125,
      preparation: "warn",
      preparationSeconds: ATTACK_ANTICIPATION_SECONDS,
      restSeconds: 0.35,
      rushSeconds: 0.36,
      rushSpeed: 21.875,
    }),
    "release-trap": {
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
      transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.14 }] }],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "set-trap", when: [{ kind: "elapsed", seconds: 0.35 }] }],
    },

    "set-trap": {
      animation: "warn",
      motion: { kind: "wait" },
      transitions: [
        { to: "release-trap", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
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

const RACCOON_GROUND_TRACK = { axis: "x", distance: -12 } as const;

export const RACCOON_BEHAVIOUR: BehaviourPlan = {
  axis: "y",
  distance: -15,
  inactiveAnimation: "idle",
  initial: "watch",
  spotted: { line: "kiwi-spotted", speaker: "raccoon" },
  states: {
    ...verticalDropStates({
      dropSpeed: 18.75,
      preparationSeconds: ATTACK_ANTICIPATION_SECONDS,
      restSeconds: 0.3,
      returnSpeed: 4.6875,
      returnState: "climb",
    }),
    "charge-rest": {
      animation: "rest",
      motion: { kind: "wait" },
      track: RACCOON_GROUND_TRACK,
      transitions: [{ to: "return-ground", when: [{ kind: "elapsed", seconds: 0.3 }] }],
    },
    "frustration-ground": { ...frustrationNode("prepare-charge"), track: RACCOON_GROUND_TRACK },
    "frustration-return": { ...frustrationNode("return-ground"), track: RACCOON_GROUND_TRACK },
    "prepare-charge": {
      animation: "prepare",
      enter: "face-target",
      motion: { kind: "wait" },
      track: RACCOON_GROUND_TRACK,
      transitions: [
        {
          to: "frustration-ground",
          when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }, ...LOST_TARGET],
        },
        { to: "rush", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      track: RACCOON_GROUND_TRACK,
      transitions: [{ to: "prepare-charge", when: [{ kind: "elapsed", seconds: 0.3 }] }],
    },
    "return-ground": {
      animation: "climb",
      motion: { direction: 1, kind: "move", speed: 4.6875 },
      track: RACCOON_GROUND_TRACK,
      transitions: [
        { to: "climb", when: [{ kind: "boundary" }] },
        { to: "frustration-return", when: [{ kind: "elapsed", seconds: 3.2 }] },
      ],
    },
    rush: {
      animation: "rush",
      motion: { direction: "facing", kind: "move", speed: 25 },
      track: RACCOON_GROUND_TRACK,
      transitions: [
        { to: "charge-rest", when: [{ kind: "boundary" }] },
        { to: "charge-rest", when: [{ kind: "elapsed", seconds: 0.48 }] },
      ],
    },
    watch: {
      animation: "idle",
      motion: { kind: "wait" },
      track: RACCOON_GROUND_TRACK,
      transitions: [{ to: "prepare-charge", when: DETECTION }],
    },
  },
};

export const BEAR_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: -18,
  inactiveAnimation: "idle",
  initial: "watch",
  spotted: { line: "bini-spotted", speaker: "bear" },
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
      transitions: [{ to: "rest", when: [{ kind: "elapsed", seconds: 0.3 }] }],
    },
    "prepare-charge": {
      animation: "prepare-attack",
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        {
          to: "frustration",
          when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }, ...LOST_TARGET],
        },
        { to: "rush", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    "prepare-growl": {
      animation: "prepare-attack",
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        { to: "growl", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    "prepare-maul": {
      animation: "prepare-attack",
      motion: { kind: "wait" },
      transitions: [
        { to: "maul", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    pursuit: {
      animation: "walk",
      motion: { direction: "target", kind: "move", speed: 5 },
      transitions: [
        { to: "frustration", when: LOST_TARGET },
        { to: "prepare-charge", when: [{ kind: "nearby", range: ANIMAL_DETECTION_RANGE }] },
      ],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare-growl", when: [{ kind: "elapsed", seconds: 0.35 }] }],
    },
    rush: {
      animation: "rush",
      motion: { direction: "facing", kind: "move", speed: 31.25 },
      transitions: [
        { to: "prepare-maul", when: [{ kind: "boundary" }] },
        { to: "prepare-maul", when: [{ kind: "elapsed", seconds: 0.44 }] },
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

function pigeonFlight(next: string, failure: string, to: Point): BehaviourNode {
  return {
    animation: "fly",
    motion: { kind: "fly", speed: 20, to },
    transitions: [
      { to: next, when: [{ kind: "arrived", tolerance: 0.1 }] },
      { to: failure, when: [{ kind: "elapsed", seconds: 2.4 }] },
    ],
  };
}

function pigeonSwoop(failure: string, x: number): BehaviourNode {
  return {
    animation: "swoop",
    motion: {
      bounds: { height: 19, width: 8, x, y: -8 },
      kind: "fly",
      speed: 37.5,
      to: "target",
    },
    transitions: [
      { to: failure, when: [{ kind: "arrived", tolerance: 0.6 }] },
      { to: failure, when: [{ kind: "elapsed", seconds: 0.88 }] },
    ],
  };
}

export const PIGEON_BEHAVIOUR: BehaviourPlan = {
  axis: "x",
  distance: 24,
  inactiveAnimation: "idle",
  initial: "watch",
  spotted: { line: "pebble-spotted", speaker: "pigeon" },
  states: {
    "ascend-left": pigeonFlight("fly-right", "frustration-left", { x: -12, y: -8 }),
    "ascend-right": pigeonFlight("return-high", "frustration-right", { x: 12, y: -8 }),
    "drop-left": {
      animation: "drop",
      motion: { kind: "wait" },
      onEnter: [PIGEON_POOP],
      transitions: [{ to: "prepare-swoop-left", when: [{ kind: "elapsed", seconds: 0.14 }] }],
    },
    "drop-right": {
      animation: "drop",
      motion: { kind: "wait" },
      onEnter: [PIGEON_POOP],
      transitions: [{ to: "prepare-swoop-right", when: [{ kind: "elapsed", seconds: 0.14 }] }],
    },
    "fly-left": pigeonFlight("prepare-drop-left", "frustration-left", { x: -12, y: -8 }),
    "fly-right": pigeonFlight("prepare-drop-right", "frustration-right", { x: 12, y: -8 }),
    "frustration-left": frustrationNode("ascend-left"),
    "frustration-perch": frustrationNode("land-perch"),
    "frustration-return": frustrationNode("return-high"),
    "frustration-right": frustrationNode("ascend-right"),
    "land-perch": pigeonFlight("rest", "frustration-perch", { x: 0, y: 0 }),
    prepare: {
      animation: "prepare-air",
      motion: { kind: "wait" },
      transitions: [
        { to: "fly-left", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    "prepare-drop-left": {
      animation: "prepare-air",
      motion: { kind: "wait" },
      transitions: [
        { to: "drop-left", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    "prepare-drop-right": {
      animation: "prepare-air",
      motion: { kind: "wait" },
      transitions: [
        { to: "drop-right", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    "prepare-swoop-left": {
      animation: "prepare-air",
      motion: { kind: "wait" },
      transitions: [
        { to: "swoop-left", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    "prepare-swoop-right": {
      animation: "prepare-air",
      motion: { kind: "wait" },
      transitions: [
        { to: "swoop-right", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
      ],
    },
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare", when: [{ kind: "elapsed", seconds: 0.35 }] }],
    },
    "return-high": pigeonFlight("land-perch", "frustration-return", { x: 0, y: -8 }),
    "swoop-left": pigeonSwoop("frustration-left", -12),
    "swoop-right": pigeonSwoop("frustration-right", 4),
    watch: {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [{ to: "prepare", when: DETECTION }],
    },
  },
};
