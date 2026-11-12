// Chibi's adapters onto game-kit's movement and air maps: profiles derived from each boss's own
// movement data, the static terrain of one area, and the masks that disable dynamic terrain per
// query. Ground pursuit reads `pursuitGroundMap`.
import {
  type AirArea,
  type AirBuildOptions,
  type AirMap,
  type AirMask,
  buildAirMap,
  type FlightProfile,
} from "@andornaut/game-kit/terrain/airMap";
import {
  buildMovementMap,
  type MapArea,
  type MapBuildOptions,
  type MapJumpScript,
  type MapMask,
  type MovementMap,
  type MovementProfile,
} from "@andornaut/game-kit/terrain/movementMap";

import { EDGE, spriteFrameOrigin, STEP_SECONDS } from "../core/index.ts";
import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours.ts";
import { TILE } from "../data/screen.ts";
import type {
  AreaLayout,
  BirdTuning,
  CrumblingSupportId,
  ObjectLayout,
  Point,
  Rect,
  ZoneLayout,
} from "../data/types/index.ts";
import type { BehaviourPlatformFrame, BehaviourWorld } from "./behaviourReach.ts";
import { contactBox } from "./behaviourTrack.ts";
import { clockedSupport } from "./effectiveCollision.ts";
import { supportedLanding } from "./flyLanding.ts";
import { hazardBoundsAt } from "./hazardOccupancy.ts";
import { timedHazardRect } from "./timedHazard.ts";

// A support or hazard: a terrain rectangle or the object that owns a platform or hazard.
export type MapSupport = CrumblingSupportId;

// Fixed-impulse jumps: the impulse on the first tick and the move held after it, plus the
// apex air-stop for each direction. Holding jump changes nothing in the ground kernel.
export const BOSS_JUMP_SCRIPTS: readonly MapJumpScript[] = [-1, 0, 1].flatMap((move) => {
  const d = move as -1 | 0 | 1;
  const script = { hold: { jump: false, move: d }, lead: [{ jump: true, move: d }] };
  return d === 0 ? [script] : [script, { ...script, afterApex: { jump: false, move: 0 } }];
});

// Ground maps step at the fixed simulation step with the runtime search's per-leg horizon, so a
// map leg fits one pursuit search.
const MAP_BUILD_OPTIONS: Omit<MapBuildOptions<MapSupport>, "jumps"> = {
  dtSeconds: STEP_SECONDS,
  epsilon: EDGE,
  horizonSteps: BEHAVIOUR_TRAVERSAL_SEARCH.budget.horizonSteps,
  launchStride: 2 * TILE,
  maxCollisionSteps: BEHAVIOUR_TRAVERSAL_SEARCH.maxCollisionSteps,
};

// Flyer cells are one tile; each change between horizontal and vertical legs costs this much,
// so routes keep the ascend, cruise and descend legs that flight proofs require.
const AIR_BUILD_OPTIONS: AirBuildOptions = { axisChangeSeconds: 0.25, tileSize: TILE };

type BossMovementProfile =
  | { readonly key: string; readonly kind: "ground"; readonly profile: MovementProfile }
  | { readonly key: string; readonly kind: "air"; readonly profile: FlightProfile };

function bodyOf(object: ObjectLayout): MovementProfile["body"] {
  const box = object.hitbox;
  return {
    height: box?.height ?? object.height,
    offset: { x: box?.x ?? 0, y: box?.y ?? 0 },
    width: box?.width ?? object.width,
  };
}

function groundKey(profile: MovementProfile): string {
  const { body, climb } = profile;
  return [
    "ground",
    body.width,
    body.height,
    body.offset.x,
    body.offset.y,
    profile.walkSpeed,
    profile.gravity,
    profile.jumpSpeed,
    profile.maxFallSpeed,
    climb ? `${climb.height}/${climb.speed}` : "-",
  ].join(" ");
}

function airKey(profile: FlightProfile): string {
  const { body } = profile;
  return ["air", body.width, body.height, body.offset.x, body.offset.y, profile.speed, profile.cell]
    .map(String)
    .join(" ");
}

