import { insetRect, rectsOverlap } from "@andornaut/game-kit/rect";

import {
  attackCadence,
  boundedStep,
  cancelledTellKeepsCooldown,
  cooldownHonoured,
  escapeAtDistance,
  everyTick,
  noAttackWhileEscaped,
  noStall,
  type Property,
  singleCommittedAttack,
  tellBounded,
  tellPrecedesCommit,
  tellStarts,
} from "../ai/agentProperties";
import type { AgentSample } from "../ai/agentTrace";
import { EDGE, STEP_SECONDS } from "../core";
import { TILE } from "../data/screen";
import type { BehaviourPlan, Rect, ZoneLayout } from "../data/types";
import { contactBox } from "../rules/behaviourTrack";
import { BOSSES, type BossTick } from "./bossSimulator";

// Boss rules from gameplay/design.md as checks over a boss trace. Thresholds are read from the
// zone's resolved behaviour data, or are the design's own bounds where data has none.

const DESIGN = "gameplay/design.md";
const RULES = {
  attackCadence: `${DESIGN} Objects: Animals`,
  attackSequencing: `${DESIGN} Objects: Attack sequencing`,
  attackTells: `${DESIGN} Objects: Attack tells`,
  bossDeath: `${DESIGN} Objects: Boss death`,
  deferral: `${DESIGN} Forced transit: Deferral`,
  enemyPursuit: `${DESIGN} Objects: Enemy pursuit`,
  flight: `${DESIGN} Boss encounter principles: Flight`,
  idleRecovery: `${DESIGN} Objects: Idle recovery`,
  pebbleCycle: `${DESIGN} Pebble encounter: Cycle`,
  recovery: `${DESIGN} Boss encounter principles: Recovery`,
  traversal: `${DESIGN} Boss encounter principles: Traversal and variety`,
} as const;

// Each boss character's resolved plan in the layout.
function bossPlans(layout: ZoneLayout): ReadonlyMap<string, BehaviourPlan> {
  const plans = new Map<string, BehaviourPlan>();
  for (const area of Object.values(layout.areas)) {
    for (const object of area.objects) {
      if (object.character in BOSSES && object.behaviour) {
        plans.set(object.character, object.behaviour);
      }
    }
  }
  return plans;
}

const attackStates = (plan: BehaviourPlan, id: string, phase: "committed" | "tell") =>
  Object.entries(plan.states).filter(
    ([, node]) => node.attack?.id === id && node.attack.phase === phase,
  );

const elapsedSeconds = (plan: BehaviourPlan, from: string, to: (key: string) => boolean) =>
  plan.states[from]!.transitions.flatMap(({ to: key, when }) =>
    to(key)
      ? when.flatMap((condition) => (condition.kind === "elapsed" ? [condition.seconds] : []))
      : [],
  );

// The shortest authored tell before an attack's committed state.
export function minimumTellSeconds(plan: BehaviourPlan, id: string): number {
  const committed = new Set(attackStates(plan, id, "committed").map(([key]) => key));
  const seconds = attackStates(plan, id, "tell").flatMap(([key]) =>
    elapsedSeconds(plan, key, (to) => committed.has(to)),
  );
  if (seconds.length === 0) {
    throw new Error(`No authored tell before ${id}`);
  }
  return Math.min(...seconds);
}

// The longest authored tell deadline of an attack, committed or cancelled.
export function maximumTellSeconds(plan: BehaviourPlan, id: string): number {
  const tells = new Set(attackStates(plan, id, "tell").map(([key]) => key));
  const seconds = [...tells].flatMap((key) => elapsedSeconds(plan, key, (to) => !tells.has(to)));
  if (seconds.length === 0) {
    throw new Error(`No authored tell deadline for ${id}`);
  }
  return Math.max(...seconds);
}

// Idle recovery: while engaged and more than two tiles from Chibi, a boss moves half a tile
// horizontally (the watchdog's minimum movement) within every four seconds.
const STALL_BOUND = { distance: 2 * TILE, seconds: 4 } as const;

