import { createHash } from "node:crypto";

import type { Archetype, Character, Instance, StageRecipe, ZonePlan } from "../data/types";
import type { ChunkLibrary } from "../rules/assemble";
export interface PlayabilityContext {
  readonly archetypes: Readonly<Record<string, Archetype>>;
  readonly catalogue: readonly {
    readonly id: string;
    readonly stages: readonly string[];
  }[];
  readonly library: ChunkLibrary & { readonly characters: Readonly<Record<string, Character>> };
  readonly load: (seed: number, stage: string) => ZonePlan;
  readonly provenance: {
    readonly data: string;
    readonly source: string;
  };
  readonly recipes: Readonly<Record<string, StageRecipe>>;
}
type Counts = Readonly<Record<string, number>>;
interface Selection {
  readonly area: string;
  readonly col: number;
  readonly cols: number;
  readonly cap: boolean;
  readonly difficulty: number;
  readonly encounters: number;
  readonly id: string;
  readonly mechanics: readonly string[];
}
export interface StageAssessment {
  readonly areas: readonly {
    readonly cols: number;
    readonly id: string;
    readonly rows: number;
  }[];
  readonly authoredTargets: StageRecipe | null;
  readonly chunks: readonly Selection[];
  readonly demandFingerprint: string;
  readonly difficultyDistribution: Counts;
  readonly geometryFingerprint: string;
  readonly middleDifficultyDistribution: Counts;
  readonly longestEncounterFreeChunkRunPerAreaCols: number;
  readonly geometry: readonly {
    readonly area: string;
    readonly solidTopRows: readonly number[];
    readonly verticalSpanRows: number;
    readonly terrainProjectionGaps: readonly {
      readonly col: number;
      readonly cols: number;
    }[];
  }[];
  readonly encounters: number;
  readonly id: string;
  readonly provenance: PlayabilityContext["provenance"];
  readonly lengthCols: number;
  readonly mechanics: Counts;
  readonly mechanicsPer100Cols: Counts;
  readonly repeatedAdjacentSignatures: number;
  readonly seed: number;
  readonly uniqueSignatures: number;
  readonly zone: string;
}
export interface PlayabilityReport {
  readonly comparisons: readonly {
    readonly first: string;
    readonly jaccardPresence: number;
    readonly meanFrequencyDifferencePer100Cols: number;
    readonly second: string;
    readonly shared: readonly string[];
    readonly uniqueFirst: readonly string[];
    readonly uniqueSecond: readonly string[];
  }[];
  readonly limitations: readonly string[];
  readonly provenance: PlayabilityContext["provenance"];
  readonly schema: 1;
  readonly seeds: readonly number[];
  readonly stages: readonly StageAssessment[];
  readonly units: {
    readonly density: string;
    readonly difficulty: string;
    readonly length: string;
  };
  readonly zones: readonly {
    readonly chunks: number;
    readonly encounters: number;
    readonly id: string;
    readonly lengthCols: number;
    readonly mechanics: Counts;
    readonly mechanicsPer100Cols: Counts;
    readonly uniqueChunkIds: number;
    readonly uniqueSignatures: number;
  }[];
}
const LIMITATIONS = [
  "Structural inventory, not a playthrough or proof of reachability, safety or human difficulty.",
  "Authored grades are ordinal labels, not measured player difficulty; fixed caps are included.",
  "Mechanics count placed objects once per capability, not attacks, frames or required route usage.",
  "Chunk signatures describe mechanics present, not a proven order of player actions.",
  "Encounter totals come from selected chunk metadata; encounter-free chunk runs reset at each area boundary.",
  "Terrain projection gaps and solid-top spans are geometry proxies, not required jumps.",
  "Signatures include terrain/object bounds and reachable graph logic/numeric tuning.",
  "Signatures exclude artwork collision pixels, animation tags, text and skins.",
  "Lengths sum area widths, not travelled distance; no successful-clear time is measured or estimated.",
] as const;
function increment(counts: Record<string, number>, key: string, amount = 1): void {
  counts[key] = (counts[key] ?? 0) + amount;
}
function sorted(counts: Counts): Counts {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}
function density(cols: number, counts: Counts): Counts {
  return sorted(
    Object.fromEntries(Object.entries(counts).map(([key, n]) => [key, (100 * n) / cols])),
  );
}
// Signatures include numeric physical data and reachable graph logic, excluding drawing/text.
function fingerprint(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      return item.map(canonical);
    }
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, canonical(entry)]),
      );
    }
    return item;
  };
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex")}`;
}
function physicalObject(context: PlayabilityContext, object: Instance) {
  const character = context.library.characters[object.character]!;
  const archetype = context.archetypes[character.archetype]!;
  return {
    collision: archetype.collision,
    cols: object.cols ?? character.cols,
    rows: object.rows ?? character.rows,
  };
}
function demand(context: PlayabilityContext, object: Instance): unknown {
  const character = context.library.characters[object.character]!;
  const archetype = context.archetypes[character.archetype]!;
  const graph = object.behaviour ?? character.behaviour;
  const states: Record<string, unknown> = {};
  if (graph) {
    const pending = [graph.initial];
    while (pending.length) {
      const key = pending.pop()!;
      if (Object.hasOwn(states, key)) {
        continue;
      }
      const node = graph.states[key]!;
      states[key] = {
        enter: node.enter ?? null,
        motion: node.motion,
        onEnter: (node.onEnter ?? []).map((action) => {
          if (action.kind === "force-pulse") {
            return Object.fromEntries(Object.entries(action).filter(([key]) => key !== "visual"));
          }
          const template = action.character;
          const spawn = Object.fromEntries(
            Object.entries(action).filter(
              ([key]) => key !== "armingAnimation" && key !== "character",
            ),
          );
          return {
            ...spawn,
            template: {
              ...physicalObject(context, { character: template, col: 0, row: 0 }),
              tuning: context.library.characters[template]?.tuning ?? null,
            },
          };
        }),
        track: node.track ?? null,
        transitions: node.transitions,
      };
      pending.push(...node.transitions.map(({ to }) => to));
    }
  }
  return {
    behaviour: graph
      ? { axis: graph.axis, distance: graph.distance, initial: graph.initial, states }
      : null,
    collision: archetype.collision,
    motion: { ...archetype.motion, ...character.tuning?.motion, ...object.overrides?.motion },
    phase: object.phase ?? 0,
    reaction: {
      ...archetype.reaction,
      ...character.tuning?.reaction,
      ...object.overrides?.reaction,
    },
  };
}

