// The boss acceptance batch: proves every acceptance arena once, in id order, and checks each
// proof against the acceptance targets (src/testing/arenaAcceptance.ts). Run in the check
// container: `make acceptance`, or `npm run acceptance` inside one. Exits 1 when an arena misses
// a target ACCEPTANCE_FAILURES does not list, or meets one it lists.
import {
  ACCEPTANCE_ARENAS,
  ACCEPTANCE_FAILURES,
  acceptanceProblems,
  gameArenaOf,
  missedTargets,
  proveArena,
} from "../testing/index.ts";

const started = performance.now();
const outcomes = ACCEPTANCE_ARENAS.map((id) => {
  const found = gameArenaOf(id);
  const at = performance.now();
  const proof = proveArena(found);
  const outcome = {
    arena: id,
    missed: missedTargets(proof),
    seconds: Math.round((performance.now() - at) / 100) / 10,
    work: proof.work,
    zone: found.zone,
  };
  console.log(JSON.stringify({ ...outcome, evidence: proof.evidence }));
  return outcome;
});
const problems = acceptanceProblems(ACCEPTANCE_FAILURES, outcomes);
console.log("| Arena | Zone | Missed targets | Work | Seconds |");
console.log("| --- | --- | --- | --- | --- |");
for (const { arena, missed, seconds, work, zone } of outcomes) {
  console.log(`| ${arena} | ${zone} | ${missed.join(", ") || "none"} | ${work} | ${seconds} |`);
}
for (const problem of problems) {
  console.error(problem);
}
console.log(
  `${outcomes.length} arenas in ${Math.round((performance.now() - started) / 1000)} s, ${problems.length} problems`,
);
process.exitCode = problems.length > 0 ? 1 : 0;
