// Certify, verify and report each zone's middle chunks (src/data/certified/<zone>.json). Run in
// the check container with no network: `npm run pairs -- <command>`. Proofs run on at most four
// worker threads, longest recorded work first; output is sorted and holds no timings, so it is
// identical for any worker count or machine.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";

import type { CertifiedChunks, CertifiedEntry, ZoneKey } from "../data/types";
import {
  type Candidate,
  dataHash,
  distinctLayouts,
  entryOf,
  feasibilityProblems,
  GAME_CONTEXT,
  hashOf,
  layoutOf,
  type Proof,
  proofsHash,
  prove,
  routeHash,
  structuralProblems,
  verifyStructure,
  zoneCandidates,
  ZONES,
} from "../testing/pairCertify";

const USAGE = `Usage:
  npm run pairs -- certify [--zone ZONE]... [--all]
      prove every candidate of each zone (all zones by default) and write its certified list;
      entries whose layout and route are unchanged keep their proofs unless --all or the proofs
      hash changed
  npm run pairs -- verify [--zone ZONE]... [--changed-since REF] [--sample-ms N]
      check every list's hashes and structure, fully prove entries that differ from REF's lists,
      then prove a deterministic sample within N ms (default 20000)
  npm run pairs -- report --out PATH
      write rejections, grade and encounter counts and distinct layouts per zone; refuses an
      existing PATH`;
const MAX_WORKERS = 4;
const listUrl = (zone: ZoneKey) => new URL(`../data/certified/${zone}.json`, import.meta.url);

// themes: the themes to walk, computed by the worker when left out.
interface Job {
  readonly id: string;
  readonly themes?: readonly string[];
  readonly zone: ZoneKey;
}

const candidatesByZone = new Map<ZoneKey, Map<string, Candidate>>();
function candidateOf(zone: ZoneKey, id: string): Candidate {
  let byId = candidatesByZone.get(zone);
  if (!byId) {
    byId = new Map(
      zoneCandidates(GAME_CONTEXT, zone).candidates.map((candidate) => [candidate.id, candidate]),
    );
    candidatesByZone.set(zone, byId);
  }
  const candidate = byId.get(id);
  if (!candidate) {
    throw new Error(`No candidate ${id} in ${zone}`);
  }
  return candidate;
}

// Runs every job on up to MAX_WORKERS threads, the costliest first, or, given a deadline, in
// order until it passes; results by job index, undefined for a job never started.
async function proveAll(
  jobs: readonly Job[],
  costs: readonly number[],
  deadline = Infinity,
): Promise<(Proof | undefined)[]> {
  const order = jobs
    .map((_, index) => index)
    .sort((a, b) => (deadline === Infinity ? costs[b]! - costs[a]! : 0) || a - b);
  const results = new Array<Proof | undefined>(jobs.length);
  const count = Math.min(MAX_WORKERS, availableParallelism(), order.length);
  let next = 0;
  let done = 0;
  const take = async (worker: Worker): Promise<void> => {
    if (next >= order.length || performance.now() > deadline) {
      return undefined;
    }
    const index = order[next++]!;
    results[index] = await new Promise<Proof>((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
      worker.postMessage(jobs[index]);
    });
    worker.removeAllListeners("error");
    done++;
    if (done % 20 === 0 || done === order.length) {
      console.error(`proved ${done} of ${order.length}`);
    }
    return take(worker);
  };
  await Promise.all(
    Array.from({ length: count }, async () => {
      const worker = new Worker(new URL(import.meta.url));
      try {
        await take(worker);
      } finally {
        await worker.terminate();
      }
    }),
  );
  return results;
}

function readList(zone: ZoneKey): CertifiedChunks | undefined {
  const url = listUrl(zone);
  return existsSync(url) ? (JSON.parse(readFileSync(url, "utf8")) as CertifiedChunks) : undefined;
}

async function writeList(list: CertifiedChunks): Promise<void> {
  const prettier = await import("prettier");
  const path = listUrl(list.zone);
  const options = (await prettier.resolveConfig(path)) ?? {};
  writeFileSync(
    path,
    await prettier.format(JSON.stringify(list), { ...options, filepath: path.pathname }),
  );
}

const ENCOUNTER_COST = 1_000_000;
const costOf = (candidate: Candidate, previous: CertifiedEntry | undefined) =>
  previous?.work ?? (candidate.chunk.encounters > 0 ? ENCOUNTER_COST : 0);

