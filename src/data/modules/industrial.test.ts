import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../../assets";
import { STEP_SECONDS } from "../../core";
import { SKILL_PROFILES } from "../../progress";
import { themesOf } from "../../rules/assemble";
import { composePair } from "../../rules/modules";
import { standsOn } from "../../rules/platformBird";
import { zoneLayout } from "../../rules/tiles";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../../rules/zone";
import { CHUNK_LIBRARY } from "../../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/art";
import { chunkThemePlan } from "../../testing/chunkWalkCases";
import { BIRD } from "../bird";
import { GANTRY_DISTANCE } from "../obstacleBehaviours";
import { OBSTACLE_MOVER_PAUSE, OBSTACLE_MOVER_SPEED } from "../obstacleTuning";
import { REACH } from "../reach";
import { TILE } from "../screen";
import { ZONE_FRAMES } from "../zoneFrames";
import { MODULE_RULES, MODULES, PAIR_GRADES } from ".";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const LEFT = MODULES["crane-lookout"]!;
const RIDE = MODULES["crane-ride"]!;
const LEG_SECONDS = GANTRY_DISTANCE / OBSTACLE_MOVER_SPEED;
const CYCLE_SECONDS = 2 * (LEG_SECONDS + OBSTACLE_MOVER_PAUSE);
// User-approved route-budget exception for the 4 tiles/s crane over the ordinary 600 ticks: the
// lookout and crane pair's route proof measured this many ticks from chunk entry to the exit.
const CRANE_ROUTE_TICKS = 754;

function pair() {
  const composed = composePair(
    { frame: ZONE_FRAMES.industrial, grades: PAIR_GRADES, rules: MODULE_RULES, zone: "industrial" },
    LEFT,
    RIDE,
  );
  const library = {
    ...CHUNK_LIBRARY,
    chunks: { ...CHUNK_LIBRARY.chunks, [composed.id]: composed.chunk },
  };
  const theme = themesOf(composed.chunk)[0]!;
  const plan = chunkThemePlan({ fills: { door: [], event: [] }, theme }, library, composed.chunk);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const crane = area.objects.findIndex(({ character }) => character === "freight-crane-container");
  return { area, chunk: composed.chunk, crane, layout };
}

const f = pair();
const container = f.area.objects[f.crane]!;
const DOCK_X = container.origin.x;
const FAR_X = DOCK_X + GANTRY_DISTANCE * TILE;
const STRIP_X = LEFT.objects[0]!.col * TILE;
const step = (zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const craneX = (zone: ZoneState) => zone.objects[f.crane]!.x;
const docked = (x: number, dock: number) => Math.abs(x - dock) < 0.01;
const lidCentre = (zone: ZoneState) => craneX(zone) + (container.width - ordinary.width) / 2;
const onLid = (zone: ZoneState) =>
  zone.bird.grounded &&
  standsOn(ordinary, zone.bird, {
    ...zone.objects[f.crane]!,
    height: container.height,
    width: container.width,
  });
const toward = (zone: ZoneState, goal: number): ZoneInput => ({
  ...idle,
  move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
});

// From where he stands: right, jumping the lookout's red strip, to the dock's edge; onto the lid's
// centre once the container is docked there, held still across the pit, then off to the right
// once it is docked at the far bank. Decides only from the container's observed position.
function ride(start: ZoneState, limit: number) {
  let zone = start;
  const phases: (string | undefined)[] = [];
  let boarded = false;
  let ticks = 0;
  for (; ticks < limit && !zone.cleared; ticks++) {
    const at = craneX(zone);
    let input: ZoneInput;
    if (!boarded) {
      input = docked(at, DOCK_X) ? toward(zone, lidCentre(zone)) : toward(zone, DOCK_X - 2 * TILE);
      const ahead = STRIP_X - zone.bird.x;
      if (zone.bird.grounded && ahead > TILE && ahead < 4 * TILE) {
        input = { ...input, jumpHeld: true };
      }
      boarded = onLid(zone) && Math.abs(zone.bird.x - lidCentre(zone)) <= 2;
    } else {
      input = docked(at, FAR_X) ? { ...idle, move: 1 } : idle;
    }
    zone = step(zone, input);
    expect(zone.death).toBeUndefined();
    if (boarded && phases.at(-1) !== zone.forcedTransit?.episode?.phase) {
      phases.push(zone.forcedTransit?.episode?.phase);
    }
  }
  return { phases, ticks, zone };
}

describe("crane ride module", () => {
  it("keeps the crane's pit beyond a jump, red-floored, between banks level with the lid", () => {
    const pit = RIDE.solids[1]!.col - RIDE.solids[0]!.cols;
    expect(pit).toBeGreaterThan(REACH.gap);
    expect(RIDE.solids.map(({ row }) => row)).toEqual([RIDE.entry.row, RIDE.exit.row]);
    expect(container.origin.y).toBe(RIDE.entry.row * TILE);
    expect([LEFT.encounters, RIDE.encounters, f.chunk.encounters]).toEqual([0, 0, 0]);
    expect([RIDE.difficulty, f.chunk.difficulty]).toEqual([4, 4]);
  });

  it("boards at the dock pause from chunk entry, rides the forced leg and exits within its budget", () => {
    const { phases, ticks, zone } = ride(startZone(ordinary, f.layout, 1), 2 * CRANE_ROUTE_TICKS);
    expect(zone.cleared).toBe(true);
    expect(phases).toContain("forced");
    console.info("Crane module route ticks", ticks);
    expect(ticks).toBeLessThanOrEqual(CRANE_ROUTE_TICKS);
  });

  it("recovers a missed boarding by waiting on the dock for the container's return", () => {
    let zone = startZone(ordinary, f.layout, 1);
    while (zone.behaviours[f.crane]!.stateKey !== "forward") {
      zone = step(zone, idle);
    }
    let missed = zone;
    for (let tick = 0; tick < 60; tick++) {
      missed = step(missed, idle);
    }
    // On the dock's bank just after the container left it: at most a cycle's wait for its return,
    // then the dock pause, the leg and the step off.
    const bound = CYCLE_SECONDS + OBSTACLE_MOVER_PAUSE + LEG_SECONDS + 0.5;
    const { phases, zone: done } = ride(
      {
        ...missed,
        bird: { ...missed.bird, vx: 0, vy: 0, x: DOCK_X - 3 * TILE, y: missed.bird.y },
      },
      Math.round(bound / STEP_SECONDS),
    );
    expect(done.cleared).toBe(true);
    expect(phases).toContain("forced");
  });
});
