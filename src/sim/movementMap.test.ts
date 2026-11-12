// Path out of an encounter, through src/sim/pathOut.ts.
import { locate, pathTo } from "@andornaut/game-kit/terrain/movementMap";
import { describe, expect, it } from "vitest";

import { TILE } from "../data/screen.ts";
import {
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  groundMap,
  groundMask,
} from "../rules/movementMaps.ts";
import { arenaLayout, sampleArenaCase } from "../testing/arenas.ts";
import { ORDINARY } from "../testing/encounterLayouts.ts";
import {
  ALLOW,
  edgeProblems,
  hitboxAt,
  NO_DISABLED_EDGES,
  pathOut,
  pathOutEncounter,
  type PathOutOptions,
} from "./pathOut.ts";

// Archie's sample arena: a floor at row 80, under the deck at row 74 a nook whose two-row step
// runs from col 28 to col 38.
const found = sampleArenaCase("dog-antagonist");
const encounter = () => pathOutEncounter(found.chunk, arenaLayout(found));
const pathOutOf = (options: Pick<PathOutOptions, "disabled">) =>
  pathOut({ ...options, chibi: ORDINARY }, encounter());

// Each case builds the arena's movement maps, which takes over 5 s on a CI runner.
describe("Archie's sample arena path out", { timeout: 20_000 }, () => {
  it("lets Archie reach the deck from the floor below it", () => {
    const subject = encounter();
    const archie = subject.bosses.find(({ character }) => character === "dog-antagonist")!;
    const entry = bossMovementProfiles(archie)[0]!;
    if (entry.kind !== "ground") {
      throw new Error("Expected Archie's ground profile");
    }
    const map = groundMap({ jumps: BOSS_JUMP_SCRIPTS }, subject.terrain, entry.profile);
    const mask = groundMask({ allowed: ALLOW, climb: false, key: "pursuit" }, map);
    const { body } = map.profile;
    const below = locate(
      map,
      hitboxAt(map, 46 * TILE - body.offset.x, 80 * TILE - body.height - body.offset.y),
    )!;
    const path = pathTo(map, mask, below, { point: { x: 50 * TILE, y: 74 * TILE }, radius: TILE });
    expect(path).toBeDefined();
    for (const id of path!.edges) {
      expect(edgeProblems(subject.terrain, archie, map, map.edges[id]!)).toBeUndefined();
    }
  });

  // Jumps and wall-tops are each the other's alternative up to the deck where Archie spawns: either
  // alone keeps every route; without both, the floor has no pursuit path back to his spawn.
  it("reports the floor without a path to the spawn once no edge can climb", () => {
    expect(pathOutOf({ disabled: NO_DISABLED_EDGES }).problems).toEqual([]);
    expect(pathOutOf({ disabled: new Set(["wall-top"]) }).problems).toEqual([]);
    expect(
      pathOutOf({ disabled: new Set(["jump", "wall-top"]) }).problems.some(
        (problem) =>
          problem.startsWith("dog-antagonist ") &&
          problem.endsWith(" has no pursuit path to the spawn"),
      ),
    ).toBe(true);
  });
});
