import { rectsOverlap } from "@andornaut/game-kit/rect";

import type { AgentSample, AgentTick } from "../ai/agentTrace";
import { simulate, type SimulationController, type SimulationModel } from "../ai/simulation";
import { EDGE, STEP_SECONDS } from "../core";
import { BOSS_CHARACTERS } from "../data/achievements";
import type {
  BirdTuning,
  ObjectLayout,
  Point,
  Rect,
  TargetedAttackWindow,
  ZoneLayout,
} from "../data/types";
import { SKILL_PROFILES } from "../progress";
import { contactBox, nodeOf } from "../rules/behaviourTrack";
import { birdBox, startBird } from "../rules/bird";
import { supportContact } from "../rules/flyLanding";
import {
  activateBehaviour,
  areaOf,
  retryZone,
  startZone,
  stepZoneBodies,
  type ZoneInput,
  type ZoneState,
} from "../rules/zone";
import { presentTerrain, supportPresent } from "../rules/zoneCrumbling";
import { botInput, type BotPolicy, type BotSkill, newBot, prepareSensors } from "./bot";

// The six bosses by character, in character order, with the names gameplay uses for them.
export const BOSSES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(BOSS_CHARACTERS)
    .map(([boss, character]) => [character, boss.charAt(0).toUpperCase() + boss.slice(1)])
    .sort(([a], [b]) => a!.localeCompare(b!)),
);

interface BossWorldSample {
  // Indices of the area's terrain rects that crumbling has removed at the end of the tick.
  readonly absentTerrain: readonly number[];
  readonly area: string;
  // Each crumbling support's phase, the actors in standing or pending support contacts (chibi,
  // agent ids or transients), and the bosses whose contact box rests on a present crumbling
  // support.
  readonly crumbling?: {
    readonly bosses: readonly string[];
    readonly phases: readonly string[];
    readonly standing: readonly string[];
  };
  // The dead bosses' agent ids.
  readonly defeated: readonly string[];
  // The targeted-attack window the bosses perceived during the tick.
  readonly targetedAttackWindow: TargetedAttackWindow;
  readonly transients: number;
}

export type BossTick = AgentTick<BossWorldSample>;

const isBoss = (object: ObjectLayout) => object.character in BOSSES;

// Present terrain and supports at the end of a tick, as the support check reads them.
function supportWorld(layout: ZoneLayout, zone: ZoneState) {
  const area = areaOf(layout, zone.area);
  const platforms = area.objects.flatMap((object, index) =>
    (object.collision === "solid" || object.collision === "ledge") &&
    supportPresent(zone.crumbling, object)
      ? [
          {
            collision: object.collision,
            owner: object,
            rect: {
              ...(zone.objects[index] ?? object.origin),
              height: object.height,
              width: object.width,
            },
          },
        ]
      : [],
  );
  return { platforms, solids: presentTerrain(zone.crumbling, area.solids) };
}

function footing(world: ReturnType<typeof supportWorld>, box: Rect): boolean {
  const bottom = box.y + box.height;
  return [...world.solids, ...world.platforms.map(({ rect }) => rect)].some(
    (rect) =>
      Math.abs(rect.y - bottom) <= EDGE &&
      box.x < rect.x + rect.width &&
      rect.x < box.x + box.width,
  );
}

// Whether a box's bottom rests on one of the area's present crumbling supports.
function onCrumbling(
  area: ReturnType<typeof areaOf>,
  world: ReturnType<typeof supportWorld>,
  box: Rect,
): boolean {
  const rects = (area.crumbling ?? []).flatMap(({ supportId }) =>
    "character" in supportId
      ? world.platforms.filter(({ owner }) => owner === supportId).map(({ rect }) => rect)
      : world.solids.includes(supportId)
        ? [supportId]
        : [],
  );
  return footing({ platforms: [], solids: rects }, box);
}

