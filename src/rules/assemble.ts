import { type Random, randomInt, randomStream, shuffled } from "@andornaut/game-kit/random";

import type {
  Character,
  ChunkPlan,
  ChunkPool,
  ChunkRules,
  FilledSlot,
  Instance,
  OrderedZoneRecipe,
  PlacedChunk,
  SlotKind,
  StageRecipe,
  TerrainRect,
  ThemePlan,
  TilePoint,
  ZonePlan,
  ZoneRecipe,
} from "../data/types";
import { bindElement } from "./elementBinding";

// What zones are assembled from: the chunks and themes by key, the chunk rules, the seam rows,
// a zone's height in rows, and the characters by key, for the size of each theme's door.
export interface ChunkLibrary {
  readonly characters: Readonly<Record<string, Pick<Character, "cols" | "rows">>>;
  readonly chunks: Readonly<Record<string, ChunkPlan>>;
  readonly rows: number;
  readonly rules: ChunkRules;
  readonly seams: readonly number[];
  readonly themes: Readonly<Record<string, ThemePlan>>;
}

// An assembled zone's one area, and the entry she starts at.
export const ASSEMBLED_AREA = "main";
const START_ENTRY = "start";

// The themes a chunk is drawn in.
export function themesOf(chunk: ChunkPlan): readonly string[] {
  return typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
}

function chunkOf(library: ChunkLibrary, id: string): ChunkPlan {
  const chunk = library.chunks[id];
  if (!chunk) {
    throw new Error(`No chunk ${id}`);
  }
  return chunk;
}

// Authored pools retain their order; implicit flat pools retain the legacy sorted theme order.
export function recipeChunkPool(library: ChunkLibrary, recipe: ZoneRecipe): ChunkPool {
  return (
    recipe.chunks ??
    Object.keys(library.chunks)
      .filter(
        (id) =>
          id !== recipe.start &&
          id !== recipe.finish &&
          themesOf(chunkOf(library, id)).includes(recipe.theme),
      )
      .sort()
  );
}

export function chunkPoolProblems(
  library: ChunkLibrary,
  context: Pick<ZoneRecipe, "finish" | "start" | "theme">,
  pool: ChunkPool,
): string[] {
  const problems: string[] = [];
  if (pool.length === 0 || new Set(pool).size !== pool.length) {
    problems.push("invalid chunk pool");
  }
  for (const id of pool) {
    const chunk = library.chunks[id];
    if (
      chunk &&
      (!Number.isInteger(chunk.cols) ||
        chunk.cols < library.rules.cols.min ||
        chunk.cols > library.rules.cols.max)
    ) {
      problems.push(`invalid generated width for chunk ${id}`);
    }
    if (!chunk) {
      problems.push(`no chunk ${id}`);
    } else if (
      id === context.start ||
      id === context.finish ||
      !themesOf(chunk).includes(context.theme)
    ) {
      problems.push(`invalid pool chunk ${id}`);
    }
  }
  return problems;
}

function eligibleChunks(
  library: ChunkLibrary,
  recipe: Pick<ZoneRecipe, "difficulty" | "difficultyWeights">,
  pool: ChunkPool,
): ChunkPool {
  return pool.filter((id) => {
    const { difficulty } = chunkOf(library, id);
    return (
      difficulty >= recipe.difficulty.min &&
      difficulty <= recipe.difficulty.max &&
      (recipe.difficultyWeights?.[difficulty] ?? 1) > 0
    );
  });
}

const slotCount = (chunk: ChunkPlan, kind: SlotKind) =>
  (chunk.slots ?? []).filter((slot) => slot.kind === kind).length;

const wanted = (entries: readonly { readonly count: number }[]) =>
  entries.reduce((sum, { count }) => sum + count, 0);

// The chunks in an order drawn from random, each placed ahead of another as likely as its
// weight is to the other's (weighted sampling without replacement).
function weightedOrder(
  random: Random,
  library: ChunkLibrary,
  weights: ZoneRecipe["difficultyWeights"],
  ids: readonly string[],
): string[] {
  return ids
    .map((id) => ({
      id,
      key:
        random() **
        (1 /
          ((chunkOf(library, id).weight ?? 1) * (weights?.[chunkOf(library, id).difficulty] ?? 1))),
    }))
    .sort((a, b) => b.key - a.key)
    .map(({ id }) => id);
}

