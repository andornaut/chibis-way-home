import type {
  CertifiedChunks,
  ChunkModule,
  ChunkPlan,
  ChunkSeam,
  Difficulty,
  Instance,
  ModuleRouteProfile,
  ModuleRouteTarget,
  ModuleRules,
  ModuleSide,
  TilePoint,
  ZoneFrame,
  ZoneKey,
} from "../data/types";
import { seamRuleProblems, thingOf } from "./chunk";
import { bindElement } from "./elementBinding";
import { prefixInstanceIds } from "./orbit";
import type { Catalogue } from "./tiles";

// The roles whose objects are encounters; a module's encounters count them.
export const ENCOUNTER_ROLES: ReadonlySet<string> = new Set(["antagonist", "antagonist-intro"]);
const MODULE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The zone-independent id of a pair, keying grade overrides.
const pairKey = (left: string, right: string): string => `${left}--${right}`;
const pairId = (zone: ZoneKey, left: string, right: string): string =>
  `${zone}-${pairKey(left, right)}`;

// A pair's grade: the harder half, one harder when both halves are grade 4 or 5, at most 5.
export function pairGrade(left: Difficulty, right: Difficulty): Difficulty {
  return Math.min(5, Math.max(left, right) + (left >= 4 && right >= 4 ? 1 : 0)) as Difficulty;
}

// Why two modules cannot pair in a zone, if they cannot: each fills its half, the joint rows
// match, both list the zone, and at most one half holds an encounter.
export function pairProblems(zone: ZoneKey, left: ChunkModule, right: ChunkModule): string[] {
  const problems: string[] = [];
  if (!left.sides.includes("left")) {
    problems.push(`${left.id} does not fill the left half`);
  }
  if (!right.sides.includes("right")) {
    problems.push(`${right.id} does not fill the right half`);
  }
  if (left.exit.row !== right.entry.row) {
    problems.push(`joint rows ${left.exit.row} and ${right.entry.row} differ`);
  }
  for (const module of [left, right]) {
    if (!module.zones.includes(zone)) {
      problems.push(`${module.id} is not authored for ${zone}`);
    }
  }
  if (left.encounters + right.encounters > 1) {
    problems.push("both halves hold an encounter");
  }
  return problems;
}

// A module as a chunk of its own width in one theme's bindings, for the seam rule.
function moduleChunk(
  context: { readonly rules: ModuleRules; readonly theme: string },
  bindings: Parameters<typeof bindElement>[0],
  module: ChunkModule,
): ChunkPlan {
  const bind = (instance: Instance) => bindElement(bindings, instance);
  return {
    backdrops: (module.backdrops ?? []).map(bind),
    cols: context.rules.cols,
    difficulty: module.difficulty,
    encounters: module.encounters,
    entry: module.entry as ChunkSeam,
    exit: module.exit as ChunkSeam,
    objects: module.objects.map(bind),
    rows: context.rules.rows,
    ...(module.scenery && { scenery: module.scenery.map(bind) }),
    solids: module.solids,
    theme: context.theme,
  };
}

const outerEdge = (side: ModuleSide) => (side === "left" ? "entry" : "exit");
const jointEdge = (side: ModuleSide) => (side === "left" ? "exit" : "entry");

interface ModuleContext {
  readonly catalogue: Catalogue;
  readonly chunkRules: { readonly footing: number; readonly headroom: number };
  readonly frames: Readonly<Partial<Record<ZoneKey, ZoneFrame>>>;
  readonly rules: ModuleRules;
  readonly seams: readonly number[];
  readonly themes: Readonly<
    Record<string, { readonly bindings: Parameters<typeof bindElement>[0] }>
  >;
}

