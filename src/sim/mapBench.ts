// Movement map build cost per boss profile per stage area: kernel steps (deterministic) and
// wall time. Run in the check container: node src/sim/mapBench.ts [--seeds 3] [--repeats 5]
// [--window leash|<tiles>] [--decisions].
import { EDGE } from "../core";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { ObjectLayout, Rect } from "../data/types";
import { RECIPES } from "../data/zones";
import { planMapLeg } from "../rules/behaviourMapPursuit";
import {
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  flightMap,
  groundMap,
  type MapTerrain,
  mapTerrain,
  pursuitGroundMap,
} from "../rules/movementMaps";
import { stageLoader } from "./catalogue";
import { parseOptions, runMain, UsageError } from "./command";

const HELP = `Usage: node src/sim/mapBench.ts [--seeds <n>] [--repeats <n>] [--window <w>]
       node src/sim/mapBench.ts --decisions [--seeds <n>]

Builds every boss's movement or air map for every stage area that places it, for layout seeds
1 to n (default 3), each build repeated (default 5), and prints work and wall time per profile.
--window clips each build to the area's full height and, horizontally, either the boss's pursuit
leash around its spawn (leash) or a width in tiles centred on its spawn.

--decisions builds each ground boss's runtime pursuit map once (pursuitGroundMap, as an
encounter does on first use) and times it, then times one pursuit decision from every map node
to Chibi standing on every map node: choosing a new route, then keeping it on the next tick.`;

// Contract targets: a build per profile per area at or under this at the 95th percentile, and
// one decision per boss.
const TARGET_MS = 25;
const DECISION_TARGET_MS = 0.3;

// Each ground boss's runtime pursuit map build and its decisions over node pairs.
function decisionBench(seeds: number): number {
  interface Row {
    readonly builds: number[];
    readonly fresh: number[];
    readonly kept: number[];
  }
  const all: Row = { builds: [], fresh: [], kept: [] };
  const scripts = new Map<string, number>();
  const perBoss = new Map<string, Row>();
  const time = (run: () => unknown): number => {
    const begin = performance.now();
    run();
    return performance.now() - begin;
  };
  for (const stage of Object.keys(RECIPES).sort()) {
    const load = stageLoader(stage);
    for (let seed = 1; seed <= seeds; seed++) {
      for (const area of Object.values(load(seed).layout.areas)) {
        for (const object of area.objects) {
          let entry: ReturnType<typeof pursuitGroundMap>;
          const built = time(() => (entry = pursuitGroundMap(area, object)));
          const pace = object.behaviour?.pursuit?.pace;
          if (!entry || !pace) {
            continue;
          }
          const found = entry;
          const row = perBoss.get(object.character) ?? { builds: [], fresh: [], kept: [] };
          perBoss.set(object.character, row);
          row.builds.push(built);
          all.builds.push(built);
          const { map, terrain } = found;
          scripts.set(object.character, map.options.jumps.length);
          const world = { ...terrain.world, groundMap: () => found };
          const { body } = map.profile;
          for (const from of map.nodes) {
            const at = { x: from.left - body.offset.x, y: from.y - body.height - body.offset.y };
            for (const to of map.nodes) {
              const hers = {
                height: BIRD.height,
                width: BIRD.width,
                x: (to.left + to.right + body.width) / 2 - BIRD.width / 2,
                y: to.y - BIRD.height - EDGE / 2,
              };
              let plan: ReturnType<typeof planMapLeg>;
              const fresh = time(
                () => (plan = planMapLeg(world, object, found, pace, 1, undefined, at, hers)),
              );
              const kept = time(() =>
                planMapLeg(world, object, found, pace, 1, plan?.state, at, hers),
              );
              row.fresh.push(fresh);
              row.kept.push(kept);
              all.fresh.push(fresh);
              all.kept.push(kept);
            }
          }
        }
      }
    }
  }
  const most = (values: readonly number[]) => values.reduce((a, b) => Math.max(a, b), 0);
  console.log(
    `jump scripts per profile: ${[...scripts]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([boss, count]) => `${boss} ${count}`)
      .join(", ")}`,
  );
  console.log(
    "boss                 builds  build p50  build p95  decisions  new p50  new p95  new max" +
      "  kept p50  kept p95",
  );
  const rows = [...perBoss].sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [boss, row] of [...rows, ["all", all] as const]) {
    console.log(
      [
        boss.padEnd(20),
        String(row.builds.length).padStart(6),
        percentile(0.5, row.builds).toFixed(2).padStart(10),
        percentile(0.95, row.builds).toFixed(2).padStart(10),
        String(row.fresh.length).padStart(10),
        percentile(0.5, row.fresh).toFixed(3).padStart(8),
        percentile(0.95, row.fresh).toFixed(3).padStart(8),
        most(row.fresh).toFixed(3).padStart(8),
        percentile(0.5, row.kept).toFixed(3).padStart(9),
        percentile(0.95, row.kept).toFixed(3).padStart(9),
      ].join(" "),
    );
  }
  console.log(
    `new-route decision p95 ${percentile(0.95, all.fresh).toFixed(3)} ms, kept-route p95 ` +
      `${percentile(0.95, all.kept).toFixed(3)} ms, against the ${DECISION_TARGET_MS} ms ` +
      `target; build p95 ${percentile(0.95, all.builds).toFixed(2)} ms`,
  );
  return 0;
}

