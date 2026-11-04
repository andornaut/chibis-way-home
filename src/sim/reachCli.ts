// Prints the bird's measured reaches beside gameplay's targets: npm run reaches. Exits 1 when a
// reach is off its target.
import { BIRD } from "../data/bird";
import { REACH } from "../data/reach";
import { TILE } from "../data/screen";
import { parseOptions, runMain } from "./command";
import { measureReaches, type Reach } from "./reach";

const HELP = `npm run reaches
Prints the bird's measured reaches in tiles beside gameplay's targets.
Exits 1 when a reach is off its target and 2 on a usage error.`;

function reachCli(args: readonly string[]): number {
  if (parseOptions({}, args).help) {
    console.log(HELP);
    return 0;
  }
  const measured = measureReaches(BIRD, TILE);
  let off = false;
  for (const reach of Object.keys(REACH) as Reach[]) {
    const verdict = measured[reach] === REACH[reach] ? "ok" : "off";
    off ||= verdict === "off";
    console.log(`${reach}: ${measured[reach]} tiles, target ${REACH[reach]} (${verdict})`);
  }
  return off ? 1 : 0;
}

runMain(import.meta.url, HELP, reachCli);
