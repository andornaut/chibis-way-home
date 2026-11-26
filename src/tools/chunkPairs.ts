// Certify, verify and report each zone's middle chunks and arenas (src/data/certified/<zone>.json),
// every arena proved on every certify and sampled by verify. Run in
// the check container with no network: `npm run pairs -- <command>`. Proofs run on at most four
// worker threads, longest recorded work first; output is sorted and holds no timings, so it is
// identical for any worker count or machine.
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
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
import type { RunResult } from "../sim/index.ts";
import {
  ARENA_COST,
  type Candidate,
  canonicalApproachTrace,
  certificateFeasibilityProblems,
  certifiedArena,
  completeArenaApproachQualification,
  completeCurrentListProposal,
  completePairProposal,
  type CurrentListResult,
  dataHash,
  distinctLayouts,
  entryOf,
  feasibilityProblems,
  GAME_CONTEXT,
  gameArenaOf,
  hashOf,
  layoutOf,
  newEntryProofProfile,
  ORDINARY_PROOF_PROFILE,
  prepareCurrentListProposal,
  preparePairProposal,
  type Proof,
  proofsHash,
  proveArena,
  proveForProfile,
  routeHash,
  structuralProblems,
  verifyArenas,
  verifyStructure,
  zoneArenas,
  zoneCandidates,
  ZONES,
} from "../testing/index.ts";

const DEFAULT_SAMPLE_MS = 20_000;

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
      (default ${DEFAULT_SAMPLE_MS})
  npm run pairs -- propose --zone ZONE --id ID... --profile ordinary [--reprove-existing] --out SCRATCH_PATH
      write a scratch ordinary proposal for selected new pairs or legacy entries only
  npm run pairs -- qualify-approach --zone ZONE --stage STAGE --input PENDING_CERTIFICATE
      --result CANONICAL_RESULT --trace CANONICAL_RAW_TRACE --out SCRATCH_PATH
      record existing canonical cold-encounter evidence against the explicit pending certificate;
      validate the complete result and write exclusively; never simulate
  npm run pairs -- propose-current --out SCRATCH_PATH
      reprove only the six current lists and their recorded profiles and arenas;
      write scratch evidence, blocking any missing, failed or changed proof
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
  {
    costs,
    deadline = Infinity,
    observe,
  }: {
    readonly costs: readonly number[];
    readonly deadline?: number;
    readonly observe?: (index: number, result: Proof | undefined, error?: unknown) => void;
  },
  jobs: readonly Job[],
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
    try {
      results[index] = await new Promise<Proof>((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
        worker.postMessage(jobs[index]);
      });
      observe?.(index, results[index]);
    } catch (error) {
      observe?.(index, undefined, error);
      throw error;
    }
    worker.removeAllListeners("error");
    work += results[index].work;
    spent += performance.now() - started;
    done++;
    if (done % 20 === 0 || done === order.length) {
      console.error(`proved ${done} of ${order.length}`);
    }
    return take(worker);
  };
  const workers = Array.from({ length: count }, async () => {
    const worker = new Worker(new URL(import.meta.url));
    try {
      await take(worker);
    } finally {
      await worker.terminate();
    }
  });
  if (observe === undefined) {
    await Promise.all(workers);
  } else {
    const settled = await Promise.allSettled(workers);
    const failed = settled.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") {
      throw failed.reason;
    }
  }
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
    const newProfile = newEntryProofProfile(previous);
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
      const proof = old?.proof ?? newProfile;
      pending.push({
        candidate,
        cost: costOf(candidate, old),
        job: {
          id: candidate.id,
          ...(proof !== undefined && { proof }),
          themes,
          zone,
        },
        layout,
      });
    }
    console.error(`${zone}: ${entries.length} reused, ${pending.length} to prove`);
    const arenas = zoneArenas(ARENAS, zone);
    return { arenas, candidates, entries, failed, pending, previous, zone };
  });
  const queued = plans.flatMap(({ pending }) => pending);
  const arenaJobs = plans.flatMap(({ arenas, zone }) =>
    arenas.map((found) => ({ found, job: { arena: true as const, id: found.arena.id, zone } })),
  );
  const results = await proveAll(
    { costs: [...queued.map(({ cost }) => cost), ...arenaJobs.map(() => ARENA_COST)] },
    [...queued.map(({ job }) => job), ...arenaJobs.map(({ job }) => job)],
  );
  const proven = new Map(queued.map((item, index) => [item, results[index]!]));
  const arenaProofs = new Map(
    arenaJobs.map(({ found }, index) => [found, results[queued.length + index] as ArenaResult]),
  );
  const lists = plans.flatMap(
    ({ arenas, candidates, entries, failed, pending, previous, zone }) => {
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
      const next: CertifiedChunks = {
        ...(previous?.approaches === undefined ? {} : { approaches: previous.approaches }),
        arenas: admitted,
        entries,
        inputs: { data: dataHash(GAME_CONTEXT, zone, candidates), proofs },
        version: 1,
        zone,
      };
      const problems = verifyStructure(GAME_CONTEXT, next);
      if (problems.length > 0) {
        console.log(`${zone}: not written; ${problems.join("; ")}`);
        return [undefined];
      }
      return [next];
    },
  );
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
      { costs: targets.map(({ entry }) => ("hash" in entry ? ARENA_COST : entry.work)), deadline },
      jobs,
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