interface Sample {
  readonly boss: string;
  readonly edges: number;
  readonly key: string;
  readonly ms: number;
  readonly nodes: number;
  readonly stage: string;
  readonly steps: number;
}

function percentile(fraction: number, values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)] ?? NaN;
}

function count(name: string, value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new UsageError(`--${name} must be a positive integer`);
  }
  return parsed;
}

type WindowOption = "leash" | number;

function windowOption(value: string | undefined): WindowOption | undefined {
  return value === undefined || value === "leash" ? value : count("window", value, 1);
}

// The horizontal range clipped to the area bounds, at the area's full height.
function windowOf(option: WindowOption, terrain: MapTerrain, object: ObjectLayout): Rect {
  const { bounds } = terrain;
  const leash = object.behaviour!.pursuit!.distance;
  const centre = object.origin.x + object.width / 2;
  const [low, high] =
    option === "leash"
      ? [object.origin.x - leash, object.origin.x + object.width + leash]
      : [centre - (option * TILE) / 2, centre + (option * TILE) / 2];
  const x = Math.max(bounds.x, low);
  const width = Math.min(bounds.x + bounds.width, high) - x;
  return { height: bounds.height, width, x, y: bounds.y };
}

function mapBench(args: readonly string[]): number {
  const options = parseOptions(
    {
      decisions: { type: "boolean" },
      repeats: { type: "string" },
      seeds: { type: "string" },
      window: { type: "string" },
    },
    args,
  );
  if (options.help) {
    console.log(HELP);
    return 0;
  }
  const seeds = count("seeds", options.seeds, 3);
  if (options.decisions) {
    return decisionBench(seeds);
  }
  const repeats = count("repeats", options.repeats, 5);
  const window = windowOption(options.window);
  const samples: Sample[] = [];
  for (const stage of Object.keys(RECIPES).sort()) {
    const load = stageLoader(stage);
    for (let seed = 1; seed <= seeds; seed++) {
      for (const area of Object.values(load(seed).layout.areas)) {
        const seen = new Set<string>();
        for (const object of area.objects) {
          for (const entry of bossMovementProfiles(object)) {
            if (seen.has(entry.key)) {
              continue;
            }
            seen.add(entry.key);
            for (let repeat = 0; repeat < repeats; repeat++) {
              const start = performance.now();
              const terrain = mapTerrain({}, area);
              const clip =
                window === undefined ? {} : { window: windowOf(window, terrain, object) };
              const map =
                entry.kind === "ground"
                  ? groundMap({ jumps: BOSS_JUMP_SCRIPTS, ...clip }, terrain, entry.profile)
                  : flightMap(clip, terrain, object, entry.profile);
              const ms = performance.now() - start;
              samples.push({
                boss: object.character,
                edges: map.edges.length,
                key: entry.key,
                ms,
                nodes: map.nodes.length,
                stage: `${stage}#${seed}`,
                steps: "work" in map ? map.work.steps : 0,
              });
            }
          }
        }
      }
    }
  }
  const bosses = [...new Set(samples.map(({ boss }) => boss))].sort();
  console.log(
    "boss                 builds  nodes(max) edges(max) steps(max)  p50 ms  p95 ms  max ms",
  );
  for (const boss of [...bosses, "all"]) {
    const rows = samples.filter((sample) => boss === "all" || sample.boss === boss);
    const ms = rows.map((row) => row.ms);
    const max = (values: readonly number[]) => Math.max(...values);
    console.log(
      [
        boss.padEnd(20),
        String(rows.length).padStart(6),
        String(max(rows.map((row) => row.nodes))).padStart(11),
        String(max(rows.map((row) => row.edges))).padStart(10),
        String(max(rows.map((row) => row.steps))).padStart(10),
        percentile(0.5, ms).toFixed(2).padStart(7),
        percentile(0.95, ms).toFixed(2).padStart(7),
        max(ms).toFixed(2).padStart(7),
      ].join(" "),
    );
  }
  const slowest = [...samples].sort((a, b) => b.ms - a.ms)[0];
  if (slowest) {
    console.log(
      `slowest: ${slowest.boss} ${slowest.stage} ${slowest.ms.toFixed(2)} ms ${slowest.steps} steps`,
    );
  }
  const p95 = percentile(
    0.95,
    samples.map(({ ms }) => ms),
  );
  console.log(`p95 ${p95.toFixed(2)} ms against the ${TARGET_MS} ms target`);
  return 0;
}

runMain(import.meta.url, HELP, mapBench);
