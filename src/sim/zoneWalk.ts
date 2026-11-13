import { clamp } from "@andornaut/game-kit/numbers";

import { EDGE, STEP_SECONDS } from "../core/index.ts";
import type {
  AreaLayout,
  BirdTuning,
  ObjectLayout,
  Point,
  Rect,
  TilePoint,
  ZoneLayout,
} from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { startBird, stepBird } from "../rules/bird.ts";
import { orbitBounds } from "../rules/orbit.ts";
import {
  activateBehaviour,
  areaOf,
  enterArea,
  standsOn,
  startZone,
  stepZone as stepActualZone,
  type ZoneInput,
  type ZoneState,
} from "../rules/zone.ts";
import {
  type BehaviourBoundsContext,
  emissionBounds,
  hasDynamicMotion,
  objectCycleSeconds,
  sweptBehaviourRect,
} from "./behaviourBounds.ts";
import { landingCorridor, phaseCount, type PhaseMover, phaseStarts } from "./walkPhases.ts";
import { type WalkStep, walkTransitions } from "./walkTransitions.ts";
import { WalkWitnesses } from "./zoneWalkWitnesses.ts";

const BEHAVIOUR_INDICES = new WeakMap<AreaLayout, readonly number[]>();
const WALK_TERMINALS = new WeakMap<ZoneLayout, (zone: ZoneState, support: Surface) => void>();
const WALK_WITNESSES = new WeakMap<ZoneLayout, WalkWitnesses>();
const WALK_OBSERVERS = new WeakMap<ZoneLayout, (before: ZoneState, next: ZoneState) => void>();
const WALK_STEP_HOOKS = new WeakMap<ZoneLayout, NonNullable<WalkRouteQuery["onStep"]>>();
const WALK_SPANS = new WeakMap<
  ZoneLayout,
  WeakMap<
    Pick<BehaviourBoundsContext, "maximumRise" | "targetHeight">,
    WeakMap<Surface, ReturnType<typeof sweptSpan>>
  >
>();

// Conversations do not move the world. The walker activates their patrols explicitly so it
// verifies the active encounter, including on any fresh attempt.
function physicalStep(
  tuning: BirdTuning,
  layout: ZoneLayout,
  seconds: number,
  input: ZoneInput,
  zone: ZoneState,
): ZoneState {
  const area = areaOf(layout, zone.area);
  let indices = BEHAVIOUR_INDICES.get(area);
  if (!indices) {
    indices = area.objects.flatMap((object, index) => (object.behaviour ? [index] : []));
    BEHAVIOUR_INDICES.set(area, indices);
  }
  const active = indices.reduce((state, index) => activateBehaviour(index, state), zone);
  const next = stepActualZone(SKILL_PROFILES, tuning, layout, seconds, input, active);
  if (next !== active) {
    WALK_STEP_HOOKS.get(layout)?.(layout, seconds, active, next);
  }
  return next;
}

function observeTransition(layout: ZoneLayout, before: ZoneState, next: ZoneState): ZoneState {
  if (!before.cleared) {
    WALK_OBSERVERS.get(layout)?.(before, next);
  }
  return next;
}

function stepZone(
  tuning: BirdTuning,
  layout: ZoneLayout,
  seconds: number,
  input: ZoneInput,
  zone: ZoneState,
): ZoneState {
  return observeTransition(layout, zone, physicalStep(tuning, layout, seconds, input, zone));
}

// A top he can stand on in an area: a still span from left to right at height y, or a moving
// platform's top (mover: its object's index), placed where its track starts. Still spans are
// the tops of terrain and still solid and ledge objects, joined where they meet at one height,
// less where a solid or still hazard leaves him no room to stand.
export interface Surface {
  readonly area: string;
  readonly key: string;
  readonly left: number;
  readonly mover: number | undefined;
  readonly right: number;
  readonly y: number;
}

// Where the walk has him standing: a stretch of a surface, its bucket (BUCKET px wide, from the
// surface's left), and his zone state when he first came to stand there.
interface Spot {
  readonly bucket: number;
  readonly state: ZoneState;
  readonly surface: Surface;
}

// What the walk finds: every surface in the zone, the keys of those he came to stand on,
// whether he cleared the zone, and how many zone steps it ran.
export interface ZoneWalk {
  readonly cleared: boolean;
  readonly reached: ReadonlySet<string>;
  readonly steps: number;
  readonly surfaces: readonly Surface[];
}

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
// The walk splits each surface into stretches this wide, so a jump along one surface (over a
// hazard on it, say) counts as a move.
const BUCKET = 96;
// How far he runs up before a takeoff, and how far inside his surface his centre stays as he
// gets into place, in px; how long a try may run after the takeoff, and how long he may take to
// walk into place, in steps.
const RUN_UP = 36;
const FOOTING = 16;
const AIR_STEPS = Math.round(5 / STEP_SECONDS);
const WALK_STEPS = Math.round(8 / STEP_SECONDS);
// Where he presses Jump before the edge he runs off, in px back along his run, besides every
// TAKEOFF_STEP px along his surface; and the nearby buckets of his own surface he aims for.
const EDGE_TAKEOFFS = [4, 12, 36, 72, 120];
const TAKEOFF_STEP = 12;
const OWN_BUCKETS = [-3, -2, -1, 1, 2, 3];
// Waits before a try, in steps, where something moves near it: through the longest cycle of the
// relevant moving things (at most MAX_CYCLE seconds), every half second.
const WAIT_STEP = Math.round(0.5 / STEP_SECONDS);
const MAX_CYCLE = 16;
// Slack on how far the walk looks for a move, in px.
const MARGIN = 24;

const isStill = (object: ObjectLayout) => !hasDynamicMotion(object);
// A still hazard on a clock of hazard phases, lethal only while active.
const isTimedHazard = (object: ObjectLayout) =>
  isStill(object) &&
  object.collision === "hazard" &&
  Object.values(object.behaviour?.states ?? {}).some((node) => node.hazardPhase !== undefined);
const movementSpeed = (object: ObjectLayout): number =>
  object.behaviour
    ? Math.max(
        0,
        ...Object.values(object.behaviour.states).map((node) =>
          node.motion.kind !== "wait" ? node.motion.speed : 0,
        ),
      )
    : object.motion.speed;

const objectRect = (object: ObjectLayout, at: Point): Rect => ({
  height: object.height,
  width: object.width,
  x: at.x,
  y: at.y,
});

// The area an object can be in over its track: its rectangle swept along its motion's axis.
function sweptRect(
  target: Pick<BehaviourBoundsContext, "maximumRise" | "targetHeight">,
  area: AreaLayout,
  object: ObjectLayout,
): Rect {
  if (object.orbit) {
    return orbitBounds(area.objects, object);
  }
  const pattern = object.behaviour;
  if (pattern) {
    return sweptBehaviourRect(
      { ...target, areaBounds: { height: area.height, width: area.width, x: 0, y: 0 } },
      pattern,
      objectRect(object, object.origin),
    );
  }
  const { direction, distance } = object.motion;
  const reach = object.reaction.kind === "none" ? distance : distance + object.reaction.range;
  const rect = objectRect(object, object.origin);
  switch (direction) {
    case "left":
      return { ...rect, width: rect.width + reach, x: rect.x - reach };
    case "right":
      return { ...rect, width: rect.width + reach };
    case "up":
      return { ...rect, height: rect.height + reach, y: rect.y - reach };
    default:
      return { ...rect, height: rect.height + reach };
  }
}

// The x spans of spans with the parts in cuts taken out.
function subtract(
  spans: readonly [number, number][],
  cuts: readonly [number, number][],
): [number, number][] {
  return cuts.reduce<[number, number][]>(
    (rest, [from, to]) =>
      rest.flatMap(([left, right]): [number, number][] =>
        to <= left || from >= right
          ? [[left, right]]
          : [
              ...(from > left ? [[left, from] as [number, number]] : []),
              ...(to < right ? [[to, right] as [number, number]] : []),
            ],
      ),
    [...spans],
  );
}