// Why a module breaks the module rules, if it does: its id, sides and zones; its terrain, slots
// and every placed thing's swept span inside its columns in every theme of every zone it lists;
// the full seam rule at each listed side's outer edge and the joint rule at its joint edge; an
// encounter count equal to its antagonist objects, at most one; and at least one mandatory
// challenge, so two quiet halves never make a screen of flat travel.
export function moduleProblems(context: ModuleContext, module: ChunkModule): string[] {
  const { cols, rows } = context.rules;
  const problems: string[] = [];
  if (!MODULE_ID.test(module.id)) {
    problems.push(`id ${module.id} is not kebab-case without "--"`);
  }
  if (module.sides.length === 0 || new Set(module.sides).size !== module.sides.length) {
    problems.push("sides must be a nonempty list without repeats");
  }
  if (module.zones.length === 0 || new Set(module.zones).size !== module.zones.length) {
    problems.push("zones must be a nonempty list without repeats");
  }
  const antagonists = module.objects.filter(
    ({ role }) => role !== undefined && ENCOUNTER_ROLES.has(role),
  ).length;
  if (module.encounters !== antagonists || antagonists > 1) {
    problems.push(`encounters ${module.encounters} for ${antagonists} antagonist objects`);
  }
  const within = (rect: { col: number; cols: number; row: number; rows: number }) =>
    rect.col >= 0 && rect.row >= 0 && rect.col + rect.cols <= cols && rect.row + rect.rows <= rows;
  for (const solid of module.solids) {
    if (!within(solid)) {
      problems.push(`terrain at col ${solid.col} row ${solid.row} is outside the module`);
    }
  }
  for (const slot of module.slots ?? []) {
    if (!within(slot.area)) {
      problems.push(`slot ${slot.id} is outside the module`);
    }
  }
  const spots: readonly TilePoint[] = [
    ...(module.outOfReach ?? []),
    ...(module.noCross ?? []).flatMap(({ from, to }) => [from, to]),
    ...(module.route.targets ?? []).map(({ at }) => at),
  ];
  for (const spot of spots) {
    if (spot.col < 0 || spot.col > cols || spot.row < 0 || spot.row > rows) {
      problems.push(`spot at col ${spot.col} row ${spot.row} is outside the module`);
    }
  }
  if (module.weight !== undefined && !(module.weight > 0)) {
    problems.push(`weight ${module.weight} is not positive`);
  }
  let challenge = (module.route.targets?.length ?? 0) > 0;
  for (const zone of module.zones) {
    const frame = context.frames[zone];
    if (!frame) {
      problems.push(`no frame for zone ${zone}`);
      continue;
    }
    const extras = module.zoneObjects?.[zone] ?? [];
    for (const theme of frame.themes) {
      const bindings = context.themes[theme]?.bindings;
      if (!bindings) {
        problems.push(`no theme ${theme}`);
        continue;
      }
      let chunk: ChunkPlan;
      try {
        chunk = moduleChunk({ rules: context.rules, theme }, bindings, {
          ...module,
          objects: [...module.objects, ...extras],
        });
        const instances = [...(chunk.backdrops ?? []), ...chunk.objects];
        for (const instance of chunk.objects) {
          const { collision, moves, span } = thingOf(context.catalogue, instances, instance);
          challenge ||= collision === "hazard" || (moves && collision !== "none");
          if (span.left < 0 || span.right > cols || span.top < 0 || span.bottom > rows) {
            problems.push(
              `${theme}: ${instance.character} at col ${instance.col} row ${instance.row} ` +
                "leaves the module",
            );
          }
        }
        for (const instance of [...(chunk.backdrops ?? []), ...(chunk.scenery ?? [])]) {
          const character = context.catalogue.characters[instance.character];
          const rect = {
            col: instance.col,
            cols: instance.cols ?? character?.cols ?? 0,
            row: instance.row,
            rows: instance.rows ?? character?.rows ?? 0,
          };
          if (!within(rect)) {
            problems.push(`${theme}: scenery ${instance.character} is outside the module`);
          }
        }
      } catch (error) {
        problems.push(`${theme}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      for (const side of module.sides) {
        const outer = outerEdge(side);
        if (!context.seams.includes(module[outer].row)) {
          problems.push(`${side} ${outer} row ${module[outer].row} is not a seam row`);
        }
        problems.push(
          ...seamRuleProblems(
            { catalogue: context.catalogue, rules: context.chunkRules },
            chunk,
            outer,
            module[outer],
          ).map((problem) => `${theme} ${side} outer ${problem}`),
          ...seamRuleProblems(
            { catalogue: context.catalogue, rules: context.rules.joint },
            chunk,
            jointEdge(side),
            module[jointEdge(side)],
          ).map((problem) => `${theme} ${side} joint ${problem}`),
        );
      }
    }
  }
  if (!challenge) {
    problems.push("no mandatory challenge: no route target, hazard or mover");
  }
  return [...new Set(problems)];
}

// A composed pair: its chunk, id and required-route contract in chunk tiles.
interface ComposedPair {
  readonly chunk: ChunkPlan;
  readonly id: string;
  readonly route: {
    readonly profile: ModuleRouteProfile;
    readonly targets: readonly ModuleRouteTarget[];
  };
}

const PROFILE_ORDER: readonly ModuleRouteProfile[] = ["primary", "recovery", "encounter"];

interface PairContext {
  readonly frame: ZoneFrame;
  readonly grades: Readonly<Record<string, Difficulty>>;
  readonly rules: ModuleRules;
  readonly zone: ZoneKey;
}

// The chunk two compatible modules make in a zone: the left half as authored and the right half
// shifted one module right; objects left, right, then each half's zone additions, so motion
// stream indices are fixed; instance ids with the orbit hosts and phase sources that name them,
// slots prefixed by half, so halves may reuse ids; the zone's themes and frame;
// one maxPerZone.
export function composePair(
  context: PairContext,
  left: ChunkModule,
  right: ChunkModule,
): ComposedPair {
  const problems = pairProblems(context.zone, left, right);
  if (problems.length > 0) {
    throw new Error(`${pairKey(left.id, right.id)}: ${problems.join("; ")}`);
  }
  const offset = context.rules.cols;
  const scoped = (side: ModuleSide, values: readonly Instance[] | undefined): Instance[] =>
    prefixInstanceIds(`${side}:`, values ?? []);
  const point = <T extends TilePoint>(value: T): T => ({ ...value, col: value.col + offset });
  const shifted = <T extends { readonly col: number }>(values: readonly T[] | undefined): T[] =>
    (values ?? []).map((value) => ({ ...value, col: value.col + offset }));
  const zoneObjects = (module: ChunkModule) => module.zoneObjects?.[context.zone];
  const key = pairKey(left.id, right.id);
  const slots = [
    ...(left.slots ?? []).map((slot) => ({ ...slot, id: `left:${slot.id}` })),
    ...(right.slots ?? []).map((slot) => ({
      ...slot,
      area: point(slot.area),
      id: `right:${slot.id}`,
    })),
  ];
  const noCross = [
    ...(left.noCross ?? []),
    ...(right.noCross ?? []).map(({ from, to }) => ({ from: point(from), to: point(to) })),
  ];
  const outOfReach = [...(left.outOfReach ?? []), ...(right.outOfReach ?? []).map(point)];
  const backdrops = [
    ...scoped("left", left.backdrops),
    ...shifted(scoped("right", right.backdrops)),
  ];
  const scenery = [...scoped("left", left.scenery), ...shifted(scoped("right", right.scenery))];
  const chunk = context.frame.frame({
    ...(backdrops.length > 0 && { backdrops }),
    cols: 2 * offset,
    difficulty: context.grades[key] ?? pairGrade(left.difficulty, right.difficulty),
    encounters: left.encounters + right.encounters,
    entry: left.entry as ChunkSeam,
    exit: right.exit as ChunkSeam,
    maxPerZone: 1,
    ...(noCross.length > 0 && { noCross }),
    objects: [
      ...scoped("left", left.objects),
      ...shifted(scoped("right", right.objects)),
      ...scoped("left", zoneObjects(left)),
      ...shifted(scoped("right", zoneObjects(right))),
    ],
    ...(outOfReach.length > 0 && { outOfReach }),
    rows: context.rules.rows,
    ...(scenery.length > 0 && { scenery }),
    ...(slots.length > 0 && { slots }),
    solids: [...left.solids, ...shifted(right.solids)],
    theme: context.frame.themes,
    weight: (left.weight ?? 1) * (right.weight ?? 1),
  });
  const profile =
    PROFILE_ORDER[
      Math.max(
        PROFILE_ORDER.indexOf(left.route.profile),
        PROFILE_ORDER.indexOf(right.route.profile),
      )
    ]!;
  return {
    chunk,
    id: pairId(context.zone, left.id, right.id),
    route: {
      profile,
      targets: [
        ...(left.route.targets ?? []),
        ...(right.route.targets ?? []).map((target) => ({
          ...target,
          at: point(target.at),
          ...(target.xRange && {
            xRange: { max: target.xRange.max + offset, min: target.xRange.min + offset },
          }),
        })),
      ],
    },
  };
}

interface CertifiedContext {
  readonly frames: Readonly<Partial<Record<ZoneKey, ZoneFrame>>>;
  readonly grades: Readonly<Record<string, Difficulty>>;
  readonly modules: Readonly<Record<string, ChunkModule>>;
  readonly rules: ModuleRules;
}

// The chunks of every certified pair, by id, and each zone's certified pool: its pairs and
// singles in list order. Only listed pairs are composed, so an unlisted pair is never drawn.
export function certifiedChunks(
  context: CertifiedContext,
  lists: readonly CertifiedChunks[],
): {
  readonly chunks: Readonly<Record<string, ChunkPlan>>;
  readonly pools: Readonly<Partial<Record<ZoneKey, readonly string[]>>>;
} {
  const chunks: Record<string, ChunkPlan> = {};
  const pools: Partial<Record<ZoneKey, readonly string[]>> = {};
  for (const list of lists) {
    const frame = context.frames[list.zone];
    if (!frame) {
      throw new Error(`No frame for certified zone ${list.zone}`);
    }
    pools[list.zone] = list.entries.map((entry) => {
      if (entry.kind === "pair") {
        const [leftId, rightId] = entry.modules ?? [];
        const left = leftId === undefined ? undefined : context.modules[leftId];
        const right = rightId === undefined ? undefined : context.modules[rightId];
        if (!left || !right) {
          throw new Error(`Certified pair ${entry.id} names a missing module`);
        }
        const composed = composePair({ ...context, frame, zone: list.zone }, left, right);
        if (composed.id !== entry.id) {
          throw new Error(`Certified pair ${entry.id} composes as ${composed.id}`);
        }
        chunks[entry.id] = composed.chunk;
      }
      return entry.id;
    });
  }
  return { chunks, pools };
}
