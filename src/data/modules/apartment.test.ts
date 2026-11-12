import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../../assets/index.ts";
import { STEP_SECONDS } from "../../core/index.ts";
import { SKILL_PROFILES } from "../../progress/index.ts";
import { themesOf } from "../../rules/assemble.ts";
import { startBird } from "../../rules/bird.ts";
import { composePair } from "../../rules/modules.ts";
import { standsOn } from "../../rules/platformBird.ts";
import { zoneLayout } from "../../rules/tiles.ts";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../../rules/zone.ts";
import { CHUNK_LIBRARY } from "../../rules/zonePlans.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/art.ts";
import { chunkThemePlan } from "../../testing/chunkWalkCases.ts";
import { BIRD } from "../bird.ts";
import { CHANDELIER_SWING } from "../obstacleTuning.ts";
import { REACH } from "../reach.ts";
import { TILE } from "../screen.ts";
import type { Rect } from "../types/index.ts";
import { ZONE_FRAMES } from "../zoneFrames.ts";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "./index.ts";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const LEFT = MODULES["chandelier-approach"]!;
const SWING = MODULES["chandelier-swing"]!;
// User-approved route-budget exception for the 4 tiles/s chandelier over the ordinary 600 ticks:
// the approach and chandelier pair's route proof measured this many ticks from chunk entry to the
// exit.
const CHANDELIER_ROUTE_TICKS = 903;

function pair() {
  const composed = composePair(
    { frame: ZONE_FRAMES.apartment, grades: PAIR_GRADES, rules: MODULE_RULES, zone: "apartment" },
    LEFT,
    SWING,
  );
  const library = {
    ...CHUNK_LIBRARY,
    chunks: { ...CHUNK_LIBRARY.chunks, [composed.id]: composed.chunk },
  };
  const theme = themesOf(composed.chunk)[0]!;
  const plan = chunkThemePlan({ fills: { door: [], event: [] }, theme }, library, composed.chunk);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const chandelier = area.objects.findIndex(
    ({ character }) => character === "apartment-chandelier",
  );
  return { area, chandelier, chunk: composed.chunk, layout };
}

