import { assertNever } from "@andornaut/game-kit/assertNever";

import type {
  AreaLayout,
  BirdTuning,
  Point,
  Reaches,
  Rect,
  TileRect,
  ZoneLayout,
  ZonePlan,
} from "../data/types";
import { STEP_SECONDS } from "../rules/step";
import { tileRect, zoneLayout } from "../rules/tiles";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../rules/zone";
import { BIRD_FRAME } from "../view/bird";

export type Reach = keyof Reaches;

// Each check plays a tile zone on the real rules: ground whose top is row GROUND_ROW, RUN_UP
// tiles of it before the ledge or gap, and room above for the tallest ledge tried.
const GROUND_ROW = 40;
const RUN_UP = 40;
const FAR_SIDE = 20;
// The largest reach tried, in tiles, and how long a try may take before it counts as missed.
const MAX_TILES = 60;
const MAX_STEPS = Math.round(10 / STEP_SECONDS);
// Steps she stands still first, so every try starts from her standing on the ground.
const SETTLE_STEPS = 2;
const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };

// One try: the zone, the solid she must land on top of, and her input for each step given the
// state so far.
interface Course {
  readonly input: (zone: ZoneState) => ZoneInput;
  readonly layout: ZoneLayout;
  readonly target: Rect;
}

const ground = (cols: number) => ({ col: 0, cols, row: GROUND_ROW, rows: 2 });

// One area of terrain, with nothing in it, where she starts at start (her box's bottom centre).
// It never clears, so she runs on past its right edge until the measure ends.
function courseLayout(tile: number, cols: number, solids: TileRect[], start: Point): ZoneLayout {
  const plan: ZonePlan = {
    areas: {
      course: {
        cols,
        entries: { start: { col: 0, row: 0 } },
        objects: [],
        rows: GROUND_ROW + 2,
        solids,
      },
    },
    start: { area: "course", entry: "start" },
  };
  const layout = zoneLayout(
    tile,
    BIRD_FRAME,
    { archetypes: {}, characters: {} },
    {},
    {},
    new Set(),
    plan,
  );
  const area = layout.areas.course as AreaLayout;
  return {
    ...layout,
    areas: { course: { ...area, backX: -Infinity, entries: { start }, exitX: Infinity } },
  };
}

// A ledge tiles high, just right of where she stands still. She walks right, holding Jump for
// jumpSteps from the first step she moves.
function ledgeCourse(tuning: BirdTuning, tile: number, tiles: number, jumpSteps: number): Course {
  const ledge = { col: RUN_UP, cols: FAR_SIDE, row: GROUND_ROW - tiles, rows: tiles };
  const target = tileRect(tile, ledge);
  return {
    input: (zone) =>
      zone.steps < SETTLE_STEPS
        ? STILL
        : { jumpHeld: zone.steps < SETTLE_STEPS + jumpSteps, move: 1, useHeld: false },
    layout: courseLayout(tile, RUN_UP + FAR_SIDE, [ground(RUN_UP + FAR_SIDE), ledge], {
      x: target.x - tuning.width / 2,
      y: GROUND_ROW * tile,
    }),
    target,
  };
}

// A gap tiles wide between two runs of ground at the same height. She runs right from a
// standstill and presses Jump, holding it, press steps after the last step she stands on the
// near edge (the step after which, without a jump, she would no longer stand on it): before it
// for a negative press, in coyote time for a positive one.
function gapCourse(tuning: BirdTuning, tile: number, tiles: number, press: number): Course {
  const near = ground(RUN_UP);
  const far = { ...ground(FAR_SIDE), col: RUN_UP + tiles };
  const layout = courseLayout(tile, RUN_UP + tiles + FAR_SIDE, [near, far], {
    x: 2 * tile,
    y: GROUND_ROW * tile,
  });
  const run: ZoneInput = { jumpHeld: false, move: 1, useHeld: false };
  const runOn = (zone: ZoneState) => (zone.steps < SETTLE_STEPS ? STILL : run);
  let last = startZone(tuning, layout, 1);
  while (
    last.death === undefined &&
    (last.steps < SETTLE_STEPS || stepZone(tuning, layout, STEP_SECONDS, run, last).bird.grounded)
  ) {
    last = stepZone(tuning, layout, STEP_SECONDS, runOn(last), last);
  }
  return {
    input: (zone) => (zone.steps < last.steps + press ? runOn(zone) : { ...run, jumpHeld: true }),
    layout,
    target: tileRect(tile, far),
  };
}

// The press timings tried, in steps from the gap course's last step on the edge: from as many
// steps before it as coyote time lasts, through a step past the end of coyote time. The press
// that makes the farthest gap may come at any of them. A ledge's height does not depend on when
// she presses, standing on the ground, so it has one timing.
export function pressTimings(tuning: BirdTuning, reach: Reach): number[] {
  if (reach !== "gap") {
    return [0];
  }
  const window = Math.ceil(tuning.coyoteTime / STEP_SECONDS);
  return Array.from({ length: 2 * window + 2 }, (_, i) => i - window);
}

function course(
  tuning: BirdTuning,
  tile: number,
  reach: Reach,
  tiles: number,
  press: number,
): Course {
  switch (reach) {
    case "hop":
      // The shortest press: the smallest jump she can make.
      return ledgeCourse(tuning, tile, tiles, 1);
    case "jump":
      return ledgeCourse(tuning, tile, tiles, MAX_STEPS);
    case "gap":
      return gapCourse(tuning, tile, tiles, press);
    default:
      return assertNever(reach);
  }
}

// Whether she makes a reach of tiles with Jump pressed at the press timing given (see
// pressTimings): she stands on top of the ledge or the far side before a restart or the time runs
// out.
function makesWith(
  tuning: BirdTuning,
  tile: number,
  reach: Reach,
  tiles: number,
  press: number,
): boolean {
  const { input, layout, target: solid } = course(tuning, tile, reach, tiles, press);
  let zone = startZone(tuning, layout, 1);
  while (zone.steps < MAX_STEPS && zone.restarts === 0 && zone.death === undefined) {
    zone = stepZone(tuning, layout, STEP_SECONDS, input(zone), zone);
    const { bird } = zone;
    const onTop = Math.abs(bird.y + tuning.height - solid.y) < 1e-6;
    const over = bird.x + tuning.width > solid.x && bird.x < solid.x + solid.width;
    if (bird.grounded && onTop && over) {
      return true;
    }
  }
  return false;
}

// Whether she makes a reach of tiles at any of its press timings.
export function makes(tuning: BirdTuning, tile: number, reach: Reach, tiles: number): boolean {
  return pressTimings(tuning, reach).some((press) => makesWith(tuning, tile, reach, tiles, press));
}

// The largest reach of each kind she makes, at any press timing, in tiles, or 0.
export function measureReaches(tuning: BirdTuning, tile: number): Reaches {
  const largest = (reach: Reach) => {
    let best = 0;
    for (let tiles = 1; tiles <= MAX_TILES; tiles++) {
      if (makes(tuning, tile, reach, tiles)) {
        best = tiles;
      }
    }
    return best;
  };
  return { gap: largest("gap"), hop: largest("hop"), jump: largest("jump") };
}