// The still spans in an area: the tops of terrain and still solid and ledge objects, joined where
// they meet at one height, less where a solid or still hazard leaves him no room to stand; with
// passable, less only where a solid or a hazard other than a timed one does.
function stillSpans(
  tuning: BirdTuning,
  area: AreaLayout,
  passable: boolean,
): { left: number; right: number; y: number }[] {
  const still = area.objects.filter(isStill);
  const solids = [
    ...area.solids,
    ...still.filter((o) => o.collision === "solid").map((o) => objectRect(o, o.origin)),
  ];
  const tops = [
    ...solids,
    ...still.filter((o) => o.collision === "ledge").map((o) => objectRect(o, o.origin)),
  ];
  const hazards = still
    .filter((o) => o.collision === "hazard" && !(passable && isTimedHazard(o)))
    .map((o) =>
      o.hitbox
        ? { ...o.hitbox, x: o.origin.x + o.hitbox.x, y: o.origin.y + o.hitbox.y }
        : objectRect(o, o.origin),
    );
  const heights = [...new Set(tops.map((top) => top.y))].sort((a, b) => a - b);
  return heights.flatMap((y) => {
    const spans = tops
      .filter((top) => top.y === y)
      .map((top): [number, number] => [top.x, top.x + top.width])
      .sort((a, b) => a[0] - b[0])
      .reduce<[number, number][]>((joined, [left, right]) => {
        const last = joined.at(-1);
        if (last && left <= last[1]) {
          last[1] = Math.max(last[1], right);
        } else {
          joined.push([left, right]);
        }
        return joined;
      }, []);
    const cuts = [...solids, ...hazards]
      .filter((rect) => rect.y < y && rect.y + rect.height > y - tuning.height)
      .map((rect): [number, number] => [rect.x, rect.x + rect.width]);
    return subtract(spans, cuts).map(([left, right]) => ({ left, right, y }));
  });
}

function areaSurfaces(tuning: BirdTuning, name: string, area: AreaLayout): Surface[] {
  const surfaces = stillSpans(tuning, area, false);
  const movers = area.objects.flatMap((object, index) =>
    !isStill(object) && (object.collision === "solid" || object.collision === "ledge")
      ? [
          {
            left: object.origin.x,
            mover: index,
            right: object.origin.x + object.width,
            y: object.origin.y,
          },
        ]
      : [],
  );
  return [...surfaces.map((span) => ({ ...span, mover: undefined })), ...movers].map((span) => ({
    ...span,
    area: name,
    key: `${name}:${span.mover ?? "still"}:${span.left},${span.y}`,
  }));
}

// Every surface he can stand on in the zone.
export function zoneSurfaces(tuning: BirdTuning, layout: ZoneLayout): Surface[] {
  return Object.entries(layout.areas).flatMap(([name, area]) => areaSurfaces(tuning, name, area));
}

// The still surfaces next to each still surface across timed hazards alone, by its key: he may
// walk from one to the other while those hazards are not active.
function timedCrossings(
  tuning: BirdTuning,
  layout: ZoneLayout,
  surfaces: readonly Surface[],
): Map<string, Surface[]> {
  const crossings = new Map<string, Surface[]>();
  const link = (from: Surface, to: Surface) =>
    crossings.set(from.key, [...(crossings.get(from.key) ?? []), to]);
  for (const [name, area] of Object.entries(layout.areas)) {
    if (!area.objects.some(isTimedHazard)) {
      continue;
    }
    for (const span of stillSpans(tuning, area, true)) {
      const parts = surfaces
        .filter(
          (surface) =>
            surface.area === name &&
            surface.mover === undefined &&
            surface.y === span.y &&
            surface.left >= span.left &&
            surface.right <= span.right,
        )
        .sort((a, b) => a.left - b.left);
      parts.slice(1).forEach((next, index) => {
        link(parts[index]!, next);
        link(next, parts[index]!);
      });
    }
  }
  return crossings;
}

// The surface a spot names: one whose top is the spot's row and whose span, where its track
// starts, takes in the spot's column's left edge.
export function surfaceAt(
  tile: number,
  surfaces: readonly Surface[],
  area: string,
  spot: TilePoint,
): Surface | undefined {
  const x = spot.col * tile;
  return surfaces.find(
    (surface) =>
      surface.area === area &&
      surface.y === spot.row * tile &&
      surface.left <= x &&
      x <= surface.right,
  );
}

// Where a surface is now: a moving platform's top where the zone has it.
function placed(surface: Surface, zone: ZoneState, layout: ZoneLayout): Surface {
  if (surface.mover === undefined) {
    return surface;
  }
  const object = areaOf(layout, surface.area).objects[surface.mover];
  const at = zone.objects[surface.mover] ?? object?.origin ?? { x: 0, y: 0 };
  const width = object?.width ?? surface.right - surface.left;
  return { ...surface, left: at.x, right: at.x + width, y: at.y };
}

// The surface he stands on, if any.
function surfaceUnder(
  tuning: BirdTuning,
  layout: ZoneLayout,
  surfaces: readonly Surface[],
  zone: ZoneState,
): Surface | undefined {
  const { bird } = zone;
  if (!bird.grounded) {
    return undefined;
  }
  return surfaces
    .filter((surface) => surface.area === zone.area)
    .find((surface) => {
      const now = placed(surface, zone, layout);
      return standsOn(tuning, bird, {
        height: 1,
        width: now.right - now.left,
        x: now.left,
        y: now.y,
      });
    });
}

// The spot he stands on, on surface: its bucket by where his centre is along it.
function spotOf(surface: Surface, zone: ZoneState, layout: ZoneLayout, tuning: BirdTuning): Spot {
  const now = placed(surface, zone, layout);
  const centre = zone.bird.x + tuning.width / 2;
  const bucket = Math.max(0, Math.floor((clamp(now.left, now.right, centre) - now.left) / BUCKET));
  return { bucket, state: zone, surface };
}

const spotKey = (spot: Pick<Spot, "bucket" | "surface">) => `${spot.surface.key}#${spot.bucket}`;
const pathSpotKey = (layout: ZoneLayout, spot: Spot) =>
  `${spotKey(spot)}:${WALK_WITNESSES.get(layout)?.profile(spot.state) ?? 0n}`;

// A stretch he may aim for: a whole surface, or one bucket of one (key: the spot's key).
interface Target {
  readonly fixed?: boolean;
  readonly key: string;
  readonly left: number;
  readonly right: number;
  readonly surface: Surface;
}

// One try, as input for each step. dir: the way he runs. pre: where his trailing side goes
// before he runs. takeoff: where his trailing side is when he presses Jump; or, with late, he
// runs on until he leaves the ground and presses late steps after. hold: the steps he holds
// Jump, 0 for none. rise: the steps after the press he goes straight up before he steers.
// target: the stretch he steers to land on. pre and takeoff are from the left
// of the surface he starts on, wherever a moving one has got to.
interface Try {
  readonly continuous?: boolean;
  readonly dir: -1 | 1;
  readonly hold: number;
  readonly late: number | undefined;
  readonly pre: number;
  readonly rise: number;
  readonly takeoff: number;
  readonly target: Target;
}

const trailing = (tuning: BirdTuning, dir: -1 | 1, x: number) => (dir > 0 ? x : x + tuning.width);

// Runs zone on one step at a time; step returns false once he restarts or turns back into the
// area's first column, which would end the zone, so no try counts a spot past it.
function runner(tuning: BirdTuning, layout: ZoneLayout, start: ZoneState) {
  return runWith((input, zone) => stepZone(tuning, layout, STEP_SECONDS, input, zone), start);
}

