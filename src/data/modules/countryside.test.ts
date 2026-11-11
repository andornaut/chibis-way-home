import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../../assets";
import { STEP_SECONDS } from "../../core";
import { SKILL_PROFILES } from "../../progress";
import { zonePlanOf } from "../../rules/assemble";
import { composePair } from "../../rules/modules";
import { standsOn } from "../../rules/platformBird";
import { zoneLayout } from "../../rules/tiles";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../../rules/zone";
import { CHUNK_LIBRARY } from "../../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/walkSuite";
import { BIRD } from "../bird";
import { WINDMILL_SAILS } from "../obstacleTuning";
import { REACH } from "../reach";
import { TILE } from "../screen";
import { ZONE_FRAMES } from "../zoneFrames";
import { MODULE_RULES, MODULES, PAIR_GRADES } from ".";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
// User-approved route-budget exception for the 4 tiles/s windmill over the ordinary 600 ticks:
// the lookout and windmill pair's route proof measured this many ticks from chunk entry to the
// exit.
const WINDMILL_ROUTE_TICKS = 936;

const windmill = MODULES.windmill!;
const lookout = MODULES["windmill-lookout"]!;

function fixture() {
  const { chunk, id } = composePair(
    {
      frame: ZONE_FRAMES.countryside,
      grades: PAIR_GRADES,
      rules: MODULE_RULES,
      zone: "countryside",
    },
    lookout,
    windmill,
  );
  const library = { ...CHUNK_LIBRARY, chunks: { ...CHUNK_LIBRARY.chunks, [id]: chunk } };
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "farmland", 2, [id]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const sails = area.objects.flatMap((object, index) =>
    object.character === "windmill-sail-ledge" ? [index] : [],
  );
  const hub = area.objects.find(({ character }) => character === "countryside-windmill")!;
  return { area, chunk, hub, layout, sails };
}

type Fixture = ReturnType<typeof fixture>;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const centre = (rect: { height: number; width: number; x: number; y: number }) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});
// The sail stopped at angle about the hub (0 on the rising side, pi/2 at the bottom), if one is.
function sailAt(f: Fixture, zone: ZoneState, angle: number): number | undefined {
  const pivot = centre({ ...f.hub, ...f.hub.origin });
  const radius = WINDMILL_SAILS.radius * TILE;
  return f.sails.find((sail) => {
    const object = f.area.objects[sail]!;
    const at = centre({ ...zone.objects[sail]!, height: object.height, width: object.width });
    return (
      Math.abs(at.x - pivot.x - radius * Math.cos(angle)) < 0.01 &&
      Math.abs(at.y - pivot.y - radius * Math.sin(angle)) < 0.01
    );
  });
}
const onSail = (f: Fixture, zone: ZoneState, sail: number) => {
  const object = f.area.objects[sail]!;
  return (
    zone.bird.grounded &&
    standsOn(ordinary, zone.bird, {
      ...zone.objects[sail]!,
      height: object.height,
      width: object.width,
    })
  );
};

// From chunk entry: right over the lookout's knoll, to the approach's edge, onto the sail stopped
// at the bottom, held still on it through the quarter turn, then off to the right when it stops
// level with the exit bank. Decides only from the terrain ahead and the sails' observed positions.
function ride(f: Fixture, limit: number) {
  let zone = startZone(ordinary, f.layout, 1);
  const edge = (MODULE_RULES.cols + windmill.solids[0]!.cols) * TILE - ordinary.width - 2;
  let phase: "approach" | "board" | "ride" | "exit" = "approach";
  let sail: number | undefined;
  let jumpUntil = 0;
  let ticks = 0;
  for (; ticks < limit && !zone.cleared; ticks++) {
    let input: ZoneInput = idle;
    if (phase === "approach") {
      const move = Math.abs(edge - zone.bird.x) <= 2 ? 0 : edge > zone.bird.x ? 1 : -1;
      const feet = zone.bird.y + ordinary.height;
      const wall = f.chunk.solids.some(
        ({ col, row }) =>
          move > 0 &&
          row * TILE < feet - 1e-6 &&
          col * TILE > zone.bird.x &&
          col * TILE <= zone.bird.x + ordinary.width + TILE,
      );
      if (zone.bird.grounded && wall && ticks >= jumpUntil) {
        jumpUntil = ticks + 40;
      }
      input = { ...idle, jumpHeld: ticks < jumpUntil, move };
      sail = sailAt(f, zone, Math.PI / 2);
      if (move === 0 && zone.bird.grounded && sail !== undefined) {
        phase = "board";
      }
    }
    if (phase === "board") {
      const object = f.area.objects[sail!]!;
      const goal = zone.objects[sail!]!.x + (object.width - ordinary.width) / 2;
      input = {
        ...idle,
        jumpHeld: !onSail(f, zone, sail!),
        move: Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1,
      };
      if (onSail(f, zone, sail!)) {
        phase = "ride";
      }
    }
    if (phase === "ride" && sailAt(f, zone, 0) === sail) {
      phase = "exit";
    }
    if (phase === "exit") {
      input = { ...idle, move: 1 };
    }
    zone = step(f, zone, input);
    expect(zone.death).toBeUndefined();
  }
  return { ticks, zone };
}

describe("countryside windmill", () => {
  it("stops a sail flush with the exit bank, one within a jump of the approach, and requires the ride", () => {
    const { chunk, hub } = fixture();
    const [approach, trough, plinth, , exit] = windmill.solids;
    // The hub's centre in the windmill module's tiles, and a sail's half size there.
    const pivot = {
      col: (hub.origin.x + hub.width / 2) / TILE - MODULE_RULES.cols,
      row: (hub.origin.y + hub.height / 2) / TILE,
    };
    const sail = CATALOGUE.characters["windmill-sail-ledge"]!;
    // Risen on the rising side: its top level with the exit bank, its right edge at the bank.
    expect(pivot.row - sail.rows / 2).toBe(exit!.row);
    expect(pivot.col + WINDMILL_SAILS.radius + sail.cols / 2).toBe(exit!.col);
    // At the bottom: within a jump up and a gap across from the approach's edge.
    expect(approach!.row - (pivot.row + WINDMILL_SAILS.radius - sail.rows / 2)).toBeLessThanOrEqual(
      REACH.jump,
    );
    expect(pivot.col - sail.cols / 2 - approach!.cols).toBeLessThan(REACH.gap);
    // The exit bank is beyond a jump from the approach; the trough climbs back to it.
    expect(approach!.row - exit!.row).toBeGreaterThan(REACH.jump);
    expect(trough!.row - approach!.row).toBeLessThanOrEqual(REACH.jump);
    // The plinth stands on its step: the hub's footprint ends within the step's top row.
    const base = (hub.origin.y + hub.height) / TILE;
    expect(base - plinth!.row).toBeGreaterThanOrEqual(0);
    expect(base - plinth!.row).toBeLessThan(1);
    expect(chunk.encounters).toBe(0);
  });

  it("boards the sail stopped at the bottom, rides it up and exits within its recorded budget", () => {
    const f = fixture();
    const { ticks, zone } = ride(f, 3 * WINDMILL_ROUTE_TICKS);
    expect(zone.cleared).toBe(true);
    console.info("Countryside windmill pair route ticks", ticks);
    expect(ticks).toBeLessThanOrEqual(WINDMILL_ROUTE_TICKS);
  });
});
