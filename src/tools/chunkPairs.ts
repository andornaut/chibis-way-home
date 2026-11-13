// Certify, verify and report each zone's middle chunks and arenas (src/data/certified/<zone>.json),
// every arena proved on every certify and sampled by verify. Run in
// the check container with no network: `npm run pairs -- <command>`. Proofs run on at most four
// worker threads, longest recorded work first; output is sorted and holds no timings, so it is
// identical for any worker count or machine.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";

import { ARENAS } from "../data/arenas/index.ts";
import type {
  CertifiedArena,
  CertifiedChunks,
  CertifiedEntry,
  OrdinaryProofProfile,
  ZoneKey,
} from "../data/types/index.ts";
import {
  ARENA_COST,
  certifiedArena,
  gameArenaOf,
  proveArena,
  verifyArenas,
  zoneArenas,
} from "../testing/arenaCertify.ts";
import {
  type Candidate,
  dataHash,
  distinctLayouts,
  entryOf,
  feasibilityProblems,
  GAME_CONTEXT,
  hashOf,
  layoutOf,
  ORDINARY_PROOF_PROFILE,
  type Proof,
  proofsHash,
  proveForProfile,
  routeHash,
  structuralProblems,
  verifyStructure,
  zoneCandidates,
  ZONES,
} from "../testing/pairCertify.ts";
import { completePairProposal, preparePairProposal } from "../testing/selectedCertification.ts";

const USAGE = `Usage:
  npm run pairs -- certify [--zone ZONE]... [--all]
      prove every candidate of each zone (all zones by default) and write its certified list;
      entries whose layout and route are unchanged keep their proofs unless --all or the proofs
      hash changed; every arena of the zone is proved: its static checks, required route, path
      out and evade playtest
  npm run pairs -- verify [--zone ZONE]... [--changed-since REF] [--sample-ms N] [--seed S]
      check every list's input hashes and structure against the tree, fully prove entries that
      differ from REF's lists (needs git), then prove a sample ordered by S (the lists' input
      hashes by default), starting only proofs whose recorded work fits within N ms of the start
      (default 20000)
  npm run pairs -- propose --zone ZONE --id ID... --profile ordinary --out SCRATCH_PATH
      prove only new selected pairs with ordinary tuning and write a scratch proposal;
      existing entries and arenas stay unchanged; no arena or assembly-feasibility proofs
  npm run pairs -- report --out PATH
      write rejections, grade and encounter counts and distinct layouts per zone; refuses an
      existing PATH`;
const MAX_WORKERS = 4;

// An entry verify proves: a pair or single, or an arena.
type Target =
  | { readonly entry: CertifiedEntry; readonly zone: ZoneKey }
  | { readonly entry: CertifiedArena; readonly zone: ZoneKey };
type ArenaResult = ReturnType<typeof proveArena>;
const listUrl = (zone: ZoneKey) => new URL(`../data/certified/${zone}.json`, import.meta.url);