// One profile per distinct pursuit movement in a pursuer's resolved plan: ground pursuit from its
// traversal speed and physics, with a climb when a state moves up its own vertical track, and
// flight from its pursuit speed with the whole frame as the body, as flight landings use.
export function bossMovementProfiles(object: ObjectLayout): readonly BossMovementProfile[] {
  const plan = object.behaviour;
  if (!plan?.pursuit) {
    return [];
  }
  const nodes = Object.values(plan.states);
  const climbs = nodes.flatMap(({ motion, track }) =>
    motion.kind === "move" && motion.direction === -1 && (track ?? plan).axis === "y"
      ? [{ height: Math.abs((track ?? plan).distance), speed: motion.speed }]
      : [],
  );
  const climb = climbs.sort((a, b) => b.height - a.height || b.speed - a.speed)[0];
  const profiles = new Map<string, BossMovementProfile>();
  for (const { motion } of nodes) {
    if (motion.kind !== "pursue") {
      continue;
    }
    if (motion.mode === "ground" && motion.traversal) {
      const { gravity, jumpSpeed, maxFallSpeed, speed } = motion.traversal;
      const profile: MovementProfile = {
        body: bodyOf(object),
        gravity,
        jumpSpeed,
        maxFallSpeed,
        walkSpeed: speed,
        ...(climb && { climb }),
      };
      profiles.set(groundKey(profile), { key: groundKey(profile), kind: "ground", profile });
    } else if (motion.mode === "fly") {
      const profile: FlightProfile = {
        body: { height: object.height, offset: { x: 0, y: 0 }, width: object.width },
        cell: 1,
        speed: motion.speed,
      };
      profiles.set(airKey(profile), { key: airKey(profile), kind: "air", profile });
    }
  }
  return [...profiles.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

// Chibi without skills on the ground kernel: his collision box and his gravity, full jump,
// flutter fall and walk speed.
export function chibiMovementProfile(tuning: BirdTuning): MovementProfile {
  return {
    body: { height: tuning.height, offset: { x: 0, y: 0 }, width: tuning.width },
    gravity: tuning.gravity,
    jumpSpeed: tuning.jumpSpeed,
    maxFallSpeed: tuning.flutterFallSpeed,
    walkSpeed: tuning.walkSpeed,
  };
}

// His full jump plus the tapped low hop, each as a fixed impulse; a released jump lands between.
export function chibiJumpScripts(tuning: BirdTuning): readonly MapJumpScript[] {
  const hop = Math.sqrt(2 * tuning.gravity * tuning.jumpHopHeight);
  return [
    ...BOSS_JUMP_SCRIPTS,
    ...BOSS_JUMP_SCRIPTS.map((script) => ({ ...script, jumpSpeed: hop })),
  ];
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width - EDGE &&
    b.x < a.x + a.width - EDGE &&
    a.y < b.y + b.height - EDGE &&
    b.y < a.y + a.height - EDGE
  );
}

// Touching counts: a sweep resting on a support top depends on that support.
function touches(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width - EDGE &&
    b.x < a.x + a.width - EDGE &&
    a.y <= b.y + b.height + EDGE &&
    b.y <= a.y + a.height + EDGE
  );
}

// A uniform grid of at most 64 by 64 cells over the finite rects. Queries widen by twice EDGE and
// visit every rect whose cells meet them; a missing or non-finite rect meets every query, so the
// exact tests see a superset of the matches and `filter` keeps the original order.
const GRID_CELLS = 64;

interface RectGrid {
  readonly filter: (query: Rect, test: (index: number) => boolean) => readonly number[];
  readonly some: (query: Rect, test: (index: number) => boolean) => boolean;
}

function rectGrid(rects: readonly (Rect | undefined)[]): RectGrid {
  const finite = (rect: Rect | undefined): rect is Rect =>
    rect !== undefined && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite);
  const all = rects.map((_, i) => i);
  const always = all.filter((i) => !finite(rects[i]));
  const placed = rects.filter(finite);
  const left = Math.min(...placed.map(({ x }) => x));
  const top = Math.min(...placed.map(({ y }) => y));
  const right = Math.max(...placed.map(({ width, x }) => x + width));
  const bottom = Math.max(...placed.map(({ height, y }) => y + height));
  const size = Math.max((right - left) / GRID_CELLS, (bottom - top) / GRID_CELLS, TILE);
  const columns = placed.length ? Math.floor((right - left) / size) + 1 : 0;
  const rows = placed.length ? Math.floor((bottom - top) / size) + 1 : 0;
  const column = (x: number) => Math.floor((x - left) / size);
  const row = (y: number) => Math.floor((y - top) / size);
  const cells: number[][] = Array.from({ length: columns * rows }, () => []);
  rects.forEach((rect, i) => {
    if (finite(rect)) {
      for (let cx = column(rect.x); cx <= column(rect.x + rect.width); cx++) {
        for (let cy = row(rect.y); cy <= row(rect.y + rect.height); cy++) {
          cells[cx * rows + cy]!.push(i);
        }
      }
    }
  });
  const margin = 2 * EDGE;
  // Calls the visitor for each candidate until it returns true, with repeats across cells.
  const visit = (query: Rect, visitor: (index: number) => boolean): boolean => {
    if (always.some(visitor)) {
      return true;
    }
    const x0 = column(query.x - margin);
    const x1 = column(query.x + query.width + margin);
    const y0 = row(query.y - margin);
    const y1 = row(query.y + query.height + margin);
    if (![x0, x1, y0, y1].every(Number.isFinite)) {
      return all.some(visitor);
    }
    for (let cx = Math.max(0, x0); cx <= Math.min(columns - 1, x1); cx++) {
      for (let cy = Math.max(0, y0); cy <= Math.min(rows - 1, y1); cy++) {
        if (cells[cx * rows + cy]!.some(visitor)) {
          return true;
        }
      }
    }
    return false;
  };
  return {
    filter: (query, test) => {
      const found: number[] = [];
      visit(query, (i) => {
        if (!found.includes(i) && test(i)) {
          found.push(i);
        }
        return false;
      });
      return found.length > 1 ? found.sort((a, b) => a - b) : found;
    },
    some: visit,
  };
}

