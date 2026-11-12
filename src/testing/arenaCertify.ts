// The arena step of certification: each arena of a zone passes its static checks, then its
// required route (encounter profile) with slots empty and filled, its boss's path out and the
// evade playtest, in its stage's theme only.
import { readFileSync } from "node:fs";

import { traceRecorder } from "../ai/trace.ts";
import { BIRD_FRAME } from "../assets/index.ts";
import { ARENAS } from "../data/arenas/index.ts";
import { BIRD } from "../data/bird.ts";
import { TILE } from "../data/screen.ts";
import type { CertifiedArena, CertifiedChunks, ChunkArena, ZoneKey } from "../data/types/index.ts";
import { zoneLayout } from "../rules/tiles.ts";
import { CHUNK_LIBRARY } from "../rules/zonePlans.ts";
import { NO_DISABLED_EDGES, pathOut } from "../sim/pathOut.ts";
import { zoneTraceLine } from "../sim/zoneTrace.ts";
import { crosses, surfaceAt, walkRequiredRoutes } from "../sim/zoneWalk.ts";
import {
  type ArenaCase,
  arenaCase,
  arenaLayout,
  arenaMaps,
  arenaPlan,
  arenaProblems,
} from "./arenas.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "./art.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import { EVADE_SLOWED, type EvadeRun, evadeRuns } from "./evade.ts";
import { hashOf } from "./pairCertify.ts";
import { moduleRouteTargets, slotFills } from "./requiredRoutes.ts";

// Recorded walk ticks an arena proof takes, a cost hint for scheduling and sampling.
export const ARENA_COST = 60_000;

export interface ArenaProof {
  readonly evidence: ArenaEvidence;
  readonly hash: string;
  readonly problems: readonly string[];
  readonly trace: string;
  readonly work: number;
}

type EvidenceStatus = "failed" | "not_evaluated" | "passed";
type EvaluatedEvidence<T> =
  { readonly status: "not_evaluated" } | (T & { readonly status: "failed" | "passed" });
interface ProblemEvidence {
  readonly problems: readonly string[];
}
export interface ArenaEvidence {
  readonly static: ProblemEvidence & { readonly status: EvidenceStatus };
  readonly functional: {
    readonly requiredRoutes: EvaluatedEvidence<ProblemEvidence & { readonly profiles: number }>;
    readonly pathOut: EvaluatedEvidence<ProblemEvidence>;
    readonly evade: EvaluatedEvidence<{
      readonly runs: number;
      readonly aliveExits: number;
      readonly deaths: number;
      readonly runsWithProblems: number;
      readonly work: number;
      readonly searchUnknown: "not_recorded";
      readonly repeatedStarts: readonly string[];
    }>;
  };
  readonly challenge: EvaluatedEvidence<{
    readonly slowedRuns: number;
    readonly requiredRuns: number;
    readonly seconds: number;
  }>;
  readonly humanPlayability: { readonly status: "not_evaluated" };
}
interface ArenaEvidenceInput {
  readonly staticProblems: readonly string[];
  readonly requiredRoutes?: ProblemEvidence & { readonly profiles: number };
  readonly pathOut?: ProblemEvidence;
  readonly evade?: {
    readonly runs: readonly EvadeRun[];
    readonly repeatedStarts: readonly string[];
    readonly slowedRuns: number;
  };
}