async function certify(zones: readonly ZoneKey[], all: boolean): Promise<number> {
  const proofs = proofsHash();
  const plans = zones.map((zone) => {
    const { candidates, rejected } = zoneCandidates(GAME_CONTEXT, zone);
    for (const { id, problems } of rejected) {
      console.log(`${zone} module ${id} rejected: ${problems.join("; ")}`);
    }
    const previous = readList(zone);
    const reuse = !all && previous?.inputs.proofs === proofs;
    const before = new Map((previous?.entries ?? []).map((entry) => [entry.id, entry]));
    const entries: CertifiedEntry[] = [];
    const pending: { candidate: Candidate; cost: number; job: Job; layout: string }[] = [];
    let failed = false;
    for (const candidate of candidates) {
      const problems = structuralProblems(zone, candidate);
      if (problems.length > 0) {
        console.log(`${zone} ${candidate.id} rejected: ${problems.join("; ")}`);
        failed ||= candidate.kind === "single";
        continue;
      }
      const { layout, themes } = layoutOf(zone, candidate);
      const old = before.get(candidate.id);
      if (reuse && old && old.layout === layout && old.route === routeHash(candidate)) {
        entries.push(entryOf(candidate, layout, old));
        continue;
      }
      pending.push({
        candidate,
        cost: costOf(candidate, old),
        job: { id: candidate.id, themes, zone },
        layout,
      });
    }
    console.error(`${zone}: ${entries.length} reused, ${pending.length} to prove`);
    return { candidates, entries, failed, pending, zone };
  });
  const queued = plans.flatMap(({ pending }) => pending);
  const results = await proveAll(
    queued.map(({ job }) => job),
    queued.map(({ cost }) => cost),
  );
  const proven = new Map(queued.map((item, index) => [item, results[index]!]));
  const lists = plans.flatMap(({ candidates, entries, failed, pending, zone }) => {
    let singleFailed = failed;
    for (const item of pending) {
      const proof = proven.get(item)!;
      if (proof.problems.length > 0) {
        console.log(`${zone} ${item.candidate.id} rejected: ${proof.problems.join("; ")}`);
        singleFailed ||= item.candidate.kind === "single";
      } else {
        entries.push(entryOf(item.candidate, item.layout, proof));
      }
    }
    entries.sort((a, b) => (a.id < b.id ? -1 : 1));
    const feasibility = feasibilityProblems(GAME_CONTEXT, zone, entries);
    for (const problem of feasibility) {
      console.log(`${zone} assembly: ${problem}`);
    }
    if (singleFailed || feasibility.length > 0) {
      console.log(`${zone}: not written; a single failed or a recipe cannot assemble`);
      return [undefined];
    }
    console.log(`${zone}: ${entries.length} certified`);
    return [
      {
        entries,
        inputs: { data: dataHash(GAME_CONTEXT, zone, candidates), proofs },
        version: 1 as const,
        zone,
      },
    ];
  });
  await Promise.all(lists.flatMap((list) => (list ? [writeList(list)] : [])));
  return lists.includes(undefined) ? 1 : 0;
}

