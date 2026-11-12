import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

import { BIRD } from "../data/bird.ts";
import { ZONE_MAP } from "../data/map.ts";
import {
  DIAGNOSTIC_SKILL,
  FORWARD_POLICY,
  type JumpPolicy,
  NAVIGATION_DEFAULTS,
  NAVIGATION_VALIDATION,
  type NavigationConfig,
} from "./bot.ts";
import { stageLoader } from "./catalogue.ts";
import { choiceOption, numberOption, parseOptions, runMain, UsageError } from "./command.ts";
import { VALIDATION_LIMITS } from "./diagnostics.ts";
import { simulateBatch } from "./report.ts";
import { type SimulationConfig, type SimulationSeeds, validateSimulation } from "./simulate.ts";

const HELP = `npm run simulate -- [--stage ID] [--seed N] [--runs N] [--max-ticks N]
  [--max-retries N] [--reaction-ticks N] [--look-ahead PX] [--hold-ticks N]
  [--layout-seed N] [--motion-seed N] [--bot-seed N]
  [--area ID --entry ID | --area ID --start-x PX --start-y PX] [--goal-x PX]
  [--trace-cap N] [--trace-every N] [--trace-stall-ticks N]
  [--[no-]adaptive-jump] [--min-hold-ticks N] [--[no-]wait-for-movers]
  [--max-wait-ticks N] [--build-id ID] [--data-id ID]
  [--max-wall-ms N] [--batch-wall-ms N] [--stop-stall-ticks N]
  [--profile quick|validation]
  [--witness-segments N] [--[no-]require-full-pass]
  [--plan-horizon N] [--plan-candidates N] [--plan-replan N] [--plan-ticks N]
  [--error-rate 0..1] [--jump reactive|continuous|never|planned] [--move=-1|0|1] [--out FILE]

Defaults: first map stage, seed 1, one run, 3600 total ticks/run, zero retries.
Bot defaults are mechanical diagnostic settings, not calibrated human skills.
Consecutive seeds select layout/motion/bot unless explicitly overridden by component flags.
Section coordinates are collision-box top-left pixels. --goal-x requires --area and nonzero move.
Omitting a goal runs the whole stage from the selected cold start. Tracing is off by default.
A value starting with a dash is passed as --flag=VALUE. --out refuses an existing file.
Output is JSON with per-run and aggregate metrics. Runtime includes no rendering.
Exits 1 when --require-full-pass is not met and 2 on a usage error.
Only run bounded batches in the project container; coordinate larger batches with gameplay.`;

const OPTIONS = {
  "adaptive-jump": { type: "boolean" },
  area: { type: "string" },
  "batch-wall-ms": { type: "string" },
  "bot-seed": { type: "string" },
  "build-id": { type: "string" },
  "data-id": { type: "string" },
  entry: { type: "string" },
  "error-rate": { type: "string" },
  "goal-x": { type: "string" },
  "hold-ticks": { type: "string" },
  jump: { type: "string" },
  "layout-seed": { type: "string" },
  "look-ahead": { type: "string" },
  "max-retries": { type: "string" },
  "max-ticks": { type: "string" },
  "max-wait-ticks": { type: "string" },
  "max-wall-ms": { type: "string" },
  "min-hold-ticks": { type: "string" },
  "motion-seed": { type: "string" },
  move: { type: "string" },
  out: { type: "string" },
  "plan-candidates": { type: "string" },
  "plan-horizon": { type: "string" },
  "plan-replan": { type: "string" },
  "plan-ticks": { type: "string" },
  profile: { type: "string" },
  "reaction-ticks": { type: "string" },
  "require-full-pass": { type: "boolean" },
  runs: { type: "string" },
  seed: { type: "string" },
  stage: { type: "string" },
  "start-x": { type: "string" },
  "start-y": { type: "string" },
  "stop-stall-ticks": { type: "string" },
  "trace-cap": { type: "string" },
  "trace-every": { type: "string" },
  "trace-stall-ticks": { type: "string" },
  "wait-for-movers": { type: "boolean" },
  "witness-segments": { type: "string" },
} as const;
type Option = keyof typeof OPTIONS;