function fixed(object: ObjectLayout): boolean {
  return (
    object.motion.algorithm === "static" &&
    !object.behaviour &&
    !object.orbit &&
    object.reaction.kind === "none"
  );
}

function hazardRect(object: ObjectLayout): Rect {
  return object.contact
    ? { ...spriteFrameOrigin(object.contact.frame, object, object.origin), ...object.contact.frame }
    : contactBox(object, object.origin, 1);
}

// Static hazards block. Pursuers are bodies, not terrain. Every other hazard is a dependency over
// its certified footprint: a timed hazard's box, or a moving hazard's whole certified reach.
// Uncertified reach covers the area.
const FOOTPRINT_SECONDS = 3600;

export interface MapTerrain {
  readonly area: MapArea<MapSupport>;
  readonly bounds: Rect;
  // Every support whose presence can change: crumbling and clocked supports' ids.
  readonly crumbling: ReadonlySet<MapSupport>;
  readonly depKey: (id: MapSupport) => string;
  readonly hazards: readonly { readonly owner: ObjectLayout; readonly rect: Rect }[];
  readonly pads: readonly Rect[];
  // The terrain as a stationary behaviour world, for supported-landing rules and kernel proofs.
  readonly world: BehaviourWorld;
}

interface MapTerrainOptions {
  // Extends the area: padding columns and their ground, as supports and bounds.
  readonly bounds?: Rect;
  readonly pads?: readonly Rect[];
}