// Uses resolved placed objects, including theme/instance behaviour overrides, never pool names.
function objectMechanics(context: PlayabilityContext, object: Instance): readonly string[] {
  const character: Character | undefined = context.library.characters[object.character];
  if (!character) {
    throw new Error(`Unknown character ${object.character}`);
  }
  const archetype = context.archetypes[character.archetype];
  if (!archetype) {
    throw new Error(`Unknown archetype ${character.archetype}`);
  }
  if (archetype.collision === "none") {
    return [];
  }
  const tags = new Set<string>();
  const graph = object.behaviour ?? character.behaviour;
  if (archetype.collision === "hazard") {
    tags.add("lethal-contact");
  }
  if (archetype.collision === "ledge") {
    tags.add("one-way-ledge");
  }
  const art = object.skin?.art ?? character.art;
  if (art.startsWith("hazard-")) {
    tags.add(`edge:${art.slice("hazard-".length)}`);
  }
  if (graph) {
    const pending = [graph.initial];
    const visited = new Set<string>();
    while (pending.length) {
      const state = pending.pop()!;
      if (visited.has(state)) {
        continue;
      }
      visited.add(state);
      const node = graph.states[state];
      if (!node) {
        throw new Error(`Unknown behaviour state ${state}`);
      }
      pending.push(...node.transitions.map(({ to }) => to));
      const motion = node.motion;
      if (motion.kind === "move") {
        tags.add(`mover:${node.track?.axis ?? graph.axis}`);
        if (motion.direction === "target") {
          tags.add("target-pursuit");
        }
        if (motion.direction === "facing") {
          tags.add("committed-charge");
        }
      } else if (motion.kind === "fly") {
        tags.add(motion.to === "target" ? "target-locked-flight" : "waypoint-flight");
      } else if (motion.kind === "hop") {
        tags.add("hop");
      }
      for (const action of node.onEnter ?? []) {
        if (action.kind === "force-pulse") {
          tags.add("force-gust");
        } else {
          tags.add(action.armSeconds > 0 ? "armed-spawn" : "projectile-spawn");
        }
      }
    }
  } else {
    const motion = {
      ...archetype.motion,
      ...character.tuning?.motion,
      ...object.overrides?.motion,
    };
    if (motion.algorithm !== "static") {
      tags.add(`motion:${motion.algorithm}`);
    }
  }
  return [...tags].sort();
}
export function assessPlayability(
  context: PlayabilityContext,
  seeds: readonly number[],
): PlayabilityReport {
  if (
    seeds.length === 0 ||
    seeds.length > 16 ||
    new Set(seeds).size !== seeds.length ||
    seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
  ) {
    throw new Error("Supply 1 to 16 distinct explicit unsigned 32-bit seeds");
  }
  if (!context.provenance.source.trim() || !context.provenance.data.trim()) {
    throw new Error("Source and data provenance are required");
  }
  const ids = context.catalogue.flatMap(({ stages }) => stages);
  if (
    ids.length === 0 ||
    ids.length > 64 ||
    new Set(ids).size !== ids.length ||
    context.catalogue.some(({ stages }) => stages.length === 0)
  ) {
    throw new Error("Catalogue needs 1 to 64 unique stage IDs");
  }
  const stages: StageAssessment[] = [];
  for (const zone of context.catalogue) {
    for (const id of zone.stages) {
      for (const seed of seeds) {
        const plan = context.load(seed, id);
        const order = plan.areaOrder ?? Object.keys(plan.areas).sort();
        if (
          order.length !== Object.keys(plan.areas).length ||
          new Set(order).size !== order.length
        ) {
          throw new Error(`Incomplete area order for ${id}`);
        }
        const mechanics: Record<string, number> = {};
        const physicalAreas: unknown[] = [];
        const demands: unknown[] = [];
        const difficultyDistribution: Record<string, number> = {};
        const middleDifficultyDistribution: Record<string, number> = {};
        const recipe = context.recipes[id];
        const geometry: {
          area: string;
          solidTopRows: number[];
          verticalSpanRows: number;
          terrainProjectionGaps: {
            col: number;
            cols: number;
          }[];
        }[] = [];
        const chunks: Selection[] = [];
        const areas = order.map((areaId) => {
          const area = plan.areas[areaId];
          if (!area || !Number.isFinite(area.cols) || area.cols <= 0) {
            throw new Error(`Invalid area ${areaId}`);
          }
          const tops = [...new Set(area.solids.map(({ row }) => row))].sort((a, b) => a - b);
          const terrainProjectionGaps: {
            col: number;
            cols: number;
          }[] = [];
          let edge = 0;
          for (const solid of [...area.solids].sort((a, b) => a.col - b.col)) {
            if (solid.col > edge) {
              terrainProjectionGaps.push({ col: edge, cols: solid.col - edge });
            }
            edge = Math.max(edge, solid.col + solid.cols);
          }
          if (edge < area.cols) {
            terrainProjectionGaps.push({ col: edge, cols: area.cols - edge });
          }
          geometry.push({
            area: areaId,
            solidTopRows: tops,
            terrainProjectionGaps,
            verticalSpanRows: tops.length ? tops.at(-1)! - tops[0]! : 0,
          });
          const objects = area.objects.map((object) => ({
            object,
            tags: objectMechanics(context, object),
          }));
          const physical = objects.filter(
            ({ object }) => physicalObject(context, object).collision !== "none",
          );
          physicalAreas.push({
            cols: area.cols,
            objects: physical
              .map(({ object }) => ({
                ...physicalObject(context, object),
                col: object.col,
                row: object.row,
              }))
              .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
            rows: area.rows,
            solids: area.solids
              .map(({ col, cols, row, rows }) => ({ col, cols, row, rows }))
              .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
          });
          demands.push(
            physical
              .map(({ object }) => ({
                ...physicalObject(context, object),
                col: object.col,
                demand: demand(context, object),
                row: object.row,
              }))
              .sort((a, b) => fingerprint(a).localeCompare(fingerprint(b))),
          );
          for (const { tags } of objects) {
            for (const tag of tags) {
              increment(mechanics, tag);
            }
          }
          for (const placed of area.chunks ?? []) {
            const chunk = context.library.chunks[placed.chunk];
            if (!chunk) {
              throw new Error(`Unknown selected chunk ${placed.chunk}`);
            }
            const tags = new Set(
              objects
                .filter(
                  ({ object }) => object.col >= placed.col && object.col < placed.col + placed.cols,
                )
                .flatMap(({ tags }) => tags),
            );
            if (chunk.exit.row !== chunk.entry.row) {
              const tag = chunk.exit.row < chunk.entry.row ? "seam-rise" : "seam-descent";
              tags.add(tag);
              increment(mechanics, tag);
            }
            const cap = placed.chunk === recipe?.start || placed.chunk === recipe?.finish;
            if (!cap) {
              increment(middleDifficultyDistribution, String(chunk.difficulty));
            }
            increment(difficultyDistribution, String(chunk.difficulty));
            chunks.push({
              area: areaId,
              cap,
              col: placed.col,
              cols: placed.cols,
              difficulty: chunk.difficulty,
              encounters: chunk.encounters,
              id: placed.chunk,
              mechanics: [...tags].sort(),
            });
          }
          return { cols: area.cols, id: areaId, rows: area.rows };
        });
        const lengthCols = areas.reduce((n, area) => n + area.cols, 0);
        const signatures = chunks.map((chunk) => chunk.mechanics.join(","));
        let longestEncounterFreeChunkRunPerAreaCols = 0,
          emptyRun = 0,
          previousArea = "";
        for (const chunk of chunks) {
          if (chunk.area !== previousArea || chunk.encounters > 0) {
            emptyRun = 0;
          }
          if (chunk.encounters === 0) {
            emptyRun += chunk.cols;
          }
          longestEncounterFreeChunkRunPerAreaCols = Math.max(
            longestEncounterFreeChunkRunPerAreaCols,
            emptyRun,
          );
          previousArea = chunk.area;
        }
        stages.push({
          areas,
          authoredTargets: context.recipes[id] ?? null,
          chunks,
          demandFingerprint: fingerprint(demands),
          difficultyDistribution: sorted(difficultyDistribution),
          encounters: chunks.reduce((n, chunk) => n + chunk.encounters, 0),
          geometry,
          geometryFingerprint: fingerprint(physicalAreas),
          id,
          lengthCols,
          longestEncounterFreeChunkRunPerAreaCols,
          mechanics: sorted(mechanics),
          mechanicsPer100Cols: density(lengthCols, mechanics),
          middleDifficultyDistribution: sorted(middleDifficultyDistribution),
          provenance: context.provenance,
          repeatedAdjacentSignatures: signatures.filter(
            (signature, index) =>
              index > 0 &&
              chunks[index]!.area === chunks[index - 1]!.area &&
              signature === signatures[index - 1],
          ).length,
          seed,
          uniqueSignatures: new Set(signatures).size,
          zone: zone.id,
        });
      }
    }
  }
  const zones = context.catalogue.map(({ id }) => {
    const rows = stages.filter((stage) => stage.zone === id);
    const mechanics: Record<string, number> = {};
    for (const row of rows) {
      for (const [key, n] of Object.entries(row.mechanics)) {
        increment(mechanics, key, n);
      }
    }
    const lengthCols = rows.reduce((n, row) => n + row.lengthCols, 0);
    return {
      chunks: rows.reduce((n, row) => n + row.chunks.length, 0),
      encounters: rows.reduce((n, row) => n + row.encounters, 0),
      id,
      lengthCols,
      mechanics: sorted(mechanics),
      mechanicsPer100Cols: density(lengthCols, mechanics),
      uniqueChunkIds: new Set(rows.flatMap((row) => row.chunks.map((chunk) => chunk.id))).size,
      uniqueSignatures: new Set(
        rows.flatMap((row) => row.chunks.map((chunk) => chunk.mechanics.join(","))),
      ).size,
    };
  });
  const comparisons = zones.flatMap((first, index) =>
    zones.slice(index + 1).map((second) => {
      const a = Object.keys(first.mechanics),
        b = Object.keys(second.mechanics);
      const union = [...new Set([...a, ...b])].sort();
      const shared = a.filter((tag) => b.includes(tag));
      return {
        first: first.id,
        jaccardPresence: union.length ? shared.length / union.length : 1,
        meanFrequencyDifferencePer100Cols: union.length
          ? union.reduce(
              (n, key) =>
                n +
                Math.abs(
                  (first.mechanicsPer100Cols[key] ?? 0) - (second.mechanicsPer100Cols[key] ?? 0),
                ),
              0,
            ) / union.length
          : 0,
        second: second.id,
        shared,
        uniqueFirst: a.filter((tag) => !b.includes(tag)),
        uniqueSecond: b.filter((tag) => !a.includes(tag)),
      };
    }),
  );
  return {
    comparisons,
    limitations: LIMITATIONS,
    provenance: context.provenance,
    schema: 1,
    seeds: [...seeds],
    stages,
    units: {
      density: "mechanic occurrences per 100 summed area columns, pooled across seeds",
      difficulty: "authored ordinal grade; counts include fixed caps",
      length: "tiles (summed area widths)",
    },
    zones,
  };
}
export function comparePlayability(before: PlayabilityReport, after: PlayabilityReport) {
  const keys = (report: PlayabilityReport) =>
    report.stages.map(({ id, seed, zone }) => `${zone}:${id}:${seed}`);
  if (
    before.schema !== after.schema ||
    JSON.stringify(keys(before)) !== JSON.stringify(keys(after)) ||
    JSON.stringify(before.seeds) !== JSON.stringify(after.seeds) ||
    JSON.stringify(before.units) !== JSON.stringify(after.units)
  ) {
    throw new Error("Incompatible metric schema, units, stage order or seeds");
  }
  return {
    after: after.provenance,
    before: before.provenance,
    configurationChanged:
      JSON.stringify(before.stages.map(({ authoredTargets }) => authoredTargets)) !==
      JSON.stringify(after.stages.map(({ authoredTargets }) => authoredTargets)),
    stages: after.stages.map((stage, index) => ({
      demandChanged: stage.demandFingerprint !== before.stages[index]!.demandFingerprint,
      encountersDelta: stage.encounters - before.stages[index]!.encounters,
      geometryChanged: stage.geometryFingerprint !== before.stages[index]!.geometryFingerprint,
      id: stage.id,
      lengthColsDelta: stage.lengthCols - before.stages[index]!.lengthCols,
      mechanicsPer100ColsDelta: Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(stage.mechanics),
            ...Object.keys(before.stages[index]!.mechanics),
          ]),
        ]
          .sort()
          .map((key) => [
            key,
            (stage.mechanicsPer100Cols[key] ?? 0) -
              (before.stages[index]!.mechanicsPer100Cols[key] ?? 0),
          ]),
      ),
      seed: stage.seed,
      sequenceChanged:
        JSON.stringify(stage.chunks) !== JSON.stringify(before.stages[index]!.chunks),
    })),
  };
}
export function formatPlayabilityMarkdown(report: PlayabilityReport): string {
  const cell = (s: string | number) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
  const row = (cells: readonly (string | number)[]) => `| ${cells.map(cell).join(" | ")} |`;
  return [
    "# Structural playability assessment",
    "",
    `Source: ${cell(report.provenance.source)}. Data: ${cell(report.provenance.data)}.`,
    `Seeds: ${report.seeds.join(", ")}.`,
    "",
    ...report.limitations.map((line) => `- ${line}`),
    "",
    `Density: ${report.units.density}.`,
    "",
    row([
      "Stage",
      "Seed",
      "Columns",
      "Areas",
      "Encounters",
      "Grade counts",
      "Signatures",
      "Adjacent repeats",
    ]),
    row(Array<string>(8).fill("---")),
    ...report.stages.map((stage) =>
      row([
        stage.id,
        stage.seed,
        stage.lengthCols,
        stage.areas.length,
        stage.encounters,
        JSON.stringify(stage.difficultyDistribution),
        `${stage.uniqueSignatures}/${stage.chunks.length}`,
        stage.repeatedAdjacentSignatures,
      ]),
    ),
    "",
    "## Zone comparison",
    "",
    row(["Zones", "Presence Jaccard", "Mean density difference", "Unique mechanics"]),
    row(Array<string>(4).fill("---")),
    ...report.comparisons.map((pair) =>
      row([
        `${pair.first} / ${pair.second}`,
        pair.jaccardPresence.toFixed(3),
        pair.meanFrequencyDifferencePer100Cols.toFixed(3),
        `${pair.uniqueFirst.join(", ")} / ${pair.uniqueSecond.join(", ")}`,
      ]),
    ),
    "",
  ].join("\n");
}