export function difficultyWeightProblems(
  library: ChunkLibrary,
  recipe: Pick<ZoneRecipe, "difficulty" | "difficultyWeights">,
  pool: readonly string[],
): string[] {
  const weights = recipe.difficultyWeights;
  if (weights === undefined) {
    return [];
  }
  if (
    Object.entries(weights).some(
      ([grade, weight]) =>
        !Number.isInteger(Number(grade)) ||
        Number(grade) < 1 ||
        Number(grade) > 5 ||
        !Number.isFinite(weight) ||
        weight < 0,
    )
  ) {
    return ["difficulty weights must be finite nonnegative values for grades 1 to 5"];
  }
  const eligible = pool.filter((id) => {
    const grade = chunkOf(library, id).difficulty;
    return grade >= recipe.difficulty.min && grade <= recipe.difficulty.max;
  });
  return eligible.some((id) => (weights[chunkOf(library, id).difficulty] ?? 1) > 0)
    ? []
    : ["difficulty weights exclude every eligible chunk"];
}

// Encounter constraints are opt-in. Counts come only from explicit chunk metadata.
function encounterQuota(
  library: ChunkLibrary,
  quota: number | undefined,
  ids: readonly string[],
): number | undefined {
  if (quota === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(quota) || quota < 0) {
    throw new Error("Encounter quota must be a nonnegative safe integer");
  }
  for (const id of ids) {
    const count = chunkOf(library, id).encounters;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Invalid encounter count for chunk ${id}`);
    }
  }
  return quota;
}

function encounterFits(
  library: ChunkLibrary,
  remaining: number | undefined,
  previous: string | undefined,
  id: string,
): boolean {
  if (remaining === undefined) {
    return true;
  }
  const count = chunkOf(library, id).encounters;
  return (
    count <= remaining &&
    (count === 0 || previous === undefined || chunkOf(library, previous).encounters === 0)
  );
}

// Where the search stands: the chunks so far after the start, the columns they take with the
// start's, and the event and door slots so far.
interface Run {
  readonly counts: ReadonlyMap<string, number>;
  readonly doors: number;
  readonly events: number;
  readonly ids: readonly string[];
  readonly remaining: number | undefined;
  readonly width: number;
}

// The ids of the chunks between the recipe's start and finish, left to right: a seeded run
// whose seams join, never the same chunk twice in a row, each chunk at most its maxPerZone
// times, within the difficulty band, with slots enough for the recipe's events and doors,
// and the whole zone within the recipe's length. It aims for a length drawn from the seed, tries
// the chunks in a seeded weighted order, and backtracks when stuck. Undefined when none exists.
function searchRun(
  library: ChunkLibrary,
  random: Random,
  recipe: ZoneRecipe,
): readonly string[] | undefined {
  const start = chunkOf(library, recipe.start);
  const finish = chunkOf(library, recipe.finish);
  const pool = eligibleChunks(library, recipe, recipeChunkPool(library, recipe));
  const quota = encounterQuota(library, recipe.encounters, [recipe.start, recipe.finish, ...pool]);
  const remaining = quota === undefined ? undefined : quota - start.encounters - finish.encounters;
  if (remaining !== undefined && remaining < 0) {
    return undefined;
  }
  const { max, min } = recipe.length;
  const target = randomInt(random, min, max + 1);
  const needEvents = wanted(recipe.events);
  const needDoors = wanted(recipe.doors);
  const failed = new Set<string>();
  const keyOf = (run: Run) =>
    [
      run.width,
      run.ids.at(-1) ?? recipe.start,
      Math.min(run.events, needEvents),
      Math.min(run.doors, needDoors),
      ...(run.remaining === undefined
        ? []
        : [run.remaining, chunkOf(library, run.ids.at(-1) ?? recipe.start).encounters > 0]),
      ...pool.flatMap((id) =>
        chunkOf(library, id).maxPerZone === undefined ? [] : [run.counts.get(id) ?? 0],
      ),
    ].join("|");

  const finishes = (run: Run, prev: string, exitRow: number) => {
    const total = run.width + finish.cols;
    return (
      prev !== recipe.finish &&
      exitRow === finish.entry.row &&
      total >= min &&
      total <= max &&
      (run.remaining === undefined ||
        (run.remaining === 0 && encounterFits(library, finish.encounters, prev, recipe.finish))) &&
      run.events + slotCount(finish, "event") >= needEvents &&
      run.doors + slotCount(finish, "door") >= needDoors
    );
  };

  const extend = (run: Run, id: string): Run => {
    const chunk = chunkOf(library, id);
    const width = run.width + chunk.cols;
    return {
      counts: new Map(run.counts).set(id, (run.counts.get(id) ?? 0) + 1),
      doors: run.doors + slotCount(chunk, "door"),
      events: run.events + slotCount(chunk, "event"),
      ids: [...run.ids, id],
      remaining: run.remaining === undefined ? undefined : run.remaining - chunk.encounters,
      width,
    };
  };

  const search = (run: Run): readonly string[] | undefined => {
    const key = keyOf(run);
    if (failed.has(key)) {
      return undefined;
    }
    const prev = run.ids.at(-1) ?? recipe.start;
    const exitRow = chunkOf(library, prev).exit.row;
    const next = pool.filter((id) => {
      const chunk = chunkOf(library, id);
      return (
        id !== prev &&
        encounterFits(library, run.remaining, prev, id) &&
        chunk.entry.row === exitRow &&
        (run.counts.get(id) ?? 0) < (chunk.maxPerZone ?? Infinity) &&
        run.width + chunk.cols + finish.cols <= max
      );
    });
    const order: (string | undefined)[] = weightedOrder(
      random,
      library,
      recipe.difficultyWeights,
      next,
    );
    // undefined stands for the finish: tried first once the run is long enough.
    if (run.width + finish.cols >= target) {
      order.unshift(undefined);
    } else {
      order.push(undefined);
    }
    for (const id of order) {
      if (id === undefined) {
        if (finishes(run, prev, exitRow)) {
          return run.ids;
        }
        continue;
      }
      const longer = extend(run, id);
      const found = search(longer);
      if (found) {
        return found;
      }
    }
    failed.add(key);
    return undefined;
  };

  return search({
    counts: new Map(),
    doors: slotCount(start, "door"),
    events: slotCount(start, "event"),
    ids: [],
    remaining,
    width: start.cols,
  });
}

const shiftPoint = (col: number, point: TilePoint): TilePoint => ({
  ...point,
  col: point.col + col,
});
const shiftInstance = (col: number, instance: Instance): Instance => ({
  ...instance,
  col: instance.col + col,
});

// A zone of chunks ids, left to right, drawn in theme: each chunk's contents moved to its zone
// columns, each terrain look as the theme's tileset draws it, the theme's repeated backdrops
// across the whole zone, and fills (event ids, then door rooms, by kind) placed in its slots by
// random. A filled door slot places the theme's door at its own size, centred across the slot
// (half a tile in where the two widths differ by an odd number of tiles) and standing on its
// floor, leading to its room.
// She starts at spawnCol on the first chunk's entry row.
export function zonePlanOf(
  library: ChunkLibrary,
  random: Random,
  fills: Readonly<Record<SlotKind, readonly string[]>>,
  themeKey: string,
  spawnCol: number,
  ids: readonly string[],
): ZonePlan {
  const theme = library.themes[themeKey];
  if (!theme) {
    throw new Error(`No theme ${themeKey}`);
  }
  const chunks = ids.map((id) => chunkOf(library, id));
  const first = chunks[0];
  if (!first || !Number.isInteger(spawnCol) || spawnCol <= 1 || spawnCol >= first.cols) {
    throw new Error(
      `Spawn column ${spawnCol} must be an integer beyond the first column and inside the opening chunk`,
    );
  }
  const placed = chunks.reduce<PlacedChunk[]>((list, chunk, index) => {
    const last = list.at(-1);
    list.push({ chunk: ids[index] ?? "", col: last ? last.col + last.cols : 0, cols: chunk.cols });
    return list;
  }, []);
  const cols = placed.reduce((sum, chunk) => sum + chunk.cols, 0);
  const at = (index: number) => placed[index]?.col ?? 0;
  const look = (id: string, solid: TerrainRect): TerrainRect => {
    if (solid.look === undefined) {
      return solid;
    }
    const drawn = theme.looks[solid.look];
    if (drawn === undefined) {
      throw new Error(`Theme ${themeKey} has no look ${solid.look} for chunk ${id}`);
    }
    return { ...solid, look: drawn };
  };
  const slots = chunks.flatMap((chunk, index) =>
    (chunk.slots ?? []).map((slot): FilledSlot => ({
      ...slot,
      area: { ...slot.area, col: slot.area.col + at(index) },
      chunk: index,
    })),
  );
  const filled = new Map<FilledSlot, string>();
  for (const kind of ["event", "door"] as const) {
    const open = shuffled(
      random,
      slots.filter((slot) => slot.kind === kind),
    );
    const want = fills[kind];
    if (want.length > open.length) {
      throw new Error(`${want.length} ${kind}s for ${open.length} ${kind} slots`);
    }
    want.forEach((fill, index) => filled.set(open[index] as FilledSlot, fill));
  }
  const doorTemplate = bindElement(theme.bindings, {
    character: "",
    col: 0,
    role: theme.door,
    row: 0,
  });
  const door = library.characters[doorTemplate.character];
  if (!door) {
    throw new Error(`No character ${doorTemplate.character} for theme ${themeKey}'s doors`);
  }
  const doors = slots.flatMap((slot): Instance[] => {
    const room = filled.get(slot);
    if (slot.kind !== "door" || room === undefined) {
      return [];
    }
    const { area } = slot;
    return [
      {
        ...doorTemplate,
        col: area.col + (area.cols - door.cols) / 2,
        room,
        row: area.row + area.rows - door.rows,
      },
    ];
  });
  return {
    areas: {
      [ASSEMBLED_AREA]: {
        chunks: placed,
        cols,
        entries: {
          [START_ENTRY]: {
            col: spawnCol,
            row: first.entry.row,
          },
        },
        noCross: chunks.flatMap((chunk, index) =>
          (chunk.noCross ?? []).map(({ from, to }) => ({
            from: shiftPoint(at(index), from),
            to: shiftPoint(at(index), to),
          })),
        ),
        objects: [
          ...theme.backdrops.map((backdrop) =>
            bindElement(theme.bindings, { ...backdrop, col: 0, cols }),
          ),
          ...chunks.flatMap((chunk, index) =>
            (chunk.backdrops ?? []).map((instance) =>
              bindElement(theme.bindings, shiftInstance(at(index), instance)),
            ),
          ),
          ...chunks.flatMap((chunk, index) =>
            chunk.objects.map((instance) =>
              bindElement(theme.bindings, shiftInstance(at(index), instance)),
            ),
          ),
          ...doors,
        ],
        outOfReach: chunks.flatMap((chunk, index) =>
          (chunk.outOfReach ?? []).map((spot) => shiftPoint(at(index), spot)),
        ),
        rows: library.rows,
        slots: slots.map((slot) => {
          const fill = filled.get(slot);
          return fill === undefined ? slot : { ...slot, fill };
        }),
        solids: chunks.flatMap((chunk, index) =>
          chunk.solids.map((solid) =>
            look(ids[index] ?? "", { ...solid, col: solid.col + at(index) }),
          ),
        ),
        tileset: theme.tileset,
      },
    },
    start: { area: ASSEMBLED_AREA, entry: START_ENTRY },
  };
}