function runWith(step: WalkStep, start: ZoneState) {
  const run = {
    step: (input: ZoneInput) => {
      const before = run.zone.restarts;
      run.zone = step(input, run.zone);
      run.steps++;
      return (
        run.zone.death === undefined &&
        run.zone.restarts === before &&
        !run.zone.turnedBack &&
        run.zone.area === start.area
      );
    },
    steps: 0,
    zone: start,
  };
  return run;
}

// The input that steers his centre into a stretch, wherever its surface is now.
function steer(
  tuning: BirdTuning,
  layout: ZoneLayout,
  target: Target,
  zone: ZoneState,
): -1 | 0 | 1 {
  const shift = target.fixed ? 0 : placed(target.surface, zone, layout).left - target.surface.left;
  const lo = target.left + shift + tuning.width / 2;
  const hi = target.right + shift - tuning.width / 2;
  const centre = zone.bird.x + tuning.width / 2;
  return centre < Math.min(lo, hi) ? 1 : centre > Math.max(lo, hi) ? -1 : 0;
}

// The run-up and coyote delay depend on the starting state and takeoff, independently of
// the landing target and how Jump is held after takeoff.
function prepare(
  tuning: BirdTuning,
  layout: ZoneLayout,
  step: WalkStep,
  from: Spot,
  start: ZoneState,
  attempt: Try,
): { ready: boolean; steps: number; zone: ZoneState } {
  const run = runWith(step, start);
  const missed = () => ({ ready: false, steps: run.steps, zone: run.zone });
  const base = () => placed(from.surface, run.zone, layout).left;
  const { dir } = attempt;
  // Into place, braking in time to stop there, then still.
  for (let i = 0; i < WALK_STEPS; i++) {
    const { vx } = run.zone.bird;
    const gap = base() + attempt.pre - trailing(tuning, dir, run.zone.bird.x);
    if (Math.abs(gap) < 2 && Math.abs(vx) < 1) {
      break;
    }
    const stopping = (vx * vx) / (2 * tuning.groundAccel);
    const move = Math.abs(gap) <= stopping + 1 && vx * gap >= 0 ? 0 : gap > 0 ? 1 : -1;
    if (!run.step({ ...STILL, move }) || !run.zone.bird.grounded) {
      return missed();
    }
  }
  // The run up to the takeoff.
  let stuck = 0;
  for (let i = 0; i < WALK_STEPS && stuck < 3; i++) {
    const { bird } = run.zone;
    const there =
      attempt.late === undefined
        ? dir * (trailing(tuning, dir, bird.x) - base() - attempt.takeoff) >= 0
        : !bird.grounded;
    if (there) {
      break;
    }
    if (!run.step({ ...STILL, move: dir })) {
      return missed();
    }
    stuck = Math.abs(run.zone.bird.x - bird.x) < 1e-9 ? stuck + 1 : 0;
  }
  for (let i = 0; i < (attempt.late ?? 0); i++) {
    if (!run.step({ ...STILL, move: dir })) {
      return missed();
    }
  }
  return { ready: true, steps: run.steps, zone: run.zone };
}

interface TrialResult {
  readonly entered: ZoneState | undefined;
  readonly landed: Spot | undefined;
  readonly steps: number;
}

// Plays every distinct takeoff prefix once, including failed run-ups. Each continuation still
// uses the real zone rules with its own hold, rise and landing target. The cache lives for one
// source spot and starting wait state, so moving hazards and platforms retain their timing.
function trialsFrom(
  tuning: BirdTuning,
  layout: ZoneLayout,
  surfaces: readonly Surface[],
  from: Spot,
  start: ZoneState,
): {
  readonly continuous: (attempt: Pick<Try, "hold" | "rise" | "target">) => TrialResult;
  readonly drop: (target: Target) => TrialResult;
  readonly jump: (attempt: Try) => TrialResult;
  readonly launch: (attempt: Pick<Try, "hold" | "rise" | "target">) => TrialResult;
} {
  const prepared = new Map<string, ReturnType<typeof prepare>>();
  const cached = walkTransitions((input, zone) =>
    physicalStep(tuning, layout, STEP_SECONDS, input, zone),
  );
  // Query-local observation belongs to each logical step, including reused physics results.
  const step: WalkStep = (input, zone) => observeTransition(layout, zone, cached(input, zone));
  const jump = (attempt: Try) => {
    const key = `${attempt.dir}:${attempt.pre}:${attempt.takeoff}:${attempt.late}`;
    let prefix = prepared.get(key);
    let steps = 0;
    if (!prefix) {
      prefix = prepare(tuning, layout, step, from, start, attempt);
      prepared.set(key, prefix);
      steps = prefix.steps;
    }
    if (!prefix.ready) {
      return {
        entered: prefix.zone.area === start.area ? undefined : prefix.zone,
        landed: undefined,
        steps,
      };
    }
    const result = play(tuning, layout, step, surfaces, from, prefix.zone, attempt);
    return { ...result, steps: steps + result.steps };
  };
  const launch = (attempt: Pick<Try, "hold" | "rise" | "target">): TrialResult => {
    let takeoff = start;
    let releasedSteps = 0;
    if (start.bird.jumpHeld) {
      const release = runWith(step, start);
      const alive = release.step(STILL);
      releasedSteps = release.steps;
      if (!alive || !release.zone.bird.grounded) {
        return {
          entered: release.zone.area === start.area ? undefined : release.zone,
          landed: undefined,
          steps: releasedSteps,
        };
      }
      takeoff = release.zone;
    }
    const result = play(tuning, layout, step, surfaces, from, takeoff, attempt);
    return { ...result, steps: result.steps + releasedSteps };
  };
  return {
    continuous: (attempt) =>
      play(tuning, layout, step, surfaces, from, start, { ...attempt, continuous: true }),
    drop: (target) =>
      play(tuning, layout, step, surfaces, from, start, { hold: 0, rise: 0, target }),
    jump,
    launch,
  };
}

// Rested trials stop at the first landing. Continuous trials preserve moving intermediate
// landings and real release/press edges within the same horizon toward the original target.
function play(
  tuning: BirdTuning,
  layout: ZoneLayout,
  step: WalkStep,
  surfaces: readonly Surface[],
  from: Spot,
  start: ZoneState,
  attempt: Pick<Try, "hold" | "rise" | "target"> & { readonly continuous?: boolean },
): TrialResult {
  const continuous = attempt.continuous === true;
  const run = runWith(step, start);
  const missed = (): TrialResult => ({
    entered: run.zone.area === start.area ? undefined : run.zone,
    landed: undefined,
    steps: run.steps,
  });
  let left = !run.zone.bird.grounded;
  let jumpAt = continuous && start.bird.jumpHeld ? 1 : 0;
  for (let i = 0; i < AIR_STEPS; i++) {
    const move =
      i >= jumpAt && i - jumpAt < attempt.rise
        ? 0
        : steer(tuning, layout, attempt.target, run.zone);
    if (!run.step({ jumpHeld: i >= jumpAt && i - jumpAt < attempt.hold, move, useHeld: false })) {
      return missed();
    }
    left ||= !run.zone.bird.grounded;
    if (left && run.zone.bird.grounded) {
      if (continuous) {
        const under = recordLanding(tuning, layout, surfaces, run.zone);
        if (!under) {
          return missed();
        }
        if (
          under.key === attempt.target.surface.key &&
          steer(tuning, layout, attempt.target, run.zone) === 0
        ) {
          return {
            entered: run.zone.area === start.area ? undefined : run.zone,
            landed: spotOf(under, run.zone, layout, tuning),
            steps: run.steps,
          };
        }
        jumpAt = i + (run.zone.bird.jumpHeld ? 2 : 1);
        left = false;
        continue;
      }
      const landed = comeToRest(tuning, layout, surfaces, run);
      return {
        entered: run.zone.area === start.area ? undefined : run.zone,
        landed:
          landed && pathSpotKey(layout, landed) !== pathSpotKey(layout, from) ? landed : undefined,
        steps: run.steps,
      };
    }
  }
  return missed();
}

