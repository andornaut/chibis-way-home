import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { CHUNKS } from "../data/chunks";
import { TILE } from "../data/screen";
import type { ZoneLayout } from "../data/types";
import { themesOf, zonePlanOf } from "../rules/assemble";
import { STEP_SECONDS } from "../rules/step";
import { zoneLayout } from "../rules/tiles";
import { standsOn, startZone, stepZone } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";

const CASES = [
  { dock: { x: 23 * TILE, y: 40 * TILE }, id: "compound-lift-shuttle", jumpBoard: true },
  { dock: { x: 17 * TILE, y: 40 * TILE }, id: "compound-return-shuttle", jumpBoard: false },
] as const;
function layoutOf(id: string): ZoneLayout {
  const chunk = CHUNKS[id]!;
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, themesOf(chunk)[0]!, 2, [
    id,
  ]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

describe.each(CASES)("authored mover track $id", ({ dock, id, jumpBoard }) => {
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
    const index = area.objects.findIndex(({ character }) => character === "city-shuttle");
    const object = area.objects[index]!;
    let zone = startZone(BIRD, layout, 1);
    let boarded = false,
      carried = 0,
      previousX = zone.bird.x;
    let launched = false;
    for (let tick = 0; tick < 1200 && !zone.cleared && !zone.death; tick++) {
      const at = zone.objects[index]!;
      const on = standsOn(BIRD, zone.bird, { ...at, height: object.height, width: object.width });
      if (on) {
        boarded = true;
      }
      if (boarded && on && !launched && at.x >= object.origin.x + object.behaviour!.distance - 24) {
        launched = true;
      }
      const move = launched
        ? zone.bird.x < (jumpBoard ? 56 : 55) * TILE
          ? 1
          : 0
        : !boarded && !jumpBoard
          ? 1
          : 0;
      const jumpHeld = launched
        ? jumpBoard && zone.bird.x < (jumpBoard ? 56 : 55) * TILE
        : jumpBoard && tick < 40;
      zone = stepZone(BIRD, layout, STEP_SECONDS, { jumpHeld, move, useHeld: false }, zone);
      if (on && !launched) {
        carried += Math.max(0, zone.bird.x - previousX);
      }
      previousX = zone.bird.x;
      if (
        zone.bird.grounded &&
        zone.bird.x >= 56 * TILE &&
        zone.bird.y + BIRD.height === area.solids.at(-1)!.y
      ) {
        expect(boarded).toBe(true);
        expect(carried).toBeGreaterThan(12 * TILE);
        expect(zone.death).toBeUndefined();
        return;
      }
    }
    expect.fail(JSON.stringify({ bird: zone.bird, boarded, carried, death: zone.death, launched }));
  });
});
