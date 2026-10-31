import type { BirdTuning, ZoneDeath, ZoneLayout } from "../data/types";
import { birdBox } from "../rules/bird";
import { stageProgress } from "../rules/stageProgress";
import { STEP_SECONDS } from "../rules/step";
import {
  activateBehaviour,
  areaOf,
  retryZone,
  startZone,
  stepZone,
  type ZoneState,
} from "../rules/zone";
import { proximityDialogue } from "../view/zoneDialogue";
import {
  botInput,
  type BotPolicy,
  type BotSkill,
  newBot,
  prepareSensors,
  type SensorIndex,
} from "./bot";
import { type TraceEvent, traceEvent, type TraceOptions } from "./diagnostics";
import { layoutAtStart, type SimulationStart, validateStart } from "./start";

export interface SimulationSeeds {
  readonly bot: number;
  readonly layout: number;
  readonly motion: number;
}
export interface SimulationProvenance {
  readonly build?: string;
  readonly data?: string;
}

export interface SimulationConfig {
  readonly goal?: { readonly area: string; readonly x: number };
  readonly provenance?: SimulationProvenance;
  readonly seeds?: Partial<SimulationSeeds>;
  readonly start?: SimulationStart;
  readonly trace?: TraceOptions;
  readonly maxRetries: number;
  readonly maxSteps: number;
  readonly policy: BotPolicy;
  readonly seed: number;
  readonly skill: BotSkill;
}
export type RunStatus = "cleared" | "goal-reached" | "retry-budget" | "step-budget" | "turned-back";
export interface RunResult {
  readonly config: SimulationConfig;
  readonly provenance: SimulationProvenance;
  readonly tuning: BirdTuning;
  readonly seeds: SimulationSeeds;
  readonly start: { readonly area: string; readonly x: number; readonly y: number };
  readonly trace: readonly TraceEvent[];
  readonly traceDropped: number;
  readonly activeSeconds: number;
  readonly deaths: number;
  readonly deathsByReason: Readonly<Record<ZoneDeath["reason"], number>>;
  readonly dialogues: number;
  readonly peakProgress: number;
  readonly progress: number;
  readonly retries: number;
  readonly runtimeMs: number;
  readonly seed: number;
  readonly status: RunStatus;
  readonly successfulAttemptSeconds?: number;
  readonly steps: number;
}
export interface PreparedStage {
  readonly source?: {
    readonly chunkIds?: Readonly<Record<string, readonly string[]>>;
    readonly layoutSeed?: number;
    readonly provenance?: SimulationProvenance;
  };
  readonly introductions: Readonly<Record<string, boolean>>;
  readonly layout: ZoneLayout;
  readonly sensors: SensorIndex;
}
export function prepareStage(layout: ZoneLayout): PreparedStage {
  return {
    introductions: Object.fromEntries(
      Object.entries(layout.areas).map(([key, area]) => [
        key,
        area.objects.some((object) => object.behaviour !== undefined && object.scene !== undefined),
      ]),
    ),
    layout,
    sensors: prepareSensors(layout),
  };
}

export function simulationSeeds(config: Pick<SimulationConfig, "seed" | "seeds">): SimulationSeeds {
  return {
    bot: config.seeds?.bot ?? config.seed,
    layout: config.seeds?.layout ?? config.seed,
    motion: config.seeds?.motion ?? config.seed,
  };
}