function recordLanding(
  tuning: BirdTuning,
  layout: ZoneLayout,
  surfaces: readonly Surface[],
  zone: ZoneState,
): Surface | undefined {
  const under = surfaceUnder(tuning, layout, surfaces, zone);
  const witnesses = WALK_WITNESSES.get(layout);
  if (under && witnesses) {
    witnesses.mark(zone, witnesses.surface(under.key));
    WALK_TERMINALS.get(layout)?.(zone, under);
  }
  return under;
}

// Brings him to a stop where he landed: the spot he stands still on, unless stopping takes him
// off it or into a hazard.
function comeToRest(
  tuning: BirdTuning,
  layout: ZoneLayout,
  surfaces: readonly Surface[],
  run: ReturnType<typeof runner>,
): Spot | undefined {
  const under = recordLanding(tuning, layout, surfaces, run.zone);
  for (let i = 0; i < AIR_STEPS && Math.abs(run.zone.bird.vx) >= 1; i++) {
    if (!run.step(STILL) || !run.zone.bird.grounded) {
      return undefined;
    }
  }
  const still = surfaceUnder(tuning, layout, surfaces, run.zone);
  return under && still?.key === under.key ? spotOf(still, run.zone, layout, tuning) : undefined;
}

// Walks along his surface into a stretch of it: where he stands there, if he gets there.
function walkInto(
  tuning: BirdTuning,
  layout: ZoneLayout,
  surfaces: readonly Surface[],
  start: ZoneState,
  target: Target,
): TrialResult {
  const run = runner(tuning, layout, start);
  for (let i = 0; i < WALK_STEPS; i++) {
    const move = steer(tuning, layout, target, run.zone);
    if (move === 0) {
      const under = surfaceUnder(tuning, layout, surfaces, run.zone);
      const spot = under ? spotOf(under, run.zone, layout, tuning) : undefined;
      return {
        entered: undefined,
        landed: spot && (target.fixed || spotKey(spot) === target.key) ? spot : undefined,
        steps: run.steps,
      };
    }
    if (!run.step({ ...STILL, move }) || !run.zone.bird.grounded) {
      break;
    }
  }
  return {
    entered: run.zone.area === start.area ? undefined : run.zone,
    landed: undefined,
    steps: run.steps,
  };
}

// Walks right from start until he clears the zone at its area's last column: whether he does.
function walkOff(
  tuning: BirdTuning,
  layout: ZoneLayout,
  start: ZoneState,
): { cleared: boolean; entered: ZoneState | undefined; steps: number } {
  const run = runner(tuning, layout, start);
  for (let i = 0; i < WALK_STEPS && !run.zone.cleared; i++) {
    if (!run.step({ ...STILL, move: 1 })) {
      break;
    }
  }
  return {
    cleared: run.zone.cleared,
    entered: run.zone.area === start.area ? undefined : run.zone,
    steps: run.steps,
  };
}

// Steps him still until he stands somewhere, or gives up.
function settle(tuning: BirdTuning, layout: ZoneLayout, zone: ZoneState): ZoneState {
  let settled = zone;
  for (let i = 0; i < AIR_STEPS && !settled.bird.grounded && settled.death === undefined; i++) {
    settled = stepZone(tuning, layout, STEP_SECONDS, STILL, settled);
  }
  return settled;
}

// The zone after he stands still for each wait in turn (WAIT_STEP apart, count of them), up to
// the first that restarts him.
function waitStates(
  tuning: BirdTuning,
  layout: ZoneLayout,
  start: ZoneState,
  count: number,
): { entered: ZoneState | undefined; states: ZoneState[]; steps: number } {
  const run = runner(tuning, layout, start);
  const states = [start];
  while (states.length < count) {
    for (let i = 0; i < WAIT_STEP; i++) {
      if (!run.step(STILL)) {
        return {
          entered: run.zone.area === start.area ? undefined : run.zone,
          states,
          steps: run.steps,
        };
      }
    }
    states.push(run.zone);
  }
  return { entered: undefined, states, steps: run.steps };
}

// How far he might go in one move, in px: up to rise, and along x when the landing is drop
// below the takeoff (negative for one above), carried by a platform at up to carry px/s. From a
// full jump played on the rules: its height, and how long he is in the air coming back down to
// where he took off; a lower landing adds the fall at the flutter speed, and the time to reach
// it. MARGIN on each, for rounding. jumpRise is that height alone: nothing lifts him higher
// from a still surface with no force pulse, since the walk never presses Jump again in the air.
function moveBounds(tuning: BirdTuning, carry: number) {
  const ground = { height: 1, width: 1e6, x: -5e5, y: 0 };
  let bird = startBird(tuning, { x: 0, y: 0 });
  let rise = 0;
  let air = 0;
  for (let step = 0; step < AIR_STEPS; step++) {
    bird = stepBird(tuning, [ground], [], STEP_SECONDS, { jumpHeld: true, move: 0 }, bird);
    rise = Math.max(rise, -(bird.y + tuning.height));
    air = (step + 1) * STEP_SECONDS;
    if (step > 0 && bird.grounded) {
      break;
    }
  }
  const { coyoteTime, flutterFallSpeed, gravity, walkSpeed } = tuning;
  const across = (drop: number) =>
    (walkSpeed + carry) *
      (air + coyoteTime + Math.max(0, drop) / flutterFallSpeed + flutterFallSpeed / gravity) +
    MARGIN;
  const maximumRise = rise + MARGIN;
  return {
    across,
    jumpRise: rise + EDGE,
    maximumRise,
    rise: maximumRise,
    targetHeight: tuning.height,
  };
}

// The steps a moving thing takes to go round its track once, at most MAX_CYCLE.
function cycleSteps(objects: readonly ObjectLayout[], object: ObjectLayout): number {
  return Math.ceil(Math.min(objectCycleSeconds(objects, object), MAX_CYCLE) / STEP_SECONDS);
}

// Moving colliders retain their own cycle lengths; only supports contribute carry speed. Timed
// hazards keep their cycle for a walk across them; pulses: whether anything emits a force pulse.
interface MovingThings {
  readonly carry: number;
  readonly moving: readonly PhaseMover[];
  readonly pulses: boolean;
  readonly timed: readonly PhaseMover[];
}

const MOVING_THINGS = new WeakMap<
  AreaLayout,
  { readonly tuning: BirdTuning; readonly value: MovingThings }
>();
const TARGET_BOUNDS = new WeakMap<BirdTuning, ReturnType<typeof moveBounds>>();

function movingThings(tuning: BirdTuning, area: AreaLayout): MovingThings {
  const cached = MOVING_THINGS.get(area);
  if (cached?.tuning === tuning) {
    return cached.value;
  }
  let target = TARGET_BOUNDS.get(tuning);
  if (!target) {
    target = moveBounds(tuning, 0);
    TARGET_BOUNDS.set(tuning, target);
  }
  const moving = area.objects.filter((object) => !isStill(object) && object.collision !== "none");
  const supports = moving.filter(
    (object) => object.collision === "solid" || object.collision === "ledge",
  );
  const result = {
    carry: Math.max(0, ...supports.map(movementSpeed)),
    moving: area.objects.flatMap((object, index) => {
      if (isStill(object) || object.collision === "none") {
        return [];
      }
      const rect = emissionBounds(object, sweptRect(target, area, object));
      return [
        {
          cycleSteps: cycleSteps(area.objects, object),
          index,
          left: rect.x,
          right: rect.x + rect.width,
        },
      ];
    }),
    pulses: area.objects.some((object) =>
      Object.values(object.behaviour?.states ?? {}).some((node) =>
        (node.onEnter ?? []).some((action) => action.kind === "force-pulse"),
      ),
    ),
    timed: area.objects.flatMap((object, index) =>
      isTimedHazard(object)
        ? [
            {
              cycleSteps: cycleSteps(area.objects, object),
              index,
              left: object.origin.x,
              right: object.origin.x + object.width,
            },
          ]
        : [],
    ),
  };
  MOVING_THINGS.set(area, { tuning, value: result });
  return result;
}