// One tick of every boss in the current area and of Chibi, from the zone after the step.
export function bossSample(
  tuning: BirdTuning,
  layout: ZoneLayout,
  tick: number,
  after: ZoneState,
): BossTick {
  const area = areaOf(layout, after.area);
  const world = supportWorld(layout, after);
  const agents = area.objects.flatMap((object, index): AgentSample[] => {
    const state = after.behaviours[index];
    // A dead boss leaves the agent checks.
    if (!isBoss(object) || !state || state.defeat) {
      return [];
    }
    const at = after.objects[index] ?? object.origin;
    const { motion } = nodeOf(object, state.stateKey);
    return [
      {
        at,
        ...(state.activeAttack && { attack: state.activeAttack }),
        ...(state.attackCooldownRemainingSeconds !== undefined && {
          cooldownSeconds: state.attackCooldownRemainingSeconds,
        }),
        facing: state.facing,
        footing: footing(world, contactBox(object, at, state.facing, state.axis)),
        height: object.height,
        id: `${after.area}:${index}`,
        kind: object.character,
        motion: motion.kind === "pursue" ? `pursue-${motion.mode}` : motion.kind,
        ...(state.traversal?.preparation && { preparing: true }),
        ...(state.pursuit && { pursuit: state.pursuit.phase }),
        state: state.stateKey,
        supported: supportContact(object, world, at),
        ...(state.tellPauseRemainingSeconds !== undefined && {
          tellPauseSeconds: state.tellPauseRemainingSeconds,
        }),
        width: object.width,
      },
    ];
  });
  return {
    agents,
    episode: after.attempt,
    ...(after.death && { failure: after.death.reason }),
    seconds: after.seconds,
    target: {
      at: { x: after.bird.x, y: after.bird.y },
      grounded: after.bird.grounded,
      height: tuning.height,
      velocity: { x: after.bird.vx, y: after.bird.vy },
      width: tuning.width,
    },
    tick,
    world: {
      absentTerrain: area.solids.flatMap((rect, index) =>
        world.solids.includes(rect) ? [] : [index],
      ),
      area: after.area,
      defeated: area.objects.flatMap((object, index) =>
        isBoss(object) && after.behaviours[index]?.defeat ? [`${after.area}:${index}`] : [],
      ),
      ...(after.crumbling && {
        crumbling: {
          bosses: agents.flatMap(({ at, facing, id }) => {
            const object = area.objects[Number(id.split(":")[1])]!;
            return onCrumbling(area, world, contactBox(object, at, facing, "x")) ? [id] : [];
          }),
          phases: after.crumbling.supports.map(({ phase }) => phase.kind),
          standing: [...after.crumbling.standingContacts, ...after.crumbling.pendingContacts].map(
            ({ actorId }) =>
              typeof actorId === "string"
                ? actorId
                : `${after.area}:${area.objects.indexOf(actorId)}`,
          ),
        },
      }),
      targetedAttackWindow: after.forcedTransit?.attackWindow ?? "allowed",
      transients: after.transients.length,
    },
  };
}

export const activateAll = (zone: ZoneState): ZoneState =>
  zone.behaviours.reduce((state, _, index) => activateBehaviour(index, state), zone);

// Where Chibi's box leaves the area, as the zone step decides it: the stage exit or last column
// clears, the first column turns back. A walk link at either edge also leaves the area.
export function areaExit(
  tuning: BirdTuning,
  layout: ZoneLayout,
  zone: ZoneState,
): "cleared" | "turned-back" | undefined {
  const area = areaOf(layout, zone.area);
  const box = birdBox(tuning, zone.bird);
  if (layout.stageExit) {
    if (layout.stageExit.area === zone.area && rectsOverlap(box, layout.stageExit.rect)) {
      return "cleared";
    }
  } else if (box.x + box.width > area.exitX) {
    return "cleared";
  }
  if (box.x < area.backX) {
    return "turned-back";
  }
  // With a stage exit elsewhere, the last column leaves only through a walk link.
  return box.x + box.width > area.exitX && area.walkLinks?.right ? "cleared" : undefined;
}

// Where a scripted setup places Chibi's feet centre at the start of a tick, if anywhere.
type ChibiPlacement = (tick: number) => Point | undefined;

export function placeChibi(
  tuning: BirdTuning,
  place: ChibiPlacement | undefined,
  tick: number,
  zone: ZoneState,
): ZoneState {
  const at = place?.(tick);
  return at ? { ...zone, bird: startBird(tuning, at) } : zone;
}

