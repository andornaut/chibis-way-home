import type { ArenaProof } from "./arenaCertify.ts";
import { EVADE_LIMIT_SECONDS, EVADE_SEEDS, EVADE_SLOWED, EVADE_STARTS } from "./evade.ts";

// The boss acceptance batch (src/tools/arenaAcceptance.ts): every admitted arena proved once
// with its stage's boss, from the evade playtest's fixed seeds and starts.
export const ACCEPTANCE_ARENAS: readonly string[] = [
  "arena-bear-ravine",
  "arena-dog-city-boundary",
  "arena-ferret-penthouse",
  "arena-ferret-residential-floors",
  "arena-goose-river-crossing",
  "arena-pigeon-freight-terminal",
  "arena-raccoon-familiar-neighbourhood",
];

export type AcceptanceTarget =
  | "alive-exits"
  | "evade-runs"
  | "path-out"
  | "required-routes"
  | "slowed"
  | "static";

// ACCEPTANCE TARGETS: what every arena's proof meets, from the Evidence rule of
// gameplay/bosses.md.
export const ACCEPTANCE_TARGETS: Readonly<Record<AcceptanceTarget, string>> = {
  "alive-exits": `every run exits alive within ${EVADE_LIMIT_SECONDS} s of the boss first acquiring Chibi, with a route switch or loop level change`,
  "evade-runs": `${EVADE_SEEDS.length} seeds from each of ${EVADE_STARTS.length} starts`,
  "path-out": "every boss spawn, reachable spot and Chibi refuge has a path out",
  "required-routes": "the encounter profile's required walks clear, slots empty and filled",
  slowed: `at least ${EVADE_SLOWED.runs} runs exit ${EVADE_SLOWED.seconds} s or more after the boss-free walk`,
  static: "the arena's shape, routes, refuges and counters pass its static checks",
};

// ACCEPTANCE FAILURES: the targets an arena currently misses, each with what its proof shows. A
// failure never weakens its target; a fix that meets one fails the batch until it is removed.
export interface AcceptanceFailure {
  readonly arena: string;
  readonly cause: string;
  readonly target: AcceptanceTarget;
}
export const ACCEPTANCE_FAILURES: readonly AcceptanceFailure[] = [];

// The targets an arena's proof misses.
export function missedTargets({ evidence }: Pick<ArenaProof, "evidence">): AcceptanceTarget[] {
  const { evade, pathOut, requiredRoutes } = evidence.functional;
  const runs = EVADE_SEEDS.length * EVADE_STARTS.length;
  const missed: AcceptanceTarget[] = [];
  if (evade.status !== "passed" || evade.aliveExits !== runs || evade.runsWithProblems > 0) {
    missed.push("alive-exits");
  }
  if (evade.status === "not_evaluated" || evade.runs !== runs) {
    missed.push("evade-runs");
  }
  if (pathOut.status !== "passed") {
    missed.push("path-out");
  }
  if (requiredRoutes.status !== "passed") {
    missed.push("required-routes");
  }
  if (
    evidence.challenge.status === "not_evaluated" ||
    evidence.challenge.slowedRuns < EVADE_SLOWED.runs
  ) {
    missed.push("slowed");
  }
  if (evidence.static.status !== "passed") {
    missed.push("static");
  }
  return missed;
}

// Why a batch's outcomes fail it: an arena missing or extra, a missed target the failures do not
// list, or a listed failure the arena now meets.
export function acceptanceProblems(
  failures: readonly AcceptanceFailure[],
  outcomes: readonly { readonly arena: string; readonly missed: readonly AcceptanceTarget[] }[],
): string[] {
  const proved = outcomes.map(({ arena }) => arena).sort();
  const problems =
    proved.join() === [...ACCEPTANCE_ARENAS].sort().join()
      ? []
      : [`proved ${proved.join(", ")}, not the acceptance arenas`];
  for (const { arena, missed } of outcomes) {
    for (const target of missed) {
      if (!failures.some((entry) => entry.arena === arena && entry.target === target)) {
        problems.push(`${arena} misses ${target}: ${ACCEPTANCE_TARGETS[target]}`);
      }
    }
  }
  for (const { arena, target } of failures) {
    const outcome = outcomes.find((entry) => entry.arena === arena);
    if (outcome && !outcome.missed.includes(target)) {
      problems.push(`${arena} now meets ${target}; remove its acceptance failure`);
    }
  }
  return problems;
}
