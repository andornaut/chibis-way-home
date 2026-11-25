// Certification of each zone's middle chunks: whole authored chunks (singles) and composed module
// pairs. Structural steps (rules, grade, encounters, layout fingerprint) are cheap and run on every
// tree; proofs (required walks with their behaviour trace, boss path-out) run in the CLI.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { traceRecorder } from "../ai/index.ts";
import { BIRD_FRAME } from "../assets/index.ts";
import { ARCHETYPES } from "../data/archetypes.ts";
import { ARENAS } from "../data/arenas/index.ts";
import { BIRD } from "../data/bird.ts";
import { CHARACTERS } from "../data/characters.ts";
import { CHUNK_RULES, CHUNKS, THEMES } from "../data/chunks.ts";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "../data/modules/index.ts";
import { TILE } from "../data/screen.ts";
import { SEAM_ROWS } from "../data/seams.ts";
import type {
  ArenaApproach,
  BirdTuning,
  CertifiedChunks,
  CertifiedEntry,
  ChunkModule,
  ChunkPlan,
  Difficulty,
  OrdinaryProofProfile,
  ZoneKey,
  ZoneLayout,
  ZoneRecipe,
} from "../data/types/index.ts";
import { ZONE_FRAMES } from "../data/zoneFrames.ts";
import { RECIPES } from "../data/zones.ts";
import {
  arenaChunks,
  assembleZone,
  CHUNK_LIBRARY,
  type ChunkLibrary,
  chunkProblems,
  composePair,
  eligibleChunks,
  ENCOUNTER_ROLES,
  moduleProblems,
  pairProblems,
  recipeChunkPool,
  themesOf,
  withRoomBuildings,
  zoneLayout,
  zoneOfTheme,
} from "../rules/stage/index.ts";
import {
  crosses,
  NO_DISABLED_EDGES,
  nodeArt,
  pathOut,
  pathOutEncounter,
  preparedPlan,
  type RunResult,
  surfaceAt,
  walkRequiredRoutes,
  type WalkRouteTarget,
  zoneTraceLine,
} from "../sim/index.ts";
import {
  arenaApproachCertificateProblems,
  arenaApproachContext,
  COLD_ENCOUNTER_CASE,
  firstArenaEncounter,
  qualifyArenaApproach,
} from "./arenaApproaches.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "./art.ts";
import { chunkThemePlan, planPhysics } from "./chunkWalkCases.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import { moduleRouteTargets, REQUIRED_CHUNK_ROUTES, slotFills } from "./requiredRoutes.ts";

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
  readonly proof?: OrdinaryProofProfile;
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
function proveWithTuning(
  tuning: BirdTuning,
  candidate: Candidate,
  themes: readonly string[],
): Proof {
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
        tuning,
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
        if (!start || !end || crosses(tuning, layout, walk.surfaces, start, end)) {
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

// Existing entries keep the original skill-capable proof and trace contract.
export function prove(candidate: Candidate, themes: readonly string[]): Proof {
  return proveWithTuning(BIRD, candidate, themes);
}

export const ORDINARY_PROOF_PROFILE: OrdinaryProofProfile = {
  kind: "ordinary",
  tuning: hashOf(ORDINARY),
  version: 1,
};

export function proofProfileProblems(profile: OrdinaryProofProfile | undefined): string[] {
  return profile === undefined || canonicalJson(profile) === canonicalJson(ORDINARY_PROOF_PROFILE)
    ? []
    : ["Unknown ordinary proof profile, version or tuning fingerprint"];
}

export function proveForProfile(
  profile: OrdinaryProofProfile | undefined,
  candidate: Candidate,
  themes: readonly string[],
): Proof {
  const problems = proofProfileProblems(profile);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
  return profile === undefined
    ? prove(candidate, themes)
    : { ...proveWithTuning(ORDINARY, candidate, themes), proof: ORDINARY_PROOF_PROFILE };
}

// The entry a proven candidate certifies.
export function entryOf(
  candidate: Candidate,
  layout: string,
  proof: Pick<Proof, "proof" | "trace" | "work">,
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
    ...(proof.proof !== undefined && { proof: proof.proof }),
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

// The hash of what the proofs' outcomes rest on beyond the data: the game-kit release and this
// tool's version. A behaviour change shows in the recorded walk and arena trace hashes, which
// verify reproves.
export function proofsHash(): string {
  const manifest = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { readonly dependencies: Readonly<Record<string, string>> };
  return hashOf({
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
  return assemblyProblems(
    library,
    zoneRecipes(zone).map(
      ([stage, recipe]) =>
        [
          stage,
          {
            ...recipe,
            chunks: [
              ...recipeChunkPool(CHUNK_LIBRARY, recipe).filter((id) =>
                frame.connectors.includes(id),
              ),
              ...entries.map(({ id }) => id),
            ],
          },
        ] as const,
    ),
  );
}

function assemblyProblems(
  library: ChunkLibrary,
  recipes: readonly (readonly [string, ZoneRecipe])[],
): string[] {
  const problems: string[] = [];
  for (const [key, recipe] of recipes) {
    for (let seed = 0; seed < FEASIBILITY_SEEDS; seed++) {
      try {
        assembleZone(library, seed, key, recipe);
      } catch (error) {
        problems.push(
          `${key} seed ${seed}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  return problems;
}

// Full-certificate tools use the supplied positive relations, never a resident global list.
export function certificateFeasibilityProblems(
  context: CertifyContext,
  list: CertifiedChunks,
): string[] {
  const { library, stages } = certifiedWorld(zoneCandidates(context, list.zone).candidates, list);
  return assemblyProblems(
    library,
    stages.map(({ recipe, stage }) => [stage, recipe] as const),
  );
}

// Why a certified list is stale or malformed, if it is: its zone, version and input hashes, and
// for every entry, that it is a current candidate passing steps 1 to 3 with the recorded layout,
// route, grade, encounters and slots; entries sorted by id and unique.
function entryStructure(context: CertifyContext, list: CertifiedChunks) {
  const problems: string[] = [];
  const { candidates } = zoneCandidates(context, list.zone);
  const data = dataHash(context, list.zone, candidates);
  const proofs = proofsHash();
  if (list.version !== 1) {
    problems.push(`version ${String(list.version)} is not 1`);
  }
  if (list.inputs.data !== data) {
    problems.push(`${list.zone}: data hash is stale; rerun certify`);
  }
  if (list.inputs.proofs !== proofs) {
    problems.push(`${list.zone}: proofs hash is stale; rerun certify --all`);
  }
  return {
    candidates,
    data,
    problems: [...problems, ...verifyEntryFacts(candidates, list)],
    proofs,
  };
}

// A proposal is not yet admitted; approach qualification is checked by verifyStructure.
export function verifyEntryStructure(context: CertifyContext, list: CertifiedChunks): string[] {
  return entryStructure(context, list).problems;
}

// Full admission also requires the opted-in approach relation and matching measured context.
export function verifyStructure(context: CertifyContext, list: CertifiedChunks): string[] {
  const { candidates, data, problems, proofs } = entryStructure(context, list);
  if (problems.length > 0) {
    return problems;
  }
  const recipes = zoneRecipes(list.zone);
  if (
    (list.approaches?.length ?? 0) === 0 &&
    recipes.every(([, recipe]) => recipe.arenaApproach === undefined)
  ) {
    return problems;
  }
  const { library, stages } = certifiedWorld(candidates, list);
  problems.push(
    ...arenaApproachCertificateProblems(
      {
        inputs: { data, proofs },
        stages: stages.map(({ recipe, stage }) => ({
          arena: library.arenas?.[stage],
          eligible: eligibleChunks(library, recipe, recipeChunkPool(library, recipe)),
          expected: (seed: number) => {
            const prepared = preparedPlan(
              { ...nodeArt(), seed },
              assembleZone(library, seed, stage, recipe),
            );
            const encounter = firstArenaEncounter(prepared);
            return arenaApproachContext({ encounter, hash: hashOf }, prepared);
          },
          recipe,
          stage,
        })),
      },
      list.approaches ?? [],
    ),
  );
  return problems;
}

// A supplied certificate controls the whole effective pool; old runtime entries are never fallback choices.
function certifiedWorld(candidates: readonly Candidate[], list: CertifiedChunks) {
  const recipes = zoneRecipes(list.zone);
  const pairs = Object.fromEntries(
    candidates
      .filter(
        (candidate) =>
          candidate.kind === "pair" && list.entries.some(({ id }) => id === candidate.id),
      )
      .map(({ chunk, id }) => [id, chunk]),
  );
  const admitted = arenaChunks(
    ARENAS.filter(({ id }) => list.arenas.some((arena) => arena.id === id)),
  );
  const library: ChunkLibrary = {
    ...CHUNK_LIBRARY,
    approaches: Object.fromEntries(
      (list.approaches ?? []).map((relation) => [relation.stage, relation]),
    ),
    arenas: {
      ...Object.fromEntries(
        Object.entries(CHUNK_LIBRARY.arenas ?? {}).filter(
          ([stage]) => !recipes.some(([key]) => key === stage),
        ),
      ),
      ...admitted.stages,
    },
    chunks: { ...CHUNK_LIBRARY.chunks, ...pairs, ...admitted.chunks },
  };
  return {
    library,
    stages: recipes.map(([stage, recipe]) => ({
      recipe: {
        ...recipe,
        chunks: [
          ...recipeChunkPool(CHUNK_LIBRARY, recipe).filter((id) =>
            ZONE_FRAMES[list.zone].connectors.includes(id),
          ),
          ...list.entries.map(({ id }) => id),
        ],
      },
      stage,
    })),
  };
}

// Explicit qualification bootstrap only. This never writes or marks a certificate admitted.
export function prepareArenaApproachCandidate(
  context: { readonly stage: string },
  list: CertifiedChunks,
) {
  const checked = entryStructure(GAME_CONTEXT, list);
  if (checked.problems.length > 0) {
    throw new Error(checked.problems.join("; "));
  }
  const { library, stages } = certifiedWorld(checked.candidates, list);
  const found = stages.find(({ stage }) => stage === context.stage);
  const arena = library.arenas?.[context.stage];
  if (
    context.stage !== "city-boundary" ||
    found?.recipe.arenaApproach === undefined ||
    arena === undefined
  ) {
    throw new Error("No declared canonical cold-encounter-v1 candidate");
  }
  const relation: ArenaApproach = {
    arena,
    ...found.recipe.arenaApproach,
    stage: context.stage,
  };
  const candidateLibrary = {
    ...library,
    approaches: { ...library.approaches, [context.stage]: relation },
  };
  const plan = assembleZone(
    candidateLibrary,
    COLD_ENCOUNTER_CASE.seed,
    context.stage,
    found.recipe,
  );
  return {
    prepared: preparedPlan({ ...nodeArt(), seed: COLD_ENCOUNTER_CASE.seed }, plan),
    relation,
    status: "unqualified" as const,
  };
}

// Record an already-run canonical result; there is no simulation or fixture update here.
export function completeArenaApproachQualification(
  context: { readonly stage: string; readonly trace: string },
  list: CertifiedChunks,
  result: RunResult,
): CertifiedChunks {
  const candidate = prepareArenaApproachCandidate(context, list);
  const relation = qualifyArenaApproach(
    {
      hash: hashOf,
      inputs: list.inputs,
      policy: candidate.relation,
      stage: context.stage,
      trace: context.trace,
    },
    candidate.prepared,
    result,
  );
  const next: CertifiedChunks = {
    ...list,
    approaches: [
      ...(list.approaches ?? []).filter(({ stage }) => stage !== context.stage),
      relation,
    ].sort((a, b) => a.stage.localeCompare(b.stage)),
  };
  const problems = verifyStructure(GAME_CONTEXT, next);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
  return next;
}

// Validate recorded entry facts independently of proof provenance freshness.
export function verifyEntryFacts(
  candidates: readonly Candidate[],
  list: CertifiedChunks,
): string[] {
  const problems: string[] = [];
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
    const profileProblems = proofProfileProblems(entry.proof);
    problems.push(...profileProblems.map((problem) => `${entry.id}: ${problem}`));
    if (profileProblems.length > 0) {
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