// themes: the themes to walk, computed by the worker when left out. arena: the job proves an
// arena rather than a pair or single.
interface Job {
  readonly arena?: true;
  readonly id: string;
  readonly proof?: OrdinaryProofProfile;
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

// Recorded walk steps a worker proves per millisecond, a conservative start for the estimate a
// deadline uses; the observed rate replaces it as proofs finish.
const WORK_PER_MS = 4;

// Runs every job on up to MAX_WORKERS threads, the costliest first. Given a deadline, jobs run in
// order and a worker starts only one whose estimated time (its cost over the observed rate) ends
// before the deadline, skipping the rest; results by job index, undefined for a job not started.
async function proveAll(
  jobs: readonly Job[],
  costs: readonly number[],
  deadline = Infinity,
): Promise<(Proof | undefined)[]> {
  const bounded = deadline !== Infinity;
  const order = jobs
    .map((_, index) => index)
    .sort((a, b) => (bounded ? 0 : costs[b]! - costs[a]!) || a - b);
  const results = new Array<Proof | undefined>(jobs.length);
  const count = Math.min(MAX_WORKERS, availableParallelism(), order.length);
  let next = 0;
  let done = 0;
  let work = 0;
  let spent = 0;
  const fits = (index: number) =>
    !bounded ||
    performance.now() + costs[index]! / (spent > 0 ? work / spent : WORK_PER_MS) <= deadline;
  const take = async (worker: Worker): Promise<void> => {
    while (next < order.length && !fits(order[next]!)) {
      next++;
    }
    if (next >= order.length) {
      return undefined;
    }
    const index = order[next++]!;
    const started = performance.now();
    results[index] = await new Promise<Proof>((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
      worker.postMessage(jobs[index]);
    });
    worker.removeAllListeners("error");
    work += results[index].work;
    spent += performance.now() - started;
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
        job: {
          id: candidate.id,
          ...(old?.proof !== undefined && { proof: old.proof }),
          themes,
          zone,
        },
        layout,
      });
    }
    console.error(`${zone}: ${entries.length} reused, ${pending.length} to prove`);
    const arenas = zoneArenas(ARENAS, zone);
    return { arenas, candidates, entries, failed, pending, zone };
  });
  const queued = plans.flatMap(({ pending }) => pending);
  const arenaJobs = plans.flatMap(({ arenas, zone }) =>
    arenas.map((found) => ({ found, job: { arena: true as const, id: found.arena.id, zone } })),
  );
  const results = await proveAll(
    [...queued.map(({ job }) => job), ...arenaJobs.map(({ job }) => job)],
    [...queued.map(({ cost }) => cost), ...arenaJobs.map(() => ARENA_COST)],
  );
  const proven = new Map(queued.map((item, index) => [item, results[index]!]));
  const arenaProofs = new Map(
    arenaJobs.map(({ found }, index) => [found, results[queued.length + index] as ArenaResult]),
  );
  const lists = plans.flatMap(({ arenas, candidates, entries, failed, pending, zone }) => {
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
    const admitted: CertifiedArena[] = [];
    for (const found of arenas) {
      const proof = arenaProofs.get(found)!;
      console.error(JSON.stringify({ arena: found.arena.id, evidence: proof.evidence }));
      if (proof.problems.length > 0) {
        console.log(`${zone} ${found.arena.id} rejected: ${proof.problems.join("; ")}`);
      } else {
        admitted.push(certifiedArena(found, proof));
      }
    }
    console.log(`${zone}: ${entries.length} certified, ${admitted.length} arenas`);
    return [
      {
        arenas: admitted,
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

// REF's list for the zone: undefined when REF has none, and an error when git cannot read REF.
function baseList(ref: string, zone: ZoneKey): CertifiedChunks | undefined {
  const git = (args: readonly string[]) =>
    execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  try {
    git(["rev-parse", "--verify", `${ref}^{commit}`]);
  } catch {
    throw new Error(`git cannot read --changed-since ${ref}`);
  }
  try {
    return JSON.parse(git(["show", `${ref}:src/data/certified/${zone}.json`])) as CertifiedChunks;
  } catch {
    return undefined;
  }
}

// A deterministic order for a sample seed: entries sorted by their hash with it.
const sampleOrder = (seed: string, list: CertifiedChunks) =>
  [...list.entries].sort((a, b) => {
    const ka = hashOf([seed, a.id]);
    const kb = hashOf([seed, b.id]);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

interface VerifyOptions {
  readonly changedSince: string | undefined;
  readonly sampleMs: number;
  // Seeds the sample's order; the lists' input hashes by default, so it rotates as they change.
  readonly seed: string | undefined;
}

async function verify(options: VerifyOptions, zones: readonly ZoneKey[]): Promise<number> {
  const { changedSince, sampleMs } = options;
  const started = performance.now();
  const problems: string[] = [];
  const lists = zones.flatMap((zone) => {
    const list = readList(zone);
    if (!list) {
      problems.push(`${zone}: no certified list`);
      return [];
    }
    problems.push(...verifyStructure(GAME_CONTEXT, list), ...verifyArenas(list));
    return [list];
  });
  const check = async (targets: readonly Target[], deadline = Infinity): Promise<number> => {
    const jobs = targets.map((target) =>
      "hash" in target.entry
        ? { arena: true as const, id: target.entry.id, zone: target.zone }
        : {
            id: target.entry.id,
            ...(target.entry.proof !== undefined && { proof: target.entry.proof }),
            zone: target.zone,
          },
    );
    const results = await proveAll(
      jobs,
      targets.map(({ entry }) => ("hash" in entry ? ARENA_COST : entry.work)),
      deadline,
    );
    results.forEach((proof, index) => {
      const target = targets[index]!;
      if ("hash" in target.entry) {
        const arena = proof as ArenaResult | undefined;
        if (arena) {
          console.error(JSON.stringify({ arena: target.entry.id, evidence: arena.evidence }));
        }
        if (arena && (arena.problems.length > 0 || arena.hash !== target.entry.hash)) {
          problems.push(
            `${target.zone} ${target.entry.id}: arena proof differs: ${JSON.stringify({
              ...arena,
              recorded: target.entry.hash,
            })}`,
          );
        }
        return;
      }
      const { entry, zone } = target as { entry: CertifiedEntry; zone: ZoneKey };
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
    const changed = lists.flatMap((list): Target[] => {
      const old = baseList(changedSince, list.zone);
      const base = new Map((old?.entries ?? []).map((entry) => [entry.id, entry]));
      const arenas = new Map((old?.arenas ?? []).map((entry) => [entry.id, entry]));
      return [
        ...(list.arenas ?? [])
          .filter((entry) => JSON.stringify(arenas.get(entry.id)) !== JSON.stringify(entry))
          .map((entry) => ({ entry, zone: list.zone })),
        ...list.entries
          .filter((entry) => JSON.stringify(base.get(entry.id)) !== JSON.stringify(entry))
          .map((entry) => ({ entry, zone: list.zone })),
      ];
    });
    console.error(`proving ${changed.length} entries changed since ${changedSince}`);
    await check(changed);
  }
  if (problems.length === 0 && sampleMs > 0) {
    // Zones interleaved, so a short budget spans every zone.
    const seed = options.seed ?? hashOf(lists.map(({ inputs }) => inputs));
    const orders = lists.map((list): Target[] => [
      ...(list.arenas ?? []).map((entry) => ({ entry, zone: list.zone })),
      ...sampleOrder(seed, list).map((entry) => ({ entry, zone: list.zone })),
    ]);
    const longest = Math.max(0, ...orders.map((order) => order.length));
    const queue = Array.from({ length: longest }, (_, index) =>
      orders.flatMap((order) => order.slice(index, index + 1)),
    ).flat();
    const proved = await check(queue, started + sampleMs);
    console.error(`sampled ${proved} of ${queue.length} entries with seed ${seed}`);
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
        id: { multiple: true, type: "string" },
        out: { type: "string" },
        profile: { type: "string" },
        "sample-ms": { type: "string" },
        seed: { type: "string" },
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
  if (command !== "propose" && (values.id !== undefined || values.profile !== undefined)) {
    console.error(`Selection flags require propose\n${USAGE}`);
    return 2;
  }
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
      try {
        return await verify(
          { changedSince: values["changed-since"], sampleMs, seed: values.seed },
          zones,
        );
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 2;
      }
    }
    case "propose":
      if (
        zones.length !== 1 ||
        values.out === undefined ||
        values.profile !== "ordinary" ||
        values.id === undefined ||
        values.all ||
        values["changed-since"] !== undefined ||
        values["sample-ms"] !== undefined ||
        values.seed !== undefined
      ) {
        console.error(
          `propose requires one zone, IDs, ordinary profile and a scratch path\n${USAGE}`,
        );
        return 2;
      }
      try {
        const out = resolve(values.out);
        const scratch = realpathSync(tmpdir());
        const parent = realpathSync(dirname(out));
        const within = relative(scratch, parent);
        if (isAbsolute(within) || within === ".." || within.startsWith("../") || existsSync(out)) {
          throw new Error("Proposal output must be a new file within the scratch directory");
        }
        const current = readList(zones[0]!);
        if (current === undefined) {
          throw new Error("No existing certificate list");
        }
        const plan = preparePairProposal(zones[0]!, current, values.id);
        const results = await proveAll(
          plan.selected.map(({ candidate, themes }) => ({
            id: candidate.id,
            proof: ORDINARY_PROOF_PROFILE,
            themes,
            zone: zones[0]!,
          })),
          plan.selected.map(() => 0),
        );
        const proofs = results.map((proof) => {
          if (proof === undefined) {
            throw new Error("Selected proof did not run");
          }
          return proof;
        });
        const proposed = completePairProposal(plan, proofs);
        writeFileSync(
          out,
          `${JSON.stringify(
            {
              proposed,
              selected: plan.selected.map(({ candidate, layout, themes }, index) => ({
                id: candidate.id,
                layout,
                proof: proofs[index],
                themes,
              })),
              status: "proposal",
            },
            null,
            2,
          )}\n`,
          { flag: "wx" },
        );
        return 0;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 2;
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
    if (job.arena) {
      parentPort!.postMessage(proveArena(gameArenaOf(job.id)));
      return;
    }
    const candidate = candidateOf(job.zone, job.id);
    parentPort!.postMessage(
      proveForProfile(job.proof, candidate, job.themes ?? layoutOf(job.zone, candidate).themes),
    );
  });
} else {
  process.exitCode = await main(process.argv.slice(2));
}
