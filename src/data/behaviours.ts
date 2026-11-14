import { BIRD } from "./bird.ts";
import {
  chargeScore,
  DROP_BURST_SCORE,
  FERT_SCORER,
  GROUND_BOSS_SCORER,
  GROWL_SCORE,
  KIWI_DROP_SCORE,
  MAUL_SCORE,
  PARCEL_SCORE,
  PEBBLE_SCORER,
  PIGEON_SWOOP_SETUP_DISTANCE,
  POUNCE_SCORE,
  SWOOP_SCORE,
  TRAP_SCORE,
} from "./bossScorers.ts";
import { SCREEN, TILE } from "./screen.ts";
import type {
  BehaviourAction,
  BehaviourCondition,
  BehaviourNode,
  BehaviourPlan,
  BehaviourTransition,
  BossScoredAttack,
  BossWander,
  ChaseRelief,
  DialogueLine,
} from "./types/index.ts";

const BEAR_PURSUIT_SPEED = (0.95 * BIRD.walkSpeed) / TILE;
const BEAR_TRAVERSAL_SPEED = (1.4 * BIRD.walkSpeed) / TILE;
const CROSSING_PAUSE = 1;
const CROSSING_SPEED = 6;
const FERRET_THROW_PAUSE_SECONDS = 1;
const GROUND_PURSUIT_SPEED = BIRD.walkSpeed / TILE;
const GROUND_TRAVERSAL_SPEED = (1.5 * BIRD.walkSpeed) / TILE;
// Pebble's ordinary flight (landings and returns to support) is 1.2x Chibi's walk; his overhead
// attack approach (drop approach, swoop setup and their tells), drop alignment and relocation legs
// stay at 1.6x.
const PIGEON_FLIGHT_SPEED = (1.2 * BIRD.walkSpeed) / TILE;
const PIGEON_APPROACH_SPEED = (1.6 * BIRD.walkSpeed) / TILE;
const PIGEON_SWOOP_SPEED = 20;
const POUNCE_ENGAGEMENT_RANGE = 8;
const RACCOON_RETURN_SPEED = 4.6875;

// Tells: the charge's 0.9 s, the specials' 1 s and Bini's growl's 1.2 s.
export const ATTACK_ANTICIPATION_SECONDS = 0.9;
const ATTACK_COOLDOWN_SECONDS = 5;
// After the second consecutive cancelled tell, pursuit continues with no new tell for 1.5 s.
const TELL_CANCEL_PAUSE = { cancels: 2, seconds: 1.5 } as const;
// Every boss's removal after its death.
export const BOSS_REMOVAL_SECONDS = 0.5;
const GROWL_TELL_SECONDS = 1.2;
const SPECIAL_TELL_SECONDS = 1;
const PIGEON_SWOOP_PREPARATION_SECONDS = SPECIAL_TELL_SECONDS;
export const BEHAVIOUR_TRAVERSAL_SEARCH = {
  budget: { horizonSteps: 120, maxStates: 256, maxSteps: 4096 },
  maxCollisionSteps: 16,
} as const;

export const ANIMAL_DETECTION_RANGE = SCREEN.width / TILE;
export const ANIMAL_INTERACTION_RANGE = SCREEN.width / (2 * TILE);

const ANIMAL_IDLE_WATCHDOG: NonNullable<BehaviourPlan["idleWatchdog"]> = {
  distance: 4,
  maxAttempts: 2,
  minMovement: 0.5,
  resume: "pursuit",
  seconds: 2,
};

export const ATTACK_ENGAGEMENT_RANGE = 12;
// Ground chase: the grounded walk toward Chibi, and the horizontal speed of jumps and map legs.
interface GroundChase {
  readonly speed: number;
  readonly traversalSpeed: number;
}
const BEAR_CHASE: GroundChase = { speed: BEAR_PURSUIT_SPEED, traversalSpeed: BEAR_TRAVERSAL_SPEED };
const GROUND_CHASE: GroundChase = {
  speed: GROUND_PURSUIT_SPEED,
  traversalSpeed: GROUND_TRAVERSAL_SPEED,
};
const GROUND_TRAVERSAL = {
  gravity: BIRD.gravity / TILE,
  jumpSpeed: BIRD.jumpSpeed / TILE,
  maxFallSpeed: BIRD.flutterFallSpeed / TILE,
  prepIntervalSeconds: 2,
  prepSeconds: 0.6,
};

const DETECTION = [{ kind: "visible" }] as const;
const LOST_TARGET = [{ kind: "lost-target", tolerance: 1 }] as const;

// A ground boss with no path to Chibi paces 2 tiles each side of the reachable spot nearest him,
// at 0.35 of Chibi's walk, pausing facing him at the start and at every turn.
const BOSS_PACE = {
  distance: 4,
  pauseSeconds: { max: 1.5, min: 0.8 },
  speed: (0.35 * BIRD.walkSpeed) / TILE,
};

