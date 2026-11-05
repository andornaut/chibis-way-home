import { BIRD } from "./bird";
import { SCREEN, TILE } from "./screen";
import type {
  BehaviourAction,
  BehaviourGroundReposition,
  BehaviourNode,
  BehaviourPlan,
  BehaviourPursuitIntent,
  BehaviourTransition,
  DialogueLine,
} from "./types";

const BEAR_PURSUIT_SPEED = (1.4 * BIRD.walkSpeed) / TILE;
const CROSSING_PAUSE = 1;
const CROSSING_SPEED = 6;
const DOG_PATROL_PAUSE = 0.14;
const DOG_PATROL_SPEED = 4.6875;
const FERRET_THROW_PAUSE_SECONDS = 1;
const FRUSTRATION_SECONDS = 0.55;
const GOOSE_PATROL_SPEED = 3.125;
const GROUND_PURSUIT_SPEED = (1.5 * BIRD.walkSpeed) / TILE;
const PIGEON_FLIGHT_SPEED = (1.6 * BIRD.walkSpeed) / TILE;
const PIGEON_PURSUIT_SPEED = PIGEON_FLIGHT_SPEED;
const PIGEON_SWOOP_SPEED = 20;
const POUNCE_ENGAGEMENT_RANGE = 8;
const RACCOON_RETURN_SPEED = 4.6875;

export const ATTACK_ANTICIPATION_SECONDS = 0.6;
const ATTACK_COOLDOWN_SECONDS = 2.5;
// After the second consecutive cancelled tell, pursuit continues with no new tell for 1.5 s.
const TELL_CANCEL_PAUSE = { cancels: 2, seconds: 1.5 } as const;
// Every boss's removal after its death.
export const BOSS_REMOVAL_SECONDS = 0.5;
const GROWL_TELL_SECONDS = 1;
const SPECIAL_TELL_SECONDS = 0.8;
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

const GROUND_BOSS_REPOSITION: BehaviourGroundReposition = {
  distance: 12,
  intervalSeconds: 2,
  maxAttempts: 2,
  minDistance: 4,
  resume: "pursuit",
};

const BOSS_PURSUIT_INTENT: BehaviourPursuitIntent = {
  decisionSeconds: { max: 1.2, min: 0.8 },
  offset: { max: 2, min: -2 },
  pauseChance: 0.2,
  pauseSeconds: { max: 0.3, min: 0.1 },
};

function withPursuitIntent(plan: BehaviourPlan, eligible: readonly string[]): BehaviourPlan {
  const states = { ...plan.states };
  for (const key of eligible) {
    const node = states[key];
    if (!node || node.motion.kind !== "pursue" || node.attack || node.onEnter?.length) {
      throw new Error(`Invalid pursuit intent state ${key}`);
    }
    states[key] = { ...node, motion: { ...node.motion, intent: BOSS_PURSUIT_INTENT } };
  }
  return { ...plan, states };
}

const ATTACK_ENGAGEMENT_RANGE = 12;
const GROUND_TRAVERSAL = {
  gravity: BIRD.gravity / TILE,
  jumpSpeed: BIRD.jumpSpeed / TILE,
  maxFallSpeed: BIRD.flutterFallSpeed / TILE,
  prepSeconds: 0.6,
};

const DETECTION = [{ kind: "visible" }] as const;
const LOST_TARGET = [{ kind: "lost-target", tolerance: 1 }] as const;