// The tries from a spot toward a target: from each way he can run at it, pressing Jump at every
// tile along his surface, just before the edge he runs off and in coyote time after it, each
// held and tapped, and off an edge with no press at all where the target is lower.
function triesToward(tuning: BirdTuning, from: Spot, here: Surface, target: Target): Try[] {
  const { width } = tuning;
  const lo = here.left + from.bucket * BUCKET - BUCKET;
  const hi = here.left + (from.bucket + 2) * BUCKET;
  // Where either surface moves, which way he must go depends on when he goes: both ways, then.
  const moving = here.mover !== undefined || target.surface.mover !== undefined;
  const dirs: (-1 | 1)[] =
    !moving && target.left >= here.right
      ? [1]
      : !moving && target.right <= here.left
        ? [-1]
        : [1, -1];
  const below = target.surface.y > here.y;
  const coyote = Math.ceil(tuning.coyoteTime / STEP_SECONDS);
  const lates = [...new Set([0, 3, 6, 9, coyote - 2, coyote - 1, coyote, coyote + 1])].filter(
    (late) => late >= 0,
  );
  // Held, tapped, and held going straight up through the tap window first, to clear something
  // close by that the hop alone does not.
  const tapSteps = Math.round(tuning.jumpTapWindow / STEP_SECONDS);
  const presses = [
    { hold: AIR_STEPS, rise: 0 },
    { hold: 1, rise: 0 },
    { hold: AIR_STEPS, rise: tapSteps },
  ];
  return dirs.flatMap((dir) => {
    const edge = dir > 0 ? here.right : here.left;
    const inReach = (x: number) => {
      const leading = x + dir * width;
      return Math.max(x, leading) > lo && Math.min(x, leading) < hi;
    };
    // His run-up starts with his centre at least FOOTING px inside his surface, so stopping
    // there never takes him off it; the middle, on a surface narrower than that.
    const half = dir > 0 ? width / 2 : -width / 2;
    const middle = (here.left + here.right) / 2;
    const minCentre = Math.min(here.left + FOOTING, middle);
    const maxCentre = Math.max(here.right - FOOTING, middle);
    const preFor = (x: number) => clamp(minCentre, maxCentre, x - dir * RUN_UP + half) - half;
    // Along his surface, his centre every TAKEOFF_STEP px from its left.
    const first = Math.max(0, Math.floor((lo - here.left + half - width) / TAKEOFF_STEP));
    const last = Math.min(
      Math.floor((here.right - here.left) / TAKEOFF_STEP),
      Math.ceil((hi - here.left + half + width) / TAKEOFF_STEP),
    );
    const along = Array.from(
      { length: Math.max(0, last - first + 1) },
      (_, i) => here.left + (first + i) * TAKEOFF_STEP - half,
    );
    const before = [
      ...new Set([...EDGE_TAKEOFFS.map((back) => edge - dir * back), ...along]),
    ].filter((x) => inReach(x) && dir * (x - edge) < 0);
    const relative = (attempt: Omit<Try, "dir" | "rise" | "target"> & { rise?: number }): Try => ({
      rise: 0,
      ...attempt,
      dir,
      pre: attempt.pre - here.left,
      takeoff: attempt.takeoff - here.left,
      target,
    });
    const pressed = before.flatMap((x) =>
      presses.map((press) => relative({ ...press, late: undefined, pre: preFor(x), takeoff: x })),
    );
    const offEdge = inReach(edge)
      ? [
          ...lates.flatMap((late) =>
            presses.map((press) => relative({ ...press, late, pre: preFor(edge), takeoff: edge })),
          ),
          ...(below ? [relative({ hold: 0, late: 0, pre: preFor(edge), takeoff: edge })] : []),
        ]
      : [];
    return [...pressed, ...offEdge];
  });
}

// Where a surface can be over its track: its x range and its highest and lowest top.
function sweptSpan(
  target: Pick<BehaviourBoundsContext, "maximumRise" | "targetHeight">,
  layout: ZoneLayout,
  surface: Surface,
): { bottom: number; left: number; right: number; top: number } {
  const spans = WALK_SPANS.get(layout);
  let bySurface = spans?.get(target);
  const previous = bySurface?.get(surface);
  if (previous) {
    return previous;
  }
  const object =
    surface.mover === undefined ? undefined : areaOf(layout, surface.area).objects[surface.mover];
  const rect = object ? sweptRect(target, areaOf(layout, surface.area), object) : undefined;
  const span =
    rect && object
      ? {
          bottom: rect.y + rect.height - object.height,
          left: rect.x,
          right: rect.x + rect.width,
          top: rect.y,
        }
      : { bottom: surface.y, left: surface.left, right: surface.right, top: surface.y };
  if (spans) {
    if (!bySurface) {
      bySurface = new WeakMap();
      spans.set(target, bySurface);
    }
    bySurface.set(surface, span);
  }
  return span;
}

// The stretches a spot might reach in one move: the other surfaces in its area within the
// bird's bounds, and its own surface's buckets nearby.
function targetsFrom(
  tuning: Pick<BirdTuning, "brakeAccel" | "walkSpeed" | "width">,
  layout: ZoneLayout,
  surfaces: readonly Surface[],
  bounds: ReturnType<typeof moveBounds>,
  rise: number,
  from: Spot,
  here: Surface,
): { others: Target[]; own: Target[] } {
  // A moving surface can take him anywhere along its track before he goes.
  const own = sweptSpan(bounds, layout, from.surface);
  const lo = from.surface.mover === undefined ? here.left + (from.bucket - 1) * BUCKET : own.left;
  const hi = from.surface.mover === undefined ? here.left + (from.bucket + 2) * BUCKET : own.right;
  const others = surfaces
    .filter((surface) => surface.area === here.area && surface.key !== here.key)
    .filter((surface) => {
      const span = sweptSpan(bounds, layout, surface);
      const dx = Math.max(0, span.left - hi, lo - span.right);
      return own.top - span.bottom <= rise && dx <= bounds.across(span.bottom - own.top);
    })
    .flatMap((surface) => {
      const target = { key: surface.key, left: surface.left, right: surface.right, surface };
      if (surface.mover !== undefined) {
        return [target];
      }
      // A lower bank may require descending just beyond an upper ledge instead of steering
      // back underneath it. Keep the full target and try its actual overhang boundaries too.
      const edges = surfaces
        .filter(
          (upper) =>
            upper.area === surface.area && upper.mover === undefined && upper.y < surface.y,
        )
        .flatMap((upper) => [upper.right, upper.left - tuning.width]);
      const aims = [...new Set(edges)]
        .filter((left) => left >= surface.left && left + tuning.width <= surface.right)
        .map((left) => ({ ...target, left, right: left + tuning.width }));
      const area = areaOf(layout, surface.area);
      const stopping =
        tuning.walkSpeed ** 2 / (2 * tuning.brakeAccel) + tuning.walkSpeed * STEP_SECONDS;
      const beforeExit = Math.min(surface.right, area.exitX) - tuning.width - stopping;
      if (
        WALK_WITNESSES.has(layout) &&
        area.walkLinks?.right === undefined &&
        surface.right > area.exitX &&
        beforeExit >= surface.left
      ) {
        aims.unshift({ ...target, left: beforeExit, right: beforeExit + tuning.width });
      }
      return [...aims, target];
    });
  const stretches = OWN_BUCKETS.map((offset) => from.bucket + offset)
    .filter((bucket) => bucket >= 0 && here.left + bucket * BUCKET < here.right)
    .map((bucket) => ({
      key: `${from.surface.key}#${bucket}`,
      left: here.left + bucket * BUCKET,
      right: Math.min(here.right, here.left + (bucket + 1) * BUCKET),
      surface: from.surface,
    }));
  return { others, own: stretches };
}