// The boss pipeline and the physics it perceives: object frames with every behaviour object's
// perceive, decide and act, crumbling, forced transit and Chibi's body, contact and death.
// Barks, doors, walk links and the stage exit are left out; leaving the area ends the run,
// and a death retries with every behaviour active. A placement for the next tick applies at
// the end of each step, so the step's sample records where the bosses next perceive Chibi.
export function bossModel(
  tuning: BirdTuning,
  layout: ZoneLayout,
  place?: ChibiPlacement,
): SimulationModel<ZoneState, ZoneInput, BossTick> {
  let stepped = 0;
  return {
    begin: (zone) => (zone.death ? activateAll(retryZone(tuning, layout, zone)) : zone),
    finished: (zone) => areaExit(tuning, layout, zone) !== undefined,
    sample: (tick, _, after) => bossSample(tuning, layout, tick, after),
    step: (seconds, input, zone) =>
      placeChibi(
        tuning,
        place,
        ++stepped,
        stepZoneBodies(SKILL_PROFILES, tuning, layout, seconds, input, zone).zone,
      ),
  };
}

export type BossController = SimulationController<ZoneState, ZoneInput>;

// A scripted Chibi: a pure function of the tick.
export function scriptedChibi(script: (tick: number) => ZoneInput): BossController {
  return (tick) => script(tick);
}

// The reactive bot with its own seeded stream.
export function botChibi(
  tuning: BirdTuning,
  layout: ZoneLayout,
  skill: BotSkill,
  policy: BotPolicy,
  seed: number,
): BossController {
  const sensors = prepareSensors(layout);
  const bot = newBot(seed);
  return (_, zone) => botInput(tuning, sensors, layout, skill, policy, zone, bot);
}

export interface BossScenario {
  // Chibi's input; a bot owns its own seeded stream.
  readonly controller: (tuning: BirdTuning, layout: ZoneLayout) => BossController;
  readonly layout: () => ZoneLayout;
  readonly name: string;
  // Chibi's scripted placements, for setups a walk cannot reach deterministically.
  readonly place?: ChibiPlacement;
  // The zone seed: object tracks and boss decisions draw from it.
  readonly seed: number;
  readonly start?: (layout: ZoneLayout, zone: ZoneState) => ZoneState;
  readonly ticks: number;
}

export function bossStart(tuning: BirdTuning, layout: ZoneLayout, scenario: BossScenario) {
  const zone = activateAll(startZone(tuning, layout, scenario.seed));
  return placeChibi(
    tuning,
    scenario.place,
    0,
    scenario.start ? scenario.start(layout, zone) : zone,
  );
}

export function simulateBosses(tuning: BirdTuning, scenario: BossScenario) {
  const layout = scenario.layout();
  return simulate(
    { maxTicks: scenario.ticks, stepSeconds: STEP_SECONDS },
    bossModel(tuning, layout, scenario.place),
    scenario.controller(tuning, layout),
    bossStart(tuning, layout, scenario),
  );
}

// What a scenario must exercise for its properties to mean anything.
// limited-move: a state whose move has a distance, such as Trixi's slide.
export type BossCoverage =
  | "attack"
  | "boss-death"
  | "boss-on-crumbling"
  | "deferred-window"
  | "limited-move"
  | "retell"
  | "tell"
  | "tell-pause";

export function observedCoverage(
  layout: ZoneLayout,
  ticks: readonly BossTick[],
): ReadonlySet<BossCoverage> {
  const seen = new Set<BossCoverage>();
  for (const { agents, world } of ticks) {
    for (const { attack, id, state, tellPauseSeconds } of agents) {
      if (attack) {
        seen.add(attack.phase === "tell" ? "tell" : "attack");
      }
      if (attack?.continues) {
        seen.add("retell");
      }
      if (tellPauseSeconds !== undefined) {
        seen.add("tell-pause");
      }
      const [area, index] = id.split(":");
      const { motion } = nodeOf(layout.areas[area!]!.objects[Number(index)]!, state);
      if (motion.kind === "move" && motion.distance !== undefined) {
        seen.add("limited-move");
      }
      if (world.crumbling?.bosses.includes(id)) {
        seen.add("boss-on-crumbling");
      }
    }
    if (world.targetedAttackWindow === "deferred") {
      seen.add("deferred-window");
    }
    if (world.defeated.length > 0) {
      seen.add("boss-death");
    }
  }
  return seen;
}