function baseList(ref: string, zone: ZoneKey): CertifiedChunks | undefined {
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${ref}:src/data/certified/${zone}.json`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    ) as CertifiedChunks;
  } catch {
    return undefined;
  }
}

// A deterministic order seeded by the list's data hash: entries sorted by their hash with it.
const sampleOrder = (list: CertifiedChunks) =>
  [...list.entries].sort((a, b) => {
    const ka = hashOf([list.inputs.data, a.id]);
    const kb = hashOf([list.inputs.data, b.id]);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

async function verify(
  zones: readonly ZoneKey[],
  changedSince: string | undefined,
  sampleMs: number,
): Promise<number> {
  const problems: string[] = [];
  const lists = zones.flatMap((zone) => {
    const list = readList(zone);
    if (!list) {
      problems.push(`${zone}: no certified list`);
      return [];
    }
    problems.push(...verifyStructure(GAME_CONTEXT, list));
    return [list];
  });
  const check = async (
    targets: readonly { entry: CertifiedEntry; zone: ZoneKey }[],
    deadline = Infinity,
  ): Promise<number> => {
    const jobs = targets.map(({ entry, zone }) => ({ id: entry.id, zone }));
    const results = await proveAll(
      jobs,
      targets.map(({ entry }) => entry.work),
      deadline,
    );
    results.forEach((proof, index) => {
      const { entry, zone } = targets[index]!;
      if (
        proof &&
        (proof.problems.length > 0 || proof.trace !== entry.trace || proof.work !== entry.work)
      ) {
        problems.push(
          `${zone} ${entry.id}: proof differs: ${JSON.stringify({ ...proof, recorded: entry.trace })}`,
        );
      }
    });
    return results.filter((proof) => proof !== undefined).length;
  };
  if (problems.length === 0 && changedSince !== undefined) {
    const changed = lists.flatMap((list) => {
      const base = new Map(
        (baseList(changedSince, list.zone)?.entries ?? []).map((entry) => [entry.id, entry]),
      );
      return list.entries
        .filter((entry) => JSON.stringify(base.get(entry.id)) !== JSON.stringify(entry))
        .map((entry) => ({ entry, zone: list.zone }));
    });
    console.error(`proving ${changed.length} entries changed since ${changedSince}`);
    await check(changed);
  }
  if (problems.length === 0 && sampleMs > 0) {
    // Zones interleaved, so a short budget spans every zone.
    const orders = lists.map((list) =>
      sampleOrder(list).map((entry) => ({ entry, zone: list.zone })),
    );
    const longest = Math.max(0, ...orders.map((order) => order.length));
    const queue = Array.from({ length: longest }, (_, index) =>
      orders.flatMap((order) => order.slice(index, index + 1)),
    ).flat();
    const proved = await check(queue, performance.now() + sampleMs);
    console.error(`sampled ${proved} of ${queue.length} entries`);
  }
  for (const problem of problems) {
    console.log(problem);
  }
  return problems.length > 0 ? 1 : 0;
}

function report(zones: readonly ZoneKey[], out: string): number {
  if (existsSync(out)) {
    console.error(`Refusing existing --out ${out}`);
    return 2;
  }
  const result = Object.fromEntries(
    zones.map((zone) => {
      const { candidates, rejected } = zoneCandidates(GAME_CONTEXT, zone);
      const list = readList(zone);
      const listed = new Set(list?.entries.map(({ id }) => id));
      const layouts = list ? distinctLayouts(list) : undefined;
      const count = (key: "encounters" | "grade") =>
        Object.fromEntries(
          [...new Set(list?.entries.map((entry) => entry[key]))]
            .sort()
            .map((value) => [value, list!.entries.filter((entry) => entry[key] === value).length]),
        );
      return [
        zone,
        {
          candidates: candidates.length,
          distinctLayouts: layouts && {
            grades: Object.fromEntries(layouts.grades),
            total: layouts.total,
          },
          encounters: count("encounters"),
          entries: list?.entries.length ?? 0,
          grades: count("grade"),
          modulesRejected: rejected,
          unlisted: candidates
            .filter(({ id }) => !listed.has(id))
            .map((candidate) => ({
              id: candidate.id,
              problems: structuralProblems(zone, candidate),
            })),
        },
      ];
    }),
  );
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  return 0;
}

async function main(args: readonly string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...args],
      options: {
        all: { type: "boolean" },
        "changed-since": { type: "string" },
        help: { short: "h", type: "boolean" },
        out: { type: "string" },
        "sample-ms": { type: "string" },
        zone: { multiple: true, type: "string" },
      },
      strict: true,
    });
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    return 2;
  }
  const { positionals, values } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const zones = (values.zone ?? ZONES) as ZoneKey[];
  const unknown = zones.filter((zone) => !ZONES.includes(zone));
  const [command, ...rest] = positionals;
  if (unknown.length > 0 || rest.length > 0) {
    console.error(`Unknown zone or argument: ${[...unknown, ...rest].join(", ")}\n${USAGE}`);
    return 2;
  }
  switch (command) {
    case "certify":
      return certify(zones, values.all ?? false);
    case "verify": {
      const sampleMs = Number(values["sample-ms"] ?? 20_000);
      if (!Number.isFinite(sampleMs) || sampleMs < 0) {
        console.error(`Invalid --sample-ms ${values["sample-ms"]}\n${USAGE}`);
        return 2;
      }
      return verify(zones, values["changed-since"], sampleMs);
    }
    case "report":
      if (values.out === undefined) {
        console.error(`report needs --out\n${USAGE}`);
        return 2;
      }
      return report(zones, values.out);
    default:
      console.error(`Unknown command ${command ?? "(none)"}\n${USAGE}`);
      return 2;
  }
}

// A worker proves the jobs it is sent; the main thread runs the command.
if (!isMainThread) {
  parentPort!.on("message", (job: Job) => {
    const candidate = candidateOf(job.zone, job.id);
    parentPort!.postMessage(prove(candidate, job.themes ?? layoutOf(job.zone, candidate).themes));
  });
} else {
  process.exitCode = await main(process.argv.slice(2));
}