// Takeoff coordinates describe trailing edges; convert them to body-left positions before
// bounding the landing. A moving source contributes every position along its swept track.
function phaseCorridor(
  tuning: Pick<BirdTuning, "width">,
  layout: ZoneLayout,
  bounds: ReturnType<typeof moveBounds>,
  from: Spot,
  here: Surface,
  target: Target,
  tries: readonly Try[],
) {
  const positions = [
    from.state.bird.x,
    ...tries.flatMap(({ dir, pre, takeoff }) => {
      const offset = dir < 0 ? -tuning.width : 0;
      return [here.left + pre + offset, here.left + takeoff + offset];
    }),
  ];
  const sourceSpan = sweptSpan(bounds, layout, from.surface);
  const targetSpan = sweptSpan(bounds, layout, target.surface);
  const landing = target.surface.mover === undefined ? target : targetSpan;
  const takeoffs =
    from.surface.mover === undefined
      ? positions
      : [
          Math.min(...positions) + sourceSpan.left - here.left,
          Math.max(...positions) + sourceSpan.right - here.right,
        ];
  return landingCorridor(
    tuning.width,
    bounds.across(targetSpan.bottom - sourceSpan.top),
    takeoffs,
    landing,
  );
}

// Walks the zone from its start on the real rules. From each spot he comes to stand on, it
// tries each stretch in range that he has not reached yet: a walk along his own surface, then
// every jump at it, at every wait where something moves near. From a spot near the area's last
// column on a surface that runs into it, he walks right to clear the zone. It never presses
// Use, so doors and their rooms play no part, and a try that takes him back into the first
// column, which would end the zone, fails. It stops when no try finds a new spot.
export interface WalkRouteTarget {
  readonly area: string;
  readonly at: TilePoint;
  // Inclusive actor body top-left X interval in area tile units, not sprite/centre coordinates.
  readonly xRange?: { readonly min: number; readonly max: number };
}

export interface WalkRouteQuery {
  // Called after every real zone step the walk takes that changes the state, speculative ones
  // included, as the behaviour trace records them.
  readonly onStep?: (
    layout: ZoneLayout,
    seconds: number,
    before: ZoneState,
    after: ZoneState,
  ) => void;
  readonly targets: readonly WalkRouteTarget[];
  readonly tile: number;
}

interface WalkRequirements {
  readonly intervals: {
    readonly max: number;
    readonly min: number;
    readonly source: WalkRouteTarget;
    readonly target: Target;
    readonly token: bigint;
  }[];
  readonly surfaces: Set<string>;
  readonly witnesses: WalkWitnesses;
}

// A required walk first tries the stretches that advance its route: those carrying a required
// surface this path has not touched, then, once every requirement is met, surfaces that reach
// the exit. Each of these tries its whole surface before narrower aims at it. Order alone
// changes; every other stretch still runs unless already covered.
function progressFirst(
  required: WalkRequirements,
  profile: bigint,
  terminal: (target: Target) => boolean,
  state: ZoneState,
  targets: readonly Target[],
): Target[] {
  const ready = required.witnesses.ready(state);
  const rank = (target: Target) => {
    const narrow =
      target.left !== target.surface.left || target.right !== target.surface.right ? 1 : 0;
    return (required.witnesses.surface(target.surface.key) & ~profile) !== 0n
      ? narrow
      : ready && terminal(target)
        ? 2 + narrow
        : 4;
  };
  return targets
    .map((target, index) => ({ index, rank: rank(target), target }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ target }) => target);
}

function requiredComplete(required: WalkRequirements): boolean {
  return required.witnesses.complete();
}

export interface RequiredRouteWalk extends ZoneWalk {
  readonly complete: boolean;
}

// An actual living, grounded observation of the named support. Narrow intervals name the
// actor's body-left position and also require its whole body on that support's current span.
export function requiredRouteTargetReached(
  tuning: BirdTuning,
  query: { readonly surfaces: readonly Surface[]; readonly tile: number },
  layout: ZoneLayout,
  target: WalkRouteTarget,
  zone: ZoneState,
): boolean {
  if (zone.death !== undefined || zone.turnedBack || !zone.bird.grounded) {
    return false;
  }
  const expected = surfaceAt(query.tile, query.surfaces, target.area, target.at);
  const under = surfaceUnder(tuning, layout, query.surfaces, zone);
  if (expected === undefined || under?.key !== expected.key) {
    return false;
  }
  if (target.xRange === undefined) {
    return true;
  }
  const support = placed(under, zone, layout);
  return (
    zone.bird.x >= target.xRange.min * query.tile - EDGE &&
    zone.bird.x <= target.xRange.max * query.tile + EDGE &&
    zone.bird.x >= support.left - EDGE &&
    zone.bird.x + tuning.width <= support.right + EDGE
  );
}

export function walkRequiredRoutes(
  tuning: BirdTuning,
  query: WalkRouteQuery,
  layout: ZoneLayout,
): RequiredRouteWalk {
  if (!Number.isFinite(query.tile) || query.tile <= 0) {
    throw new Error("Required routes need a positive tile size");
  }
  const surfaces = zoneSurfaces(tuning, layout);
  const required: WalkRequirements = {
    intervals: [],
    surfaces: new Set(),
    witnesses: new WalkWitnesses(),
  };
  query.targets.forEach(({ area, at, xRange }, index) => {
    const surface = surfaceAt(query.tile, surfaces, area, at);
    if (!surface) {
      throw new Error(`No required route surface in ${area} at ${at.col},${at.row}`);
    }
    if (xRange === undefined) {
      required.surfaces.add(surface.key);
      required.witnesses.token(`surface:${surface.key}`);
      return;
    }
    const min = xRange.min * query.tile;
    const max = xRange.max * query.tile;
    const local = areaOf(layout, area);
    const span =
      surface.mover === undefined
        ? surface
        : sweptSpan(moveBounds(tuning, movingThings(tuning, local).carry), layout, surface);
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min > max ||
      min < span.left - EDGE ||
      max + tuning.width > span.right + EDGE
    ) {
      throw new Error(`Invalid required route xRange in ${area}`);
    }
    required.intervals.push({
      max,
      min,
      source: query.targets[index]!,
      target: {
        fixed: true,
        key: `required:${index}`,
        left: min,
        right: max + tuning.width,
        surface,
      },
      token: required.witnesses.token(`interval:${index}`),
    });
  });
  const observedLayout = { ...layout };
  if (query.onStep) {
    WALK_STEP_HOOKS.set(observedLayout, query.onStep);
  }
  if (required.intervals.length > 0) {
    WALK_OBSERVERS.set(observedLayout, (_before, zone) => {
      for (const interval of required.intervals) {
        if (
          (required.witnesses.profile(zone) & interval.token) === 0n &&
          requiredRouteTargetReached(
            tuning,
            { surfaces, tile: query.tile },
            observedLayout,
            interval.source,
            zone,
          )
        ) {
          required.witnesses.mark(zone, interval.token);
        }
      }
    });
  }
  try {
    const result = walk(tuning, required, surfaces, observedLayout);
    return { ...result, complete: result.cleared && requiredComplete(required) };
  } finally {
    WALK_OBSERVERS.delete(observedLayout);
    WALK_STEP_HOOKS.delete(observedLayout);
  }
}

export function walkZone(tuning: BirdTuning, layout: ZoneLayout): ZoneWalk {
  return walk(tuning, undefined, zoneSurfaces(tuning, layout), layout);
}

