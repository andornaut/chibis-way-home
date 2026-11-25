// The acceptance batch: proves every acceptance arena once, in id order, then crosses every
// batched connector in each zone that lists it, and checks each against the acceptance targets
// (src/testing/arenaAcceptance.ts, src/testing/connectorAcceptance.ts). Run in the check
// container: `make acceptance`, or `npm run acceptance` inside one. Exits 1 when an arena or
// connector misses a target ACCEPTANCE_FAILURES does not list, or meets one it lists.
import {
  ACCEPTANCE_ARENAS,
  ACCEPTANCE_CONNECTORS,
  ACCEPTANCE_FAILURES,
  acceptanceProblems,
  connectorCases,
  connectorRoute,
  gameArenaOf,
  missedConnectorTargets,
  missedTargets,
  proveArena,
} from "../testing/index.ts";

const elapsed = (from: number) => Math.round((performance.now() - from) / 100) / 10;

const started = performance.now();
const arenas = ACCEPTANCE_ARENAS.map((id) => {
  const found = gameArenaOf(id);
  const at = performance.now();
  const proof = proveArena(found);
  const outcome = {
    missed: missedTargets(proof),
    seconds: elapsed(at),
    subject: id,
    work: proof.work,
    zone: found.zone,
  };
  console.log(JSON.stringify({ ...outcome, evidence: proof.evidence }));
  return outcome;
});
console.log("| Arena | Zone | Missed targets | Work | Seconds |");
console.log("| --- | --- | --- | --- | --- |");
for (const { missed, seconds, subject, work, zone } of arenas) {
  console.log(`| ${subject} | ${zone} | ${missed.join(", ") || "none"} | ${work} | ${seconds} |`);
}

const routesStarted = performance.now();
const routes = connectorCases(ACCEPTANCE_CONNECTORS).map((found) => {
  const route = connectorRoute(found.theme, found.connector);
  const outcome = { ...found, missed: missedConnectorTargets(route), ticks: route.ticks };
  console.log(JSON.stringify({ ...outcome, route }));
  return outcome;
});
console.log("| Connector | Zone | Theme | Missed targets | Ticks |");
console.log("| --- | --- | --- | --- | --- |");
for (const { connector, missed, theme, ticks, zone } of routes) {
  console.log(`| ${connector} | ${zone} | ${theme} | ${missed.join(", ") || "none"} | ${ticks} |`);
}
const connectors = ACCEPTANCE_CONNECTORS.map((subject) => {
  const cases = routes.filter(({ connector }) => connector === subject);
  // A connector no zone lists has no route, so it misses its target.
  const missed = cases.length === 0 ? ["ordinary-route" as const] : cases.flatMap((c) => c.missed);
  return { missed: [...new Set(missed)], subject };
});

const problems = acceptanceProblems(
  [...ACCEPTANCE_ARENAS, ...ACCEPTANCE_CONNECTORS],
  ACCEPTANCE_FAILURES,
  [...arenas, ...connectors],
);
for (const problem of problems) {
  console.error(problem);
}
console.log(
  `${arenas.length} arenas and ${routes.length} connector routes in ` +
    `${Math.round((performance.now() - started) / 1000)} s (routes ${elapsed(routesStarted)} s), ` +
    `${problems.length} problems`,
);
process.exitCode = problems.length > 0 ? 1 : 0;
