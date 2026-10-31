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
  type ZoneInput,
  type ZoneState,
} from "../rules/zone";
import { proximityDialogue } from "../view/zoneDialogue";
import {
  botInput,
  type BotPolicy,
  type BotSkill,
  type NavigationCounters,
  navigationCounters,
  navigationSnapshot,
  newBot,
  prepareSensors,
  rememberNavigationFailure,
  resetNavigation,
  restoreNavigationMemory,
  type SensorIndex,
  validateNavigation,
} from "./bot";
import {
  type CompletionWitness,
  type TraceEvent,
  traceEvent,
  type TraceOptions,
  VALIDATION_LIMITS,
  witnessContextHash,
  type WitnessSegment,
} from "./diagnostics";
import { layoutAtStart, type SimulationStart, validateStart } from "./start";

export interface SimulationSeeds {
  readonly bot: number;
  readonly layout: number;
  readonly motion: number;
}
export interface SimulationProvenance {
  readonly build?: string;
  readonly data?: string;
  readonly stage?: string;
}

export interface SimulationConfig {
  readonly goal?: { readonly area: string; readonly x: number };
  readonly provenance?: SimulationProvenance;
  readonly seeds?: Partial<SimulationSeeds>;
  readonly start?: SimulationStart;
  readonly trace?: TraceOptions;
  readonly witness?: { readonly maxSegments: number };
  readonly maxWallTimeMs?: number;
  readonly stopAfterStallTicks?: number;
  readonly maxRetries: number;
  readonly maxSteps: number;
  readonly policy: BotPolicy;
  readonly seed: number;
  readonly skill: BotSkill;
}
export type RunStatus =
  | "cleared"
  | "goal-reached"
  | "retry-budget"
  | "step-budget"
  | "turned-back"
  | "policy-stall"
  | "wall-budget"
  | "prediction-budget";
export interface RunResult {
  readonly fullPass: boolean;
  readonly witness?: CompletionWitness;
  readonly terminal: TraceEvent;
  readonly failures: readonly TraceEvent[];
  readonly lastAttemptSeconds: number;
  readonly planning: NavigationCounters;
  readonly finalPolicy: {
    readonly move: number;
    readonly waitingTicks: number;
    readonly plannerStatus?: string;
  };
  readonly coverage: {
    readonly areasVisited: readonly string[];
    readonly path: readonly {
      readonly area: string;
      readonly attempt: number;
      readonly chunk: number | undefined;
      readonly chunkId: string | undefined;
      readonly tick: number;
    }[];
    readonly areaTransitions: number;
    readonly chunksVisited: Readonly<Record<string, readonly { index: number; id?: string }[]>>;
  };
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
  if (
    config.skill.navigation?.profile === "validation" &&
    (config.maxSteps > VALIDATION_LIMITS.maxSteps ||
      config.maxRetries > VALIDATION_LIMITS.maxRetries ||
      config.maxWallTimeMs === undefined ||
      config.maxWallTimeMs > VALIDATION_LIMITS.maxWallTimeMs ||
      config.stopAfterStallTicks === undefined ||
      config.stopAfterStallTicks > VALIDATION_LIMITS.stopAfterStallTicks)
  ) {
    throw new Error("Validation profile exceeds its execution limits");
  }
  if (
    config.witness &&
    (!Number.isSafeInteger(config.witness.maxSegments) ||
      config.witness.maxSegments < 1 ||
      config.witness.maxSegments > config.maxSteps)
  ) {
    throw new Error("Invalid witness segment budget");
  }
  if (config.policy.jump === "planned" || config.skill.navigation !== undefined) {
    validateNavigation(config.skill.navigation);
  }
  for (const [name, value] of [
    ["maxWallTimeMs", config.maxWallTimeMs],
    ["stopAfterStallTicks", config.stopAfterStallTicks],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isFinite(value) ||
        value <= 0 ||
        (name === "stopAfterStallTicks" && !Number.isSafeInteger(value)))
    ) {
      throw new Error(`Invalid ${name}`);
    }
  }
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
    !["continuous", "never", "reactive", "planned"].includes(config.policy.jump) ||
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
  return executeStage(tuning, stage, config);
}