// The recipe's events and doors, each id or room repeated count times.
function fillsOf(recipe: Pick<ZoneRecipe, "doors" | "events">): Record<SlotKind, string[]> {
  return {
    door: recipe.doors.flatMap(({ count, room }) => Array<string>(count).fill(room)),
    event: recipe.events.flatMap(({ count, id }) => Array<string>(count).fill(id)),
  };
}

// Section length includes its global caps and at least one generated chunk.
export function orderedRecipeProblems(library: ChunkLibrary, recipe: OrderedZoneRecipe): string[] {
  const problems: string[] = [];
  if (recipe.sections.length === 0) {
    return ["ordered stage has no sections"];
  }
  if (
    new Set(recipe.sections.map(({ id }) => id)).size !== recipe.sections.length ||
    recipe.sections.some(({ id }) => id.length === 0)
  ) {
    problems.push("section ids must be unique and nonempty");
  }
  for (const id of [recipe.start, recipe.finish]) {
    if (!library.chunks[id]) {
      problems.push(`no chunk ${id}`);
    }
  }
  const first = recipe.sections[0];
  const last = recipe.sections.at(-1);
  for (const [id, section] of [
    [recipe.start, first],
    [recipe.finish, last],
  ] as const) {
    const cap = library.chunks[id];
    if (
      cap &&
      section &&
      (!Number.isInteger(cap.cols) ||
        cap.cols < library.rules.cols.min ||
        cap.cols > library.rules.cols.max ||
        !themesOf(cap).includes(section.theme))
    ) {
      problems.push(`invalid cap ${id} for section ${section.id}`);
    }
  }
  for (const [index, section] of recipe.sections.entries()) {
    if (!library.themes[section.theme]) {
      problems.push(`no theme ${section.theme}`);
    }
    problems.push(
      ...chunkPoolProblems(
        library,
        {
          finish: recipe.finish,
          start: recipe.start,
          theme: section.theme,
        },
        section.chunks,
      ),
    );
    if (
      !Number.isSafeInteger(section.length.min) ||
      !Number.isSafeInteger(section.length.max) ||
      section.length.min <= 0 ||
      section.length.min > section.length.max
    ) {
      problems.push(`invalid length for section ${section.id}`);
    }
    problems.push(
      ...difficultyWeightProblems(
        library,
        section,
        section.chunks.filter((id) => library.chunks[id] !== undefined),
      ),
    );
    const widths = section.chunks.flatMap((id) => {
      const chunk = library.chunks[id];
      return chunk &&
        themesOf(chunk).includes(section.theme) &&
        chunk.difficulty >= section.difficulty.min &&
        chunk.difficulty <= section.difficulty.max &&
        (section.difficultyWeights?.[chunk.difficulty] ?? 1) > 0
        ? [chunk.cols]
        : [];
    });
    const capWidth =
      (index === 0 ? (library.chunks[recipe.start]?.cols ?? 0) : 0) +
      (index === recipe.sections.length - 1 ? (library.chunks[recipe.finish]?.cols ?? 0) : 0);
    if (widths.length > 0 && section.length.min < capWidth + Math.min(...widths)) {
      problems.push(`length for section ${section.id} must include its caps and a generated chunk`);
    }
    if (!Number.isInteger(section.spawnCol) || section.spawnCol <= 1) {
      problems.push(`invalid spawn column for section ${section.id}`);
    }
    if (
      !Number.isInteger(section.difficulty.min) ||
      !Number.isInteger(section.difficulty.max) ||
      section.difficulty.min < 1 ||
      section.difficulty.max > 5 ||
      section.difficulty.min > section.difficulty.max
    ) {
      problems.push(`invalid difficulty for section ${section.id}`);
    }
    for (const { count } of [...section.doors, ...section.events]) {
      if (!Number.isInteger(count) || count < 0) {
        problems.push(`invalid fill count for section ${section.id}`);
      }
    }
  }
  return problems;
}