function walk(
  tuning: BirdTuning,
  required: WalkRequirements | undefined,
  surfaces: Surface[],
  layout: ZoneLayout,
): ZoneWalk {
  const observedLayout = { ...layout };
  // Fixed full-track bounds depend only on this layout, exact bounds object and surface.
  WALK_SPANS.set(observedLayout, new WeakMap());
  const observe = WALK_OBSERVERS.get(layout);
  const onStep = WALK_STEP_HOOKS.get(layout);
  if (onStep) {
    WALK_STEP_HOOKS.set(observedLayout, onStep);
  }
  if (required) {
    WALK_WITNESSES.set(observedLayout, required.witnesses);
  }
  let cleared = false;
  WALK_OBSERVERS.set(observedLayout, (before, next) => {
    required?.witnesses.transition(before, next);
    if (
      next.cleared &&
      before.death === undefined &&
      next.death === undefined &&
      !before.turnedBack &&
      !next.turnedBack &&
      before.restarts === next.restarts
    ) {
      cleared = true;
      required?.witnesses.finish(next);
    }
    observe?.(before, next);
  });
  try {
    const result = walkSearch(tuning, required, surfaces, observedLayout, () => cleared);
    return { ...result, cleared: result.cleared || cleared };
  } finally {
    WALK_OBSERVERS.delete(observedLayout);
    WALK_SPANS.delete(observedLayout);
    WALK_WITNESSES.delete(observedLayout);
    WALK_TERMINALS.delete(observedLayout);
    WALK_STEP_HOOKS.delete(observedLayout);
  }
}

function walkSearch(
  tuning: BirdTuning,
  required: WalkRequirements | undefined,
  surfaces: Surface[],
  layout: ZoneLayout,
  engineCleared: () => boolean,
): ZoneWalk {
  const seen = new Map<string, Spot>();
  const reached = new Set<string>();
  const queue: Spot[] = [];
  const priority: Spot[] = [];
  const scheduledSurfaces = new Set<string>();
  const claimed = new WeakSet<Spot>();
  const areaBounds = new Map<AreaLayout, ReturnType<typeof moveBounds>>();
  const arrivals = new WeakSet<ZoneState>();
  let steps = 0;
  let cleared = false;
  const complete = () =>
    required !== undefined && (cleared || engineCleared()) && requiredComplete(required);
  const profiles = new Map<string, bigint[]>();
  const crossings = timedCrossings(tuning, layout, surfaces);
  let activeProfile = 0n;
  const terminalAttempts = new WeakSet<ZoneState>();
  if (required) {
    WALK_TERMINALS.set(layout, (zone, support) => {
      if (zone.death !== undefined || zone.turnedBack || !zone.bird.grounded) {
        return;
      }
      reached.add(support.key);
      const area = areaOf(layout, zone.area);
      if (
        complete() ||
        zone.cleared ||
        area.walkLinks?.right !== undefined ||
        (layout.stageExit !== undefined && layout.stageExit.area !== zone.area) ||
        placed(support, zone, layout).right <= area.exitX ||
        !required.witnesses.ready(zone) ||
        terminalAttempts.has(zone)
      ) {
        return;
      }
      terminalAttempts.add(zone);
      const off = walkOff(tuning, layout, zone);
      steps += off.steps;
      if (off.entered) {
        arrive(off.entered);
      }
      cleared ||= off.cleared;
    });
  }
  const reach = (spot: Spot) => {
    required?.witnesses.mark(spot.state, required.witnesses.surface(spot.surface.key));
    WALK_TERMINALS.get(layout)?.(spot.state, spot.surface);
    const profile = required?.witnesses.profile(spot.state) ?? 0n;
    const key = required ? pathSpotKey(layout, spot) : spotKey(spot);
    if (!seen.has(key)) {
      const firstSurface = !scheduledSurfaces.has(spot.surface.key);
      scheduledSurfaces.add(spot.surface.key);
      seen.set(key, spot);
      reached.add(spot.surface.key);
      for (const key of [spotKey(spot), spot.surface.key]) {
        const earned = profiles.get(key) ?? [];
        earned.push(profile);
        profiles.set(key, earned);
      }
      if (
        required &&
        (firstSurface || (profile !== activeProfile && (profile & activeProfile) === activeProfile))
      ) {
        priority.push(spot);
      } else {
        queue.push(spot);
      }
    }
  };
  const arrive = (zone: ZoneState) => {
    if (arrivals.has(zone)) {
      return;
    }
    arrivals.add(zone);
    const settled = settle(tuning, layout, zone);
    if (settled.death !== undefined) {
      return;
    }
    const under = surfaceUnder(tuning, layout, surfaces, settled);
    if (under) {
      reach(spotOf(under, settled, layout, tuning));
    }
  };
  const covered = (key: string, profile: bigint) =>
    profiles.get(key)?.some((earned) => (earned & profile) === profile) ?? false;
  function* expand(from: Spot): Generator<void> {
    const previousProfile = activeProfile;
    const profile = required?.witnesses.profile(from.state) ?? 0n;
    activeProfile = profile;
    try {
      const area = areaOf(layout, from.surface.area);
      const here = placed(from.surface, from.state, layout);
      const { carry, moving, pulses, timed } = movingThings(tuning, area);
      let bounds = areaBounds.get(area);
      if (!bounds) {
        bounds = moveBounds(tuning, carry);
        areaBounds.set(area, bounds);
      }
      const trials = new Map<ZoneState, ReturnType<typeof trialsFrom>>();
      const waited = phaseStarts((start: ZoneState) => {
        const result = waitStates(tuning, layout, start, 2);
        steps += result.steps;
        if (result.entered) {
          arrive(result.entered);
        }
        return result.states[1];
      }, from.state);
      const startsFor = (corridor: { left: number; right: number }, target?: Surface) =>
        waited(
          phaseCount(WAIT_STEP, BUCKET, [from.surface.mover, target?.mover], moving, corridor),
        );
      if (required !== undefined && !complete() && here.right > area.exitX) {
        const sourceSpan = sweptSpan(bounds, layout, from.surface);
        for (const start of startsFor({
          left: Math.min(
            from.state.bird.x,
            area.exitX,
            from.surface.mover === undefined ? Infinity : sourceSpan.left,
          ),
          right: Math.max(
            from.state.bird.x + tuning.width,
            area.exitX + tuning.width,
            from.surface.mover === undefined ? -Infinity : sourceSpan.right,
          ),
        })) {
          if (priority.length) {
            yield;
          }
          const off = walkOff(tuning, layout, start);
          steps += off.steps;
          if (off.entered) {
            arrive(off.entered);
            if (priority.length) {
              yield;
            }
            break;
          }
          if (off.cleared) {
            cleared = true;
            break;
          }
        }
      }
      if (complete()) {
        return;
      }
      // From a still surface with no force pulse about, a full jump's own height bounds the rise.
      const rise = from.surface.mover === undefined && !pulses ? bounds.jumpRise : bounds.rise;
      const { others, own } = targetsFrom(tuning, layout, surfaces, bounds, rise, from, here);
      const intervals =
        required?.intervals.filter(
          (interval) =>
            (required!.witnesses.profile(from.state) & interval.token) === 0n &&
            (interval.target.surface === from.surface ||
              others.some(({ surface }) => surface === interval.target.surface)),
        ) ?? [];
      const terminal = (target: Target) =>
        required !== undefined &&
        target.surface !== from.surface &&
        area.walkLinks?.right === undefined &&
        sweptSpan(bounds, layout, target.surface).right > area.exitX;
      const stretches = required
        ? progressFirst(required, profile, terminal, from.state, [...own, ...others])
        : [...own, ...others];
      for (const target of [...intervals.map((interval) => interval.target), ...stretches]) {
        const interval = intervals.find((item) => item.target === target);
        const terminalTarget = terminal(target);
        const done = () =>
          complete() ||
          (!terminalTarget &&
            (required
              ? covered(
                  target.surface === from.surface && !interval ? target.key : target.surface.key,
                  profile | (interval?.token ?? required.witnesses.surface(target.surface.key)),
                )
              : target.surface === from.surface
                ? seen.has(target.key)
                : reached.has(target.key)));
        if (done()) {
          continue;
        }
        const tries = triesToward(tuning, from, here, target);
        const starts = startsFor(
          phaseCorridor(tuning, layout, bounds, from, here, target, tries),
          target.surface,
        );
        for (const start of starts) {
          if (priority.length) {
            yield;
          }
          if (done()) {
            break;
          }
          if (target.surface === from.surface) {
            const walked = walkInto(tuning, layout, surfaces, start, target);
            steps += walked.steps;
            if (walked.entered) {
              arrive(walked.entered);
            }
            if (walked.landed) {
              reach(walked.landed);
              if (priority.length) {
                yield;
              }
              break;
            }
            if (priority.length) {
              yield;
            }
          }
          let trial = trials.get(start);
          if (!trial) {
            trial = trialsFrom(tuning, layout, surfaces, from, start);
            trials.set(start, trial);
          }
          if (target.surface !== from.surface) {
            const variants = new Set<string>();
            for (const attempt of tries) {
              const key = `${attempt.hold}:${attempt.rise}`;
              if (variants.has(key)) {
                continue;
              }
              variants.add(key);
              const continued = trial.continuous(attempt);
              steps += continued.steps;
              if (continued.entered) {
                arrive(continued.entered);
              }
              if (continued.landed) {
                reach(continued.landed);
              }
              if (priority.length) {
                yield;
              }
              if (done()) {
                break;
              }
            }
          }
          const heightDifference =
            placed(target.surface, start, layout).y - placed(from.surface, start, layout).y;
          const lower = heightDifference > 0;
          const higherGrounded =
            heightDifference < 0 &&
            start.bird.grounded &&
            start.death === undefined &&
            !start.turnedBack;
          const immediate =
            (lower || higherGrounded) &&
            tries.find(({ hold, rise }) => hold === AIR_STEPS && rise === 0);
          if (immediate) {
            const launched = trial.launch(immediate);
            steps += launched.steps;
            if (launched.entered) {
              arrive(launched.entered);
            }
            if (launched.landed) {
              reach(launched.landed);
            }
            if (priority.length) {
              yield;
            }
          }
          if (lower && !done()) {
            const dropped = trial.drop(target);
            steps += dropped.steps;
            if (dropped.entered) {
              arrive(dropped.entered);
            }
            if (dropped.landed) {
              reach(dropped.landed);
            }
            if (priority.length) {
              yield;
            }
          }
          for (const attempt of tries) {
            if (done()) {
              break;
            }
            for (const policy of [{ ...attempt, continuous: true }, attempt]) {
              if (done()) {
                break;
              }
              const { entered, landed, steps: ran } = trial.jump(policy);
              steps += ran;
              if (entered) {
                arrive(entered);
              }
              if (landed) {
                reach(landed);
              }
              if (priority.length) {
                yield;
              }
            }
          }
        }
      }
      // A walk across a timed hazard to the surface beyond, from a stretch at its edge, at every
      // wait through the hazard's cycle and those of things moving near.
      const lo = here.left + (from.bucket - 1) * BUCKET;
      const hi = here.left + (from.bucket + 2) * BUCKET;
      for (const beyond of crossings.get(from.surface.key) ?? []) {
        const right = beyond.left >= here.right;
        const edge = right ? here.right : here.left;
        const crossed = () =>
          complete() ||
          (required
            ? covered(beyond.key, profile | required.witnesses.surface(beyond.key))
            : reached.has(beyond.key));
        if (edge < lo || edge > hi || crossed()) {
          continue;
        }
        const target = {
          fixed: true,
          key: beyond.key,
          left: beyond.left,
          right: beyond.right,
          surface: beyond,
        };
        const corridor = right
          ? { left: from.state.bird.x, right: beyond.left + tuning.width }
          : { left: beyond.right - tuning.width, right: from.state.bird.x + tuning.width };
        const count = phaseCount(WAIT_STEP, BUCKET, [], [...moving, ...timed], corridor);
        for (const start of waited(count)) {
          if (priority.length) {
            yield;
          }
          if (crossed()) {
            break;
          }
          const walked = walkInto(tuning, layout, surfaces, start, target);
          steps += walked.steps;
          if (walked.entered) {
            arrive(walked.entered);
          }
          if (walked.landed?.surface.key === beyond.key) {
            reach(walked.landed);
            break;
          }
        }
      }
      if (required === undefined && !cleared && here.right > area.exitX && hi > area.exitX) {
        const sourceSpan = sweptSpan(bounds, layout, from.surface);
        for (const start of startsFor({
          left: Math.min(
            from.state.bird.x,
            area.exitX,
            from.surface.mover === undefined ? Infinity : sourceSpan.left,
          ),
          right: Math.max(
            from.state.bird.x + tuning.width,
            area.exitX + tuning.width,
            from.surface.mover === undefined ? -Infinity : sourceSpan.right,
          ),
        })) {
          const off = walkOff(tuning, layout, start);
          steps += off.steps;
          if (off.entered) {
            arrive(off.entered);
            break;
          }
          if (off.cleared) {
            cleared = true;
            break;
          }
        }
      }
    } finally {
      activeProfile = previousProfile;
    }
  }
  arrive(startZone(tuning, layout, 1));
  const work: { readonly iterator: Generator<void>; readonly profile: bigint }[] = [];
  // A claimed generator retains every remaining attempt and phase while a new support is explored.
  while (!complete()) {
    const next = priority.shift() ?? (work.length === 0 ? queue.shift() : undefined);
    if (next && !claimed.has(next)) {
      claimed.add(next);
      work.push({
        iterator: expand(next),
        profile: required?.witnesses.profile(next.state) ?? 0n,
      });
    }
    const current = work[work.length - 1];
    if (!current) {
      if (priority.length || queue.length) {
        continue;
      }
      break;
    }
    activeProfile = current.profile;
    if (current.iterator.next().done) {
      work.pop();
    }
  }
  for (const current of work.reverse()) {
    current.iterator.return(undefined);
  }
  return { cleared, reached, steps, surfaces };
}