// Describes already executed proofs. It does not certify additional behaviour or run physics.
export function summariseArenaEvidence(
  challenge: { readonly runs: number; readonly seconds: number },
  input: ArenaEvidenceInput,
): ArenaEvidence {
  const status = (problems: readonly string[]): "failed" | "passed" =>
    problems.length > 0 ? "failed" : "passed";
  const notEvaluated = { status: "not_evaluated" } as const;
  const evaluated = input.staticProblems.length === 0;
  const routes = evaluated ? input.requiredRoutes : undefined;
  const path = evaluated ? input.pathOut : undefined;
  const evade = evaluated ? input.evade : undefined;
  return {
    challenge: evade
      ? {
          requiredRuns: challenge.runs,
          seconds: challenge.seconds,
          slowedRuns: evade.slowedRuns,
          status: evade.slowedRuns >= challenge.runs ? "passed" : "failed",
        }
      : notEvaluated,
    functional: {
      evade: evade
        ? {
            aliveExits: evade.runs.filter(
              (run) => run.exit !== undefined && run.death === undefined,
            ).length,
            deaths: evade.runs.filter((run) => run.death !== undefined).length,
            repeatedStarts: [...evade.repeatedStarts],
            runs: evade.runs.length,
            runsWithProblems: evade.runs.filter((run) => run.problems.length > 0).length,
            searchUnknown: "not_recorded",
            status:
              evade.runs.some((run) => run.problems.length > 0) || evade.repeatedStarts.length > 0
                ? "failed"
                : "passed",
            work: evade.runs.reduce((total, run) => total + run.work, 0),
          }
        : notEvaluated,
      pathOut: path
        ? { problems: [...path.problems], status: status(path.problems) }
        : notEvaluated,
      requiredRoutes: routes
        ? {
            problems: [...routes.problems],
            profiles: routes.profiles,
            status: status(routes.problems),
          }
        : notEvaluated,
    },
    humanPlayability: notEvaluated,
    static: { problems: [...input.staticProblems], status: status(input.staticProblems) },
  };
}

// The game's arenas whose stage lies in the zone, sorted by id.
export function zoneArenas(arenas: readonly ChunkArena[], zone: ZoneKey): ArenaCase[] {
  return arenas
    .map((arena) => arenaCase(CHUNK_LIBRARY, arena))
    .filter((found) => found.zone === zone)
    .sort((a, b) => (a.arena.id < b.arena.id ? -1 : 1));
}

export const gameArenaOf = (id: string): ArenaCase => {
  const arena = ARENAS.find((candidate) => candidate.id === id);
  if (!arena) {
    throw new Error(`No arena ${id}`);
  }
  return arenaCase(CHUNK_LIBRARY, arena);
};

const gameKit = (): string =>
  (
    JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      readonly dependencies: Readonly<Record<string, string>>;
    }
  ).dependencies["@andornaut/game-kit"] ?? "";