// Objects: each boss starts a charge or special tell within 10 s of eligible engaged time, and
// its distinct special tell within 20 s.
const CADENCE_SECONDS = { any: 10, special: 20 } as const;

// Each boss's charge or contact dive; its other attacks are its specials.
export const CHARGE_ATTACKS: Readonly<Record<string, string>> = {
  "bear-antagonist": "charge",
  "dog-antagonist": "charge",
  "ferret-antagonist": "charge",
  "goose-antagonist": "charge",
  "pigeon-antagonist": "swoop",
  "raccoon-antagonist": "charge",
};

// The attacks forced-transit deferral holds back: Pebble's targeted swoop and aimed poop burst.
export const DEFERRED_ATTACKS: Readonly<Record<string, readonly string[]>> = {
  "pigeon-antagonist": ["drop-burst", "swoop"],
};

// Attacks whose tell is entered only while the targeted-attack window allows it.
export function targetedAttacks(plan: BehaviourPlan): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const node of Object.values(plan.states)) {
    for (const { to, when } of node.transitions) {
      const target = plan.states[to]?.attack;
      if (target?.phase === "tell" && when.some(({ kind }) => kind === "targeted-attack-allowed")) {
        ids.add(target.id);
      }
    }
  }
  return ids;
}

// The fastest authored travel: state speeds, ground traversal launch and fall, and hop rise.
function fastestSpeed(plan: BehaviourPlan): number {
  return Math.max(
    ...Object.values(plan.states).flatMap(({ motion }) => [
      motion.kind === "wait" ? 0 : motion.speed,
      ...(motion.kind === "pursue" && motion.mode === "ground" && motion.traversal
        ? [motion.traversal.jumpSpeed, motion.traversal.maxFallSpeed]
        : []),
      ...(motion.kind === "hop" ? [(4 * motion.hopHeight) / motion.hopSeconds] : []),
    ]),
  );
}

const flies = (plan: BehaviourPlan) =>
  Object.values(plan.states).some(
    ({ motion }) => motion.kind === "fly" || (motion.kind === "pursue" && motion.mode === "fly"),
  );

// Each tell id a plan can start.
export function tellAttacks(plan: BehaviourPlan): ReadonlySet<string> {
  return new Set(
    Object.values(plan.states).flatMap(({ attack }) =>
      attack?.phase === "tell" ? [attack.id] : [],
    ),
  );
}

// Rearming after escape: from the tick Chibi settles past cover, each boss present then crosses
// edge (a pixel x on the cover between them) with its body centre on his side within seconds.
// Without a settling tick, he settles where he stands still on the ground for the rest of the
// run. A scenario-specific check: the edge names cover the boss can clear.
export function crossesAfterSettle(
  edge: number,
  seconds: number,
  settledTick?: number,
): Property<BossTick> {
  return {
    check: (ticks) => {
      const last = ticks.at(-1);
      if (!last) {
        return [];
      }
      const still = (tick: BossTick) =>
        tick.episode === last.episode &&
        tick.target.grounded &&
        tick.target.at.x === last.target.at.x &&
        tick.target.at.y === last.target.at.y;
      let settled = ticks.findIndex(({ tick }) => tick === settledTick);
      if (settled < 0) {
        settled = ticks.length - 1;
        while (settled > 0 && still(ticks[settled - 1]!)) {
          settled--;
        }
      }
      const from = ticks[settled]!;
      const deadline = from.tick + Math.round(seconds / STEP_SECONDS);
      const side = Math.sign(from.target.at.x + from.target.width / 2 - edge);
      const across = (agent: AgentSample) =>
        Math.sign(agent.at.x + agent.width / 2 - edge) === side;
      return from.agents.flatMap(({ id }) =>
        ticks
          .slice(settled)
          .some(
            ({ agents, tick }) =>
              tick <= deadline && agents.some((agent) => agent.id === id && across(agent)),
          )
          ? []
          : [
              {
                agent: id,
                detail: `not across x ${edge} within ${seconds} s of Chibi settling at tick ${from.tick}`,
                tick: Math.min(deadline, last.tick),
              },
            ],
      );
    },
    id: "rearm-crossing",
    rule: RULES.enemyPursuit,
  };
}

