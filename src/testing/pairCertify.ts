// Certification of each zone's middle chunks: whole authored chunks (singles) and composed module
// pairs. Structural steps (rules, grade, encounters, layout fingerprint) are cheap and run on every
// tree; proofs (required walks with their behaviour trace, boss path-out) run in the CLI.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

import { traceRecorder } from "../ai/trace";
import { BIRD_FRAME } from "../assets";
import { ARCHETYPES } from "../data/archetypes";
import { ARENAS } from "../data/arenas";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { CHUNK_RULES, CHUNKS, THEMES } from "../data/chunks";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "../data/modules";
import { TILE } from "../data/screen";
import { SEAM_ROWS } from "../data/seams";
import type {
  CertifiedChunks,
  CertifiedEntry,
  ChunkModule,
  ChunkPlan,
  Difficulty,
  ZoneKey,
  ZoneLayout,
  ZoneRecipe,
} from "../data/types";
import { ZONE_FRAMES } from "../data/zoneFrames";
import { RECIPES } from "../data/zones";
import { assembleZone, type ChunkLibrary, recipeChunkPool, themesOf } from "../rules/assemble";
import { chunkProblems } from "../rules/chunk";
import { composePair, ENCOUNTER_ROLES, moduleProblems, pairProblems } from "../rules/modules";
import { withRoomBuildings } from "../rules/roomBuildings";
import { zoneLayout } from "../rules/tiles";
import { CHUNK_LIBRARY, zoneOfTheme } from "../rules/zonePlans";
import { NO_DISABLED_EDGES, pathOut, pathOutEncounter } from "../sim/pathOut";
import { zoneTraceLine } from "../sim/zoneTrace";
import { crosses, surfaceAt, walkRequiredRoutes, type WalkRouteTarget } from "../sim/zoneWalk";
import { CATALOGUE, HITBOXES, TILESETS } from "./art";
import { chunkThemePlan, planPhysics } from "./chunkWalkCases";
import { ORDINARY } from "./encounterLayouts";
import { moduleRouteTargets, REQUIRED_CHUNK_ROUTES, slotFills } from "./requiredRoutes";

// Bump when a certification step changes what it proves, forcing a full recertification.
const CERTIFY_VERSION = 1;
export const ZONES: readonly ZoneKey[] = [
  "apartment",
  "blue",
  "countryside",
  "home",
  "industrial",
  "woodland",
];
// Distinct layouts every zone's certified list reaches, split across grades by its shares.
export const POOL_TARGET = 125;
// Seeds of the stage assembly feasibility check.
const FEASIBILITY_SEEDS = 64;

type Target = Omit<WalkRouteTarget, "area">;
type SlotFills = ReturnType<typeof slotFills>;
const EMPTY: SlotFills = { door: [], event: [] };

// The modules and grade overrides certification composes, the game's unless a test supplies its own.
interface CertifyContext {
  readonly grades: Readonly<Record<string, Difficulty>>;
  readonly modules: Readonly<Record<string, ChunkModule>>;
}
export const GAME_CONTEXT: CertifyContext = { grades: PAIR_GRADES, modules: MODULES };

// A chunk to certify for a zone, with its required-route targets and slot fills.
export interface Candidate {
  readonly chunk: ChunkPlan;
  readonly fills: SlotFills | undefined;
  readonly id: string;
  readonly kind: CertifiedEntry["kind"];
  readonly modules?: readonly [left: string, right: string];
  readonly targets: readonly Target[];
}

// Keys sorted, undefined members omitted, non-JSON numbers and functions tagged, so equal data
// always hashes equally.
function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : `"#${String(value)}"`;
  }
  if (typeof value === "function") {
    return JSON.stringify(`#fn:${value.toString()}`);
  }
  if (value === undefined) {
    return '"#undefined"';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value instanceof Set || value instanceof Map) {
    return canonicalJson([...value]);
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export const hashOf = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 16);

// The flat game recipes a zone's frame draws.
export function zoneRecipes(zone: ZoneKey): readonly (readonly [string, ZoneRecipe])[] {
  return Object.entries(RECIPES).flatMap(([key, recipe]) =>
    "sections" in recipe || zoneOfTheme(recipe.theme) !== zone ? [] : [[key, recipe] as const],
  );
}