const PURSUIT_LIMITS = {
  distance: (6 * SCREEN.width) / TILE,
  escapeDistance: SCREEN.width / TILE,
  unreachableGraceSeconds: null,
};
function persistentPursuit(escaped: DialogueLine): NonNullable<BehaviourPlan["pursuit"]> {
  return { ...PURSUIT_LIMITS, escaped };
}
function chaseNode(
  mode: "ground" | "fly",
  speed: number,
  failure: string,
  next: string,
): BehaviourNode {
  return {
    allowIdleReposition: true,
    animation: mode === "fly" ? "fly" : "walk",
    motion:
      mode === "ground"
        ? { kind: "pursue", mode, speed, traversal: GROUND_TRAVERSAL }
        : { kind: "pursue", mode, speed },
    transitions: [
      { to: failure, when: LOST_TARGET },
      { to: next, when: [{ kind: "nearby", range: ATTACK_ENGAGEMENT_RANGE }] },
    ],
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
  // A committed overshoot after every rush: tiles past the rush's end, its speed in tiles per
  // second and the seconds it may take. A wall or ledge that stops it ends it there.
  readonly slide?: { readonly distance: number; readonly seconds: number; readonly speed: number };
}

function patrolChargeStates(tuning: PatrolChargeTuning): BehaviourPlan["states"] {
  const afterRush = tuning.slide ? "slide" : "rest";
  return {
    [tuning.preparation]: {
      animation: tuning.preparation,
      enter: "face-target",
      motion: { kind: "wait" },
      transitions: [
        escapeTransition("pursuit"),
        {
          to: "frustration",
          when: [{ kind: "elapsed", seconds: tuning.preparationSeconds }, ...LOST_TARGET],
        },
        { to: "rush", when: [{ kind: "elapsed", seconds: tuning.preparationSeconds }] },
      ],
    },
    frustration: frustrationNode("pursuit"),
    "patrol-left": {
      allowIdleReposition: true,
      animation: "walk",
      motion: { direction: -1, kind: "move", speed: tuning.patrolSpeed },
      transitions: [
        { to: tuning.preparation, when: DETECTION },
        { to: "wait-left", when: [{ kind: "boundary" }] },
      ],
    },
    "patrol-right": {
      allowIdleReposition: true,
      animation: "walk",
      motion: { direction: 1, kind: "move", speed: tuning.patrolSpeed },
      transitions: [
        { to: tuning.preparation, when: DETECTION },
        { to: "wait-right", when: [{ kind: "boundary" }] },
      ],
    },
    pursuit: {
      ...chaseNode("ground", GROUND_PURSUIT_SPEED, "frustration", tuning.preparation),
      allowGroundReposition: true,
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
    "wait-left": {
      allowIdleReposition: true,
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [
        { to: tuning.preparation, when: DETECTION },
        { to: "patrol-right", when: [{ kind: "elapsed", seconds: tuning.patrolPause }] },
      ],
    },
    "wait-right": {
      allowIdleReposition: true,
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

const DOG_ATTACK_PROFILE: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: -18,
    groundReposition: GROUND_BOSS_REPOSITION,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: "patrol-left",
    pursuit: persistentPursuit({ line: "archie-escaped", speaker: "dog" }),
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
          escapeTransition("pursuit-pounce"),
          {
            to: "frustration",
            when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }, ...LOST_TARGET],
          },
          {
            to: "pounce",
            when: [
              { kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS },
              { kind: "nearby", range: POUNCE_ENGAGEMENT_RANGE },
              { kind: "line-of-sight" },
            ],
          },
          {
            to: "pursuit-pounce",
            when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }],
          },
        ],
      },
      "pursuit-pounce": {
        ...chaseNode("ground", GROUND_PURSUIT_SPEED, "frustration", "prepare-pounce"),
        transitions: [
          { to: "frustration", when: LOST_TARGET },
          {
            to: "prepare-pounce",
            when: [{ kind: "nearby", range: POUNCE_ENGAGEMENT_RANGE }, { kind: "line-of-sight" }],
          },
        ],
      },
      rest: {
        animation: "rest",
        motion: { kind: "wait" },
        transitions: [{ to: "pursuit-pounce", when: [{ kind: "elapsed", seconds: 0.25 }] }],
      },
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
  },
  [
    {
      committed: ["rush", "rest"],
      finished: [{ from: "rest", to: "pursuit-pounce" }],
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

export const DOG_BEHAVIOUR = withPursuitIntent(DOG_ATTACK_PROFILE, ["pursuit", "pursuit-pounce"]);

const FERRET_ATTACK_PROFILE: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: -18,
    groundReposition: GROUND_BOSS_REPOSITION,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: "patrol-left",
    pursuit: persistentPursuit({ line: "fert-escaped", speaker: "ferret" }),
    spotted: { line: "fert-spotted", speaker: "ferret" },
    states: {
      ...patrolChargeStates(GROUND_CHARGE),
      "prepare-throw": {
        animation: "crouch",
        enter: "face-target",
        motion: { kind: "wait" },
        transitions: [
          escapeTransition("pursuit-throw"),
          { to: "throw", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
      "pursuit-throw": chaseNode("ground", GROUND_PURSUIT_SPEED, "frustration", "prepare-throw"),
      rest: {
        animation: "rest",
        motion: { kind: "wait" },
        transitions: [{ to: "pursuit-throw", when: [{ kind: "elapsed", seconds: 0.25 }] }],
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
  },
  [
    {
      committed: ["rush", "rest"],
      finished: [{ from: "rest", to: "pursuit-throw" }],
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

export const FERRET_BEHAVIOUR = withPursuitIntent(FERRET_ATTACK_PROFILE, [
  "pursuit",
  "pursuit-throw",
]);

const GOOSE_ATTACK_PROFILE: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: -12,
    groundReposition: GROUND_BOSS_REPOSITION,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: "patrol-left",
    pursuit: persistentPursuit({ line: "trixi-escaped", speaker: "goose" }),
    spotted: { line: "trixi-spotted", speaker: "goose" },
    states: {
      ...patrolChargeStates({
        attackRange: ANIMAL_DETECTION_RANGE,
        patrolPause: 0.25,
        patrolSpeed: GOOSE_PATROL_SPEED,
        preparation: "warn",
        preparationSeconds: ATTACK_ANTICIPATION_SECONDS,
        restSeconds: 0.35,
        rushSeconds: 0.36,
        rushSpeed: 21.875,
        slide: { distance: 3, seconds: 0.4, speed: 10.9375 },
      }),
      "pursuit-trap": chaseNode("ground", GROUND_PURSUIT_SPEED, "frustration", "set-trap"),
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
        transitions: [{ to: "pursuit-trap", when: [{ kind: "elapsed", seconds: 0.35 }] }],
      },
      "set-trap": {
        animation: "warn",
        motion: { kind: "wait" },
        transitions: [
          escapeTransition("pursuit-trap"),
          { to: "release-trap", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
  },
  [
    {
      committed: ["rush", "slide", "rest"],
      finished: [{ from: "rest", to: "pursuit-trap" }],
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

export const GOOSE_BEHAVIOUR = withPursuitIntent(GOOSE_ATTACK_PROFILE, ["pursuit", "pursuit-trap"]);

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

const RACCOON_ATTACK_PROFILE: BehaviourPlan = attackProfile(
  {
    axis: "y",
    distance: -15,
    groundReposition: GROUND_BOSS_REPOSITION,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: "watch",
    pursuit: persistentPursuit({ line: "kiwi-escaped", speaker: "raccoon" }),
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
      "frustration-ground": { ...frustrationNode("pursuit"), track: RACCOON_GROUND_TRACK },
      "frustration-return": { ...frustrationNode("return-ground"), track: RACCOON_GROUND_TRACK },
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
          {
            to: "frustration-ground",
            when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }, ...LOST_TARGET],
          },
          { to: "rush", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
      pursuit: {
        ...chaseNode("ground", GROUND_PURSUIT_SPEED, "frustration-ground", "prepare-charge"),
        allowGroundReposition: true,
        animation: "climb",
        track: RACCOON_GROUND_TRACK,
      },
      "pursuit-drop": {
        ...chaseNode("ground", GROUND_PURSUIT_SPEED, "frustration-ground", "climb"),
        track: RACCOON_GROUND_TRACK,
        transitions: [
          { to: "frustration-ground", when: LOST_TARGET },
          {
            to: "return-ground-staging",
            when: [
              ...DETECTION,
              { kind: "attack-ready" },
              { comparison: "below", distance: KIWI_DROP_ALIGNMENT, kind: "horizontal-gap" },
              RACCOON_CLIMB_CLEAR,
            ],
          },
          {
            to: "pursuit",
            when: [
              ...DETECTION,
              { kind: "attack-ready" },
              { condition: RACCOON_CLIMB_CLEAR, kind: "not" },
            ],
          },
        ],
      },
      // Kiwi charges twice: the second rush follows its own re-aimed tell.
      recharge: {
        animation: "prepare",
        enter: "face-target",
        motion: { kind: "wait" },
        track: RACCOON_GROUND_TRACK,
        transitions: [
          escapeTransition("pursuit"),
          {
            to: "frustration-ground",
            when: [{ kind: "elapsed", seconds: KIWI_RETELL_SECONDS }, ...LOST_TARGET],
          },
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
          { to: "pursuit", when: [{ kind: "boundary" }, { kind: "pursuit-ended" }] },
          { to: "pursuit-drop", when: [{ kind: "boundary" }] },
          { to: "frustration-return", when: [{ kind: "elapsed", seconds: 3.2 }] },
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
      watch: {
        allowIdleReposition: true,
        animation: "idle",
        motion: { kind: "wait" },
        track: RACCOON_GROUND_TRACK,
        transitions: [{ to: "prepare-charge", when: DETECTION }],
      },
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
  },
  [
    {
      committed: ["rush", "rush-second", "charge-rest", "return-ground", "frustration-return"],
      finished: [
        { from: "return-ground", to: "pursuit-drop" },
        { from: "return-ground", to: "pursuit" },
        { from: "recharge", to: "pursuit" },
        { from: "recharge", to: "frustration-ground" },
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

export const RACCOON_BEHAVIOUR = withPursuitIntent(RACCOON_ATTACK_PROFILE, [
  "pursuit",
  "pursuit-drop",
]);

const BEAR_ATTACK_PROFILE: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: -18,
    groundReposition: GROUND_BOSS_REPOSITION,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: "watch",
    pursuit: persistentPursuit({ line: "bini-escaped", speaker: "bear" }),
    spotted: { line: "bini-spotted", speaker: "bear" },
    states: {
      frustration: frustrationNode("pursuit-growl"),
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
          escapeTransition("pursuit-growl"),
          { to: "growl", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
      "prepare-maul": {
        animation: "prepare-attack",
        enter: "face-target",
        motion: { kind: "wait" },
        transitions: [
          escapeTransition("pursuit-maul"),
          { to: "maul", when: [{ kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS }] },
        ],
      },
      pursuit: {
        ...chaseNode("ground", BEAR_PURSUIT_SPEED, "frustration", "prepare-charge"),
        allowGroundReposition: true,
      },
      "pursuit-growl": chaseNode("ground", BEAR_PURSUIT_SPEED, "frustration", "prepare-growl"),
      "pursuit-maul": chaseNode("ground", BEAR_PURSUIT_SPEED, "frustration", "prepare-maul"),
      rest: {
        animation: "rest",
        motion: { kind: "wait" },
        transitions: [{ to: "pursuit-growl", when: [{ kind: "elapsed", seconds: 0.35 }] }],
      },
      rush: {
        animation: "rush",
        motion: { direction: "facing", kind: "move", speed: 31.25 },
        transitions: [
          { to: "pursuit-maul", when: [{ kind: "boundary" }] },
          { to: "pursuit-maul", when: [{ kind: "elapsed", seconds: 0.44 }] },
        ],
      },
      watch: {
        allowIdleReposition: true,
        animation: "idle",
        motion: { kind: "wait" },
        transitions: [{ to: "prepare-growl", when: DETECTION }],
      },
    },
    takeoffAnimation: ANTICIPATION_ANIMATION,
  },
  [
    {
      committed: ["rush"],
      finished: [{ from: "rush", to: "pursuit-maul" }],
      id: "charge",
      tells: { "prepare-charge": ATTACK_ANTICIPATION_SECONDS },
    },
    {
      committed: ["maul", "rest"],
      finished: [{ from: "rest", to: "pursuit-growl" }],
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

export const BEAR_BEHAVIOUR = withPursuitIntent(BEAR_ATTACK_PROFILE, [
  "pursuit",
  "pursuit-growl",
  "pursuit-maul",
]);

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
const PIGEON_OVERHEAD_CLEARANCE = 6;
const PIGEON_SWOOP_AHEAD = 18;
const PIGEON_SWOOP_MIN_GAP = 12;
const PIGEON_RELOCATION_SECONDS = 2;
const PIGEON_RELOCATION_SELECTION = {
  clearance: PIGEON_OVERHEAD_CLEARANCE,
  distance: SCREEN.width / TILE,
  kind: "varied",
  maxAttempts: 4,
  minDistance: SCREEN.width / (4 * TILE),
} as const;

function pigeonOverhead(ahead: number): BehaviourNode["motion"] {
  return {
    kind: "pursue",
    mode: "fly",
    overhead: { ahead, clearance: PIGEON_OVERHEAD_CLEARANCE },
    speed: PIGEON_PURSUIT_SPEED,
  };
}

function pigeonApproach(swoop: boolean, next: string): BehaviourNode {
  const ready = [
    { kind: "arrived", target: "intent", tolerance: 0.1 },
    { kind: "attack-ready" },
    { kind: "line-of-sight" },
    { kind: "targeted-attack-allowed" },
  ] as const;
  return {
    allowIdleReposition: true,
    animation: "fly",
    motion: pigeonOverhead(swoop ? PIGEON_SWOOP_AHEAD : PIGEON_DROP_AHEAD),
    transitions: [
      { to: "return-high", when: [{ kind: "alignment-blocked" }] },
      { to: "frustration-return", when: LOST_TARGET },
      ...(swoop
        ? ([1, -1] as const).map((direction) => ({
            to: direction === 1 ? "prepare-swoop-left" : "prepare-swoop-right",
            when: [
              ...ready,
              { direction, kind: "flight-approach-direction" as const },
              {
                comparison: "at-least" as const,
                distance: PIGEON_SWOOP_MIN_GAP,
                kind: "horizontal-gap" as const,
              },
            ],
          }))
        : [{ to: next, when: ready }]),
      { to: "relocate", when: [{ kind: "elapsed", seconds: PIGEON_RELOCATION_SECONDS }] },
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
    speed: PIGEON_FLIGHT_SPEED,
    to: "target-x",
  };
}
function pigeonDropBurst(side: "left" | "right"): BehaviourPlan["states"] {
  return Object.fromEntries(
    ["", "-2", "-3"].flatMap((suffix, index) => {
      const align = `align-drop-${side}${suffix}`;
      const drop = `drop-${side}${suffix}`;
      const next = index === 2 ? `return-swoop-${side}` : `align-drop-${side}-${index + 2}`;
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

function pigeonSwoop(failure: string, x: number): BehaviourNode {
  return {
    animation: "swoop",
    motion: {
      bounds: { height: 19, width: 16, x, y: -8 },
      kind: "fly",
      speed: PIGEON_SWOOP_SPEED,
      to: "target",
    },
    transitions: [
      { to: failure, when: [{ kind: "arrived", tolerance: 0.6 }] },
      { to: failure, when: [{ kind: "elapsed", seconds: 1.2 }] },
    ],
  };
}

const PIGEON_ATTACK_PROFILE: BehaviourPlan = attackProfile(
  {
    axis: "x",
    distance: 24,
    idleWatchdog: ANIMAL_IDLE_WATCHDOG,
    inactiveAnimation: "idle",
    initial: "watch",
    pursuit: persistentPursuit({ line: "pebble-escaped", speaker: "pigeon" }),
    spotted: { line: "pebble-spotted", speaker: "pigeon" },
    states: {
      ...pigeonDropBurst("left"),
      ...pigeonDropBurst("right"),
      "burst-land-perch": pigeonLanding("burst-recovery"),
      "burst-recovery": {
        animation: "rest",
        motion: { kind: "wait", support: "required" },
        transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.35 }] }],
      },
      "burst-rest-left": {
        animation: "rest",
        motion: { kind: "wait", support: "required" },
        transitions: [{ to: "pursuit-swoop-left", when: [{ kind: "elapsed", seconds: 0.35 }] }],
      },
      "burst-rest-right": {
        animation: "rest",
        motion: { kind: "wait", support: "required" },
        transitions: [{ to: "pursuit-swoop-right", when: [{ kind: "elapsed", seconds: 0.35 }] }],
      },
      "burst-return-high": pigeonLanding("burst-land-perch"),
      "frustration-return": frustrationNode("return-high"),
      "land-perch": pigeonLanding("rest"),
      "prepare-drop-left": {
        animation: "prepare-air",
        motion: pigeonOverhead(PIGEON_DROP_AHEAD),
        transitions: [
          { to: "return-high", when: [{ kind: "alignment-blocked" }] },
          escapeTransition("return-high"),
          {
            to: "align-drop-left",
            when: [
              { kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS },
              { kind: "arrived", tolerance: 0.1 },
              { kind: "line-of-sight" },
              { kind: "targeted-attack-allowed" },
            ],
          },
          { to: "return-high", when: [{ kind: "elapsed", seconds: SPECIAL_TELL_SECONDS }] },
        ],
      },
      "prepare-drop-right": {
        animation: "prepare-air",
        motion: pigeonOverhead(PIGEON_DROP_AHEAD),
        transitions: [
          { to: "return-high", when: [{ kind: "alignment-blocked" }] },
          escapeTransition("return-high"),
          {
            to: "align-drop-right",
            when: [
              { kind: "elapsed", seconds: ATTACK_ANTICIPATION_SECONDS },
              { kind: "arrived", tolerance: 0.1 },
              { kind: "line-of-sight" },
              { kind: "targeted-attack-allowed" },
            ],
          },
          { to: "return-high", when: [{ kind: "elapsed", seconds: SPECIAL_TELL_SECONDS }] },
        ],
      },
      "prepare-swoop-left": {
        animation: "prepare-air",
        motion: pigeonOverhead(PIGEON_SWOOP_AHEAD),
        transitions: [
          { to: "return-high", when: [{ kind: "alignment-blocked" }] },
          escapeTransition("return-high"),
          {
            to: "pursuit-swoop-left",
            when: [{ comparison: "below", distance: PIGEON_SWOOP_MIN_GAP, kind: "horizontal-gap" }],
          },
          {
            to: "swoop-left",
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
      },
      "prepare-swoop-right": {
        animation: "prepare-air",
        motion: pigeonOverhead(PIGEON_SWOOP_AHEAD),
        transitions: [
          { to: "return-high", when: [{ kind: "alignment-blocked" }] },
          escapeTransition("return-high"),
          {
            to: "pursuit-swoop-right",
            when: [{ comparison: "below", distance: PIGEON_SWOOP_MIN_GAP, kind: "horizontal-gap" }],
          },
          {
            to: "swoop-right",
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
      },
      pursuit: pigeonApproach(false, "prepare-drop-left"),
      "pursuit-burst-right": pigeonApproach(false, "prepare-drop-right"),
      "pursuit-swoop-left": pigeonApproach(true, "prepare-swoop-left"),
      "pursuit-swoop-right": pigeonApproach(true, "prepare-swoop-right"),
      relocate: {
        animation: "fly",
        motion: {
          kind: "fly",
          selection: PIGEON_RELOCATION_SELECTION,
          speed: PIGEON_FLIGHT_SPEED,
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
            to: "watch",
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
            to: "watch",
            when: [
              { kind: "elapsed", seconds: PIGEON_RELOCATION_SECONDS },
              { kind: "pursuit-ended" },
            ],
          },
          { to: "relocate", when: [{ kind: "elapsed", seconds: PIGEON_RELOCATION_SECONDS }] },
        ],
      },
      "return-high": pigeonLanding("land-perch"),
      "return-swoop-left": pigeonLanding("burst-rest-left"),
      "return-swoop-right": pigeonLanding("burst-rest-right"),
      "swoop-land-left": pigeonLanding("swoop-rest-left"),
      "swoop-land-right": pigeonLanding("swoop-rest-right"),
      "swoop-left": pigeonSwoop("swoop-return-left", -20),
      "swoop-rest-left": {
        animation: "rest",
        motion: { kind: "wait", support: "required" },
        transitions: [{ to: "pursuit-burst-right", when: [{ kind: "elapsed", seconds: 0.35 }] }],
      },
      "swoop-rest-right": {
        animation: "rest",
        motion: { kind: "wait", support: "required" },
        transitions: [{ to: "pursuit", when: [{ kind: "elapsed", seconds: 0.35 }] }],
      },
      "swoop-return-left": pigeonLanding("swoop-land-left"),
      "swoop-return-right": pigeonLanding("swoop-land-right"),
      "swoop-right": pigeonSwoop("swoop-return-right", 4),
      watch: {
        allowIdleReposition: true,
        animation: "idle",
        motion: { kind: "wait" },
        transitions: [{ to: "pursuit", when: DETECTION }],
      },
    },
  },
  [
    {
      committed: [
        "align-drop-left",
        "drop-left",
        "align-drop-left-2",
        "drop-left-2",
        "align-drop-left-3",
        "drop-left-3",
        "align-drop-right",
        "drop-right",
        "align-drop-right-2",
        "drop-right-2",
        "align-drop-right-3",
        "drop-right-3",
        "return-swoop-left",
        "burst-rest-left",
        "return-swoop-right",
        "burst-rest-right",
        "burst-return-high",
        "burst-land-perch",
        "burst-recovery",
      ],
      finished: [
        { from: "burst-rest-left", to: "pursuit-swoop-left" },
        { from: "burst-rest-right", to: "pursuit-swoop-right" },
        { from: "burst-recovery", to: "pursuit" },
      ],
      id: "drop-burst",
      tells: {
        "prepare-drop-left": SPECIAL_TELL_SECONDS,
        "prepare-drop-right": SPECIAL_TELL_SECONDS,
      },
    },
    {
      committed: [
        "swoop-left",
        "swoop-right",
        "swoop-return-left",
        "swoop-return-right",
        "swoop-land-left",
        "swoop-land-right",
        "swoop-rest-left",
        "swoop-rest-right",
      ],
      finished: [
        { from: "swoop-rest-left", to: "pursuit-burst-right" },
        { from: "swoop-rest-right", to: "pursuit" },
      ],
      id: "swoop",
      tells: {
        "prepare-swoop-left": SPECIAL_TELL_SECONDS,
        "prepare-swoop-right": SPECIAL_TELL_SECONDS,
      },
    },
  ],
);

export const PIGEON_BEHAVIOUR = withPursuitIntent(PIGEON_ATTACK_PROFILE, [
  "pursuit",
  "pursuit-burst-right",
  "pursuit-swoop-left",
  "pursuit-swoop-right",
]);