const f = pair();
const rim = f.area.objects[f.chandelier]!;
const [nearBank, step, lower, farBank, beam] = SWING.solids.map((solid) => ({
  ...solid,
  col: solid.col + MODULE_RULES.cols,
}));
const BANK_TOP = nearBank!.row * TILE;
const NEAR_RIGHT = (nearBank!.col + nearBank!.cols) * TILE;
const FAR_LEFT = farBank!.col * TILE;
const STRIP_X = LEFT.objects[0]!.col * TILE;
const stepZ = (zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const rimRect = (zone: ZoneState): Rect => ({
  ...zone.objects[f.chandelier]!,
  height: rim.height,
  width: rim.width,
});
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
// Holding at the near end (flush left of the gap) or the far end (flush right of it).
const atNear = (zone: ZoneState) =>
  near(rimRect(zone).x, NEAR_RIGHT) && near(rimRect(zone).y, BANK_TOP);
const atFar = (zone: ZoneState) =>
  near(rimRect(zone).x + rim.width, FAR_LEFT) && near(rimRect(zone).y, BANK_TOP);
const toward = (zone: ZoneState, goal: number): ZoneInput => ({
  ...idle,
  move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
});
const feet = (zone: ZoneState) => zone.bird.y + ordinary.height;
const onRim = (zone: ZoneState) =>
  zone.bird.grounded && standsOn(ordinary, zone.bird, rimRect(zone));
const rimCentre = (zone: ZoneState) => rimRect(zone).x + (rim.width - ordinary.width) / 2;

// From where he stands: right, jumping the approach's red strip, or left from under the arc,
// jumping against each step and wall back up onto the near bank; along it to its edge, onto the
// chandelier once it holds at the near end, held still on it through the swing, then off to the
// right once it holds at the far end. Decides only from the chandelier's observed position.
function ride(start: ZoneState, limit: number) {
  let zone = start;
  let phase: "approach" | "board" | "climb" | "ride" | "exit" = "approach";
  let carried = 0;
  const edge = NEAR_RIGHT - ordinary.width - 2;
  let ticks = 0;
  for (; ticks < limit && !zone.cleared; ticks++) {
    let input: ZoneInput = idle;
    if (phase !== "climb" && zone.bird.grounded && !onRim(zone) && feet(zone) > BANK_TOP) {
      phase = "climb";
    }
    if (phase === "climb") {
      input = { ...idle, jumpHeld: ticks % 40 < 30, move: -1 };
      if (zone.bird.grounded && feet(zone) === BANK_TOP && zone.bird.x < NEAR_RIGHT) {
        phase = "approach";
      }
    }
    if (phase === "approach") {
      input = toward(zone, edge);
      const ahead = STRIP_X - zone.bird.x;
      if (zone.bird.grounded && ahead > TILE && ahead < 4 * TILE) {
        input = { ...input, jumpHeld: true };
      }
      if (zone.bird.grounded && Math.abs(zone.bird.x - edge) <= 2 && atNear(zone)) {
        phase = "board";
      }
    }
    if (phase === "board") {
      input = toward(zone, rimCentre(zone));
      if (onRim(zone) && input.move === 0) {
        phase = "ride";
      }
    }
    if (phase === "ride") {
      input = idle;
      if (atFar(zone)) {
        phase = "exit";
      }
    }
    if (phase === "exit") {
      input = { ...idle, move: 1 };
    }
    const before = zone.objects[f.chandelier]!;
    zone = stepZ(zone, input);
    expect(zone.death).toBeUndefined();
    if (phase === "ride" && onRim(zone)) {
      const after = zone.objects[f.chandelier]!;
      carried += Math.hypot(after.x - before.x, after.y - before.y);
    }
  }
  return { carried, ticks, zone };
}

const SPAN = 2 * CHANDELIER_SWING.length * Math.sin(CHANDELIER_SWING.amplitude) * TILE;

describe("chandelier swing module", () => {
  it("climbs back from a miss in less than a jump, keeps the ride required and stays quiet", () => {
    expect(step!.row - nearBank!.row).toBeLessThan(REACH.jump);
    expect(lower!.row - step!.row).toBeLessThanOrEqual(REACH.hop);
    expect(lower!.row - farBank!.row).toBeGreaterThan(REACH.jump);
    expect(farBank!.col - (step!.col + step!.cols)).toBeGreaterThan(REACH.gap);
    // The beam covers the chain's whole sweep, above the mount.
    const reach = CHANDELIER_SWING.length * Math.sin(CHANDELIER_SWING.amplitude);
    const pivot = f.area.objects.find(
      ({ character }) => character === "apartment-chandelier-mount",
    )!;
    const pivotX = pivot.origin.x + pivot.width / 2;
    expect(beam!.col * TILE).toBeLessThanOrEqual(pivotX - reach * TILE);
    expect((beam!.col + beam!.cols) * TILE).toBeGreaterThanOrEqual(pivotX + reach * TILE);
    expect((beam!.row + beam!.rows) * TILE).toBeLessThanOrEqual(pivot.origin.y);
    expect([LEFT.encounters, SWING.encounters, f.chunk.encounters]).toEqual([0, 0, 0]);
    expect([SWING.difficulty, f.chunk.difficulty]).toEqual([4, 4]);
  });

  it("boards at the near hold from chunk entry, rides across and exits within its budget", () => {
    const { carried, ticks, zone } = ride(
      startZone(ordinary, f.layout, 1),
      2 * CHANDELIER_ROUTE_TICKS,
    );
    expect(zone.cleared).toBe(true);
    expect(carried).toBeGreaterThan(SPAN - 1);
    console.info("Chandelier module route ticks", ticks);
    expect(ticks).toBeLessThanOrEqual(CHANDELIER_ROUTE_TICKS);
  });

  it.each([
    ["step", step!.col + 1, step!.row],
    ["floor", lower!.col + 9, lower!.row],
  ])(
    "rejoins the ride from the %s under the arc by climbing back onto the near bank",
    (_, col, row) => {
      const start = startZone(ordinary, f.layout, 1);
      const fallen = { ...start, bird: startBird(ordinary, { x: col * TILE, y: row * TILE }) };
      const { carried, zone } = ride(fallen, 4 * CHANDELIER_ROUTE_TICKS);
      expect(zone.cleared).toBe(true);
      expect(carried).toBeGreaterThan(SPAN - 1);
    },
  );
});