// Every scored pursuer pauses after 5 to 8 s of chase, for 0.8 to 1.4 s, at least 1 s from any
// tell. Each engagement draws a give-up time in 30 to 60 s, taken at the first pause after it.
const CHASE_RELIEF: ChaseRelief = {
  giveUp: { seconds: { max: 60, min: 30 } },
  pause: {
    afterSeconds: { max: 8, min: 5 },
    seconds: { max: 1.4, min: 0.8 },
    tellClearanceSeconds: 1,
  },
};

// Pursuit ends past one screen width, after 6 s with no movement path, or by giving up; awareness
// engages again 5 s after any ended chase, and until then the boss keeps clear of Chibi. Chosen
// destinations keep the body a tile inside Chibi's screen.
const PURSUIT_LIMITS = {
  distance: (6 * SCREEN.width) / TILE,
  escapeDistance: SCREEN.width / TILE,
  keepClear: true,
  pace: BOSS_PACE,
  rearmSeconds: 5,
  relief: CHASE_RELIEF,
  screen: { margin: 1, width: SCREEN.width / TILE },
  unreachableGraceSeconds: 6,
};
// Unengaged, a ground boss walks 1 to 2 tiles at half Chibi's walk every 2 to 4 s within 4 tiles
// of its encounter position, holding 1 to 2 s facing its walk; Pebble hops to a supported spot
// within 4 tiles every 3 to 5 s and perches 1.5 to 3 s.
const WANDER_RANGE = 4;
const GROUND_WANDER: BossWander = {
  everySeconds: { max: 4, min: 2 },
  holdSeconds: { max: 2, min: 1 },
  range: WANDER_RANGE,
  walk: { distance: { max: 2, min: 1 }, speed: (0.5 * BIRD.walkSpeed) / TILE },
};
const PIGEON_WANDER: BossWander = {
  everySeconds: { max: 5, min: 3 },
  holdSeconds: { max: 3, min: 1.5 },
  hop: "wander-hop",
  range: WANDER_RANGE,
};
const WANDER_STATE = "wander";
// The unengaged wander state: it opens its first move on sight of Chibi.
function wanderNode(opening: string): BehaviourNode {
  return {
    allowIdleReposition: true,
    animation: "idle",
    motion: { kind: "wait", wander: true },
    transitions: [{ to: opening, when: DETECTION }],
  };
}

function persistentPursuit(escaped: DialogueLine): NonNullable<BehaviourPlan["pursuit"]> {
  return { ...PURSUIT_LIMITS, escaped };
}
// A scored attack of the engaged state: `when` gates it and the scorer chooses it.
function scored(
  to: string,
  score: BossScoredAttack,
  when: readonly BehaviourCondition[],
): BehaviourTransition {
  return { score, to, when };
}
const ENGAGEMENT = { kind: "nearby", range: ATTACK_ENGAGEMENT_RANGE } as const;

// The engaged ground state: the scorer chooses among its attacks and moves.
function chaseNode(chase: GroundChase, attacks: readonly BehaviourTransition[]): BehaviourNode {
  return {
    allowIdleReposition: true,
    animation: "walk",
    motion: {
      kind: "pursue",
      mode: "ground",
      speed: chase.speed,
      traversal: { ...GROUND_TRAVERSAL, speed: chase.traversalSpeed },
    },
    transitions: attacks,
  };
}

interface AttackSequence {
  readonly committed: readonly string[];
  readonly finished: readonly { readonly from: string; readonly to: string }[];
  readonly id: string;
  // Continuing tells inside the committed sequence, entered without attack-ready.
  readonly retells?: Readonly<Record<string, number>>;
  readonly tells: Readonly<Record<string, number>>;
}

function tellNode(
  attack: NonNullable<BehaviourNode["attack"]>,
  node: BehaviourNode,
  seconds: number,
): BehaviourNode {
  return {
    ...node,
    allowIdleReposition: false,
    animation: ANTICIPATION_ANIMATION,
    attack,
    transitions: node.transitions.map((transition) => ({
      ...transition,
      when: transition.when.map((condition) =>
        condition.kind === "elapsed" ? { ...condition, seconds } : condition,
      ),
    })),
  };
}

const ANTICIPATION_ANIMATION = "anticipate-lift";