function scratchOutput(subject: string): string {
  const out = resolve(subject);
  const scratch = realpathSync(tmpdir());
  const parent = realpathSync(dirname(out));
  const checkout = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
  const inside = (root: string, path: string) => {
    const part = relative(root, path);
    return !isAbsolute(part) && part !== ".." && !part.startsWith(`..${sep}`);
  };
  if (!inside(scratch, parent) || inside(checkout, parent) || existsSync(out)) {
    throw new Error(
      "Proposal output must be a new file within the scratch directory and outside the checkout",
    );
  }
  return out;
}

async function proposeCurrent(subject: string): Promise<number> {
  const out = scratchOutput(subject);
  const plan = prepareCurrentListProposal(
    ZONES.map((zone) => ({
      contents: readFileSync(listUrl(zone), "utf8"),
      zone,
    })),
  );
  console.error(
    JSON.stringify({
      inventory: plan.lists.map(({ current, sha256 }) => ({
        arenas: current.arenas,
        entries: current.entries.map(({ id, proof }) => ({
          id,
          ...(proof !== undefined && { proof }),
        })),
        inputs: current.inputs,
        sha256,
        zone: current.zone,
      })),
      jobs: plan.jobs.length,
    }),
  );
  writeFileSync(out, `${JSON.stringify({ plan, status: "running" }, null, 2)}\n`, { flag: "wx" });
  const journal = openSync(`${out}.results.jsonl`, "wx");
  const results: CurrentListResult[] = [];
  let failure: string | undefined;
  try {
    await proveAll(
      {
        costs: plan.jobs.map((job) => (job.kind === "arena" ? ARENA_COST : job.previous.work)),
        observe: (index, proof, error) => {
          const job = plan.jobs[index]!;
          const identity = { id: job.previous.id, zone: job.zone };
          if (proof === undefined) {
            results.push({ ...identity, error: String(error), kind: "error" });
          } else if (job.kind === "arena") {
            results.push({ ...identity, kind: "arena", proof: proof as ArenaResult });
          } else {
            results.push({ ...identity, kind: "entry", proof });
          }
          writeSync(journal, `${JSON.stringify(results.at(-1))}\n`);
          fsyncSync(journal);
        },
      },
      plan.jobs.map((job) => ({
        id: job.previous.id,
        zone: job.zone,
        ...(job.kind === "arena"
          ? { arena: true as const }
          : {
              ...(job.previous.proof !== undefined && { proof: job.previous.proof }),
              themes: job.themes,
            }),
      })),
    );
  } catch (error) {
    failure = String(error);
  } finally {
    closeSync(journal);
  }
  const changed = plan.lists.filter(
    ({ contents, current }) => readFileSync(listUrl(current.zone), "utf8") !== contents,
  );
  const completed = completeCurrentListProposal(plan, results);
  const proposal =
    changed.length === 0
      ? completed
      : {
          ...completed,
          problems: [
            ...completed.problems,
            ...changed.map(
              ({ current }) => `${current.zone}: certificate preimage changed during execution`,
            ),
          ],
          proposed: undefined,
          status: "blocked",
        };
  writeFileSync(
    out,
    `${JSON.stringify({ ...proposal, ...(failure !== undefined && { failure }) }, null, 2)}\n`,
  );
  return proposal.status === "proposal" && failure === undefined ? 0 : 1;
}