const inBand = (recipe: ZoneRecipe, grade: Difficulty) =>
  grade >= recipe.difficulty.min &&
  grade <= recipe.difficulty.max &&
  (recipe.difficultyWeights?.[grade] ?? 1) > 0;

// The zone's authored middle chunks: every chunk its recipes may draw, connectors and caps aside.
function zoneSingles(zone: ZoneKey): readonly string[] {
  const { connectors } = ZONE_FRAMES[zone];
  const ids = new Set<string>();
  for (const [, recipe] of zoneRecipes(zone)) {
    for (const id of recipeChunkPool(CHUNK_LIBRARY, recipe)) {
      const chunk = CHUNKS[id];
      if (chunk && !connectors.includes(id) && inBand(recipe, chunk.difficulty)) {
        ids.add(id);
      }
    }
  }
  return [...ids].sort();
}

function moduleContext() {
  return {
    catalogue: CATALOGUE,
    chunkRules: CHUNK_RULES,
    frames: ZONE_FRAMES,
    rules: MODULE_RULES,
    seams: SEAM_ROWS,
    themes: THEMES,
  };
}

interface ZoneCandidates {
  readonly candidates: readonly Candidate[];
  // Modules authored for the zone that break the module rules, with why.
  readonly rejected: readonly { readonly id: string; readonly problems: readonly string[] }[];
}

// Every chunk the zone may certify: its singles, and each ordered pair of rule-abiding modules
// authored for it that the compatibility rule admits.
export function zoneCandidates(context: CertifyContext, zone: ZoneKey): ZoneCandidates {
  const singles = zoneSingles(zone).map((id): Candidate => {
    const chunk = CHUNKS[id]!;
    return {
      chunk,
      fills: (chunk.slots?.length ?? 0) > 0 ? slotFills(chunk) : undefined,
      id,
      kind: "single",
      targets: REQUIRED_CHUNK_ROUTES[id] ?? [],
    };
  });
  const rejected: { id: string; problems: readonly string[] }[] = [];
  const valid = Object.values(context.modules)
    .filter((module) => module.zones.includes(zone))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .filter((module) => {
      const problems = moduleProblems(moduleContext(), module);
      if (problems.length > 0) {
        rejected.push({ id: module.id, problems });
      }
      return problems.length === 0;
    });
  const frame = ZONE_FRAMES[zone];
  const pairs = valid.flatMap((left) =>
    valid.flatMap((right): Candidate[] => {
      if (pairProblems(zone, left, right).length > 0) {
        return [];
      }
      const composed = composePair(
        { frame, grades: context.grades, rules: MODULE_RULES, zone },
        left,
        right,
      );
      const library = libraryWith(composed.id, composed.chunk);
      return [
        {
          chunk: composed.chunk,
          fills: (composed.chunk.slots?.length ?? 0) > 0 ? slotFills(composed.chunk) : undefined,
          id: composed.id,
          kind: "pair",
          modules: [left.id, right.id],
          targets: moduleRouteTargets(library, composed.route, composed.chunk),
        },
      ];
    }),
  );
  return {
    candidates: [...singles, ...pairs].sort((a, b) => (a.id < b.id ? -1 : 1)),
    rejected,
  };
}

function libraryWith(id: string, chunk: ChunkPlan): ChunkLibrary {
  return CHUNK_LIBRARY.chunks[id] === chunk
    ? CHUNK_LIBRARY
    : { ...CHUNK_LIBRARY, chunks: { ...CHUNK_LIBRARY.chunks, [id]: chunk } };
}

const antagonists = (chunk: ChunkPlan) =>
  chunk.objects.filter(({ role }) => role !== undefined && ENCOUNTER_ROLES.has(role)).length;

// Steps 1 and 2: the chunk rules, a grade every zone recipe draws, and at most one encounter,
// counted from its antagonist objects.
export function structuralProblems(zone: ZoneKey, candidate: Candidate): string[] {
  const { chunk } = candidate;
  const problems = chunkProblems(libraryWith(candidate.id, chunk), CATALOGUE, chunk);
  for (const [key, recipe] of zoneRecipes(zone)) {
    if (!inBand(recipe, chunk.difficulty)) {
      problems.push(`${key} draws no grade ${chunk.difficulty}`);
    }
  }
  if (chunk.encounters > 1 || chunk.encounters !== antagonists(chunk)) {
    problems.push(`encounters ${chunk.encounters} for ${antagonists(chunk)} antagonist objects`);
  }
  if (!ZONE_FRAMES[zone].themes.some((theme) => themesOf(chunk).includes(theme))) {
    problems.push(`drawn in none of ${zone}'s themes`);
  }
  return problems;
}

