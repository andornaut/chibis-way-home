import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { createHazardChunks } from "../data/hazardChunks";
import { TILE } from "../data/screen";
import type { TilePoint } from "../data/types";
import { zonePlanOf } from "../rules/assemble";
import { chunkProblems } from "../rules/chunk";
import { STEP_SECONDS } from "../rules/step";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";

const chunks = createHazardChunks("street");
const library = { ...CHUNK_LIBRARY, chunks };
function prepared(id: string) {
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, "street", 2, [id]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}
function run(
  id: string,
  from: TilePoint,
  control: (zone: ZoneState, tick: number) => ZoneInput,
  finished: (zone: ZoneState) => boolean = (zone) => zone.cleared,
) {
  const layout = prepared(id);
  const initial = startZone(BIRD, layout, 1);
  let zone: ZoneState = {
    ...initial,
    bird: {
      ...initial.bird,
      grounded: true,
      vx: 0,
      vy: 0,
      x: from.col * TILE,
      y: from.row * TILE - BIRD.height,
    },
  };
  for (let tick = 0; tick < 600 && !zone.death && !zone.turnedBack && !finished(zone); tick++) {
    zone = stepZone(BIRD, layout, STEP_SECONDS, control(zone, tick), zone);
  }
  return { layout, zone };
}
const input = (move: -1 | 0 | 1, jumpHeld = false): ZoneInput => ({
  jumpHeld,
  move,
  useHeld: false,
});
function face(result: ReturnType<typeof run>) {
  expect(result.zone.death?.reason).toBe("hazard");
  const contact = result.zone.death?.contact;
  expect(contact?.kind).toBe("object");
  if (contact?.kind !== "object") {
    throw new Error("Missing authoritative object contact");
  }
  return result.layout.areas[result.zone.area]!.objects[contact.index]!.character;
}
const foot = (zone: ZoneState) => zone.bird.y + BIRD.height;