// The area's static terrain at its layout positions. Moving platforms (lifts, shuttles, boats,
// behaviour platforms) are left out; crumbling and clocked supports are built present and carried
// as deps of kind crumbling, so a mask decides their presence.
export function mapTerrain(options: MapTerrainOptions, area: AreaLayout): MapTerrain {
  const bounds = options.bounds ?? { height: area.height, width: area.width, x: 0, y: 0 };
  const pads = options.pads ?? [];
  const keys = new Map<MapSupport, string>();
  area.solids.forEach((rect, index) => keys.set(rect, `solid:${index}`));
  pads.forEach((rect, index) => keys.set(rect, `pad:${index}`));
  area.objects.forEach((object, index) => keys.set(object, `object:${index}`));
  const platforms = area.objects.filter(
    (object) => (object.collision === "solid" || object.collision === "ledge") && fixed(object),
  );
  const platformRect = (object: ObjectLayout): Rect => ({
    ...object.origin,
    height: object.height,
    width: object.width,
  });
  // Clocked supports collide in the map but stay out of the world, so they are never perches.
  const clocked = area.objects.filter(
    (object) => object.collision === "ledge" && clockedSupport(object),
  );
  const solids = [...area.solids, ...pads];
  const hazards: { owner: ObjectLayout; rect: Rect }[] = [];
  const dependencies: { id: MapSupport; footprint: Rect | undefined }[] = [];
  for (const definition of area.crumbling ?? []) {
    dependencies.push({ footprint: definition.volume, id: definition.supportId });
  }
  for (const object of clocked) {
    dependencies.push({ footprint: platformRect(object), id: object });
  }
  for (const object of area.objects) {
    if (object.collision !== "hazard" || object.behaviour?.pursuit) {
      continue;
    }
    if (fixed(object)) {
      hazards.push({ owner: object, rect: hazardRect(object) });
    } else if (
      object.behaviour &&
      Object.values(object.behaviour.states).some((n) => n.hazardPhase)
    ) {
      dependencies.push({ footprint: timedHazardRect(object, object.origin), id: object });
    } else {
      const contact = hazardRect(object);
      const reach = hazardBoundsAt(
        area.objects,
        undefined,
        object.origin,
        contact,
        0,
        object,
      )(FOOTPRINT_SECONDS);
      dependencies.push({ footprint: reach, id: object });
    }
  }
  const crumbling = new Set<MapSupport>([
    ...(area.crumbling ?? []).map(({ supportId }) => supportId),
    ...clocked,
  ]);
  const colliders = [
    ...solids.map((rect) => ({
      after: rect,
      before: rect,
      kind: "solid" as const,
      supportId: rect,
    })),
    ...[...platforms, ...clocked].map((object) => {
      const rect = platformRect(object);
      return {
        after: rect,
        before: rect,
        kind: object.collision as "solid" | "ledge",
        supportId: object as MapSupport,
      };
    }),
  ];
  const platformFrames: BehaviourPlatformFrame[] = platforms.map((object) => {
    const rect = platformRect(object);
    return {
      after: rect,
      before: rect,
      collision: object.collision as "solid" | "ledge",
      owner: object,
    };
  });
  const world: BehaviourWorld = {
    hazards,
    platforms: platformFrames.map(({ after, collision, owner }) => ({
      collision,
      owner,
      rect: after,
    })),
    solids,
    traversalFrame: {
      bounds,
      dtSeconds: STEP_SECONDS,
      platforms: platformFrames,
      sample: () => platformFrames,
      timeSeconds: 0,
    },
  };
  const nearHazards = rectGrid(hazards.map(({ rect }) => rect));
  const nearDependencies = rectGrid(dependencies.map(({ footprint }) => footprint));
  return {
    area: {
      blocked: (sweep) => nearHazards.some(sweep, (i) => overlaps(sweep, hazards[i]!.rect)),
      bounds,
      colliders,
      deps: (sweep) =>
        nearDependencies
          .filter(sweep, (i) => {
            const { footprint } = dependencies[i]!;
            return !footprint || touches(sweep, footprint);
          })
          .map((i) => dependencies[i]!.id),
      kind: (supportId) => (crumbling.has(supportId) ? "crumbling" : "static"),
    },
    bounds,
    crumbling,
    depKey: (id) => keys.get(id) ?? "unknown",
    hazards,
    pads,
    world,
  };
}

// A window clips the map to one boss's reach; without one the map covers the area.
export function groundMap(
  options: Pick<MapBuildOptions<MapSupport>, "jumps" | "window">,
  terrain: MapTerrain,
  profile: MovementProfile,
): MovementMap<MapSupport> {
  return buildMovementMap({ ...MAP_BUILD_OPTIONS, ...options }, profile, terrain.area);
}

// Perches: every tile-spaced landing on a static support top that the supported-landing rule
// accepts for this flyer, plus each support's right-most landing.
function flightPerches(terrain: MapTerrain, object: ObjectLayout): readonly Rect[] {
  const { platforms = [], solids } = terrain.world;
  const tops = [
    ...solids,
    ...platforms.filter(({ owner }) => owner !== object).map(({ rect }) => rect),
  ];
  const perches: Rect[] = [];
  const seen = new Set<string>();
  for (const top of tops) {
    const y = top.y - object.height;
    const high = top.x + top.width - object.width;
    const xs: number[] = [];
    for (let x = top.x; x < high - EDGE; x += TILE) {
      xs.push(x);
    }
    if (high >= top.x - EDGE) {
      xs.push(high);
    }
    for (const x of xs) {
      const rect = { height: object.height, width: object.width, x, y };
      const key = `${x},${y}`;
      if (
        !seen.has(key) &&
        y >= terrain.bounds.y &&
        x >= terrain.bounds.x &&
        x + object.width <= terrain.bounds.x + terrain.bounds.width &&
        supportedLanding(object, terrain.world, { x, y } satisfies Point)
      ) {
        seen.add(key);
        perches.push(rect);
      }
    }
  }
  return perches;
}

function airArea(terrain: MapTerrain, object: ObjectLayout): AirArea<MapSupport> {
  const { platforms = [], solids } = terrain.world;
  const blockers = [
    ...solids,
    ...platforms.filter(({ collision }) => collision === "solid").map(({ rect }) => rect),
    ...terrain.hazards.map(({ rect }) => rect),
  ];
  const near = rectGrid(blockers);
  return {
    blocked: (rect) => near.some(rect, (i) => overlaps(rect, blockers[i]!)),
    bounds: terrain.bounds,
    deps: terrain.area.deps,
    perches: flightPerches(terrain, object),
  };
}