export function validateSimulation(config: SimulationConfig): void {
  for (const [name, value, min] of [
    ["maxSteps", config.maxSteps, 1],
    ["maxRetries", config.maxRetries, 0],
    ["seed", config.seed, 0],
    ["reactionTicks", config.skill.reactionTicks, 0],
    ["jumpHoldTicks", config.skill.jumpHoldTicks, 1],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < min) {
      throw new Error(`Invalid ${name}`);
    }
  }
  if (
    (config.skill.maxWaitTicks !== undefined &&
      (!Number.isSafeInteger(config.skill.maxWaitTicks) || config.skill.maxWaitTicks < 0)) ||
    (config.skill.minJumpHoldTicks !== undefined &&
      (!Number.isSafeInteger(config.skill.minJumpHoldTicks) ||
        config.skill.minJumpHoldTicks < 1 ||
        config.skill.minJumpHoldTicks > config.skill.jumpHoldTicks))
  ) {
    throw new Error("Invalid adaptive bot timing");
  }
  for (const value of Object.values(simulationSeeds(config))) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      throw new Error("Invalid simulation seed");
    }
  }
  if (
    config.trace &&
    (!Number.isSafeInteger(config.trace.maxEvents) ||
      config.trace.maxEvents < 1 ||
      config.trace.maxEvents > 10000 ||
      !Number.isSafeInteger(config.trace.stallTicks) ||
      config.trace.stallTicks < 1 ||
      (config.trace.sampleEveryTicks !== undefined &&
        (!Number.isSafeInteger(config.trace.sampleEveryTicks) ||
          config.trace.sampleEveryTicks < 1)))
  ) {
    throw new Error("Invalid trace budget");
  }
  if (
    config.seed > 0xffffffff ||
    !Number.isFinite(config.skill.lookAheadPx) ||
    config.skill.lookAheadPx <= 0 ||
    !Number.isFinite(config.skill.errorRate) ||
    config.skill.errorRate < 0 ||
    config.skill.errorRate > 1
  ) {
    throw new Error("Invalid bot skill or seed");
  }
  if (
    !["continuous", "never", "reactive"].includes(config.policy.jump) ||
    ![-1, 0, 1].includes(config.policy.move)
  ) {
    throw new Error("Invalid bot policy");
  }
}

// A scoped goal at a linked edge is crossed before the bird is placed in the next area.
export function simulationGoalReached(
  tuning: Pick<BirdTuning, "width">,
  layout: ZoneLayout,
  direction: BotPolicy["move"],
  goal: NonNullable<SimulationConfig["goal"]>,
  before: ZoneState,
  after: ZoneState,
): boolean {
  if (after.death !== undefined || direction === 0) {
    return false;
  }
  if (goal.area === after.area) {
    return direction * (after.bird.x + (direction === 1 ? tuning.width : 0) - goal.x) >= 0;
  }
  if (goal.area !== before.area || before.area === after.area) {
    return false;
  }
  const link = areaOf(layout, before.area).walkLinks?.[direction === 1 ? "right" : "left"];
  if (link?.area !== after.area) {
    return false;
  }
  const order = layout.areaOrder;
  if (!order) {
    const opposite = areaOf(layout, before.area).walkLinks?.[direction === 1 ? "left" : "right"];
    return opposite?.area !== after.area;
  }
  const from = order.indexOf(before.area);
  const to = order.indexOf(after.area);
  return from >= 0 && to >= 0 && direction * (to - from) > 0;
}

