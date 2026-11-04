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
  const { dash, ...withoutDash } = BIRD;
  void dash;
  const ordinary = { ...withoutDash, doubleJump: false };
  const initial = startZone(ordinary, layout, 1);
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
    zone = stepZone(ordinary, layout, STEP_SECONDS, control(zone, tick), zone);
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
  it.each([
    {
      chunk: "vertical-red-gate",
      face: "red-edge-left",
      from: { col: 27, row: 50 },
      jumpHeld: false,
      name: "a mistimed gate crossing to its moving red face",
    },
    {
      chunk: "overjump-low-roof",
      face: "red-edge-bottom",
      from: { col: 16, row: 50 },
      jumpHeld: true,
      name: "a full-hold overjump to the actual ceiling underside",
    },
  ])("attributes $name", ({ chunk, face: expected, from, jumpHeld }) => {
    expect(face(run(chunk, from, () => input(1, jumpHeld)))).toBe(expected);
  });
  it.each([20, 38])("lands a missed crossing at column %s on its physical red floor", (col) => {
    const result = run("guarded-valley", { col, row: 45 }, () => input(0));
    expect(face(result)).toBe("red-edge-top");
    const area = result.layout.areas[result.zone.area]!;
    const contact = result.zone.death!.contact!;
    if (contact.kind !== "object") {
      throw new Error("Expected floor contact");
    }
    const hazard = area.objects[contact.index]!;
    const box = hazard.hitbox!;
    const bottom = hazard.origin.y + box.y + box.height;
    expect(
      area.solids.some(
        (solid) =>
          solid.y === bottom &&
          solid.x <= result.zone.bird.x &&
          solid.x + solid.width >= result.zone.bird.x + BIRD.width,
      ),
    ).toBe(true);
    expect(foot(result.zone)).toBeLessThan(area.height);
  });
  it("clears the valley over its refuge with ordinary jumps", () => {
    const targets = [
      { col: 14, row: 45 },
      { col: 30, row: 45 },
      { col: 44, row: 45 },
      { col: 54, row: 40 },
    ];
    let phase = 0;
    let jumpAt: number | undefined;
    let release = false;
    const result = run("guarded-valley", { col: 2, row: 40 }, (zone, tick) => {
      const target = targets[phase];
      if (!target) {
        return input(1);
      }
      if (
        zone.bird.grounded &&
        foot(zone) === target.row * TILE &&
        zone.bird.x >= target.col * TILE - 1
      ) {
        phase++;
        jumpAt = undefined;
        release = true;
        return input(0);
      }
      if (release) {
        release = false;
        return input(0);
      }
      if (phase > 0) {
        jumpAt ??= tick;
      }
      return input(
        zone.bird.x < target.col * TILE ? 1 : 0,
        jumpAt !== undefined && (tick - jumpAt) * STEP_SECONDS < BIRD.jumpRiseTime,
      );
    });
    expect(phase).toBe(targets.length);
    expect(result.zone.death).toBeUndefined();
    expect(result.zone.cleared).toBe(true);
  });
  it("allows deliberate reverse jumps back through both entry refuges", () => {
    let phase = 0;
    let phaseTick = 0;
    const result = run(
      "guarded-valley",
      { col: 30, row: 45 },
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