function attackProfile(plan: BehaviourPlan, sequences: readonly AttackSequence[]): BehaviourPlan {
  const states: Record<string, BehaviourNode> = { ...plan.states };
  const tells = new Set(sequences.flatMap(({ tells }) => Object.keys(tells)));
  for (const sequence of sequences) {
    for (const [key, seconds] of Object.entries(sequence.tells)) {
      states[key] = tellNode({ id: sequence.id, phase: "tell" }, states[key]!, seconds);
    }
    for (const [key, seconds] of Object.entries(sequence.retells ?? {})) {
      states[key] = tellNode(
        { continues: true, id: sequence.id, phase: "tell" },
        states[key]!,
        seconds,
      );
    }
    for (const key of sequence.committed) {
      states[key] = {
        ...states[key]!,
        allowIdleReposition: false,
        attack: { id: sequence.id, phase: "committed" },
      };
    }
    for (const { from, to } of sequence.finished) {
      const key = `${sequence.id}-completed-${from}-${to}`;
      const destination = states[to]!;
      states[key] = {
        animation: destination.animation,
        attack: { id: sequence.id, phase: "completed" },
        motion: plan.states.pursuit!.motion,
        ...(plan.states.pursuit!.track ? { track: plan.states.pursuit!.track } : {}),
        transitions: [{ to, when: [{ kind: "elapsed", seconds: 0 }] }],
      };
      states[from] = {
        ...states[from]!,
        transitions: states[from]!.transitions.map((transition) =>
          transition.to === to ? { ...transition, to: key } : transition,
        ),
      };
    }
  }
  for (const [key, node] of Object.entries(states)) {
    states[key] = {
      ...node,
      transitions: node.transitions.map((transition) =>
        tells.has(transition.to)
          ? { ...transition, when: [...transition.when, { kind: "attack-ready" }] }
          : transition,
      ),
    };
  }
  return {
    ...plan,
    attackCooldownSeconds: ATTACK_COOLDOWN_SECONDS,
    states,
    tellCancelPause: TELL_CANCEL_PAUSE,
  };
}

function escapeTransition(to: string): BehaviourTransition {
  return { to, when: [{ kind: "pursuit-ended" }] };
}

