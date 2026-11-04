import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { CHUNKS } from "../data/chunks";
import { TILE } from "../data/screen";
import type { ZoneLayout } from "../data/types";
import { themesOf, zonePlanOf } from "../rules/assemble";
import { zoneLayout } from "../rules/tiles";
import { standsOn, startZone, stepZone } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";

const CASES = ["compound-lift-shuttle", "compound-return-shuttle"] as const;
const ORDINARY_JUMP = { ...BIRD, doubleJump: false };
function layoutOf(id: string): ZoneLayout {
  const chunk = CHUNKS[id]!;
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, themesOf(chunk)[0]!, 2, [
    id,
  ]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

describe.each(CASES)("authored mover track %s", (id) => {
  it("visits both endpoints and reverses through a complete collision-aware cycle", () => {
    const layout = layoutOf(id);
    const area = layout.areas[layout.start.area]!;
    const index = area.objects.findIndex(({ character }) => character === "city-shuttle");
    const object = area.objects[index]!;
    let zone = startZone(BIRD, layout, 1);
    let min = Infinity,
      max = -Infinity;
    const directions = new Set<string>();
    for (let tick = 0; tick < 1800; tick++) {
      zone = stepZone(
        BIRD,
        layout,
        STEP_SECONDS,
        { jumpHeld: false, move: 0, useHeld: false },
        zone,
      );
      expect(zone.death).toBeUndefined();
      min = Math.min(min, zone.objects[index]!.x);
      max = Math.max(max, zone.objects[index]!.x);
      directions.add(zone.behaviours[index]!.stateKey);
    }
    expect(min).toBeCloseTo(object.origin.x, 6);
    expect(max).toBeCloseTo(object.origin.x + object.behaviour!.distance, 6);
    expect(directions).toContain("forward");
    expect(directions).toContain("back");
    expect(directions).toContain("wait-far");
    expect(directions).toContain("wait-near");
  });

  it("boards from its authored dock, rides and transfers onto the far landing", () => {
    const base = layoutOf(id);
    const area = base.areas[base.start.area]!;
    const index = area.objects.findIndex(({ character }) => character === "city-shuttle");
    const object = area.objects[index]!;
    const endpoint = object.origin.x + object.behaviour!.distance;
    const near = area.solids
      .filter((solid) => solid.x + solid.width <= object.origin.x)
      .sort((a, b) => b.x + b.width - a.x - a.width)[0];
    const far = area.solids
      .filter((solid) => solid.x >= endpoint + object.width)
      .sort((a, b) => a.x - b.x)[0];
    if (!near || !far) {
      throw new Error("Expected authored shuttle approach and landing banks");
    }
    const dock = { x: near.x + near.width - BIRD.width / 2, y: near.y };
    const landingX = far.x + (far.width - BIRD.width) / 2;
    const shortBoard = near.y - object.origin.y <= BIRD.jumpHopHeight;
    const boardHoldSeconds = shortBoard ? BIRD.jumpTapWindow / 2 : BIRD.jumpRiseTime;
    const jumpTransfer = far.y < object.origin.y;
    const layout = {
      ...base,
      areas: {
        ...base.areas,
        [base.start.area]: {
          ...area,
          entries: { ...area.entries, [base.start.entry]: dock },
          exitX: area.width,
        },
      },
    };
    let zone = startZone(ORDINARY_JUMP, layout, 1);
    let boarded = false,
      carried = 0,
      previousX = zone.bird.x;
    let launched = false;
    let boardAt: number | undefined;
    let launchAt = 0;
    let previousHostX = object.origin.x;
    for (let tick = 0; tick < 1200 && !zone.cleared && !zone.death; tick++) {
      const at = zone.objects[index]!;
      const on = standsOn(BIRD, zone.bird, { ...at, height: object.height, width: object.width });
      if (on) {
        boarded = true;
      }
      if (boarded && on && !launched && at.x >= endpoint) {
        launched = true;
        launchAt = tick;
      }
      // Level boarding waits for the returning near-dock approach, retaining a full outbound ride.
      if (
        boardAt === undefined &&
        (!shortBoard || (at.x < previousHostX && at.x <= object.origin.x + object.width / 2))
      ) {
        boardAt = tick;
      }
      const target = launched ? landingX : at.x + (object.width - BIRD.width) / 2;
      const move =
        launched || (!boarded && boardAt !== undefined) ? (zone.bird.x < target ? 1 : 0) : 0;
      const jumpHeld = launched
        ? jumpTransfer && (tick - launchAt) * STEP_SECONDS < BIRD.jumpRiseTime
        : !boarded && boardAt !== undefined && (tick - boardAt) * STEP_SECONDS < boardHoldSeconds;
      previousHostX = at.x;
      zone = stepZone(
        ORDINARY_JUMP,
        layout,
        STEP_SECONDS,
        { jumpHeld, move, useHeld: false },
        zone,
      );
      if (on && !launched) {
        carried += Math.max(0, zone.bird.x - previousX);
      }
      previousX = zone.bird.x;
      if (
        zone.bird.grounded &&
        launched &&
        zone.bird.x >= far.x &&
        zone.bird.x + BIRD.width <= far.x + far.width &&
        zone.bird.y + BIRD.height === far.y
      ) {
        expect(boarded).toBe(true);
        expect(carried).toBeGreaterThan(12 * TILE);
        expect(zone.death).toBeUndefined();
        expect(zone.bird.dash?.remainingSeconds ?? 0).toBe(0);
        return;
      }
    }
    expect.fail(JSON.stringify({ bird: zone.bird, boarded, carried, death: zone.death, launched }));
  });
});