function executeStage(
  tuning: BirdTuning,
  stage: PreparedStage,
  config: SimulationConfig,
  playback?: readonly WitnessSegment[],
  onStep?: (steps: number) => void,
): RunResult {
  validateSimulation(config);
  const navigation =
    config.policy.jump === "planned" ? validateNavigation(config.skill.navigation) : undefined;
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
  let progress = stageProgress(tuning, stage.layout, zone);
  let peakProgress = progress;
  const deathsByReason = { crush: 0, fall: 0, hazard: 0 };
  let status: RunStatus = "step-budget";
  const priorPlanning = {
    budgetExhaustions: 0,
    candidateRollouts: 0,
    decisions: 0,
    physicsSteps: 0,
  };
  const areasVisited = new Set<string>();
  const chunksVisited = new Map<string, Set<number>>();
  let areaTransitions = 0;
  let lastMove = 0;
  let lastInput: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
  const failures: TraceEvent[] = [];
  const path: RunResult["coverage"]["path"][number][] = [];
  const segments: { attempt: number; input: ZoneInput; ticks: number }[] = [];
  let capturedTicks = 0;
  let truncated = false;
  let playbackIndex = 0;
  let playbackTicks = 0;
  const readPlayback = (): ZoneInput => {
    const segment = playback?.[playbackIndex];
    if (!segment || segment.attempt !== zone.attempt) {
      throw new Error("Witness input/attempt mismatch");
    }
    playbackTicks++;
    if (playbackTicks === segment.ticks) {
      playbackIndex++;
      playbackTicks = 0;
    }
    return segment.input;
  };
  let terminalLastAdvance = 0;
  let terminalFurthest = config.policy.move * zone.bird.x;
  const visit = () => {
    areasVisited.add(zone.area);
    const indices = chunksVisited.get(zone.area) ?? new Set<number>();
    const centre = zone.bird.x + tuning.width / 2;
    const index = areaOf(layout, zone.area).chunks.findIndex(
      (c) => centre >= c.x && centre < c.x + c.width,
    );
    if (index >= 0) {
      indices.add(index);
    }
    chunksVisited.set(zone.area, indices);
    const chunk = index < 0 ? undefined : index;
    const last = path.at(-1);
    if (!last || last.area !== zone.area || last.attempt !== zone.attempt || last.chunk !== chunk) {
      path.push({
        area: zone.area,
        attempt: zone.attempt,
        chunk,
        chunkId: stage.source?.chunkIds?.[zone.area]?.[index],
        tick: steps,
      });
    }
  };
  visit();
  while (steps < config.maxSteps) {
    if (config.maxWallTimeMs !== undefined && performance.now() - started >= config.maxWallTimeMs) {
      status = "wall-budget";
      break;
    }
    if (zone.area !== previousArea) {
      for (const index of heardByArea.get(zone.area) ?? []) {
        zone = activateBehaviour(index, zone);
      }
      previousArea = zone.area;
      resetNavigation(bot);
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
      resetNavigation(bot);
      bot.holding = 0;
    }
    // Closing a conversation clears held controls before the bot acts again.
    const skill =
      navigation === undefined
        ? config.skill
        : {
            ...config.skill,
            navigation: {
              ...navigation,
              maxPhysicsSteps: Math.max(0, navigation.maxPhysicsSteps - priorPlanning.physicsSteps),
            },
          };
    const input = playback
      ? readPlayback()
      : introduction === undefined
        ? botInput(tuning, sensors, layout, skill, config.policy, zone, bot)
        : { jumpHeld: false, move: 0 as const, useHeld: false };
    if (
      playback &&
      introduction !== undefined &&
      (input.move !== 0 || input.jumpHeld || input.useHeld)
    ) {
      throw new Error("Witness introduction input mismatch");
    }
    if (config.witness && !playback && !truncated) {
      const previous = segments.at(-1);
      if (
        previous &&
        previous.attempt === zone.attempt &&
        previous.input.move === input.move &&
        previous.input.jumpHeld === input.jumpHeld &&
        previous.input.useHeld === input.useHeld
      ) {
        previous.ticks++;
        capturedTicks++;
      } else if (segments.length < config.witness.maxSegments) {
        segments.push({ attempt: zone.attempt, input: { ...input }, ticks: 1 });
        capturedTicks++;
      } else {
        truncated = true;
      }
    }
    lastInput = input;
    lastMove = input.move;
    const before = zone;
    zone = stepZone(tuning, layout, STEP_SECONDS, input, zone);
    steps++;
    onStep?.(steps);
    attemptTick++;
    visit();
    if (zone.area !== before.area) {
      areaTransitions++;
      terminalFurthest = config.policy.move * zone.bird.x;
      terminalLastAdvance = attemptTick;
    }
    if (config.policy.move * zone.bird.x > terminalFurthest + 1e-6) {
      terminalFurthest = config.policy.move * zone.bird.x;
      terminalLastAdvance = attemptTick;
    }
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
              stage.source?.chunkIds,
              navigationSnapshot(bot),
              zone,
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
                  stage.source?.chunkIds,
                  navigationSnapshot(bot),
                  zone,
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
      failures.push(
        traceEvent(
          tuning,
          layout,
          "death",
          steps,
          attemptTick,
          input,
          stage.source?.chunkIds,
          navigationSnapshot(bot),
          zone,
        ),
      );
      const memory = playback ? undefined : rememberNavigationFailure(zone, bot);
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
      const counters = navigationCounters(bot);
      for (const key of Object.keys(priorPlanning) as (keyof NavigationCounters)[]) {
        priorPlanning[key] += counters[key];
      }
      bot = newBot((seeds.bot + retries) >>> 0);
      if (memory) {
        restoreNavigationMemory(memory, bot);
      }
      terminalLastAdvance = 0;
      terminalFurthest = config.policy.move * zone.bird.x;
      attemptTick = 0;
      lastAdvance = 0;
      furthest = config.policy.move * zone.bird.x;
    }
    if (!playback && bot.navigation?.status === "budget-exhausted") {
      status = "prediction-budget";
      break;
    }
    if (
      config.stopAfterStallTicks !== undefined &&
      attemptTick - terminalLastAdvance >= config.stopAfterStallTicks
    ) {
      status = "policy-stall";
      break;
    }
  }
  const counters = navigationCounters(bot);
  const provenance = { ...stage.source?.provenance, ...config.provenance };
  const witness: CompletionWitness | undefined =
    config.witness && !playback
      ? {
          capturedTicks,
          config,
          contextHash: witnessContextHash(tuning, stage.layout),
          finalArea: zone.area,
          provenance,
          retries,
          seeds,
          segments,
          steps,
          truncated,
        }
      : undefined;
  const finalArea = stage.layout.areaOrder?.at(-1) ?? stage.layout.start.area;
  const fullPass =
    status === "cleared" &&
    zone.area === finalArea &&
    config.goal === undefined &&
    config.start === undefined &&
    witness !== undefined &&
    !witness.truncated &&
    witness.capturedTicks === steps &&
    typeof provenance.build === "string" &&
    provenance.build.length > 0;
  return {
    ...(witness ? { witness } : {}),
    failures,
    fullPass,
    terminal: traceEvent(
      tuning,
      layout,
      "terminal",
      steps,
      attemptTick,
      lastInput,
      stage.source?.chunkIds,
      navigationSnapshot(bot),
      zone,
    ),
    ...(status === "cleared" ? { successfulAttemptSeconds: attemptTick * STEP_SECONDS } : {}),
    activeSeconds: steps * STEP_SECONDS,
    config,
    coverage: {
      areaTransitions,
      areasVisited: [...areasVisited],
      chunksVisited: Object.fromEntries(
        [...chunksVisited].map(([area, indices]) => [
          area,
          [...indices].map((index) => ({
            index,
            ...(stage.source?.chunkIds?.[area]?.[index] === undefined
              ? {}
              : { id: stage.source.chunkIds[area][index] }),
          })),
        ]),
      ),
      path,
    },
    deaths: deathsByReason.crush + deathsByReason.fall + deathsByReason.hazard,
    deathsByReason,
    dialogues,
    finalPolicy: {
      move: lastMove,
      waitingTicks: bot.waited,
      ...(bot.navigation === undefined ? {} : { plannerStatus: bot.navigation.status }),
    },
    lastAttemptSeconds: attemptTick * STEP_SECONDS,
    peakProgress,
    planning: {
      budgetExhaustions: priorPlanning.budgetExhaustions + counters.budgetExhaustions,
      candidateRollouts: priorPlanning.candidateRollouts + counters.candidateRollouts,
      decisions: priorPlanning.decisions + counters.decisions,
      physicsSteps: priorPlanning.physicsSteps + counters.physicsSteps,
    },
    progress,
    provenance,
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

export interface WitnessReplayResult {
  readonly status: "verified" | "mismatch";
  readonly reason?: string;
  readonly executedSteps: number;
  readonly runtimeMs: number;
}

export function replayCompletionWitness(
  tuning: BirdTuning,
  stage: PreparedStage,
  config: SimulationConfig,
  limits: { readonly maxSteps: number; readonly maxWallTimeMs: number },
  witness: CompletionWitness,
): WitnessReplayResult {
  const started = performance.now();
  let executedSteps = 0;
  const mismatch = (reason: string): WitnessReplayResult => ({
    executedSteps,
    reason,
    runtimeMs: performance.now() - started,
    status: "mismatch",
  });
  if (
    !Number.isSafeInteger(limits.maxSteps) ||
    limits.maxSteps < 1 ||
    !Number.isFinite(limits.maxWallTimeMs) ||
    limits.maxWallTimeMs <= 0
  ) {
    return mismatch("Invalid replay budget");
  }
  const provenance = { ...stage.source?.provenance, ...config.provenance };
  if (!provenance.build) {
    return mismatch("Witness source identifier required");
  }
  if (
    config.start ||
    config.goal ||
    witness.truncated ||
    witness.capturedTicks !== witness.steps ||
    witness.steps < 1 ||
    witness.steps > config.maxSteps ||
    !Number.isSafeInteger(witness.steps)
  ) {
    return mismatch("Witness is not a complete whole-stage recording");
  }
  if (
    JSON.stringify(config) !== JSON.stringify(witness.config) ||
    JSON.stringify(simulationSeeds(config)) !== JSON.stringify(witness.seeds)
  ) {
    return mismatch("Witness configuration or seeds mismatch");
  }
  if (
    witness.contextHash !== witnessContextHash(tuning, stage.layout) ||
    JSON.stringify(provenance) !== JSON.stringify(witness.provenance)
  ) {
    return mismatch("Witness stage or provenance mismatch");
  }
  let ticks = 0;
  for (const segment of witness.segments) {
    if (
      !Number.isSafeInteger(segment.ticks) ||
      segment.ticks < 1 ||
      !Number.isSafeInteger(segment.attempt) ||
      segment.attempt < 0 ||
      ![-1, 0, 1].includes(segment.input.move) ||
      typeof segment.input.jumpHeld !== "boolean" ||
      typeof segment.input.useHeld !== "boolean"
    ) {
      return mismatch("Invalid witness input segment");
    }
    ticks += segment.ticks;
    if (!Number.isSafeInteger(ticks) || ticks > witness.steps) {
      return mismatch("Witness tick budget mismatch");
    }
  }
  if (ticks !== witness.steps || witness.segments.length > (config.witness?.maxSegments ?? 0)) {
    return mismatch("Witness tick or segment count mismatch");
  }
  try {
    const result = executeStage(
      tuning,
      stage,
      {
        ...config,
        maxSteps: Math.min(limits.maxSteps, witness.steps),
        maxWallTimeMs: limits.maxWallTimeMs,
        witness: {
          maxSegments: Math.min(
            config.witness?.maxSegments ?? witness.steps,
            witness.steps,
            limits.maxSteps,
          ),
        },
      },
      witness.segments,
      (steps) => {
        executedSteps = steps;
      },
    );
    executedSteps = result.steps;
    if (
      result.status !== "cleared" ||
      result.terminal.area !== witness.finalArea ||
      result.terminal.area !== (stage.layout.areaOrder?.at(-1) ?? stage.layout.start.area) ||
      result.steps !== witness.steps ||
      result.retries !== witness.retries
    ) {
      return mismatch("Replay did not reproduce full completion within budget");
    }
    return { executedSteps, runtimeMs: performance.now() - started, status: "verified" };
  } catch (error) {
    return mismatch(error instanceof Error ? error.message : String(error));
  }
}
