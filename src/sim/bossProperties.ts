import { insetRect, rectsOverlap } from "@andornaut/game-kit/rect";

import {
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
import type { BehaviourPlan, ZoneLayout } from "../data/types";
import { EDGE } from "../rules/bird";
import { STEP_SECONDS } from "../rules/step";
import { BOSSES, type BossTick } from "./bossSimulator";

// Boss rules from gameplay/design.md as checks over a boss trace. Thresholds are read from the
// zone's resolved behaviour data; the stall window and step bound state their multiples of it.

const DESIGN = "gameplay/design.md";
export const RULES = {
  attackSequencing: `${DESIGN} Objects: Attack sequencing`,
  attackTells: `${DESIGN} Objects: Attack tells`,
  deferral: `${DESIGN} Forced transit: Deferral`,
  enemyPursuit: `${DESIGN} Objects: Enemy pursuit`,
  flight: `${DESIGN} Boss encounter principles: Flight`,
  idleRecovery: `${DESIGN} Objects: Idle recovery`,
  pebbleCycle: `${DESIGN} Pebble encounter: Cycle`,
  recovery: `${DESIGN} Boss encounter principles: Recovery`,
  traversal: `${DESIGN} Boss encounter principles: Traversal and variety`,
} as const;

// Each boss character's resolved plan in the layout.
export function bossPlans(layout: ZoneLayout): ReadonlyMap<string, BehaviourPlan> {
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
export function fastestSpeed(plan: BehaviourPlan): number {
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

export function bossProperties(layout: ZoneLayout): Property<BossTick>[] {
  const plans = bossPlans(layout);
  const plan = (agent: AgentSample) => plans.get(agent.kind)!;
  const watchdog = (agent: AgentSample) => plan(agent).idleWatchdog!;
  const intentOffset = (agent: AgentSample) => {
    const intent = Object.values(plan(agent).states).find(
      ({ motion }) => motion.kind === "pursue" && motion.intent,
    )?.motion;
    return intent?.kind === "pursue" && intent.intent ? intent.intent.offset.max : 0;
  };
  const watchdogSeconds = Math.max(
    ...[...plans.values()].map((entry) => entry.idleWatchdog!.seconds),
  );
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
    // The watchdog allows a recovery search after its period; a stall over two periods means
    // no recovery or pursuit moved the boss. A boss within its pursuit intent offset of Chibi
    // may hold position.
    noStall(
      RULES.idleRecovery,
      STEP_SECONDS,
      2 * watchdogSeconds,
      (agent) => watchdog(agent).minMovement,
      ({ target }, agent) => {
        if (agent.pursuit !== "engaged" || agent.attack) {
          return false;
        }
        const gap = Math.max(
          target.at.x - (agent.at.x + agent.width),
          agent.at.x - (target.at.x + target.width),
        );
        return gap > intentOffset(agent);
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