// Runs the actual fixed-step rules. UI-only conversations are acknowledged at their real
// proximity; presentation and retry-card waits consume no active time or physics steps.
export function simulateStage(
  tuning: BirdTuning,
  stage: PreparedStage,
  config: SimulationConfig,
): RunResult {
  validateSimulation(config);
  const started = performance.now();
  const { sensors } = stage;
  const layout = layoutAtStart(tuning, stage.layout, config.start);
  const seeds = simulationSeeds(config);
  if (stage.source?.layoutSeed !== undefined && stage.source.layoutSeed !== seeds.layout) {
    throw new Error("Prepared layout seed does not match requested seed");
  }
  let zone = startZone(tuning, layout, seeds.motion);
  if (config.start) {
    validateStart(tuning, layout, zone);
  }
  const start = { area: zone.area, x: zone.bird.x, y: zone.bird.y };
  if (config.goal) {
    const goalArea = areaOf(layout, config.goal.area);
    const edge = zone.bird.x + (config.policy.move === 1 ? tuning.width : 0);
    if (
      !Number.isFinite(config.goal.x) ||
      config.goal.x < goalArea.backX ||
      config.goal.x > goalArea.exitX ||
      config.policy.move === 0 ||
      (config.goal.area === zone.area && config.policy.move * (config.goal.x - edge) <= 0)
    ) {
      throw new Error("Invalid section goal");
    }
  }
  let bot = newBot(seeds.bot);
  const trace: TraceEvent[] = [];
  let traceDropped = 0;
  let attemptTick = 0;
  let lastAdvance = 0;
  let furthest = config.policy.move * zone.bird.x;
  const heardByArea = new Map<string, Set<number>>();
  let previousArea = zone.area;
  let steps = 0;
  let retries = 0;
  let dialogues = 0;
  let progress = 0;
  let peakProgress = 0;
  const deathsByReason = { crush: 0, fall: 0, hazard: 0 };
  let status: RunStatus = "step-budget";
  while (steps < config.maxSteps) {
    if (zone.area !== previousArea) {
      for (const index of heardByArea.get(zone.area) ?? []) {
        zone = activateBehaviour(index, zone);
      }
      previousArea = zone.area;
      bot.holding = 0;
      bot.targetY = undefined;
      bot.waited = 0;
      bot.noticed = 0;
      furthest = config.policy.move * zone.bird.x;
      lastAdvance = attemptTick;
    }
    let heard = heardByArea.get(zone.area);
    if (!heard) {
      heard = new Set();
      heardByArea.set(zone.area, heard);
    }
    const area = areaOf(layout, zone.area);
    const introduction = stage.introductions[zone.area]
      ? proximityDialogue(area.objects, zone.objects, heard, birdBox(tuning, zone.bird))
      : undefined;
    if (introduction !== undefined) {
      heard.add(introduction);
      dialogues++;
      zone = activateBehaviour(introduction, zone);
      bot.holding = 0;
    }
    // Closing a conversation clears held controls before the bot acts again.
    const input =
      introduction === undefined
        ? botInput(tuning, sensors, layout, config.skill, config.policy, zone, bot)
        : { jumpHeld: false, move: 0 as const, useHeld: false };
    const before = zone;
    zone = stepZone(tuning, layout, STEP_SECONDS, input, zone);
    steps++;
    attemptTick++;
    if (zone.area !== before.area) {
      // A new local coordinate origin is advancement, not a stalled previous floor.
      furthest = config.policy.move * zone.bird.x;
      lastAdvance = attemptTick;
    }
    if (config.trace) {
      if (config.policy.move * zone.bird.x > furthest + 1e-6) {
        furthest = config.policy.move * zone.bird.x;
        lastAdvance = attemptTick;
      }
      const stalled = input.move !== 0 && attemptTick - lastAdvance >= config.trace.stallTicks;
      const sampled =
        config.trace.sampleEveryTicks !== undefined &&
        attemptTick % config.trace.sampleEveryTicks === 0;
      if (zone.death || stalled || sampled) {
        if (trace.length < config.trace.maxEvents) {
          trace.push(
            traceEvent(
              tuning,
              layout,
              zone.death ? "death" : stalled ? "stall" : "sample",
              steps,
              attemptTick,
              input,
              zone,
              stage.source?.chunkIds,
            ),
          );
        } else {
          traceDropped++;
          if (zone.death) {
            const expendable = trace.findIndex((event) => event.kind !== "death");
            if (expendable >= 0) {
              trace.splice(expendable, 1);
              trace.push(
                traceEvent(
                  tuning,
                  layout,
                  "death",
                  steps,
                  attemptTick,
                  input,
                  zone,
                  stage.source?.chunkIds,
                ),
              );
            }
          }
        }
        if (stalled) {
          lastAdvance = attemptTick;
        }
      }
    }
    progress = stageProgress(tuning, stage.layout, zone);
    peakProgress = Math.max(peakProgress, progress);
    if (
      config.goal !== undefined &&
      simulationGoalReached(tuning, layout, config.policy.move, config.goal, before, zone)
    ) {
      status = "goal-reached";
      break;
    }
    if (zone.cleared) {
      status = "cleared";
      break;
    }
    if (zone.turnedBack) {
      status = "turned-back";
      break;
    }
    if (zone.death !== undefined) {
      deathsByReason[zone.death.reason]++;
      if (retries >= config.maxRetries) {
        status = "retry-budget";
        break;
      }
      // A retry consumes no tick. If no tick remains, retain the final failed-attempt progress.
      if (steps === config.maxSteps) {
        break;
      }
      zone = retryZone(tuning, layout, zone);
      retries++;
      heardByArea.clear();
      bot = newBot((seeds.bot + retries) >>> 0);
      attemptTick = 0;
      lastAdvance = 0;
      furthest = config.policy.move * zone.bird.x;
    }
  }
  return {
    ...(status === "cleared" ? { successfulAttemptSeconds: attemptTick * STEP_SECONDS } : {}),
    activeSeconds: steps * STEP_SECONDS,
    config,
    deaths: deathsByReason.crush + deathsByReason.fall + deathsByReason.hazard,
    deathsByReason,
    dialogues,
    peakProgress,
    progress,
    provenance: { ...stage.source?.provenance, ...config.provenance },
    retries,
    runtimeMs: performance.now() - started,
    seed: config.seed,
    seeds,
    start,
    status,
    steps,
    trace,
    traceDropped,
    tuning,
  };
}
