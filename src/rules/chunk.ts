import type { ChunkPlan, ChunkSeam, Instance, StageRecipe, TileRect } from "../data/types";
import { sceneryParallax, worldScenery } from "../stage";
import {
  type ChunkLibrary,
  chunkPoolProblems,
  difficultyWeightProblems,
  orderedRecipeProblems,
  recipeChunkPool,
  themesOf,
} from "./assemble";
import { unacquiredBehaviourNodes } from "./behaviourScope";
import { bindElement } from "./elementBinding";
import { orbitBounds, resolveOrbits } from "./orbit";
import { chunkRows, validRows } from "./stageGeometry";
import { type Catalogue, objectLayout } from "./tiles";

// A rectangle in tiles, as columns [left, right) and rows [top, bottom).
interface Span {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

const spanOf = (rect: TileRect): Span => ({
  bottom: rect.row + rect.rows,
  left: rect.col,
  right: rect.col + rect.cols,
  top: rect.row,
});

const meets = (a: Span, b: Span) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const inside = (rows: number, cols: number, rect: TileRect) =>
  rect.col >= 0 && rect.row >= 0 && rect.col + rect.cols <= cols && rect.row + rect.rows <= rows;

// A placed thing in tiles: its collision, whether it moves, and the span it can be in over its
// track (its rectangle swept along its motion's axis, its reaction's range and its hops).
function physicalObjects(catalogue: Catalogue, instances: readonly Instance[]) {
  const objects = instances.map((instance) => {
    const physical = { ...instance };
    delete physical.skin;
    return objectLayout(1, catalogue, {}, undefined, {}, physical);
  });
  return resolveOrbits(1, instances, objects);
}
function thingOf(catalogue: Catalogue, instances: readonly Instance[], instance: Instance) {
  // Chunk checks use canonical geometry; visual metadata is validated during area resolution.
  const physical = { ...instance };
  delete physical.skin;
  const object = objectLayout(1, catalogue, {}, undefined, {}, physical);
  if (instance.orbit) {
    const objects = physicalObjects(catalogue, instances);
    const resolved = objects[instances.indexOf(instance)]!;
    const bounds = orbitBounds(objects, resolved);
    return {
      collision: object.collision,
      moves: true,
      span: {
        bottom: bounds.y + bounds.height,
        left: bounds.x,
        right: bounds.x + bounds.width,
        top: bounds.y,
      },
    };
  }
  if (object.behaviour) {
    const nodes = unacquiredBehaviourNodes(object.behaviour);
    const supportFlight = nodes.some(
      ({ motion }) => motion.kind === "fly" && motion.to === "support",
    );
    const tracks = nodes.flatMap((node) =>
      node.motion.kind === "move" || node.motion.kind === "hop"
        ? [node.track ?? object.behaviour!]
        : [],
    );
    const flights = nodes.flatMap((node) =>
      node.motion.kind !== "fly" || node.motion.to === "support"
        ? []
        : typeof node.motion.to === "string"
          ? [
              { x: node.motion.bounds.x, y: node.motion.bounds.y },
              {
                x: node.motion.bounds.x + node.motion.bounds.width,
                y: node.motion.bounds.y + node.motion.bounds.height,
              },
            ]
          : [node.motion.to],
    );
    const xs = [
      0,
      ...tracks.filter((track) => track.axis === "x").map((track) => track.distance),
      ...flights.map((to) => to.x),
    ];
    const ys = [
      0,
      ...tracks.filter((track) => track.axis === "y").map((track) => track.distance),
      ...flights.map((to) => to.y),
    ];
    const hopHeight = Math.max(
      0,
      ...nodes.map((node) => (node.motion.kind === "hop" ? node.motion.hopHeight : 0)),
    );
    return {
      collision: object.collision,
      moves:
        supportFlight ||
        flights.length > 0 ||
        hopHeight > 0 ||
        (tracks.some((track) => track.distance !== 0) &&
          nodes.some((node) => node.motion.kind === "move")),
      span: {
        // A chunk has no assembled support geometry to bound automatic landing vertically.
        bottom: supportFlight ? Infinity : object.origin.y + object.height + Math.max(...ys),
        left:
          object.origin.x +
          Math.min(...xs, ...(supportFlight ? [-object.behaviour.pursuit!.distance] : [])),
        right:
          object.origin.x +
          object.width +
          Math.max(...xs, ...(supportFlight ? [object.behaviour.pursuit!.distance] : [])),
        top: supportFlight ? -Infinity : object.origin.y + Math.min(...ys) - hopHeight,
      },
    };
  }
  const { direction, distance, hopHeight } = object.motion;
  const moves = object.motion.algorithm !== "static" || object.reaction.kind !== "none";
  const reach = distance + (object.reaction.kind === "none" ? 0 : object.reaction.range);
  const left = object.origin.x - (direction === "left" ? reach : 0);
  const right = object.origin.x + object.width + (direction === "right" ? reach : 0);
  const top =
    object.origin.y -
    (direction === "up" ? reach : 0) -
    (object.motion.algorithm === "hop" ? hopHeight : 0);
  const bottom = object.origin.y + object.height + (direction === "down" ? reach : 0);
  return { collision: object.collision, moves, span: { bottom, left, right, top } };
}

// Why a chunk's seam at the edge `side` breaks the seam rule, if it does: the terrain's top at
// its row must run the footing in from the edge without a gap, no hazard or moving thing she
// touches may come within the footing, at or above the seam, and no terrain, still solid or
// ledge, or hazard may come within the headroom above it.
function seamProblems(
  library: ChunkLibrary,
  catalogue: Catalogue,
  chunk: ChunkPlan,
  side: "entry" | "exit",
  seam: ChunkSeam,
): string[] {
  const { footing, headroom } = library.rules;
  const left = side === "entry" ? 0 : chunk.cols - footing;
  const right = left + footing;
  const { row } = seam;
  const problems: string[] = [];
  const covered = new Set(
    chunk.solids
      .filter((solid) => solid.row === row)
      .flatMap((solid) => Array.from({ length: solid.cols }, (_, i) => solid.col + i)),
  );
  const gaps = Array.from({ length: footing }, (_, i) => left + i).filter((c) => !covered.has(c));
  if (gaps.length > 0) {
    problems.push(`${side}: no terrain top at row ${row} in cols ${gaps.join(", ")}`);
  }
  const above: Span = { bottom: row, left, right, top: row - headroom };
  const near: Span = { ...above, bottom: row + 1 };
  if (chunk.solids.some((solid) => meets(spanOf(solid), above))) {
    problems.push(`${side}: terrain within ${headroom} rows above the seam`);
  }
  for (const instance of chunk.objects) {
    const { collision, moves, span } = thingOf(
      catalogue,
      [...(chunk.backdrops ?? []), ...chunk.objects],
      instance,
    );
    const name = `${instance.character} at col ${instance.col} row ${instance.row}`;
    if (collision === "hazard" && meets(span, near)) {
      problems.push(`${side}: hazard ${name} at the seam`);
    } else if (moves && collision !== "none" && collision !== "use" && meets(span, near)) {
      problems.push(`${side}: ${name} moves through the seam`);
    } else if (!moves && (collision === "solid" || collision === "ledge") && meets(span, above)) {
      problems.push(`${side}: ${name} within ${headroom} rows above the seam`);
    }
  }
  return problems;
}

// Why a chunk breaks the chunk rules, if it does: its width, its seams' rows and the seam rule
// at each, its themes and its terrain's looks in each, every placed thing a real character
// inside it, its slots inside it with unique ids, and a positive weight and maxPerZone.
export function chunkProblems(
  library: ChunkLibrary,
  catalogue: Catalogue,
  chunk: ChunkPlan,
): string[] {
  const { cols } = library.rules;
  const rows = chunkRows(library, chunk);
  const problems: string[] = [];
  if (!validRows(rows)) {
    problems.push(`invalid chunk height ${rows}`);
  }
  if (!Number.isInteger(chunk.cols) || chunk.cols < cols.min || chunk.cols > cols.max) {
    problems.push(`${chunk.cols} cols, outside ${cols.min} to ${cols.max}`);
  }
  for (const [side, seam] of [
    ["entry", chunk.entry],
    ["exit", chunk.exit],
  ] as const) {
    if (!library.seams.includes(seam.row) || seam.row <= 0 || seam.row > rows) {
      problems.push(`${side} row ${seam.row} is not a seam row`);
    }
  }
  const themes = themesOf(chunk);
  if (themes.length === 0) {
    problems.push("no theme");
  }
  for (const key of themes) {
    const theme = library.themes[key];
    if (!theme) {
      problems.push(`no theme ${key}`);
      continue;
    }
    for (const solid of chunk.solids) {
      if (solid.look === undefined || !(solid.look in theme.looks)) {
        problems.push(
          `terrain at col ${solid.col} row ${solid.row}: no look ${solid.look} in ${key}`,
        );
      }
    }
  }
  for (const solid of chunk.solids) {
    if (!inside(rows, chunk.cols, solid)) {
      problems.push(`terrain at col ${solid.col} row ${solid.row} is outside the chunk`);
    }
  }
  for (const key of themes) {
    const theme = library.themes[key];
    if (!theme) {
      continue;
    }
    let variant: ChunkPlan;
    try {
      variant = {
        ...chunk,
        backdrops: (chunk.backdrops ?? []).map((instance) => bindElement(theme.bindings, instance)),
        objects: chunk.objects.map((instance) => bindElement(theme.bindings, instance)),
        scenery: (chunk.scenery ?? []).map((instance) => bindElement(theme.bindings, instance)),
      };
    } catch (error) {
      problems.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    let resolved = true;
    for (const instance of [
      ...(variant.backdrops ?? []),
      ...variant.objects,
      ...(variant.scenery ?? []),
    ]) {
      const character = catalogue.characters[instance.character];
      if (!character || !catalogue.archetypes[character.archetype]) {
        problems.push(`no character ${instance.character}`);
        resolved = false;
        continue;
      }
      const rect = {
        col: instance.col,
        cols: instance.cols ?? character.cols,
        row: instance.row,
        rows: instance.rows ?? character.rows,
      };
      if (!inside(rows, chunk.cols, rect)) {
        problems.push(
          `${instance.character} at col ${instance.col} row ${instance.row} is outside`,
        );
      }
    }
    for (const instance of variant.scenery ?? []) {
      if (instance.orbit !== undefined) {
        problems.push(`scenery ${instance.character} cannot orbit another object`);
        continue;
      }
      try {
        // Canonical checks need no visual metadata; the renderer validates sprite art and contact.
        const physical = { ...instance };
        delete physical.skin;
        const object = {
          ...objectLayout(1, catalogue, {}, undefined, {}, physical),
          scenerySource: "chunk" as const,
        };
        if (!sceneryParallax(object) && !worldScenery(object)) {
          problems.push(
            `scenery ${instance.character} requires static parallax or autonomous world motion`,
          );
        }
        if (
          object.motion.playback !== undefined &&
          (!["linear", "hop"].includes(object.motion.algorithm) ||
            object.phase !== 0 ||
            object.motion.pause !== 0 ||
            object.motion.distance <= 0 ||
            object.motion.speed <= 0 ||
            !Number.isFinite(object.motion.distance) ||
            !Number.isFinite(object.motion.speed))
        ) {
          problems.push(
            `scenery ${instance.character} requires finite linear/hop travel with zero phase/pause`,
          );
        }
      } catch (error) {
        problems.push(
          `scenery ${instance.character}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    // The seam rule reads each placed thing's character.
    if (resolved) {
      try {
        const instances = [...(variant.backdrops ?? []), ...variant.objects];
        const objects = instances.some((instance) => instance.orbit || instance.id !== undefined)
          ? physicalObjects(catalogue, instances)
          : [];
        for (const object of objects) {
          if (!object.orbit) {
            continue;
          }
          const bounds = orbitBounds(objects, object);
          if (
            bounds.x < 0 ||
            bounds.y < 0 ||
            bounds.x + bounds.width > chunk.cols ||
            bounds.y + bounds.height > rows
          ) {
            problems.push("Orbit sweep is outside the chunk");
          }
        }
        problems.push(
          ...seamProblems(library, catalogue, variant, "entry", chunk.entry),
          ...seamProblems(library, catalogue, variant, "exit", chunk.exit),
        );
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  const slots = chunk.slots ?? [];
  for (const slot of slots) {
    if (!inside(rows, chunk.cols, slot.area)) {
      problems.push(`slot ${slot.id} is outside the chunk`);
    }
  }
  if (new Set(slots.map(({ id }) => id)).size !== slots.length) {
    problems.push("two slots share an id");
  }
  if (chunk.weight !== undefined && !(chunk.weight > 0)) {
    problems.push(`weight ${chunk.weight} is not positive`);
  }
  if (
    chunk.maxPerZone !== undefined &&
    (!Number.isInteger(chunk.maxPerZone) || chunk.maxPerZone < 1)
  ) {
    problems.push(`maxPerZone ${chunk.maxPerZone} is not a positive whole number`);
  }
  return problems;
}

// Why a recipe cannot be assembled as written, if it can't: its theme, start and finish chunks
// exist, both chunks are drawn in its theme, its length range holds them, and its counts are
// whole numbers, and its difficulty is an ordered band from 1 to 5. Whether any assembly fits
// is assembleZone's to find.
export function recipeProblems(library: ChunkLibrary, recipe: StageRecipe): string[] {
  if ("sections" in recipe) {
    return orderedRecipeProblems(library, recipe);
  }
  const problems: string[] = [];
  const rows = recipe.rows ?? library.rows;
  if (!validRows(rows)) {
    problems.push(`invalid recipe height ${rows}`);
  }
  const { max: hardest, min: easiest } = recipe.difficulty;
  if (
    !Number.isInteger(easiest) ||
    !Number.isInteger(hardest) ||
    easiest < 1 ||
    hardest > 5 ||
    easiest > hardest
  ) {
    problems.push(`difficulty ${easiest} to ${hardest} is not an ordered band from 1 to 5`);
  }
  if (!library.themes[recipe.theme]) {
    problems.push(`no theme ${recipe.theme}`);
  }
  for (const id of [recipe.start, recipe.finish]) {
    const chunk = library.chunks[id];
    if (!chunk) {
      problems.push(`no chunk ${id}`);
    } else if (chunkRows(library, chunk) !== rows) {
      problems.push(`cap ${id} height does not match its recipe`);
    } else if (!themesOf(chunk).includes(recipe.theme)) {
      problems.push(`chunk ${id} is not drawn in ${recipe.theme}`);
    }
  }
  const pool = recipeChunkPool(library, recipe);
  if (recipe.chunks !== undefined) {
    problems.push(...chunkPoolProblems(library, recipe, pool));
  }
  problems.push(
    ...difficultyWeightProblems(
      library,
      recipe,
      pool.filter((id) => library.chunks[id] !== undefined),
    ),
  );
  const { max, min } = recipe.length;
  const ends =
    (library.chunks[recipe.start]?.cols ?? 0) + (library.chunks[recipe.finish]?.cols ?? 0);
  if (!(min <= max) || max < ends) {
    problems.push(`length ${min} to ${max} cannot hold its start and finish (${ends} cols)`);
  }
  for (const { count } of [...recipe.events, ...recipe.doors]) {
    if (!Number.isInteger(count) || count < 0) {
      problems.push(`count ${count} is not a whole number`);
    }
  }
  return problems;
}