// Every proof of the arena. Its hash covers the arena's data, its chunk, the required walk and
// evade trace hashes and the game-kit release.
export function proveArena(found: ArenaCase): ArenaProof {
  const layout = arenaLayout(found);
  const problems = arenaProblems(found, layout);
  const recorder = traceRecorder({ retain: false });
  let work = 0;
  if (problems.length > 0) {
    return {
      evidence: summariseArenaEvidence(EVADE_SLOWED, { staticProblems: problems }),
      hash: "",
      problems,
      trace: recorder.hash(),
      work,
    };
  }
  // The encounter profile's targets, less any on terrain the zone frame marks out of reach (the
  // Industrial roof).
  const unreachable = new Set(
    (found.chunk.outOfReach ?? []).map(({ col, row }) => `${col},${row}`),
  );
  const targets = moduleRouteTargets(
    found.library,
    { profile: "encounter", targets: found.arena.route.targets ?? [] },
    found.chunk,
  ).filter(({ at }) => !unreachable.has(`${at.col},${at.row}`));
  const fills = (found.chunk.slots?.length ?? 0) > 0 ? slotFills(found.chunk) : undefined;
  let profiles = 0;
  for (const [profile, fill] of [
    ["empty", { door: [], event: [] }],
    ...(fills ? [["filled", fills] as const] : []),
  ] as const) {
    profiles++;
    const plan = arenaPlan(fill, found);
    const walked = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
    const area = plan.start.area;
    const walk = walkRequiredRoutes(
      BIRD,
      {
        onStep: (stepped, seconds, before, after) => {
          recorder.record(zoneTraceLine(stepped, seconds, before, after));
          work++;
        },
        targets: targets.map((target) => ({ ...target, area })),
        tile: TILE,
      },
      walked,
    );
    if (!walk.complete) {
      problems.push(`${profile}: required routes incomplete`);
    }
    for (const { from, to } of plan.areas[area]?.noCross ?? []) {
      const start = surfaceAt(TILE, walk.surfaces, area, from);
      const end = surfaceAt(TILE, walk.surfaces, area, to);
      if (!start || !end || crosses(BIRD, walked, walk.surfaces, start, end)) {
        problems.push(`${profile}: crossed no-cross ${from.col},${from.row}`);
      }
    }
  }
  const requiredRouteProblems = [...problems];
  const maps = arenaMaps(found, layout);
  const out = pathOut({ chibi: ORDINARY, disabled: NO_DISABLED_EDGES }, maps.encounter);
  if (out.bosses === 0) {
    problems.push("no pursuing boss");
  }
  problems.push(...out.problems.map((problem) => `path out: ${problem}`));
  const pathOutProblems = problems.slice(requiredRouteProblems.length);
  const runs = evadeRuns({ found, layout, maps });
  for (const run of runs) {
    work += run.work;
    problems.push(
      ...run.problems.map((problem) => `evade ${run.start} seed ${run.seed}: ${problem}`),
    );
  }
  // The boss slows him: enough runs exit well behind their boss-free walk.
  const slowed = runs.filter(
    ({ exit, free }) =>
      exit !== undefined && free !== undefined && exit - free >= EVADE_SLOWED.seconds - 1e-6,
  ).length;
  if (slowed < EVADE_SLOWED.runs) {
    problems.push(
      `evade: slowed by ${EVADE_SLOWED.seconds} s in ${slowed} of ${runs.length} runs, ` +
        `fewer than ${EVADE_SLOWED.runs}`,
    );
  }
  const repeatedStarts: string[] = [];
  // The mid start must test a state the entry start does not reach.
  for (const run of runs.filter(({ start }) => start === "mid")) {
    const entry = runs.find(({ seed, start }) => start === "entry" && seed === run.seed);
    if (entry?.trace === run.trace) {
      const problem = `evade mid seed ${run.seed}: repeats the entry run`;
      problems.push(problem);
      repeatedStarts.push(problem);
    }
  }
  const trace = recorder.hash();
  return {
    evidence: summariseArenaEvidence(EVADE_SLOWED, {
      evade: { repeatedStarts, runs, slowedRuns: slowed },
      pathOut: { problems: pathOutProblems },
      requiredRoutes: { problems: requiredRouteProblems, profiles },
      staticProblems: [],
    }),
    hash: hashOf({
      arena: found.arena,
      chunk: found.chunk,
      evade: runs.map(({ trace: run }) => run),
      gameKit: gameKit(),
      route: trace,
    }),
    problems,
    trace,
    work,
  };
}

export const certifiedArena = (found: ArenaCase, proof: ArenaProof): CertifiedArena => ({
  hash: proof.hash,
  id: found.arena.id,
  stage: found.arena.stage,
});

// Why a list's arenas are stale or malformed, if they are: sorted by unique id, each a current
// arena of the zone with its recorded stage, passing its static checks.
export function verifyArenas(list: CertifiedChunks): string[] {
  const problems: string[] = [];
  const arenas = list.arenas ?? [];
  const ids = arenas.map(({ id }) => id);
  if (ids.some((id, index) => index > 0 && ids[index - 1]! >= id)) {
    problems.push(`${list.zone}: arenas are not sorted by unique id`);
  }
  const byId = new Map(zoneArenas(ARENAS, list.zone).map((found) => [found.arena.id, found]));
  for (const entry of arenas) {
    const found = byId.get(entry.id);
    if (!found || found.arena.stage !== entry.stage) {
      problems.push(`${entry.id}: not an arena of ${entry.stage} in ${list.zone}`);
      continue;
    }
    problems.push(
      ...arenaProblems(found, arenaLayout(found)).map((problem) => `${entry.id}: ${problem}`),
    );
  }
  return problems;
}