function assembleOrdered(
  library: ChunkLibrary,
  seed: number,
  key: string,
  recipe: OrderedZoneRecipe,
): ZonePlan {
  const problems = orderedRecipeProblems(library, recipe);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
  const start = chunkOf(library, recipe.start);
  const finish = chunkOf(library, recipe.finish);
  const first = recipe.sections[0];
  const last = recipe.sections.at(-1);
  if (
    !first ||
    !last ||
    !themesOf(start).includes(first.theme) ||
    !themesOf(finish).includes(last.theme)
  ) {
    throw new Error("Stage caps do not match their section themes");
  }
  const counts = new Map<string, number>();
  for (const id of [recipe.start, recipe.finish]) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if ([...counts].some(([id, count]) => count > (chunkOf(library, id).maxPerZone ?? Infinity))) {
    throw new Error("Stage caps exceed maxPerZone");
  }
  const pools = recipe.sections.map((section) => eligibleChunks(library, section, section.chunks));
  const quota = encounterQuota(library, recipe.encounters, [
    recipe.start,
    recipe.finish,
    ...pools.flat(),
  ]);
  const remaining = quota === undefined ? undefined : quota - start.encounters - finish.encounters;
  const selected: (readonly string[])[] = [];
  const failed = new Set<string>();
  const limited = [...new Set(recipe.sections.flatMap((section) => section.chunks))]
    .filter((id) => chunkOf(library, id).maxPerZone !== undefined)
    .sort();
  const randoms = recipe.sections.map((section) =>
    randomStream(seed, `section:${key}:${section.id}`),
  );
  const targets = recipe.sections.map((section) =>
    randomInt(
      randomStream(seed, `length:${key}:${section.id}`),
      section.length.min,
      section.length.max + 1,
    ),
  );
  const choose = (
    index: number,
    previous: string | undefined,
    remaining: number | undefined,
  ): boolean => {
    const section = recipe.sections[index];
    if (!section) {
      return remaining === undefined || remaining === 0;
    }
    const cap = index === 0 ? start : undefined;
    const end = index === recipe.sections.length - 1 ? finish : undefined;
    const needDoors = wanted(section.doors);
    const needEvents = wanted(section.events);
    const search = (
      ids: readonly string[],
      width: number,
      doors: number,
      events: number,
      remaining: number | undefined,
    ): boolean => {
      const prev = ids.at(-1) ?? (cap ? recipe.start : previous);
      const seam =
        ids.length > 0 || cap !== undefined ? chunkOf(library, prev ?? "").exit.row : undefined;
      const state = [
        index,
        width,
        prev ?? "",
        Math.min(doors, needDoors),
        Math.min(events, needEvents),
        ...(remaining === undefined
          ? []
          : [remaining, prev !== undefined && chunkOf(library, prev).encounters > 0]),
        ...limited.map((id) => counts.get(id) ?? 0),
      ].join(":");
      if (failed.has(state)) {
        return false;
      }
      const total = width + (end?.cols ?? 0);
      const finishSection = () => {
        if (
          ids.length === 0 ||
          total < section.length.min ||
          total > section.length.max ||
          (end !== undefined && seam !== end.entry.row) ||
          (end !== undefined &&
            remaining !== undefined &&
            (remaining !== 0 || !encounterFits(library, finish.encounters, prev, recipe.finish))) ||
          doors + (end ? slotCount(end, "door") : 0) < needDoors ||
          events + (end ? slotCount(end, "event") : 0) < needEvents
        ) {
          return false;
        }
        selected[index] = ids;
        return choose(index + 1, ids.at(-1), remaining);
      };
      if (total >= (targets[index] ?? section.length.min) && finishSection()) {
        return true;
      }
      const next = (pools[index] ?? []).filter((id) => {
        const chunk = chunkOf(library, id);
        return (
          id !== prev &&
          encounterFits(library, remaining, prev, id) &&
          (seam === undefined || chunk.entry.row === seam) &&
          (counts.get(id) ?? 0) < (chunk.maxPerZone ?? Infinity) &&
          width + chunk.cols + (end?.cols ?? 0) <= section.length.max &&
          (ids.length > 0 || cap !== undefined || section.spawnCol < chunk.cols)
        );
      });
      for (const id of weightedOrder(randoms[index]!, library, section.difficultyWeights, next)) {
        const chunk = chunkOf(library, id);
        const count = counts.get(id) ?? 0;
        counts.set(id, count + 1);
        if (
          search(
            [...ids, id],
            width + chunk.cols,
            doors + slotCount(chunk, "door"),
            events + slotCount(chunk, "event"),
            remaining === undefined ? undefined : remaining - chunk.encounters,
          )
        ) {
          return true;
        }
        counts.set(id, count);
      }
      if (total < (targets[index] ?? section.length.min) && finishSection()) {
        return true;
      }
      failed.add(state);
      return false;
    };
    return search(
      [],
      cap?.cols ?? 0,
      cap ? slotCount(cap, "door") : 0,
      cap ? slotCount(cap, "event") : 0,
      remaining,
    );
  };
  if ((remaining !== undefined && remaining < 0) || !choose(0, undefined, remaining)) {
    throw new Error(`No ordered assembly of stage ${key} fits its section pools and lengths`);
  }
  const order = recipe.sections.map(({ id }) => id);
  const areas = Object.fromEntries(
    recipe.sections.map((section, index) => {
      const middle = selected[index];
      if (!middle || middle.length === 0) {
        throw new Error(`No selected chunk for ${section.id}`);
      }
      const ids = [
        ...(index === 0 ? [recipe.start] : []),
        ...middle,
        ...(index === order.length - 1 ? [recipe.finish] : []),
      ];
      const single = zonePlanOf(
        library,
        randomStream(seed, `slots:${key}:${section.id}`),
        fillsOf(section),
        section.theme,
        section.spawnCol,
        ids,
      ).areas[ASSEMBLED_AREA];
      if (!single) {
        throw new Error(`No assembled section ${section.id}`);
      }
      const previous = order[index - 1];
      const next = order[index + 1];
      const marker = (side: "left" | "right"): Instance => {
        const instance = bindElement(library.themes[section.theme]?.bindings ?? {}, {
          character: "",
          col: 0,
          role: recipe.transitionRoles[side],
          row: 0,
        });
        const character = library.characters[instance.character];
        if (
          !character ||
          character.cols > library.rules.footing ||
          character.rows > library.rules.headroom
        ) {
          throw new Error(`Transition marker ${instance.character} exceeds safe seam dimensions`);
        }
        const row =
          side === "left"
            ? chunkOf(library, ids[0] ?? "").entry.row
            : chunkOf(library, ids.at(-1) ?? "").exit.row;
        return {
          ...instance,
          col: side === "left" ? 0 : single.cols - character.cols,
          row: row - character.rows,
        };
      };
      return [
        section.id,
        {
          ...single,
          entries: {
            ...single.entries,
            return: { col: single.cols - 2, row: chunkOf(library, ids.at(-1) ?? "").exit.row },
          },
          objects: [
            ...single.objects,
            ...(previous !== undefined ? [marker("left")] : []),
            ...(next !== undefined ? [marker("right")] : []),
          ],
          walkLinks: {
            ...(previous !== undefined ? { left: { area: previous, entry: "return" } } : {}),
            ...(next !== undefined ? { right: { area: next, entry: START_ENTRY } } : {}),
          },
        },
      ];
    }),
  );
  return { areaOrder: order, areas, start: { area: order[0] ?? "", entry: START_ENTRY } };
}