const SKIN_FIELDS = new Set(["animations", "art", "tileset"]);

// Physics with every object's skin removed, so reskins share a layout.
function withoutSkins(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutSkins);
  }
  if (value !== null && typeof value === "object" && !(value instanceof Set)) {
    const record = value as Readonly<Record<string, unknown>>;
    const object = "origin" in record && "motion" in record;
    return Object.fromEntries(
      Object.entries(record)
        .filter(([key]) => !(object && SKIN_FIELDS.has(key)))
        .map(([key, item]) => [key, withoutSkins(item)]),
    );
  }
  return value;
}

// Step 3: the physics fingerprint in each of the zone's themes it is drawn in; the themes whose
// physics differ, the first of each kind in frame order, are the ones the proofs walk.
export function layoutOf(
  zone: ZoneKey,
  candidate: Candidate,
): { readonly layout: string; readonly themes: readonly string[] } {
  const library = libraryWith(candidate.id, candidate.chunk);
  const byPhysics = new Map<string, string>();
  for (const theme of ZONE_FRAMES[zone].themes) {
    if (!themesOf(candidate.chunk).includes(theme)) {
      continue;
    }
    const physics = hashOf(
      withoutSkins(planPhysics(chunkThemePlan({ fills: EMPTY, theme }, library, candidate.chunk))),
    );
    if (!byPhysics.has(physics)) {
      byPhysics.set(physics, theme);
    }
  }
  return { layout: hashOf([...byPhysics.keys()].sort()), themes: [...byPhysics.values()] };
}

export const routeHash = (candidate: Candidate): string =>
  hashOf({ fills: candidate.fills ?? null, targets: candidate.targets });

export interface Proof {
  readonly problems: readonly string[];
  readonly trace: string;
  readonly work: number;
}