// Whether, standing on from, he can come to stand on to in one move: any try from any stretch
// of from, at any wait, that first lands him on to.
export function crosses(
  tuning: BirdTuning,
  layout: ZoneLayout,
  surfaces: readonly Surface[],
  from: Surface,
  to: Surface,
): boolean {
  const area = areaOf(layout, from.area);
  const { carry, moving } = movingThings(tuning, area);
  const bounds = moveBounds(tuning, carry);
  const entry = Object.keys(area.entries)[0] ?? "";
  const zone = enterArea(tuning, layout, { area: from.area, entry }, startZone(tuning, layout, 1));
  const target = { key: to.key, left: to.left, right: to.right, surface: to };
  const buckets = Math.ceil((from.right - from.left) / BUCKET);
  return Array.from({ length: buckets }, (_, bucket) => bucket).some((bucket) => {
    const x = Math.min(from.left + bucket * BUCKET + BUCKET / 2, from.right - 1);
    const state = settle(tuning, layout, {
      ...zone,
      bird: { ...zone.bird, vx: 0, vy: 0, x: x - tuning.width / 2, y: from.y - tuning.height },
    });
    const spot = { bucket, state, surface: from };
    const tries = triesToward(tuning, spot, from, target);
    const count = phaseCount(
      WAIT_STEP,
      BUCKET,
      [from.mover, to.mover],
      moving,
      phaseCorridor(tuning, layout, bounds, spot, from, target, tries),
    );
    return waitStates(tuning, layout, state, count).states.some((start) => {
      const trial = trialsFrom(tuning, layout, surfaces, spot, start);
      return tries.some((attempt) => trial.jump(attempt).landed?.surface.key === to.key);
    });
  });
}
