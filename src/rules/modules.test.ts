import { describe, expect, it } from "vitest";

import { ARCHETYPES } from "../data/archetypes";
import { CHARACTERS } from "../data/characters";
import { CHUNK_RULES, THEMES } from "../data/chunks";
import { MODULE_RULES } from "../data/modules";
import { SEAM_ROWS } from "../data/seams";
import type { ChunkModule, Difficulty, ZoneKey } from "../data/types";
import { ZONE_FRAMES } from "../data/zoneFrames";
import { CROSSWALK_FIXTURE_CATALOGUE } from "../testing/chunks";
import { FIXTURE_MODULES } from "../testing/modules";
import { composePair, moduleProblems, pairGrade, pairProblems } from "./modules";
import { validateOrbitReferences } from "./orbit";
import { areaLayout } from "./tiles";

const {
  "fixture-patrol": patrol,
  "fixture-red-strip": strip,
  "fixture-step": step,
} = FIXTURE_MODULES as Readonly<Record<string, ChunkModule>> & {
  readonly "fixture-patrol": ChunkModule;
  readonly "fixture-red-strip": ChunkModule;
  readonly "fixture-step": ChunkModule;
};
const CONTEXT = {
  catalogue: { archetypes: ARCHETYPES, characters: CHARACTERS },
  chunkRules: CHUNK_RULES,
  frames: ZONE_FRAMES,
  rules: MODULE_RULES,
  seams: SEAM_ROWS,
  themes: THEMES,
};
const pair = (zone: ZoneKey, left: ChunkModule, right: ChunkModule) =>
  composePair({ frame: ZONE_FRAMES[zone], grades: {}, rules: MODULE_RULES, zone }, left, right);

describe("pairGrade", () => {
  it.each([
    [3, 3, 3],
    [3, 4, 4],
    [4, 3, 4],
    [2, 5, 5],
    [4, 4, 5],
    [4, 5, 5],
    [5, 5, 5],
  ] as const)("grades %i and %i as %i", (left, right, grade) => {
    expect(pairGrade(left as Difficulty, right as Difficulty)).toBe(grade);
  });
});

describe("pairProblems", () => {
  it.each([
    ["compatible halves", "blue", step, strip, []],
    [
      "a right-only module on the left",
      "blue",
      strip,
      step,
      ["fixture-red-strip does not fill the left half"],
    ],
    [
      "unequal joint rows",
      "blue",
      step,
      { ...strip, entry: { row: 70 } },
      ["joint rows 80 and 70 differ"],
    ],
    [
      "a zone one half omits",
      "countryside",
      step,
      strip,
      ["fixture-red-strip is not authored for countryside"],
    ],
    [
      "two encounter halves",
      "blue",
      patrol,
      { ...strip, encounters: 1 },
      ["both halves hold an encounter"],
    ],
  ] as const)("%s", (_, zone, left, right, problems) => {
    expect(pairProblems(zone, left, right)).toEqual(problems);
  });
});

describe("moduleProblems", () => {
  it.each(Object.values(FIXTURE_MODULES))("accepts $id", (module) => {
    expect(moduleProblems(CONTEXT, module)).toEqual([]);
  });

  it.each([
    [
      "an id with the pair separator",
      { ...step, id: "a--b" },
      'id a--b is not kebab-case without "--"',
    ],
    [
      "terrain across the joint",
      { ...step, solids: [...step.solids, { col: 28, cols: 4, look: "ground", row: 70, rows: 4 }] },
      "terrain at col 28 row 70 is outside the module",
    ],
    [
      "a gap in the joint footing",
      {
        ...step,
        sides: ["left"],
        solids: [{ col: 0, cols: 29, look: "ground", row: 80, rows: 40 }],
      },
      "street left joint exit: no terrain top at row 80 in cols 29",
    ],
    [
      "an encounter count without its antagonist",
      { ...step, encounters: 1 },
      "encounters 1 for 0 antagonist objects",
    ],
    [
      "an encounter without an escape point",
      { ...patrol, escapes: [] },
      "an encounter module has no designed escape point",
    ],
    [
      "no mandatory challenge",
      { ...step, route: { profile: "primary" } },
      "no mandatory challenge: no route target, hazard or mover",
    ],
  ] as const)("rejects %s", (_, module, problem) => {
    expect(moduleProblems(CONTEXT, module as ChunkModule)).toContain(problem);
  });
});