const JUMP_POLICIES: readonly JumpPolicy[] = ["reactive", "continuous", "never", "planned"];
const MOVES = ["-1", "0", "1"] as const;
const PROFILES = ["quick", "validation"] as const;

// Runs the batch args describe and prints its report; returns 1 when a required full pass fails.
export function simulationCli(args: readonly string[]): number {
  const values = parseOptions(OPTIONS, args);
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const explicit = (name: Option) => values[name] !== undefined;
  const number = (name: Option) => {
    const value = values[name];
    return typeof value === "string" ? numberOption(name, value) : undefined;
  };
  const profile =
    values.profile === undefined
      ? "quick"
      : choiceOption("simulation profile", PROFILES, values.profile);
  const stage = values.stage ?? ZONE_MAP.start;
  const seed = number("seed") ?? 1;
  const runs = number("runs") ?? 1;
  let maxSteps = number("max-ticks") ?? 3600;
  let maxRetries = number("max-retries") ?? 0;
  let witnessSegments = number("witness-segments");
  let requireFullPass = values["require-full-pass"] ?? false;
  let maxWallTimeMs = number("max-wall-ms");
  let batchWallTimeMs = number("batch-wall-ms");
  let stopAfterStallTicks = number("stop-stall-ticks");
  const navigation: { -readonly [Key in keyof NavigationConfig]?: NavigationConfig[Key] } = {};
  const planning = [
    ["plan-horizon", "horizonTicks"],
    ["plan-candidates", "maxCandidates"],
    ["plan-replan", "replanTicks"],
    ["plan-ticks", "maxPhysicsSteps"],
  ] as const;
  for (const [name, key] of planning) {
    const value = number(name);
    if (value !== undefined) {
      navigation[key] = value;
    }
  }
  const navigationSpecified = planning.some(([name]) => explicit(name));
  const out = values.out;
  const seeds: Partial<{ -readonly [Key in keyof SimulationSeeds]: SimulationSeeds[Key] }> = {};
  for (const [name, key] of [
    ["layout-seed", "layout"],
    ["motion-seed", "motion"],
    ["bot-seed", "bot"],
  ] as const) {
    const value = number(name);
    if (value !== undefined) {
      seeds[key] = value;
    }
  }
  const { area, entry } = values;
  const startX = number("start-x");
  const startY = number("start-y");
  const goalX = number("goal-x");
  const traceCap =
    number("trace-cap") ??
    (explicit("trace-every") || explicit("trace-stall-ticks") ? 128 : undefined);
  const traceEvery = number("trace-every");
  const stallTicks = number("trace-stall-ticks") ?? 120;
  let build = values["build-id"];
  const data = values["data-id"];
  const skill = { ...DIAGNOSTIC_SKILL };
  for (const [name, key] of [
    ["error-rate", "errorRate"],
    ["hold-ticks", "jumpHoldTicks"],
    ["look-ahead", "lookAheadPx"],
    ["max-wait-ticks", "maxWaitTicks"],
    ["min-hold-ticks", "minJumpHoldTicks"],
    ["reaction-ticks", "reactionTicks"],
  ] as const) {
    const value = number(name);
    if (value !== undefined) {
      skill[key] = value;
    }
  }
  if (values["adaptive-jump"] !== undefined) {
    skill.adaptiveJump = values["adaptive-jump"];
  }
  if (values["wait-for-movers"] !== undefined) {
    skill.waitForMovers = values["wait-for-movers"];
  }
  const policy = { ...FORWARD_POLICY };
  if (values.jump !== undefined) {
    policy.jump = choiceOption("jump policy", JUMP_POLICIES, values.jump);
  }
  if (values.move !== undefined) {
    policy.move = Number(choiceOption("move direction", MOVES, values.move)) as -1 | 0 | 1;
  }
  if (out !== undefined && existsSync(out)) {
    throw new Error(`Output already exists: ${out}`);
  }
  if (profile === "validation") {
    if (!explicit("max-ticks")) {
      maxSteps = VALIDATION_LIMITS.maxSteps;
    }
    if (!explicit("max-retries")) {
      maxRetries = VALIDATION_LIMITS.maxRetries;
    }
    if (!explicit("max-wall-ms")) {
      maxWallTimeMs = VALIDATION_LIMITS.maxWallTimeMs;
    }
    if (!explicit("batch-wall-ms")) {
      batchWallTimeMs = VALIDATION_LIMITS.batchWallTimeMs;
    }
    if (!explicit("stop-stall-ticks")) {
      stopAfterStallTicks = VALIDATION_LIMITS.stopAfterStallTicks;
    }
    if (!explicit("jump")) {
      policy.jump = "planned";
    }
    if (!explicit("witness-segments")) {
      witnessSegments = maxSteps;
    }
    if (!explicit("require-full-pass")) {
      requireFullPass = true;
    }
  }
  const resolvedNavigation = {
    ...(profile === "validation" ? NAVIGATION_VALIDATION : NAVIGATION_DEFAULTS),
    ...navigation,
  };
  if (!Number.isSafeInteger(runs) || runs < 1 || runs > 10000 || seed + runs - 1 > 0xffffffff) {
    throw new UsageError(
      `Invalid --runs ${runs} or --seed ${seed}: runs must be 1 to 10000 and seed + runs - 1 at most 4294967295`,
    );
  }
  const hasPoint = startX !== undefined || startY !== undefined;
  if (
    (hasPoint && (startX === undefined || startY === undefined)) ||
    (entry !== undefined && hasPoint) ||
    ((hasPoint || entry !== undefined || goalX !== undefined) && area === undefined) ||
    (area !== undefined && !hasPoint && entry === undefined && goalX === undefined)
  ) {
    throw new UsageError(
      "Provide --area with either --entry or both --start-x and --start-y, or with --goal-x",
    );
  }
  if (build === undefined) {
    try {
      build = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      /* A caller can supply the exact build when Git metadata is unavailable. */
    }
  }
  if (requireFullPass && witnessSegments === undefined) {
    throw new UsageError("--require-full-pass requires --witness-segments");
  }
  if (requireFullPass && !build) {
    throw new Error("Full-pass validation requires a source build identifier");
  }
  const config: SimulationConfig = {
    ...(witnessSegments === undefined ? {} : { witness: { maxSegments: witnessSegments } }),
    ...(maxWallTimeMs === undefined ? {} : { maxWallTimeMs }),
    ...(stopAfterStallTicks === undefined ? {} : { stopAfterStallTicks }),
    maxRetries,
    maxSteps,
    policy,
    seed,
    seeds,
    skill:
      navigationSpecified || policy.jump === "planned" || profile === "validation"
        ? { ...skill, navigation: resolvedNavigation }
        : skill,
    ...(area !== undefined && entry !== undefined
      ? { start: { area, entry } }
      : area !== undefined && startX !== undefined && startY !== undefined
        ? { start: { area, x: startX, y: startY } }
        : {}),
    ...(area !== undefined && goalX !== undefined ? { goal: { area, x: goalX } } : {}),
    ...(traceCap !== undefined
      ? {
          trace: {
            maxEvents: traceCap,
            stallTicks,
            ...(traceEvery !== undefined ? { sampleEveryTicks: traceEvery } : {}),
          },
        }
      : {}),
    provenance: {
      stage,
      ...(build !== undefined ? { build } : {}),
      ...(data !== undefined ? { data } : {}),
    },
  };
  validateSimulation(config);
  const started = performance.now();
  const prepare = stageLoader(stage);
  const result = simulateBatch(
    BIRD,
    prepare,
    config,
    Array.from({ length: runs }, (_, index) => seed + index),
    batchWallTimeMs === undefined ? {} : { maxWallTimeMs: batchWallTimeMs },
  );
  const report = {
    config: {
      ...config,
      profile,
      ...(batchWallTimeMs === undefined ? {} : { batchWallTimeMs }),
      runs,
      stage,
    },
    ...result,
    totalRuntimeMs: performance.now() - started,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  console.log(json.trimEnd());
  if (out !== undefined) {
    writeFileSync(out, json, { flag: "wx" });
  }
  return requireFullPass && !result.validation.fullPass ? 1 : 0;
}

runMain(import.meta.url, HELP, simulationCli);