export function shuttleStates(
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

interface WanderChargeTuning {
  // The tell the wander enters on spotting Chibi; the charge's preparation by default.
  readonly opening?: string;
  // The engaged state's specials, scored beside the charge.
  readonly specials: readonly BehaviourTransition[];
  // Tiles the committed charge covers.
  readonly reach: number;
  readonly preparation: "crouch" | "warn";
  readonly preparationSeconds: number;
  readonly restSeconds: number;
  readonly rushSeconds: number;
  readonly rushSpeed: number;
  // A committed overshoot after every rush: tiles past the rush's end, its speed in tiles per
  // second and the seconds it may take. A wall or ledge that stops it ends it there.
  readonly slide?: { readonly distance: number; readonly seconds: number; readonly speed: number };
}

function wanderChargeStates(tuning: WanderChargeTuning): BehaviourPlan["states"] {
  const afterRush = tuning.slide ? "slide" : "rest";
  const opening = tuning.opening ?? tuning.preparation;
  return {
    [tuning.preparation]: {
      animation: tuning.preparation,
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        escapeTransition("pursuit"),
        { to: "rush", when: [{ kind: "elapsed", seconds: tuning.preparationSeconds }] },
      ],
    },
    pursuit: chaseNode(GROUND_CHASE, [
      scored(tuning.preparation, chargeScore(tuning.reach), [ENGAGEMENT]),
      ...tuning.specials,
    ]),
    rest: {
      animation: "rest",
      motion: { kind: "wait" },
      transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: tuning.restSeconds }] }],
    },
    rush: {
      animation: "rush",
      motion: { direction: "facing", kind: "move", speed: tuning.rushSpeed },
      transitions: [
        { to: afterRush, when: LOST_TARGET },
        { to: afterRush, when: [{ kind: "boundary" }] },
        { to: afterRush, when: [{ kind: "elapsed", seconds: tuning.rushSeconds }] },
      ],
    },
    ...(tuning.slide && {
      slide: {
        animation: "skid",
        motion: {
          direction: "facing",
          distance: tuning.slide.distance,
          kind: "move",
          speed: tuning.slide.speed,
        },
        transitions: [
          { to: "rest", when: [{ kind: "boundary" }] },
          { to: "rest", when: [{ kind: "blocked" }] },
          { to: "rest", when: [{ kind: "elapsed", seconds: tuning.slide.seconds }] },
        ],
      },
    }),
    wander: wanderNode(opening),
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
    prepare: {
      animation: "prepare",
      motion: { kind: "wait" },
      transitions: [
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

const GROUND_CHARGE = {
  preparation: "crouch",
  preparationSeconds: ATTACK_ANTICIPATION_SECONDS,
  reach: 15,
  restSeconds: 0.25,
  rushSeconds: 0.48,
  rushSpeed: 31.25,
} as const;

const DOG_BEHAVIOUR_STATES = wanderChargeStates({
  ...GROUND_CHARGE,
  specials: [
    scored("prepare-pounce", POUNCE_SCORE, [
      { kind: "nearby", range: POUNCE_ENGAGEMENT_RANGE },
      { kind: "line-of-sight" },
    ]),
  ],
});

export const DOG_BEHAVIOUR: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: -18,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: WANDER_STATE,
    pursuit: persistentPursuit({ line: "archie-escaped", speaker: "dog" }),
    scorer: GROUND_BOSS_SCORER,
    spotted: { line: "archie-spotted", speaker: "dog" },
    states: {
      ...DOG_BEHAVIOUR_STATES,
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
          escapeTransition("pursuit"),
          {
            to: "pounce",
            when: [
              { kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS },
              { kind: "nearby", range: POUNCE_ENGAGEMENT_RANGE },
              { kind: "line-of-sight" },
            ],
          },
          { to: "pursuit", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
    wander: GROUND_WANDER,
  },
  [
    {
      committed: ["rush", "rest"],
      finished: [{ from: "rest", to: "pursuit" }],
      id: "charge",
      tells: { crouch: ATTACK_ANTICIPATION_SECONDS },
    },
    {
      committed: ["pounce", "pounce-rest"],
      finished: [{ from: "pounce-rest", to: "pursuit" }],
      id: "pounce",
      tells: { "prepare-pounce": SPECIAL_TELL_SECONDS },
    },
  ],
);

export const FERRET_BEHAVIOUR: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: -18,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: WANDER_STATE,
    pursuit: persistentPursuit({ line: "fert-escaped", speaker: "ferret" }),
    scorer: FERT_SCORER,
    spotted: { line: "fert-spotted", speaker: "ferret" },
    states: {
      // Fert opens with a throw on spotting Chibi, so his first pause comes before any chase.
      ...wanderChargeStates({
        ...GROUND_CHARGE,
        opening: "prepare-throw",
        specials: [scored("prepare-throw", PARCEL_SCORE, [ENGAGEMENT])],
      }),
      "prepare-throw": {
        animation: "crouch",
        enter: "face-target",
        motion: { kind: "wait" },
        transitions: [
          escapeTransition("pursuit"),
          { to: "throw", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
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
      // Fert stands still after each throw, inside the committed throw; cooldown follows.
      "throw-rest": {
        animation: "rest",
        motion: { kind: "wait" },
        transitions: [
          { to: "pursuit", when: [{ kind: "elapsed", seconds: FERRET_THROW_PAUSE_SECONDS }] },
        ],
      },
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
    wander: GROUND_WANDER,
  },
  [
    {
      committed: ["rush", "rest"],
      finished: [{ from: "rest", to: "pursuit" }],
      id: "charge",
      tells: { crouch: ATTACK_ANTICIPATION_SECONDS },
    },
    {
      committed: ["throw", "throw-rest"],
      finished: [{ from: "throw-rest", to: "pursuit" }],
      id: "parcel",
      tells: { "prepare-throw": SPECIAL_TELL_SECONDS },
    },
  ],
);

export const GOOSE_BEHAVIOUR: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: -12,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: WANDER_STATE,
    pursuit: persistentPursuit({ line: "trixi-escaped", speaker: "goose" }),
    scorer: GROUND_BOSS_SCORER,
    spotted: { line: "trixi-spotted", speaker: "goose" },
    states: {
      ...wanderChargeStates({
        preparation: "warn",
        preparationSeconds: ATTACK_ANTICIPATION_SECONDS,
        reach: 10,
        restSeconds: 0.35,
        rushSeconds: 0.36,
        rushSpeed: 21.875,
        slide: { distance: 3, seconds: 0.4, speed: 10.9375 },
        specials: [scored("set-trap", TRAP_SCORE, [ENGAGEMENT])],
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
      "set-trap": {
        animation: "warn",
        motion: { kind: "wait" },
        transitions: [
          escapeTransition("pursuit"),
          { to: "release-trap", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
    wander: GROUND_WANDER,
  },
  [
    {
      committed: ["rush", "slide", "rest"],
      finished: [{ from: "rest", to: "pursuit" }],
      id: "charge",
      tells: { warn: ATTACK_ANTICIPATION_SECONDS },
    },
    {
      committed: ["release-trap"],
      finished: [{ from: "release-trap", to: "pursuit" }],
      id: "trap",
      tells: { "set-trap": SPECIAL_TELL_SECONDS },
    },
  ],
);

const KIWI_DROP_ALIGNMENT = 1;
// The re-aimed tell before Kiwi's second charge: the minimum reaction time.
const KIWI_RETELL_SECONDS = 0.6;
// She skips the second charge with less ground than this ahead toward Chibi.
const KIWI_SECOND_CHARGE_ROOM = 3;
const RACCOON_RUSH = { seconds: 0.48, speed: 25 } as const;
const RACCOON_CLIMB_CLEAR = { kind: "track-clear", state: "climb" } as const;
const RACCOON_GROUND_TRACK = { axis: "x", distance: -12 } as const;

// A rush that ends in rest, or first in a re-tell when there is room for a second rush.
function raccoonRush(rest: string, retell?: string): BehaviourNode {
  const room = { distance: KIWI_SECOND_CHARGE_ROOM, kind: "track-room" } as const;
  const ends = [
    [{ kind: "boundary" }],
    [{ kind: "elapsed", seconds: RACCOON_RUSH.seconds }],
  ] as const;
  return {
    animation: "rush",
    motion: { direction: "facing", kind: "move", speed: RACCOON_RUSH.speed },
    track: RACCOON_GROUND_TRACK,
    transitions: ends.flatMap((end) => [
      ...(retell ? [{ to: retell, when: [...end, room] }] : []),
      { to: rest, when: [...end] },
    ]),
  };
}

const RACCOON_VERTICAL_STATES = verticalDropStates({
  dropSpeed: 18.75,
  preparationSeconds: ATTACK_ANTICIPATION_SECONDS,
  restSeconds: 0.3,
  returnSpeed: RACCOON_RETURN_SPEED,
  returnState: "climb",
});

export const RACCOON_BEHAVIOUR: BehaviourPlan = attackProfile(
  {
    axis: "y",
    distance: -15,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: WANDER_STATE,
    pursuit: persistentPursuit({ line: "kiwi-escaped", speaker: "raccoon" }),
    scorer: GROUND_BOSS_SCORER,
    spotted: { line: "kiwi-spotted", speaker: "raccoon" },
    states: {
      ...RACCOON_VERTICAL_STATES,
      "charge-rest": {
        animation: "rest",
        motion: { kind: "wait" },
        track: RACCOON_GROUND_TRACK,
        transitions: [{ to: "return-ground", when: [{ kind: "elapsed", seconds: 0.3 }] }],
      },
      climb: {
        ...RACCOON_VERTICAL_STATES.climb!,
        transitions: [
          { to: "pursuit", when: [{ kind: "blocked" }] },
          ...RACCOON_VERTICAL_STATES.climb!.transitions,
        ],
      },
      "drop-abort-return": {
        ...RACCOON_VERTICAL_STATES.drop!,
        transitions: [{ to: "pursuit", when: [{ kind: "boundary" }] }],
      },
      prepare: {
        ...RACCOON_VERTICAL_STATES.prepare!,
        transitions: [
          escapeTransition("drop-abort-return"),
          ...RACCOON_VERTICAL_STATES.prepare!.transitions,
        ],
      },
      "prepare-charge": {
        animation: "prepare",
        enter: "face-target",
        motion: { kind: "wait" },
        track: RACCOON_GROUND_TRACK,
        transitions: [
          escapeTransition("pursuit"),
          { to: "rush", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
      // Kiwi climbs only for her drop: it starts with the walk to her climb's foot once she is
      // lined up under Chibi with a clear climb.
      pursuit: {
        ...chaseNode(GROUND_CHASE, [
          scored("prepare-charge", chargeScore(12), [ENGAGEMENT]),
          scored("return-ground-staging", KIWI_DROP_SCORE, [
            ...DETECTION,
            { kind: "attack-ready" },
            { comparison: "below", distance: KIWI_DROP_ALIGNMENT, kind: "horizontal-gap" },
            RACCOON_CLIMB_CLEAR,
          ]),
        ]),
        animation: "climb",
        track: RACCOON_GROUND_TRACK,
      },
      // Kiwi charges twice: the second rush follows its own re-aimed tell.
      recharge: {
        animation: "prepare",
        enter: "face-target",
        motion: { kind: "wait" },
        track: RACCOON_GROUND_TRACK,
        transitions: [
          escapeTransition("pursuit"),
          { to: "rush-second", when: [{ kind: "elapsed", seconds: KIWI_RETELL_SECONDS }] },
        ],
      },
      rest: {
        animation: "rest",
        motion: { kind: "wait" },
        track: RACCOON_GROUND_TRACK,
        transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.3 }] }],
      },
      "return-ground": {
        animation: "climb",
        motion: { direction: 1, kind: "move", speed: RACCOON_RETURN_SPEED },
        track: RACCOON_GROUND_TRACK,
        transitions: [
          { to: "pursuit", when: [{ kind: "boundary" }] },
          { to: "pursuit", when: [{ kind: "elapsed", seconds: 3.2 }] },
        ],
      },
      "return-ground-staging": {
        animation: "climb",
        motion: { direction: 1, kind: "move", speed: RACCOON_RETURN_SPEED },
        track: RACCOON_GROUND_TRACK,
        transitions: [
          { to: "climb", when: [{ kind: "boundary" }, RACCOON_CLIMB_CLEAR] },
          { to: "pursuit", when: [{ kind: "boundary" }] },
        ],
      },
      rush: raccoonRush("charge-rest", "recharge"),
      "rush-second": raccoonRush("charge-rest"),
      wander: { ...wanderNode("prepare-charge"), track: RACCOON_GROUND_TRACK },
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
    wander: GROUND_WANDER,
  },
  [
    {
      committed: ["rush", "rush-second", "charge-rest", "return-ground"],
      finished: [
        { from: "return-ground", to: "pursuit" },
        { from: "recharge", to: "pursuit" },
      ],
      id: "charge",
      retells: { recharge: KIWI_RETELL_SECONDS },
      tells: { "prepare-charge": ATTACK_ANTICIPATION_SECONDS },
    },
    {
      committed: ["drop", "rest"],
      finished: [{ from: "rest", to: "pursuit" }],
      id: "drop",
      tells: { prepare: SPECIAL_TELL_SECONDS },
    },
  ],
);

export const BEAR_BEHAVIOUR: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: -18,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: WANDER_STATE,
    pursuit: persistentPursuit({ line: "bini-escaped", speaker: "bear" }),
    scorer: GROUND_BOSS_SCORER,
    spotted: { line: "bini-spotted", speaker: "bear" },
    states: {
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
          escapeTransition("pursuit"),
          { to: "rush", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
      "prepare-growl": {
        animation: "prepare-attack",
        enter: "face-target",
        motion: { kind: "wait" },
        transitions: [
          escapeTransition("pursuit"),
          { to: "growl", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
      "prepare-maul": {
        animation: "prepare-attack",
        enter: "face-target",
        motion: { kind: "wait" },
        transitions: [
          escapeTransition("pursuit"),
          { to: "maul", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
      pursuit: chaseNode(BEAR_CHASE, [
        scored("prepare-charge", chargeScore(13), [ENGAGEMENT]),
        scored("prepare-maul", MAUL_SCORE, [ENGAGEMENT]),
        scored("prepare-growl", GROWL_SCORE, [ENGAGEMENT]),
      ]),
      rest: {
        animation: "rest",
        motion: { kind: "wait" },
        transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.35 }] }],
      },
      rush: {
        animation: "rush",
        motion: { direction: "facing", kind: "move", speed: 31.25 },
        transitions: [
          { to: "pursuit", when: [{ kind: "boundary" }] },
          { to: "pursuit", when: [{ kind: "elapsed", seconds: 0.44 }] },
        ],
      },
      wander: wanderNode("prepare-growl"),
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
    wander: GROUND_WANDER,
  },
  [
    {
      committed: ["rush"],
      finished: [{ from: "rush", to: "pursuit" }],
      id: "charge",
      tells: { "prepare-charge": ATTACK_ANTICIPATION_SECONDS },
    },
    {
      committed: ["maul", "rest"],
      finished: [{ from: "rest", to: "pursuit" }],
      id: "maul",
      tells: { "prepare-maul": SPECIAL_TELL_SECONDS },
    },
    {
      committed: ["growl"],
      finished: [{ from: "growl", to: "pursuit" }],
      id: "growl",
      tells: { "prepare-growl": GROWL_TELL_SECONDS },
    },
  ],
);

const PIGEON_POOP: BehaviourAction = {
  armSeconds: 0,
  character: "pigeon-poop",
  gravity: 60,
  kind: "spawn",
  lifeSeconds: 3,
  maxAlive: 3,
  offset: { x: 1.5, y: 4 },
  velocity: { x: 0, y: 6 },
};

const PIGEON_DROP_AHEAD = 8;
// A drop tell commits within this many tiles of its overhead goal, so the climb a jumping Chibi
// forces on Pebble does not cancel it.
export const PIGEON_DROP_COMMIT_TOLERANCE = 0.5;
const PIGEON_OVERHEAD_CLEARANCE = 6;
// The swoop's approach adds its setup distance to the drop approach's lead.
const PIGEON_SWOOP_AHEAD = PIGEON_DROP_AHEAD + PIGEON_SWOOP_SETUP_DISTANCE;
const PIGEON_SWOOP_MIN_GAP = 12;
const PIGEON_RELOCATION_SECONDS = 2;
// An engaged approach that opens no attack within this relocates, sooner out of sight.
const PIGEON_APPROACH_SECONDS = 1.5;
const PIGEON_HIDDEN_RELOCATION_SECONDS = 1;
// A wander hop lands on a supported spot 2 to 4 tiles away, within 4 tiles of his perch.
const PIGEON_WANDER_SELECTION = {
  clearance: 2,
  distance: WANDER_RANGE,
  home: WANDER_RANGE,
  kind: "varied",
  maxAttempts: 4,
  minDistance: 2,
} as const;
// A relocation lands 15 to 60 tiles away, on Chibi's screen, trying up to 8 candidates.
const PIGEON_RELOCATION_SELECTION = {
  clearance: PIGEON_OVERHEAD_CLEARANCE,
  distance: SCREEN.width / TILE,
  kind: "varied",
  maxAttempts: 8,
  minDistance: SCREEN.width / (4 * TILE),
} as const;

function pigeonOverhead(ahead: number): BehaviourNode["motion"] {
  return {
    kind: "pursue",
    mode: "fly",
    overhead: { ahead, clearance: PIGEON_OVERHEAD_CLEARANCE },
    speed: PIGEON_APPROACH_SPEED,
  };
}

// The engaged flight: the scorer's move sets the approach goal, and arriving there opens the
// drop or, far enough out along the approach side, the swoop.
function pigeonApproach(): BehaviourNode {
  const ready = [
    { kind: "arrived", target: "intent", tolerance: 0.1 },
    { kind: "line-of-sight" },
    { kind: "targeted-attack-allowed" },
  ] as const;
  return {
    allowIdleReposition: true,
    animation: "fly",
    motion: pigeonOverhead(PIGEON_DROP_AHEAD),
    transitions: [
      { to: "return-high", when: [{ kind: "alignment-blocked" }] },
      { to: "return-high", when: LOST_TARGET },
      scored("prepare-drop", DROP_BURST_SCORE, ready),
      ...([1, -1] as const).map((direction) =>
        scored(direction === 1 ? "prepare-swoop-left" : "prepare-swoop-right", SWOOP_SCORE, [
          ...ready,
          { direction, kind: "flight-approach-direction" },
          { comparison: "at-least", distance: PIGEON_SWOOP_MIN_GAP, kind: "horizontal-gap" },
        ]),
      ),
      // Out of sight, Pebble looks for a line sooner.
      {
        to: "relocate",
        when: [
          { kind: "elapsed", seconds: PIGEON_HIDDEN_RELOCATION_SECONDS },
          { condition: { kind: "line-of-sight" }, kind: "not" },
        ],
      },
      { to: "relocate", when: [{ kind: "elapsed", seconds: PIGEON_APPROACH_SECONDS }] },
    ],
  };
}

const PIGEON_DROP_INTERVAL_SECONDS = 0.3;
function pigeonAlignmentMotion(): BehaviourNode["motion"] {
  return {
    ahead: PIGEON_DROP_AHEAD,
    bounds: { height: 19, width: 24, x: -12, y: -8 },
    kind: "fly",
    leadSeconds: 0.1,
    maxLead: 2,
    speed: PIGEON_APPROACH_SPEED,
    to: "target-x",
  };
}

// Three aligned drops, then the landing every completed or abandoned burst shares.
function pigeonDropBurst(): BehaviourPlan["states"] {
  return Object.fromEntries(
    ["", "-2", "-3"].flatMap((suffix, index) => {
      const align = `align-drop${suffix}`;
      const drop = `drop${suffix}`;
      const next = index === 2 ? "burst-return-high" : `align-drop-${index + 2}`;
      return [
        [
          align,
          {
            animation: "fly",
            motion: pigeonAlignmentMotion(),
            transitions: [
              escapeTransition("burst-return-high"),
              { to: "burst-return-high", when: [{ kind: "alignment-blocked" }] },
              { to: drop, when: [{ kind: "arrived", tolerance: 0.1 }, { kind: "line-of-sight" }] },
              { to: "burst-return-high", when: [{ kind: "arrived", tolerance: 0.1 }] },
              { to: "burst-return-high", when: [{ kind: "elapsed", seconds: 2.4 }] },
            ],
          } satisfies BehaviourNode,
        ],
        [
          drop,
          {
            animation: "drop",
            motion: pigeonAlignmentMotion(),
            onEnter: [PIGEON_POOP],
            transitions: [
              escapeTransition("burst-return-high"),
              { to: "burst-return-high", when: [{ kind: "alignment-blocked" }] },
              {
                to: next,
                when: [
                  { kind: "elapsed", seconds: index === 2 ? 0.14 : PIGEON_DROP_INTERVAL_SECONDS },
                ],
              },
            ],
          } satisfies BehaviourNode,
        ],
      ];
    }),
  );
}

function pigeonLanding(next: string): BehaviourNode {
  return {
    animation: "fly",
    motion: { kind: "fly", speed: PIGEON_FLIGHT_SPEED, to: "support" },
    transitions: [{ to: next, when: [{ kind: "arrived", tolerance: 0.1 }] }],
  };
}

function pigeonSwoop(x: number): BehaviourNode {
  return {
    animation: "swoop",
    motion: {
      bounds: { height: 19, width: 16, x, y: -8 },
      kind: "fly",
      speed: PIGEON_SWOOP_SPEED,
      to: "target",
    },
    transitions: [
      { to: "swoop-return", when: [{ kind: "arrived", tolerance: 0.6 }] },
      { to: "swoop-return", when: [{ kind: "elapsed", seconds: 1.2 }] },
    ],
  };
}

function pigeonSwoopTell(swoop: string): BehaviourNode {
  return {
    animation: "prepare-air",
    motion: pigeonOverhead(PIGEON_SWOOP_AHEAD),
    transitions: [
      { to: "return-high", when: [{ kind: "alignment-blocked" }] },
      escapeTransition("return-high"),
      {
        to: "pursuit",
        when: [{ comparison: "below", distance: PIGEON_SWOOP_MIN_GAP, kind: "horizontal-gap" }],
      },
      {
        to: swoop,
        when: [
          { kind: "elapsed", seconds: PIGEON_SWOOP_PREPARATION_SECONDS },
          { kind: "arrived", tolerance: 0.1 },
          { comparison: "at-least", distance: PIGEON_SWOOP_MIN_GAP, kind: "horizontal-gap" },
          { kind: "line-of-sight" },
          { kind: "targeted-attack-allowed" },
        ],
      },
      { to: "return-high", when: [{ kind: "elapsed", seconds: SPECIAL_TELL_SECONDS }] },
    ],
  };
}

const supportedRest = (to: string): BehaviourNode => ({
  animation: "rest",
  motion: { kind: "wait", support: "required" },
  transitions: [{ to, when: [{ kind: "elapsed", seconds: 0.35 }] }],
});

export const PIGEON_BEHAVIOUR: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: 24,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: WANDER_STATE,
    pursuit: persistentPursuit({ line: "pebble-escaped", speaker: "pigeon" }),
    scorer: PEBBLE_SCORER,
    spotted: { line: "pebble-spotted", speaker: "pigeon" },
    states: {
      ...pigeonDropBurst(),
      "burst-land-perch": pigeonLanding("burst-recovery"),
      "burst-recovery": supportedRest("pursuit"),
      "burst-return-high": pigeonLanding("burst-land-perch"),
      "land-perch": pigeonLanding("rest"),
      "prepare-drop": {
        animation: "prepare-air",
        motion: pigeonOverhead(PIGEON_DROP_AHEAD),
        transitions: [
          { to: "return-high", when: [{ kind: "alignment-blocked" }] },
          escapeTransition("return-high"),
          {
            to: "align-drop",
            when: [
              { kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS },
              { kind: "arrived", tolerance: PIGEON_DROP_COMMIT_TOLERANCE },
              { kind: "line-of-sight" },
              { kind: "targeted-attack-allowed" },
            ],
          },
          { to: "return-high", when: [{ kind: "elapsed", seconds: SPECIAL_TELL_SECONDS }] },
        ],
      },
      "prepare-swoop-left": pigeonSwoopTell("swoop-left"),
      "prepare-swoop-right": pigeonSwoopTell("swoop-right"),
      pursuit: pigeonApproach(),
      relocate: {
        animation: "fly",
        motion: {
          kind: "fly",
          selection: PIGEON_RELOCATION_SELECTION,
          speed: PIGEON_APPROACH_SPEED,
          to: "support",
        },
        transitions: [
          { to: "return-high", when: [{ kind: "alignment-blocked" }] },
          { to: "relocation-rest", when: [{ kind: "arrived", tolerance: 0.1 }] },
        ],
      },
      "relocation-rest": {
        allowIdleReposition: true,
        animation: "rest",
        motion: { kind: "wait", support: "required" },
        transitions: [
          {
            to: WANDER_STATE,
            when: [{ kind: "elapsed", seconds: 0.35 }, { kind: "pursuit-ended" }],
          },
          {
            to: "pursuit",
            when: [
              { kind: "elapsed", seconds: 0.35 },
              { kind: "attack-ready" },
              { kind: "line-of-sight" },
            ],
          },
          { to: "relocate", when: [{ kind: "elapsed", seconds: PIGEON_RELOCATION_SECONDS }] },
        ],
      },
      rest: {
        allowIdleReposition: true,
        animation: "rest",
        motion: { kind: "wait", support: "required" },
        transitions: [
          {
            to: WANDER_STATE,
            when: [
              { kind: "elapsed", seconds: PIGEON_RELOCATION_SECONDS },
              { kind: "pursuit-ended" },
            ],
          },
          { to: "relocate", when: [{ kind: "elapsed", seconds: PIGEON_RELOCATION_SECONDS }] },
        ],
      },
      "return-high": pigeonLanding("land-perch"),
      "swoop-land": pigeonLanding("swoop-rest"),
      "swoop-left": pigeonSwoop(-20),
      "swoop-rest": supportedRest("pursuit"),
      "swoop-return": pigeonLanding("swoop-land"),
      "swoop-right": pigeonSwoop(4),
      wander: wanderNode("pursuit"),
      "wander-hop": {
        animation: "fly",
        motion: {
          kind: "fly",
          selection: PIGEON_WANDER_SELECTION,
          speed: PIGEON_FLIGHT_SPEED,
          to: "support",
        },
        transitions: [
          { to: "pursuit", when: DETECTION },
          { to: "wander-land", when: [{ kind: "alignment-blocked" }] },
          { to: WANDER_STATE, when: [{ kind: "arrived", tolerance: 0.1 }] },
        ],
      },
      "wander-land": pigeonLanding(WANDER_STATE),
    },
    wander: PIGEON_WANDER,
  },
  [
    {
      committed: [
        "align-drop",
        "drop",
        "align-drop-2",
        "drop-2",
        "align-drop-3",
        "drop-3",
        "burst-return-high",
        "burst-land-perch",
        "burst-recovery",
      ],
      finished: [{ from: "burst-recovery", to: "pursuit" }],
      id: "drop-burst",
      tells: { "prepare-drop": SPECIAL_TELL_SECONDS },
    },
    {
      committed: ["swoop-left", "swoop-right", "swoop-return", "swoop-land", "swoop-rest"],
      finished: [{ from: "swoop-rest", to: "pursuit" }],
      id: "swoop",
      tells: {
        "prepare-swoop-left": SPECIAL_TELL_SECONDS,
        "prepare-swoop-right": SPECIAL_TELL_SECONDS,
      },
    },
  ],
);