describe("composePair", () => {
  it("names the pair by zone and halves and shifts the right half one module", () => {
    const { chunk, id } = pair("blue", step, strip);
    expect(id).toBe("blue-fixture-step--fixture-red-strip");
    expect(chunk.cols).toBe(2 * MODULE_RULES.cols);
    expect(chunk.rows).toBe(MODULE_RULES.rows);
    expect(chunk.solids.map(({ col }) => col)).toEqual([0, 12, 30]);
    expect(chunk.objects).toEqual([{ ...strip.objects[0], col: 42 }]);
    expect(chunk.slots).toEqual([
      { area: { col: 52, cols: 4, row: 76, rows: 4 }, id: "right:door", kind: "door" },
    ]);
    expect(chunk.theme).toEqual(ZONE_FRAMES.blue.themes);
    expect(chunk.maxPerZone).toBe(1);
  });

  it("orders objects left, right, then each half's zone additions", () => {
    const extra = { character: "platform-ledge", col: 4, cols: 4, row: 60 };
    const { chunk } = pair(
      "blue",
      { ...patrol, zoneObjects: { blue: [extra] } },
      { ...strip, zoneObjects: { blue: [extra] } },
    );
    expect(chunk.objects.map(({ character, col }) => `${character}@${col}`)).toEqual([
      "dog-antagonist@22",
      "red-edge-top@42",
      "platform-ledge@4",
      "platform-ledge@34",
    ]);
  });

  it("takes the harder route profile and applies the grade rule and its override", () => {
    const composed = pair("blue", patrol, strip);
    expect(composed.route.profile).toBe("encounter");
    expect(composed.chunk.difficulty).toBe(5);
    expect(composed.chunk.encounters).toBe(1);
    const overridden = composePair(
      {
        frame: ZONE_FRAMES.blue,
        grades: { "fixture-patrol--fixture-red-strip": 4 },
        rules: MODULE_RULES,
        zone: "blue",
      },
      patrol,
      strip,
    );
    expect(overridden.chunk.difficulty).toBe(4);
  });

  it("shifts the right half's route targets", () => {
    expect(pair("blue", step, step).route.targets).toEqual([
      { at: { col: 14, row: 77 } },
      { at: { col: 44, row: 77 } },
    ]);
  });

  it("applies the zone frame", () => {
    const frame = ZONE_FRAMES.industrial;
    const composed = composePair(
      { frame, grades: {}, rules: MODULE_RULES, zone: "industrial" },
      { ...step, zones: ["industrial"] },
      { ...step, zones: ["industrial"] },
    );
    expect(composed.chunk).toEqual(
      frame.frame({ ...pair("blue", step, step).chunk, theme: frame.themes }),
    );
    expect(composed.chunk.solids.length).toBe(5);
  });

  it("shifts and prefixes escape points by half", () => {
    const right = { ...patrol, sides: ["right"] as const };
    const { chunk } = composePair(
      { frame: ZONE_FRAMES.blue, grades: {}, rules: MODULE_RULES, zone: "blue" },
      step,
      right,
    );
    expect(chunk.escapes).toEqual([
      {
        area: { col: 34, cols: 4, row: 76, rows: 4 },
        from: { col: 33, row: 80 },
        id: "right:door",
        kind: "door",
        to: { col: 39, row: 80 },
      },
    ]);
  });

  it("scopes each half's instance ids and the references that name them", () => {
    const shared: ChunkModule = {
      ...step,
      objects: [
        { character: "test-crosswalk-strip", col: 5, id: "strip", row: 79 },
        { character: "test-crosswalk-signal", col: 3, phaseSource: "strip", row: 73 },
        { character: "platform-ledge", col: 8, id: "host", row: 60 },
        {
          character: "platform-ledge",
          col: 8,
          orbit: { angularSpeed: 1, host: "host", kind: "circle", phase: 0, radius: 4 },
          row: 60,
        },
      ],
    };
    const { chunk } = pair("blue", shared, shared);
    expect(
      chunk.objects.map(({ id, orbit, phaseSource }) => [id, phaseSource, orbit?.host]),
    ).toEqual([
      ["left:strip", undefined, undefined],
      [undefined, "left:strip", undefined],
      ["left:host", undefined, undefined],
      [undefined, undefined, "left:host"],
      ["right:strip", undefined, undefined],
      [undefined, "right:strip", undefined],
      ["right:host", undefined, undefined],
      [undefined, undefined, "right:host"],
    ]);
    const ids = validateOrbitReferences(chunk.objects);
    expect([ids.get("left:host"), ids.get("right:host")]).toEqual([2, 6]);
    const area = areaLayout(1, CROSSWALK_FIXTURE_CATALOGUE, {}, {}, new Set(), {
      cols: 2 * MODULE_RULES.cols,
      entries: { start: { col: 2, row: 80 } },
      objects: chunk.objects.filter(({ character }) => character.startsWith("test-crosswalk")),
      rows: MODULE_RULES.rows,
      solids: chunk.solids,
    });
    expect(area.objects.map(({ phaseSource }) => phaseSource)).toEqual([
      undefined,
      0,
      undefined,
      2,
    ]);
  });

  it("refuses an incompatible pair", () => {
    expect(() => pair("blue", strip, step)).toThrow("does not fill the left half");
  });
});