// The zone key's recipe assembled for a seed: its start chunk, a seeded run of its
// theme's chunks (searchRun), and its finish chunk, with the recipe's events and doors in
// seeded slots. The same seed always gives the same zone. Throws when no assembly fits.
export function assembleZone(
  library: ChunkLibrary,
  seed: number,
  key: string,
  recipe: StageRecipe,
): ZonePlan {
  if ("sections" in recipe) {
    return assembleOrdered(library, seed, key, recipe);
  }
  if (recipe.chunks !== undefined) {
    const problems = chunkPoolProblems(library, recipe, recipe.chunks);
    if (problems.length > 0) {
      throw new Error(problems.join("; "));
    }
  }
  const run = searchRun(library, randomStream(seed, `assemble:${key}`), recipe);
  if (!run) {
    throw new Error(
      `No assembly of zone ${key} fits its recipe: its theme's chunks never join from ` +
        `${recipe.start} to ${recipe.finish} within ${recipe.length.min} to ` +
        `${recipe.length.max} columns, the difficulty band and each chunk's maxPerZone, ` +
        "with slots for its events and doors",
    );
  }
  return zonePlanOf(
    library,
    randomStream(seed, `slots:${key}`),
    fillsOf(recipe),
    recipe.theme,
    recipe.spawnCol,
    [recipe.start, ...run, recipe.finish],
  );
}
