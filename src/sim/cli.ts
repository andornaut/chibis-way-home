import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { BIRD } from "../data/bird";
import { ZONE_MAP } from "../data/map";
import { DIAGNOSTIC_SKILL, FORWARD_POLICY, type JumpPolicy, NAVIGATION_DEFAULTS } from "./bot";
import { stageLoader } from "./catalogue";
import { simulateBatch } from "./report";
import { type SimulationConfig, type SimulationSeeds, validateSimulation } from "./simulate";

const HELP = `npm run simulate -- [--stage ID] [--seed N] [--runs N] [--max-steps N]
  [--max-retries N] [--reaction-ticks N] [--look-ahead PX] [--hold-ticks N]
  [--layout-seed N] [--motion-seed N] [--bot-seed N]
  [--area ID --entry ID | --area ID --start-x PX --start-y PX] [--goal-x PX]
  [--trace-cap N] [--trace-every N] [--stall-ticks N]
  [--adaptive-jump true|false] [--min-hold-ticks N] [--wait-for-movers true|false]
  [--max-wait-ticks N] [--build-id ID] [--data-id ID]
  [--max-wall-ms N] [--batch-wall-ms N] [--stall-limit N]
  [--witness-segments N] [--require-full-pass true|false]
  [--plan-horizon N] [--plan-candidates N] [--plan-replan N] [--plan-steps N]
  [--error-rate 0..1] [--jump reactive|continuous|never|planned] [--move -1|0|1] [--out FILE]

Defaults: first map stage, seed 1, one run, 3600 total ticks/run, zero retries.
Bot defaults are mechanical diagnostic settings, not calibrated human skills.
Consecutive seeds select layout/motion/bot unless explicitly overridden by component flags.
Section coordinates are collision-box top-left pixels. --goal-x requires --area and nonzero move.
Omitting a goal runs the whole stage from the selected cold start. Tracing is off by default.
Output is JSON with per-run and aggregate metrics. Runtime includes no rendering.
Only run bounded batches in the project container; coordinate larger batches with gameplay.`;

function main(args: readonly string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }
  let stage = ZONE_MAP.start;
  let seed = 1;
  let runs = 1;
  let maxSteps = 3600;
  let maxRetries = 0;
  let witnessSegments: number | undefined;
  let requireFullPass = false;
  let maxWallTimeMs: number | undefined;
  let batchWallTimeMs: number | undefined;
  let stopAfterStallTicks: number | undefined;
  const navigation = { ...NAVIGATION_DEFAULTS };
  let navigationSpecified = false;
  let out: string | undefined;
  const seeds: Partial<{ -readonly [Key in keyof SimulationSeeds]: SimulationSeeds[Key] }> = {};
  let area: string | undefined;
  let entry: string | undefined;
  let startX: number | undefined;
  let startY: number | undefined;
  let goalX: number | undefined;
  let traceCap: number | undefined;
  let traceEvery: number | undefined;
  let stallTicks = 120;
  let build: string | undefined;
  let data: string | undefined;
  const skill = { ...DIAGNOSTIC_SKILL };
  const policy = { ...FORWARD_POLICY };
  for (let at = 0; at < args.length; at += 2) {
    const flag = args[at];
    const value = args[at + 1];
    if (value === undefined || value.trim() === "") {
      throw new Error(`${flag} needs a value`);
    }
    const boolean = () => {
      if (value !== "true" && value !== "false") {
        throw new Error(`${flag} takes true or false`);
      }
      return value === "true";
    };
    switch (flag) {
      case "--witness-segments":
        witnessSegments = Number(value);
        break;
      case "--require-full-pass":
        requireFullPass = boolean();
        break;
      case "--max-wall-ms":
        maxWallTimeMs = Number(value);
        break;
      case "--batch-wall-ms":
        batchWallTimeMs = Number(value);
        break;
      case "--stall-limit":
        stopAfterStallTicks = Number(value);
        break;
      case "--plan-horizon":
        navigation.horizonTicks = Number(value);
        navigationSpecified = true;
        break;
      case "--plan-candidates":
        navigation.maxCandidates = Number(value);
        navigationSpecified = true;
        break;
      case "--plan-replan":
        navigation.replanTicks = Number(value);
        navigationSpecified = true;
        break;
      case "--plan-steps":
        navigation.maxPhysicsSteps = Number(value);
        navigationSpecified = true;
        break;
      case "--layout-seed":
        seeds.layout = Number(value);
        break;
      case "--motion-seed":
        seeds.motion = Number(value);
        break;
      case "--bot-seed":
        seeds.bot = Number(value);
        break;
      case "--area":
        area = value;
        break;
      case "--entry":
        entry = value;
        break;
      case "--start-x":
        startX = Number(value);
        break;
      case "--start-y":
        startY = Number(value);
        break;
      case "--goal-x":
        goalX = Number(value);
        break;
      case "--trace-cap":
        traceCap = Number(value);
        break;
      case "--trace-every":
        traceEvery = Number(value);
        traceCap ??= 128;
        break;
      case "--stall-ticks":
        stallTicks = Number(value);
        traceCap ??= 128;
        break;
      case "--adaptive-jump":
        skill.adaptiveJump = boolean();
        break;
      case "--wait-for-movers":
        skill.waitForMovers = boolean();
        break;
      case "--min-hold-ticks":
        skill.minJumpHoldTicks = Number(value);
        break;
      case "--max-wait-ticks":
        skill.maxWaitTicks = Number(value);
        break;
      case "--build-id":
        build = value;
        break;
      case "--data-id":
        data = value;
        break;
      case "--stage":
        stage = value;
        break;
      case "--seed":
        seed = Number(value);
        break;
      case "--runs":
        runs = Number(value);
        break;
      case "--max-steps":
        maxSteps = Number(value);
        break;
      case "--max-retries":
        maxRetries = Number(value);
        break;
      case "--reaction-ticks":
        skill.reactionTicks = Number(value);
        break;
      case "--look-ahead":
        skill.lookAheadPx = Number(value);
        break;
      case "--hold-ticks":
        skill.jumpHoldTicks = Number(value);
        break;
      case "--error-rate":
        skill.errorRate = Number(value);
        break;
      case "--jump":
        policy.jump = value as JumpPolicy;
        break;
      case "--move":
        policy.move = Number(value) as -1 | 0 | 1;
        break;
      case "--out":
        out = value;
        break;
      default:
        throw new Error(`Unknown option ${flag}`);
    }
  }
  if (!Number.isSafeInteger(runs) || runs < 1 || runs > 10000 || seed + runs - 1 > 0xffffffff) {
    throw new Error("Invalid runs or seed range");
  }
  const hasPoint = startX !== undefined || startY !== undefined;
  if (
    (hasPoint && (startX === undefined || startY === undefined)) ||
    (entry !== undefined && hasPoint) ||
    ((hasPoint || entry !== undefined || goalX !== undefined) && area === undefined) ||
    (area !== undefined && !hasPoint && entry === undefined && goalX === undefined)
  ) {
    throw new Error("Provide an explicit area and either entry or both start coordinates");
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
    throw new Error("Full-pass validation requires an explicit witness segment budget");
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
    skill: navigationSpecified || policy.jump === "planned" ? { ...skill, navigation } : skill,
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
      ...(batchWallTimeMs === undefined ? {} : { batchWallTimeMs }),
      runs,
      stage,
    },
    ...result,
    totalRuntimeMs: performance.now() - started,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  console.log(json.trimEnd());
  if (requireFullPass && !result.validation.fullPass) {
    process.exitCode = 1;
  }
  if (out !== undefined) {
    writeFileSync(out, json);
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