export function flightMap(
  options: Pick<AirBuildOptions, "window">,
  terrain: MapTerrain,
  object: ObjectLayout,
  profile: FlightProfile,
): AirMap<MapSupport> {
  return buildAirMap({ ...AIR_BUILD_OPTIONS, ...options }, profile, airArea(terrain, object));
}

const PURSUIT_MAPS = new WeakMap<
  AreaLayout,
  { readonly maps: Map<string, PursuitGroundMap>; readonly terrain: MapTerrain }
>();

export interface PursuitGroundMap {
  readonly map: MovementMap<MapSupport>;
  readonly terrain: MapTerrain;
}

// The first ground pursuit with traversal physics in state order, as pursuit reads it.
function groundPursuitMotion(object: ObjectLayout) {
  for (const { motion } of Object.values(object.behaviour?.states ?? {})) {
    if (motion.kind === "pursue" && motion.mode === "ground" && motion.traversal) {
      return { ...motion, traversal: motion.traversal };
    }
  }
  return undefined;
}

// A ground pursuer's route map: its pursuit physics without climbing, which pursuit never uses,
// clipped to the columns its leash allows (the whole area when the leash covers it). Cached per
// area, profile and window, so every boss sharing them shares one map. With `build` false it
// only reads the cache. A map is a pure function of the area, profile and window, so when it is
// built never changes its content.
export function pursuitGroundMap(
  area: AreaLayout,
  object: ObjectLayout,
  build = true,
): PursuitGroundMap | undefined {
  const motion = groundPursuitMotion(object);
  const leash = object.behaviour?.pursuit?.distance;
  if (!motion || leash === undefined) {
    return undefined;
  }
  let cached = PURSUIT_MAPS.get(area);
  if (!cached) {
    cached = { maps: new Map(), terrain: mapTerrain({}, area) };
    PURSUIT_MAPS.set(area, cached);
  }
  const { gravity, jumpSpeed, maxFallSpeed, speed } = motion.traversal;
  const profile: MovementProfile = {
    body: bodyOf(object),
    gravity,
    jumpSpeed,
    maxFallSpeed,
    walkSpeed: speed,
  };
  const left = Math.max(0, object.origin.x - leash);
  const right = Math.min(area.width, object.origin.x + object.width + leash);
  const window =
    left <= 0 && right >= area.width
      ? undefined
      : { height: area.height, width: right - left, x: left, y: 0 };
  const key = `${groundKey(profile)} ${window ? `${left},${right}` : "-"}`;
  let entry = cached.maps.get(key);
  if (!entry && build) {
    entry = {
      map: groundMap(
        { jumps: BOSS_JUMP_SCRIPTS, ...(window && { window }) },
        cached.terrain,
        profile,
      ),
      terrain: cached.terrain,
    };
    cached.maps.set(key, entry);
  }
  return entry;
}

// Builds every ground pursuer's map in every area of a zone, at zone start, so play steps only
// read the cache.
export function preparePursuitMaps(layout: ZoneLayout): void {
  for (const area of Object.values(layout.areas)) {
    for (const object of area.objects) {
      pursuitGroundMap(area, object);
    }
  }
}

interface DependencyMaskOptions {
  // Whether climb edges are enabled: only for the climbing special, never for pursuit routes.
  readonly climb: boolean;
  // Whether a dependency (crumbling support, timed or moving hazard) allows travel that departs
  // at departSeconds from the path start. Unknown presence must answer false.
  readonly allowed: (id: MapSupport, departSeconds: number) => boolean;
  readonly key: string;
}

export function groundMask(options: DependencyMaskOptions, map: MovementMap<MapSupport>): MapMask {
  return {
    edge: (id, departSeconds) => {
      const edge = map.edges[id]!;
      return (
        (options.climb || (edge.kind !== "climb" && edge.kind !== "track-climb")) &&
        edge.deps.every((dep) => options.allowed(dep, departSeconds))
      );
    },
    key: options.key,
    node: (id) => map.nodes[id]!.deps.every((dep) => options.allowed(dep, 0)),
  };
}

export function airMask(
  options: Omit<DependencyMaskOptions, "climb">,
  map: AirMap<MapSupport>,
): AirMask {
  return {
    edge: (id, departSeconds) =>
      map.edges[id]!.deps.every((dep) => options.allowed(dep, departSeconds)),
    key: options.key,
    node: (id) => map.nodes[id]!.deps.every((dep) => options.allowed(dep, 0)),
  };
}