describe("directional hazard layouts", () => {
  it("reaches both vertical endpoints and returns without crossing terrain", () => {
    const ys: number[] = [];
    const mover = Object.values(prepared("vertical-red-gate").areas)[0]!.objects.findIndex(
      (object) => object.character === "red-edge-left",
    );
    const result = run(
      "vertical-red-gate",
      { col: 2, row: 50 },
      (zone) => {
        ys.push(zone.objects[mover]!.y);
        return input(0);
      },
      () => false,
    );
    expect(result.zone.death).toBeUndefined();
    expect(Math.min(...ys)).toBeCloseTo(34 * TILE);
    expect(Math.max(...ys)).toBeCloseTo(44 * TILE);
    const upper = ys.findIndex((y) => Math.abs(y - 34 * TILE) < 0.01);
    expect(upper).toBeGreaterThan(0);
    expect(ys.slice(upper + 1).some((y) => Math.abs(y - 44 * TILE) < 0.01)).toBe(true);
  });
  it("clears the vertical gate after observing its raised phase", () => {
    let crossing = false;
    const mover = Object.values(prepared("vertical-red-gate").areas)[0]!.objects.findIndex(
      (object) => object.character === "red-edge-left",
    );
    const result = run("vertical-red-gate", { col: 26, row: 50 }, (zone) => {
      crossing ||= zone.objects[mover]!.y <= 36 * TILE;
      return input(crossing ? 1 : 0);
    });
    expect(result.zone.death).toBeUndefined();
    expect(result.zone.cleared).toBe(true);
  });
  it("attributes a mistimed gate crossing to its moving red face", () => {
    expect(face(run("vertical-red-gate", { col: 27, row: 50 }, () => input(1)))).toBe(
      "red-edge-left",
    );
  });

  it("keeps challenge families inside ordinary chunk and seam contracts", () => {
    for (const chunk of Object.values(chunks)) {
      expect(chunkProblems(library, CATALOGUE, chunk)).toEqual([]);
    }
  });
  it("clears the low roof with a short press over its step", () => {
    let jumpAt: number | undefined;
    const result = run("overjump-low-roof", { col: 2, row: 50 }, (zone, tick) => {
      if (jumpAt === undefined && zone.bird.x >= 16 * TILE) {
        jumpAt = tick;
      }
      return input(
        1,
        jumpAt !== undefined && (tick - jumpAt) * STEP_SECONDS < BIRD.jumpTapWindow / 2,
      );
    });
    expect(result.zone.death).toBeUndefined();
    expect(result.zone.cleared).toBe(true);
  });
  it("attributes a full-hold overjump to the actual ceiling underside", () => {
    expect(face(run("overjump-low-roof", { col: 16, row: 50 }, () => input(1, true)))).toBe(
      "red-edge-bottom",
    );
  });
  it.each([
    { character: "red-edge-left", col: 32, move: 1 as const },
    { character: "red-edge-right", col: 28, move: -1 as const },
  ])("attributes ground overrun to $character", ({ character, col, move }) => {
    expect(face(run("guarded-valley", { col, row: 50 }, () => input(move)))).toBe(character);
  });
  it("clears the valley with braking and both five-tile exit climbs", () => {
    let phase = 0;
    let phaseTick = 0;
    let exitJumpTick: number | undefined;
    const bank = chunks["guarded-valley"]!.solids!.filter((solid) => solid.row === 45).sort(
      (a, b) => b.col - a.col,
    )[0]!;
    const takeoff = bank.col * TILE - BIRD.walkSpeed * BIRD.jumpRiseTime;
    const result = run("guarded-valley", { col: 2, row: 40 }, (zone, tick) => {
      if (phase === 0 && zone.bird.grounded && foot(zone) === 45 * TILE) {
        phase = 1;
        phaseTick = tick;
      } else if (
        phase === 1 &&
        tick > phaseTick &&
        zone.bird.grounded &&
        foot(zone) === 50 * TILE
      ) {
        phase = 2;
        phaseTick = tick;
      } else if (
        phase === 2 &&
        tick > phaseTick &&
        zone.bird.grounded &&
        foot(zone) === 45 * TILE
      ) {
        phase = 3;
        phaseTick = tick;
      }
      if (phase === 0) {
        return input(zone.bird.x < 14 * TILE ? 1 : 0);
      }
      if (phase === 2 && exitJumpTick === undefined && zone.bird.x >= takeoff) {
        exitJumpTick = tick;
      }
      const hold = phase === 1 ? BIRD.jumpTapWindow / 2 : BIRD.jumpRiseTime;
      const move =
        phase === 1
          ? zone.bird.x < 32 * TILE
            ? 1
            : 0
          : phase === 2
            ? zone.bird.x < 44 * TILE
              ? 1
              : 0
            : 1;
      const jumpTick = phase === 2 ? exitJumpTick : phaseTick;
      return input(move, jumpTick !== undefined && (tick - jumpTick) * STEP_SECONDS < hold);
    });
    expect(phase).toBe(3);
    expect(result.zone.death).toBeUndefined();
    expect(result.zone.cleared).toBe(true);
  });
  it("allows deliberate reverse jumps back through both entry refuges", () => {
    let phase = 0;
    let phaseTick = 0;
    const result = run(
      "guarded-valley",
      { col: 26, row: 50 },
      (zone, tick) => {
        if (phase === 0 && tick > 0 && zone.bird.grounded && foot(zone) === 45 * TILE) {
          phase = 1;
          phaseTick = tick;
        }
        const target = phase === 0 ? 14 : 8;
        return input(
          zone.bird.x > target * TILE ? -1 : 0,
          (tick - phaseTick) * STEP_SECONDS < BIRD.jumpRiseTime,
        );
      },
      (zone) => zone.bird.grounded && foot(zone) === 40 * TILE && zone.bird.x < 12 * TILE,
    );
    expect(result.zone.death).toBeUndefined();
    expect(result.zone.turnedBack).toBe(false);
    expect(foot(result.zone)).toBe(40 * TILE);
    expect(result.zone.bird.grounded).toBe(true);
  });
});