function layoutFor(plan: ReturnType<typeof chunkThemePlan>): ZoneLayout {
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

// Steps 4 and 5: in every theme of the chunk, its filled doors' room buildings placed by the
// assembly pass itself; then in each walked theme, every required route walked with slots empty
// and filled, no no-cross pair crossed, the behaviour trace of every walk step hashed; then, for
// an encounter, every boss's path out on the movement map.
export function prove(candidate: Candidate, themes: readonly string[]): Proof {
  const library = libraryWith(candidate.id, candidate.chunk);
  const recorder = traceRecorder({ retain: false });
  const problems: string[] = [];
  let work = 0;
  if (candidate.fills && candidate.fills.door.length > 0) {
    for (const theme of themesOf(candidate.chunk)) {
      const plan = chunkThemePlan({ fills: candidate.fills, theme }, library, candidate.chunk);
      try {
        withRoomBuildings(library, { [plan.start.area]: theme }, plan);
      } catch (error) {
        problems.push(`${theme}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  for (const theme of themes) {
    for (const [profile, fills] of [
      ["empty", EMPTY],
      ...(candidate.fills ? [["filled", candidate.fills] as const] : []),
    ] as const) {
      const plan = chunkThemePlan({ fills, theme }, library, candidate.chunk);
      const layout = layoutFor(plan);
      const area = plan.start.area;
      const walk = walkRequiredRoutes(
        BIRD,
        {
          onStep: (stepped, seconds, before, after) => {
            recorder.record(zoneTraceLine(stepped, seconds, before, after));
            work++;
          },
          targets: candidate.targets.map((target) => ({ ...target, area })),
          tile: TILE,
        },
        layout,
      );
      if (!walk.complete) {
        problems.push(`${theme} ${profile}: required routes incomplete`);
      }
      for (const { from, to } of plan.areas[area]?.noCross ?? []) {
        const start = surfaceAt(TILE, walk.surfaces, area, from);
        const end = surfaceAt(TILE, walk.surfaces, area, to);
        if (!start || !end || crosses(BIRD, layout, walk.surfaces, start, end)) {
          problems.push(`${theme} ${profile}: crossed no-cross ${from.col},${from.row}`);
        }
      }
    }
    if (antagonists(candidate.chunk) > 0) {
      const layout = layoutFor(chunkThemePlan({ fills: EMPTY, theme }, library, candidate.chunk));
      const found = pathOutEncounter(candidate.chunk, layout);
      const result = pathOut({ chibi: ORDINARY, disabled: NO_DISABLED_EDGES }, found);
      if (result.bosses === 0) {
        problems.push(`${theme}: no pursuing boss in an encounter`);
      }
      problems.push(...result.problems.map((problem) => `${theme} path out: ${problem}`));
    }
  }
  return { problems, trace: recorder.hash(), work };
}

// The entry a proven candidate certifies.
export function entryOf(
  candidate: Candidate,
  layout: string,
  proof: Pick<Proof, "trace" | "work">,
): CertifiedEntry {
  const slots = (kind: "door" | "event") =>
    (candidate.chunk.slots ?? []).filter((slot) => slot.kind === kind).length;
  return {
    encounters: candidate.chunk.encounters as 0 | 1,
    grade: candidate.chunk.difficulty,
    id: candidate.id,
    kind: candidate.kind,
    layout,
    ...(candidate.modules && { modules: candidate.modules }),
    route: routeHash(candidate),
    slots: { door: slots("door"), event: slots("event") },
    trace: proof.trace,
    work: proof.work,
  };
}

// The hash of the data the zone's proofs read.
export function dataHash(
  context: CertifyContext,
  zone: ZoneKey,
  candidates: readonly Candidate[],
): string {
  const recipes = zoneRecipes(zone);
  const chunkIds = new Set(
    recipes.flatMap(([, recipe]) => [
      recipe.start,
      recipe.finish,
      ...recipeChunkPool(CHUNK_LIBRARY, recipe),
    ]),
  );
  const frame = ZONE_FRAMES[zone];
  return hashOf({
    archetypes: ARCHETYPES,
    arenas: ARENAS.filter(({ stage }) => {
      const recipe = RECIPES[stage];
      return recipe && !("sections" in recipe) && zoneOfTheme(recipe.theme) === zone;
    }),
    bird: BIRD,
    candidates: candidates.map((candidate) => ({
      chunk: candidate.chunk,
      id: candidate.id,
      route: routeHash(candidate),
    })),
    characters: CHARACTERS,
    chunkRules: CHUNK_RULES,
    chunks: Object.fromEntries([...chunkIds].sort().map((id) => [id, CHUNKS[id] ?? null])),
    connectors: frame.connectors,
    grades: context.grades,
    moduleRules: MODULE_RULES,
    modules: Object.values(context.modules)
      .filter((module) => module.zones.includes(zone))
      .sort((a, b) => (a.id < b.id ? -1 : 1)),
    recipes,
    themes: Object.fromEntries(frame.themes.map((theme) => [theme, THEMES[theme] ?? null])),
    version: CERTIFY_VERSION,
    zone,
  });
}

const FIXTURE_DIRS = [
  new URL("../sim/fixtures/behaviourTraces/", import.meta.url),
  new URL("../rules/fixtures/", import.meta.url),
];

// The hash of what the proofs' outcomes rest on: the behaviour trace fixtures, the game-kit
// release and this tool's version. Behaviour-preserving refactors leave it unchanged.
export function proofsHash(): string {
  const fixtures = FIXTURE_DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => [name, readFileSync(new URL(name, dir), "utf8")]),
  );
  const manifest = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { readonly dependencies: Readonly<Record<string, string>> };
  return hashOf({
    fixtures,
    gameKit: manifest.dependencies["@andornaut/game-kit"],
    version: CERTIFY_VERSION,
  });
}

// Step 6: every zone recipe assembles for each feasibility seed from its connectors and the
// certified entries alone.
export function feasibilityProblems(
  context: CertifyContext,
  zone: ZoneKey,
  entries: readonly CertifiedEntry[],
): string[] {
  const frame = ZONE_FRAMES[zone];
  const pairs = Object.fromEntries(
    zoneCandidates(context, zone)
      .candidates.filter(({ id, kind }) => kind === "pair" && entries.some((e) => e.id === id))
      .map(({ chunk, id }) => [id, chunk]),
  );
  const library = { ...CHUNK_LIBRARY, chunks: { ...CHUNK_LIBRARY.chunks, ...pairs } };
  const problems: string[] = [];
  for (const [key, recipe] of zoneRecipes(zone)) {
    const connectors = recipeChunkPool(CHUNK_LIBRARY, recipe).filter((id) =>
      frame.connectors.includes(id),
    );
    const certified = { ...recipe, chunks: [...connectors, ...entries.map(({ id }) => id)] };
    for (let seed = 0; seed < FEASIBILITY_SEEDS; seed++) {
      try {
        assembleZone(library, seed, key, certified);
      } catch (error) {
        problems.push(
          `${key} seed ${seed}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  return problems;
}

// Why a certified list is stale or malformed, if it is: its zone, version and input hashes, and
// for every entry, that it is a current candidate passing steps 1 to 3 with the recorded layout,
// route, grade, encounters and slots; entries sorted by id and unique.
export function verifyStructure(context: CertifyContext, list: CertifiedChunks): string[] {
  const problems: string[] = [];
  const { candidates } = zoneCandidates(context, list.zone);
  if (list.version !== 1) {
    problems.push(`version ${String(list.version)} is not 1`);
  }
  if (list.inputs.data !== dataHash(context, list.zone, candidates)) {
    problems.push(`${list.zone}: data hash is stale; rerun certify`);
  }
  if (list.inputs.proofs !== proofsHash()) {
    problems.push(`${list.zone}: proofs hash is stale; rerun certify --all`);
  }
  const ids = list.entries.map(({ id }) => id);
  if (ids.some((id, index) => index > 0 && ids[index - 1]! >= id)) {
    problems.push(`${list.zone}: entries are not sorted by unique id`);
  }
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  for (const entry of list.entries) {
    const candidate = byId.get(entry.id);
    if (!candidate) {
      problems.push(`${entry.id}: not a candidate of ${list.zone}`);
      continue;
    }
    const steps = structuralProblems(list.zone, candidate);
    problems.push(...steps.map((problem) => `${entry.id}: ${problem}`));
    if (steps.length > 0) {
      continue;
    }
    const { layout } = layoutOf(list.zone, candidate);
    const expected = entryOf(candidate, layout, entry);
    if (canonicalJson(expected) !== canonicalJson(entry)) {
      problems.push(`${entry.id}: recorded facts differ from ${canonicalJson(expected)}`);
    }
  }
  return problems;
}

// Grade shares over the band, normalized to 1.
function gradeShares(recipe: ZoneRecipe): ReadonlyMap<Difficulty, number> {
  const grades: Difficulty[] = [];
  for (let grade = recipe.difficulty.min; grade <= recipe.difficulty.max; grade++) {
    if (inBand(recipe, grade)) {
      grades.push(grade);
    }
  }
  const total = grades.reduce((sum, grade) => sum + (recipe.difficultyWeights?.[grade] ?? 1), 0);
  return new Map(grades.map((grade) => [grade, (recipe.difficultyWeights?.[grade] ?? 1) / total]));
}

// The pool-size targets for a zone: total distinct layouts and each grade's share of them.
export function poolTargets(
  total: number,
  recipe: ZoneRecipe,
): { readonly grades: ReadonlyMap<Difficulty, number>; readonly total: number } {
  return {
    grades: new Map(
      [...gradeShares(recipe)].map(([grade, share]) => [grade, Math.ceil(total * share)]),
    ),
    total,
  };
}

// Distinct layouts in a certified list, in all and by grade.
export function distinctLayouts(list: CertifiedChunks): {
  readonly grades: ReadonlyMap<Difficulty, number>;
  readonly total: number;
} {
  const grades = new Map<Difficulty, Set<string>>();
  for (const { grade, layout } of list.entries) {
    grades.set(grade, (grades.get(grade) ?? new Set()).add(layout));
  }
  return {
    grades: new Map([...grades].map(([grade, layouts]) => [grade, layouts.size])),
    total: new Set(list.entries.map(({ layout }) => layout)).size,
  };
}
