import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { AreaLayout, ObjectLayout, Rect } from "../data/types";
import { chunksLayout } from "../testing/encounterLayouts";
import { mapReachable, planMapLeg, pursuitMapMask } from "./behaviourMapPursuit";
import { pursuitGroundMap } from "./movementMaps";

// Archie's arena: Archie on the street at row 80, the overpass deck at cols 26 to 42 meeting the
// top of the three-tile pier at cols 42 to 45, both at row 74, and the eight-tile gantry at cols
// 30 to 38 at row 68.
const layout = chunksLayout("city-boundary", ["arena-dog-city-boundary"]);
const area: AreaLayout = layout.areas.main!;
const archie: ObjectLayout = area.objects.find(({ character }) => character === "dog-antagonist")!;
const entry = pursuitGroundMap(area, archie)!;
const pace = archie.behaviour!.pursuit!.pace!;
const world = { ...entry.terrain.world, groundMap: () => entry };

const PIER = { col: 43, row: 74 } as const;
const GANTRY_ROW = 68;

// Chibi's body standing with his left edge at a column on the support top at a row.
const chibi = (col: number, row: number): Rect => ({
  height: BIRD.height,
  width: BIRD.width,
  x: col * TILE,
  y: row * TILE - BIRD.height,
});

it("takes the map edge up to Chibi's block top, narrower than the boss, beside the ledge", () => {
  const hers = chibi(PIER.col, PIER.row);
  const plan = planMapLeg(world, archie, entry, pace, 1, undefined, archie.origin, hers);
  expect(plan?.leg.kind).toBe("edge");
  const goal = plan!.leg.kind === "edge" ? plan!.leg.goal : undefined;
  expect(goal!.y + goal!.height).toBeCloseTo(PIER.row * TILE);
  expect(mapReachable(world, archie, entry, archie.origin, hers)).toBe(true);
});

it("paces at the reachable spot nearest Chibi when no map node is his", () => {
  // A roof over the deck that the map does not hold, so Chibi stands out of reach on it.
  const roof = { height: TILE, width: 8 * TILE, x: 32 * TILE, y: 20 * TILE };
  const above = { ...world, solids: [...world.solids, roof] };
  const hers = chibi(35, 20);
  expect(mapReachable(above, archie, entry, archie.origin, hers)).toBe(false);
  // Archie on the gantry at row 68, the reachable surface nearest the roof.
  const { body } = entry.map.profile;
  const at = { x: 32 * TILE - body.offset.x, y: GANTRY_ROW * TILE - body.height - body.offset.y };
  const first = planMapLeg(above, archie, entry, pace, 1, undefined, at, hers);
  expect(first?.leg.kind).toBe("pace");
  const end = first!.leg.kind === "pace" ? first!.leg.goal.x : NaN;
  const centre = hers.x + hers.width / 2 - entry.map.profile.body.width / 2;
  expect(Math.abs(end - centre)).toBeLessThanOrEqual(pace.distance / 2 + 1e-6);
  // At that end, the pace turns towards the other end, no farther than the pace distance and
  // within the gantry.
  const there = { ...at, x: end - body.offset.x };
  const turned = planMapLeg(above, archie, entry, pace, 1, first!.state, there, hers);
  const other = turned!.leg.kind === "pace" ? turned!.leg.goal.x : NaN;
  expect(Math.abs(other - end)).toBeGreaterThan(0);
  expect(Math.abs(other - end)).toBeLessThanOrEqual(pace.distance + 1e-6);
  expect(turned!.state.paceDirection).toBe(-first!.state.paceDirection!);
});

it("masks failed edges and never routes pursuit through a climb", () => {
  const plan = planMapLeg(
    world,
    archie,
    entry,
    pace,
    1,
    undefined,
    archie.origin,
    chibi(PIER.col, PIER.row),
  );
  const edge = plan!.leg.kind === "edge" ? plan!.leg.edge : undefined;
  expect(edge).toBeDefined();
  expect(pursuitMapMask(world, entry, []).edge(edge!, 0)).toBe(true);
  expect(pursuitMapMask(world, entry, [edge!]).edge(edge!, 0)).toBe(false);
  expect(entry.map.edges.some(({ kind }) => kind === "climb" || kind === "track-climb")).toBe(
    false,
  );
});