export function bossProperties(layout: ZoneLayout): Property<BossTick>[] {
  const plans = bossPlans(layout);
  const plan = (agent: AgentSample) => plans.get(agent.kind)!;
  const watchdog = (agent: AgentSample) => plan(agent).idleWatchdog!;
  const objectOf = (agent: AgentSample) => {
    const [area, index] = agent.id.split(":");
    return layout.areas[area!]!.objects[Number(index)]!;
  };
  const committedGroundMove = (agent: AgentSample) => {
    const node = plan(agent).states[agent.state]!;
    return !flies(plan(agent)) && node.motion.kind === "move" && node.attack?.phase === "committed";
  };
  // Whether a box's bottom rests on present terrain over part of its width.
  const onTerrain = (tick: BossTick, box: Rect) =>
    layout.areas[tick.world.area]!.solids.some(
      (rect, index) =>
        !tick.world.absentTerrain.includes(index) &&
        Math.abs(rect.y - box.y - box.height) <= EDGE &&
        box.x < rect.x + rect.width &&
        rect.x < box.x + box.width,
    );
  // Engaged and ready, with an attack the targeted-attack window does not hold back.
  const cadenceEligible =
    (special: boolean) =>
    (tick: BossTick, agent: AgentSample): boolean => {
      if (
        agent.pursuit !== "engaged" ||
        agent.attack !== undefined ||
        (agent.cooldownSeconds ?? 0) > 0
      ) {
        return false;
      }
      const deferred =
        tick.world.targetedAttackWindow === "deferred" ? (DEFERRED_ATTACKS[agent.kind] ?? []) : [];
      return [...tellAttacks(plan(agent))].some(
        (id) => (!special || id !== CHARGE_ATTACKS[agent.kind]) && !deferred.includes(id),
      );
    };
  return [
    tellPrecedesCommit(RULES.attackTells, STEP_SECONDS, (agent, id) =>
      minimumTellSeconds(plan(agent), id),
    ),
    tellBounded(RULES.attackTells, STEP_SECONDS, (agent, id) =>
      maximumTellSeconds(plan(agent), id),
    ),
    singleCommittedAttack(RULES.recovery),
    cooldownHonoured(
      RULES.attackSequencing,
      STEP_SECONDS,
      (agent) => plan(agent).attackCooldownSeconds!,
    ),
    cancelledTellKeepsCooldown(RULES.attackSequencing),
    noStall(
      RULES.idleRecovery,
      STEP_SECONDS,
      STALL_BOUND.seconds,
      (agent) => watchdog(agent).minMovement,
      ({ target }, agent) => {
        if (agent.pursuit !== "engaged") {
          return false;
        }
        const gap = Math.max(
          target.at.x - (agent.at.x + agent.width),
          agent.at.x - (target.at.x + target.width),
        );
        return gap > STALL_BOUND.distance;
      },
    ),
    escapeAtDistance(RULES.enemyPursuit, (agent) => plan(agent).pursuit?.escapeDistance),
    noAttackWhileEscaped(RULES.enemyPursuit),
    // Twice the fastest authored speed leaves room for carrying support.
    boundedStep(RULES.enemyPursuit, (agent) => 2 * fastestSpeed(plan(agent)) * STEP_SECONDS),
    everyTick("flight-clearance", RULES.flight, (tick, agent) => {
      if (!flies(plan(agent))) {
        return undefined;
      }
      const body = insetRect(EDGE, { ...agent.at, height: agent.height, width: agent.width });
      const { absentTerrain, area } = tick.world;
      return layout.areas[area]!.solids.some(
        (rect, index) => !absentTerrain.includes(index) && rectsOverlap(body, rect),
      )
        ? `body overlaps terrain at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)}`
        : undefined;
    }),
    // A ground boss off support is in a jump or fall, so its height changes every step.
    everyTick("ground-footing", RULES.traversal, (_, agent, previous) =>
      !flies(plan(agent)) &&
      !agent.footing &&
      previous !== undefined &&
      !previous.footing &&
      Math.abs(agent.at.y - previous.at.y) <= EDGE
        ? `held at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)} without support, ${agent.state}`
        : undefined,
    ),
    // A committed ground rush stays inside the area and does not step off present support; it
    // falls only when that support has gone.
    everyTick("ledge-stop", RULES.enemyPursuit, (tick, agent, previous) => {
      if (!committedGroundMove(agent)) {
        return undefined;
      }
      const object = objectOf(agent);
      const box = contactBox(object, agent.at, agent.facing, "x");
      if (box.x < -EDGE || box.x + box.width > layout.areas[tick.world.area]!.width + EDGE) {
        return `${agent.state} past the area edge at ${agent.at.x.toFixed(1)}`;
      }
      return previous?.footing &&
        !agent.footing &&
        onTerrain(tick, contactBox(object, previous.at, previous.facing, "x"))
        ? `${agent.state} left present support at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)}`
        : undefined;
    }),
    attackCadence(
      "attack-cadence",
      RULES.attackCadence,
      STEP_SECONDS,
      CADENCE_SECONDS.any,
      () => true,
      cadenceEligible(false),
    ),
    attackCadence(
      "special-cadence",
      RULES.attackCadence,
      STEP_SECONDS,
      CADENCE_SECONDS.special,
      (agent, id) => id !== CHARGE_ATTACKS[agent.kind],
      cadenceEligible(true),
    ),
    // A boss on a stationary red hazard or below the level is dead, so no live agent is there.
    everyTick("boss-death", RULES.bossDeath, (tick, agent) => {
      const area = layout.areas[tick.world.area]!;
      const box = contactBox(objectOf(agent), agent.at, agent.facing, "x");
      if (box.y > area.height) {
        return `alive below the level at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)}`;
      }
      return area.objects.some(
        (object) =>
          object.collision === "hazard" &&
          !object.behaviour &&
          object.motion.algorithm === "static" &&
          rectsOverlap(box, {
            ...(object.hitbox ?? { height: object.height, width: object.width, x: 0, y: 0 }),
            x: object.origin.x + (object.hitbox?.x ?? 0),
            y: object.origin.y + (object.hitbox?.y ?? 0),
          }),
      )
        ? `alive on a red hazard at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)}`
        : undefined;
    }),
    // A flyer's flight and landing paths check hazards, so no flying boss dies on one.
    {
      check: (ticks) => {
        const found = new Set<string>();
        return ticks.flatMap((tick) =>
          tick.world.defeated.flatMap((id) => {
            const [area, index] = id.split(":");
            const object = layout.areas[area!]!.objects[Number(index)]!;
            if (found.has(id) || !flies(object.behaviour!)) {
              return [];
            }
            found.add(id);
            return [{ agent: id, detail: `${object.character} died`, tick: tick.tick }];
          }),
        );
      },
      id: "flyer-alive",
      rule: RULES.bossDeath,
    },
    everyTick("supported-completion", RULES.pebbleCycle, (_, agent, previous) =>
      flies(plan(agent)) &&
      previous?.attack?.phase === "committed" &&
      !agent.attack &&
      !agent.supported &&
      !previous.supported
        ? `${previous.attack.id} completed without support`
        : undefined,
    ),
    everyTick("targeted-attack-deferral", RULES.deferral, (tick, agent, previous) =>
      tick.world.targetedAttackWindow === "deferred" &&
      tellStarts(previous, agent) &&
      (DEFERRED_ATTACKS[agent.kind] ?? []).includes(agent.attack!.id)
        ? `${agent.attack!.id} tell during a deferred window`
        : undefined,
    ),
  ];
}
