// Path out of every pooled encounter, through src/sim/pathOut.ts.
import { locate, pathTo } from "@andornaut/game-kit/terrain/movementMap";
import { describe, expect, it } from "vitest";

import { TILE } from "../data/screen";
import { recipeChunkPool, themesOf } from "../rules/assemble";
import { ENCOUNTER_ROLES } from "../rules/modules";
import {
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  groundMap,
  groundMask,
} from "../rules/movementMaps";
import { CHUNK_LIBRARY, STAGE_RECIPES } from "../rules/zonePlans";
import { chunkLayout, ORDINARY } from "../testing/encounterLayouts";
import {
  ALLOW,
  edgeProblems,
  escapeProblems,
  hitboxAt,
  NO_DISABLED_EDGES,
  pathOut,
  pathOutEncounter,
  type PathOutOptions,
} from "./pathOut";

interface PathOutCase {
  readonly id: string;
  readonly theme: string;
}

function pooledEncounters(): readonly PathOutCase[] {
  const pools = Object.values(STAGE_RECIPES).flatMap((recipe) =>
    "sections" in recipe
      ? recipe.sections.map(({ chunks, theme }) => ({ chunks, theme }))
      : [{ chunks: recipeChunkPool(CHUNK_LIBRARY, recipe), theme: recipe.theme }],
  );
  const cases = new Map<string, PathOutCase>();
  for (const { chunks, theme } of pools) {
    for (const id of chunks) {
      const chunk = CHUNK_LIBRARY.chunks[id];
      if (
        chunk &&
        themesOf(chunk).includes(theme) &&
        chunk.objects.some(({ role }) => role !== undefined && ENCOUNTER_ROLES.has(role))
      ) {
        cases.set(`${id} ${theme}`, { id, theme });
      }
    }
  }
  return [...cases.values()].sort((a, b) => (`${a.id} ${a.theme}` < `${b.id} ${b.theme}` ? -1 : 1));
}

function encounter({ id, theme }: PathOutCase) {
  return pathOutEncounter(CHUNK_LIBRARY.chunks[id]!, chunkLayout(theme, id));
}

const pathOutOf = (options: Pick<PathOutOptions, "disabled">, subject: PathOutCase) =>
  pathOut({ ...options, chibi: ORDINARY }, encounter(subject));

const CASES = pooledEncounters();

// Layout problems for gameplay, by case: each must keep failing exactly so until its layout
// changes.
const KNOWN_PROBLEMS: Readonly<Record<string, readonly string[]>> = {};

// Each case builds its chunk's movement maps, which takes over 5 s on a CI runner.
describe("movement map path out", { timeout: 20_000 }, () => {
  it("covers every pooled encounter chunk", () => {
    expect(CASES.length).toBeGreaterThan(0);
    for (const key of Object.keys(KNOWN_PROBLEMS)) {
      expect(CASES.map(({ id, theme }) => `${id} ${theme}`)).toContain(key);
    }
  });
  it.each(CASES)("$id $theme", (subject) => {
    const result = pathOutOf({ disabled: NO_DISABLED_EDGES }, subject);
    expect(result.bosses).toBeGreaterThan(0);
    expect(result.problems).toEqual(KNOWN_PROBLEMS[`${subject.id} ${subject.theme}`] ?? []);
  });
});

describe("escape points", () => {
  const cases = CASES.filter(({ id }) => CHUNK_LIBRARY.chunks[id]!.escapes?.length);

  it("covers the pooled encounter chunks with escape points", () => {
    expect(cases.length).toBeGreaterThan(0);
  });
  it.each(cases)("$id $theme", (subject) => {
    const escapes = CHUNK_LIBRARY.chunks[subject.id]!.escapes ?? [];
    expect(escapeProblems({ chibi: ORDINARY, escapes }, encounter(subject))).toEqual([]);
  });
});

describe("patrol-cover-late regression", () => {
  const subject = { id: "patrol-cover-late", theme: "city-streets" };

  it("lets Archie reach the right block top from the floor below it", () => {
    const found = encounter(subject);
    const archie = found.bosses.find(({ character }) => character === "dog-antagonist")!;
    const entry = bossMovementProfiles(archie)[0]!;
    if (entry.kind !== "ground") {
      throw new Error("Expected Archie's ground profile");
    }
    const map = groundMap({ jumps: BOSS_JUMP_SCRIPTS }, found.terrain, entry.profile);
    const mask = groundMask({ allowed: ALLOW, climb: false, key: "pursuit" }, map);
    const below = locate(
      map,
      hitboxAt(map, 43.2 * TILE - map.profile.body.offset.x, archie.origin.y),
    )!;
    const path = pathTo(map, mask, below, { point: { x: 50 * TILE, y: 44 * TILE }, radius: TILE });
    expect(path).toBeDefined();
    for (const id of path!.edges) {
      expect(edgeProblems(found.terrain, archie, map, map.edges[id]!)).toBeUndefined();
    }
  });

  // Jumps and wall-tops are each the other's alternative over these blocks: either alone keeps
  // every route; without both, the yard floor between the blocks is a sink the checks report.
  it("reports the floor between the blocks once no edge can climb a block", () => {
    expect(pathOutOf({ disabled: NO_DISABLED_EDGES }, subject).problems).toEqual([]);
    expect(pathOutOf({ disabled: new Set(["wall-top"]) }, subject).problems).toEqual([]);
    expect(pathOutOf({ disabled: new Set(["jump", "wall-top"]) }, subject).problems).toContain(
      "dog-antagonist node 5 row 50.0 cols 24.0..43.3 is a sink",
    );
  });
});
