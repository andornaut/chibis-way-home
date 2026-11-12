import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../../assets/index.ts";
import { STEP_SECONDS } from "../../core/index.ts";
import { SKILL_PROFILES } from "../../progress/index.ts";
import { zonePlanOf } from "../../rules/assemble.ts";
import { startBird } from "../../rules/bird.ts";
import { composePair } from "../../rules/modules.ts";
import { zoneLayout } from "../../rules/tiles.ts";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../../rules/zone.ts";
import { CHUNK_LIBRARY } from "../../rules/zonePlans.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/walkSuite.ts";
import { BIRD } from "../bird.ts";
import { CHUNK_RULES } from "../chunks.ts";
import { GUST_SECONDS } from "../obstacleBehaviours.ts";
import { RAVINE_GUST_PULSE } from "../obstacleTuning.ts";
import { TILE } from "../screen.ts";
import { ZONE_FRAMES } from "../zoneFrames.ts";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "./index.ts";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const ROUTE_TICKS = 600;
const CYCLE_TICKS = Math.round(
  (GUST_SECONDS.calm + GUST_SECONDS.warning + GUST_SECONDS.gust) / STEP_SECONDS,
);

const ravine = MODULES["gust-ravine"]!;
const lookout = MODULES["ravine-lookout"]!;

function fixture() {
  const { chunk, id } = composePair(
    { frame: ZONE_FRAMES.woodland, grades: PAIR_GRADES, rules: MODULE_RULES, zone: "woodland" },
    lookout,
    ravine,
  );
  const library = { ...CHUNK_LIBRARY, chunks: { ...CHUNK_LIBRARY.chunks, [id]: chunk } };
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "forest-paths", 2, [id]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const emitter = area.objects.findIndex(({ character }) => character === "woodland-gust-emitter");
  return { area, chunk, emitter, layout };
}

type Fixture = ReturnType<typeof fixture>;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const stateOf = (f: Fixture, zone: ZoneState) =>
  zone.behaviours[f.emitter]?.stateKey ?? f.area.objects[f.emitter]!.behaviour!.initial;
// A module tile in the composed chunk's pixels, the ravine filling the right half.
const px = (col: number) => (MODULE_RULES.cols + col) * TILE;

// Chibi standing still at module col, feet on row, through the area's first gust: how far it
// moves him.
function gustShift(f: Fixture, col: number, row: number): number {
  let zone = startZone(ordinary, f.layout, 1);
  zone = { ...zone, bird: startBird(ordinary, { x: px(col), y: row * TILE - ordinary.height }) };
  for (let tick = 0; tick < CYCLE_TICKS && stateOf(f, zone) !== "gust"; tick++) {
    zone = step(f, zone, idle);
  }
  const x = zone.bird.x;
  for (let tick = 0; tick < Math.round(GUST_SECONDS.gust / STEP_SECONDS) / 2; tick++) {
    zone = step(f, zone, idle);
    expect(zone.death).toBeUndefined();
  }
  return zone.bird.x - x;
}

describe("woodland gust ravine", () => {
  it("blows a 21-tile band left from the emitter, 4 cols clear of both module edges", () => {
    const f = fixture();
    const emitter = f.area.objects[f.emitter]!;
    expect(emitter.behaviour?.facing).toBe(-1);
    const gust = Object.values(emitter.behaviour!.states).flatMap(({ onEnter }) => onEnter ?? []);
    expect(gust).toEqual([expect.objectContaining({ kind: "force-pulse", range: 21 * TILE })]);
    const left = emitter.origin.x - RAVINE_GUST_PULSE.range * TILE;
    expect(left).toBeGreaterThanOrEqual(px(CHUNK_RULES.footing));
    expect(emitter.origin.x + emitter.width).toBeLessThanOrEqual(
      px(MODULE_RULES.cols - CHUNK_RULES.footing),
    );
    expect(f.chunk.encounters).toBe(0);
  });

  it("pushes Chibi on a post top and leaves him still behind a post", () => {
    const f = fixture();
    // Post tops at row 77 (cols 10 and 16); the pocket left of the second post at row 82.
    expect(gustShift(f, 16, 77)).toBeLessThan(-TILE);
    expect(gustShift(f, 14, 82)).toBe(0);
  });

  it("waits behind the first post for a calm, crosses the posts and exits within the route budget", () => {
    const f = fixture();
    const edge = px(ravine.solids[0]!.cols) - ordinary.width - 2;
    let zone = startZone(ordinary, f.layout, 1);
    let jumpUntil = 0;
    let sawGust = false;
    let crossing = false;
    let ticks = 0;
    for (; ticks < ROUTE_TICKS && !zone.cleared; ticks++) {
      const state = stateOf(f, zone);
      if (!crossing && Math.abs(zone.bird.x - edge) <= 2 && zone.bird.grounded) {
        sawGust ||= state !== "calm";
        crossing = sawGust && state === "calm";
      }
      const goal = crossing ? Infinity : edge;
      const move = Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1;
      // Jump at a wall or a drop just ahead.
      const feet = zone.bird.y + ordinary.height;
      const ahead = zone.bird.x + ordinary.width + TILE / 2;
      const under = f.chunk.solids.find(
        ({ col, cols }) => col * TILE <= ahead && (col + cols) * TILE > ahead,
      );
      const blocked = under !== undefined && under.row * TILE !== feet;
      if (move > 0 && zone.bird.grounded && blocked && ticks >= jumpUntil) {
        jumpUntil = ticks + 30;
      }
      zone = step(f, zone, { ...idle, jumpHeld: ticks < jumpUntil, move });
      expect(zone.death).toBeUndefined();
    }
    expect(zone.cleared).toBe(true);
    expect(sawGust).toBe(true);
    console.info("Woodland gust ravine pair route ticks", ticks);
    expect(ticks).toBeLessThanOrEqual(ROUTE_TICKS);
  });
});
