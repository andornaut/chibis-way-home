// Movement map build cost per boss profile per stage area: kernel steps (deterministic) and
// wall time. Run in the check container: npx tsx src/sim/mapBench.ts [--seeds 3] [--repeats 5].
import { RECIPES } from "../data/zones";
import {
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  flightMap,
  groundMap,
  mapTerrain,
} from "../rules/movementMaps";
import { stageLoader } from "./catalogue";
import { parseOptions, runMain, UsageError } from "./command";

const HELP = `Usage: npx tsx src/sim/mapBench.ts [--seeds <n>] [--repeats <n>]

Builds every boss's movement or air map for every stage area that places it, for layout seeds
1 to n (default 3), each build repeated (default 5), and prints work and wall time per profile.`;

// Contract target: a build per profile per area at or under this at the 95th percentile.
const TARGET_MS = 25;

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

function mapBench(args: readonly string[]): number {
  const options = parseOptions({ repeats: { type: "string" }, seeds: { type: "string" } }, args);
  if (options.help) {
    console.log(HELP);
    return 0;
  }
  const seeds = count("seeds", options.seeds, 3);
  const repeats = count("repeats", options.repeats, 5);
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
              const map =
                entry.kind === "ground"
                  ? groundMap({ jumps: BOSS_JUMP_SCRIPTS }, terrain, entry.profile)
                  : flightMap(terrain, object, entry.profile);
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