const PROPOSE_OPTIONS = new Set(["id", "out", "profile", "reprove-existing", "zone"]);

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
        input: { type: "string" },
        out: { type: "string" },
        profile: { type: "string" },
        "reprove-existing": { type: "boolean" },
        result: { type: "string" },
        "sample-ms": { type: "string" },
        seed: { type: "string" },
        stage: { type: "string" },
        trace: { type: "string" },
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
  if (
    command !== "propose" &&
    [values.id, values.profile, values["reprove-existing"]].some((value) => value !== undefined)
  ) {
    console.error(`Selection flags require propose\n${USAGE}`);
    return 2;
  }
  if (unknown.length > 0 || rest.length > 0) {
    console.error(`Unknown zone or argument: ${[...unknown, ...rest].join(", ")}\n${USAGE}`);
    return 2;
  }
  if (
    command !== "qualify-approach" &&
    [values.input, values.result, values.stage, values.trace].some((value) => value !== undefined)
  ) {
    console.error(`Approach evidence flags require qualify-approach\n${USAGE}`);
    return 2;
  }
  switch (command) {
    case "qualify-approach": {
      const allowed = new Set(["input", "out", "result", "stage", "trace", "zone"]);
      if (
        values.zone?.length !== 1 ||
        values.input === undefined ||
        values.out === undefined ||
        values.result === undefined ||
        values.stage === undefined ||
        values.trace === undefined ||
        Object.keys(values).some((key) => !allowed.has(key))
      ) {
        console.error(`qualify-approach needs explicit evidence and a scratch output\n${USAGE}`);
        return 2;
      }
      try {
        const out = scratchOutput(values.out);
        const list = JSON.parse(readFileSync(values.input, "utf8")) as CertifiedChunks;
        if (list.zone !== zones[0]) {
          throw new Error("Pending certificate zone does not match --zone");
        }
        const result = JSON.parse(readFileSync(values.result, "utf8")) as RunResult;
        const trace = await canonicalApproachTrace(result, values.trace);
        const next = completeArenaApproachQualification(
          {
            stage: values.stage,
            trace,
          },
          list,
          result,
        );
        const problems = [
          ...verifyArenas(next),
          ...certificateFeasibilityProblems(GAME_CONTEXT, next),
        ];
        if (problems.length > 0) {
          throw new Error(problems.join("; "));
        }
        writeFileSync(out, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx" });
        return 0;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 2;
      }
    }
    case "propose-current":
      if (values.out === undefined || Object.keys(values).some((key) => key !== "out")) {
        console.error(`propose-current accepts only a scratch --out path\n${USAGE}`);
        return 2;
      }
      try {
        return await proposeCurrent(values.out);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 2;
      }
    case "certify":
      return certify(zones, values.all ?? false);
    case "verify": {
      const sampleMs = Number(values["sample-ms"] ?? DEFAULT_SAMPLE_MS);
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
        Object.keys(values).some((key) => !PROPOSE_OPTIONS.has(key))
      ) {
        console.error(
          `propose requires one zone, IDs, ordinary profile and a scratch path\n${USAGE}`,
        );
        return 2;
      }
      try {
        const out = scratchOutput(values.out);
        const zone = zones[0]!;
        const reprove = values["reprove-existing"] === true;
        const preimage = reprove ? readFileSync(listUrl(zone), "utf8") : undefined;
        const current =
          preimage === undefined ? readList(zone) : (JSON.parse(preimage) as CertifiedChunks);
        if (current === undefined) {
          throw new Error("No existing certificate list");
        }
        const plan = preparePairProposal(zone, current, values.id, reprove);
        const results = await proveAll(
          { costs: plan.selected.map(({ previous }) => previous?.work ?? 0) },
          plan.selected.map(({ candidate, themes }) => ({
            id: candidate.id,
            proof: ORDINARY_PROOF_PROFILE,
            themes,
            zone,
          })),
        );
        const proofs = results.map((proof) => {
          if (proof === undefined) {
            throw new Error("Selected proof did not run");
          }
          return proof;
        });
        const selected = plan.selected.map(({ candidate, layout, previous, themes }, index) => ({
          id: candidate.id,
          layout,
          ...(previous !== undefined && { previous }),
          proof: proofs[index],
          themes,
        }));
        let proposed: CertifiedChunks | undefined;
        let failure: string | undefined;
        try {
          if (preimage !== undefined && readFileSync(listUrl(zone), "utf8") !== preimage) {
            throw new Error("Certificate preimage changed during execution");
          }
          proposed = completePairProposal(plan, proofs);
        } catch (error) {
          if (!reprove) {
            throw error;
          }
          failure = String(error);
        }
        const result =
          failure === undefined
            ? { proposed, selected, status: "proposal" }
            : { error: failure, selected, status: "blocked" };
        writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
        return failure === undefined ? 0 : 1;
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
