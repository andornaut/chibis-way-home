import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { AreaLayout, ObjectLayout, Rect } from "../data/types";
import { chunksLayout } from "../testing/encounterLayouts";
import { mapReachable, planMapLeg, pursuitMapMask } from "./behaviourMapPursuit";
import { pursuitGroundMap } from "./movementMaps";

// The late patrol yard: Archie on the floor at row 50, a ledge at cols 42 to 48 meeting the top
// of a four-tile block at cols 48 to 52, both at row 44.
const layout = chunksLayout("city-streets", ["patrol-cover-late"]);
const area: AreaLayout = layout.areas.main!;
const archie: ObjectLayout = area.objects.find(({ character }) => character === "dog-antagonist")!;
const entry = pursuitGroundMap(area, archie)!;
const pace = archie.behaviour!.pursuit!.pace!;
const world = { ...entry.terrain.world, groundMap: () => entry };

// Chibi's body standing with his left edge at a column on the support top at a row.
const chibi = (col: number, row: number): Rect => ({
  height: BIRD.height,
  width: BIRD.width,
  x: col * TILE,
  y: row * TILE - BIRD.height,
});

it("takes the map edge up to Chibi's block top, narrower than the boss, beside the ledge", () => {
  const hers = chibi(49, 44);
  const plan = planMapLeg(world, archie, entry, pace, 1, undefined, archie.origin, hers);
  expect(plan?.leg.kind).toBe("edge");
  const goal = plan!.leg.kind === "edge" ? plan!.leg.goal : undefined;
  expect(goal!.y + goal!.height).toBeCloseTo(44 * TILE);
  expect(mapReachable(world, archie, entry, archie.origin, hers)).toBe(true);
});

it("paces at the reachable spot nearest Chibi when no map node is his", () => {
  // A roof over the yard that the map does not hold, so Chibi stands out of reach on it.
  const roof = { height: TILE, width: 8 * TILE, x: 41 * TILE, y: 20 * TILE };
  const above = { ...world, solids: [...world.solids, roof] };
  const hers = chibi(44, 20);
  expect(mapReachable(above, archie, entry, archie.origin, hers)).toBe(false);
  // Archie on the ledge at row 44, the reachable surface nearest the roof.
  const { body } = entry.map.profile;
  const at = { x: 44 * TILE - body.offset.x, y: 44 * TILE - body.height - body.offset.y };
  const first = planMapLeg(above, archie, entry, pace, 1, undefined, at, hers);
  expect(first?.leg.kind).toBe("pace");
  const end = first!.leg.kind === "pace" ? first!.leg.goal.x : NaN;
  const centre = hers.x + hers.width / 2 - entry.map.profile.body.width / 2;
  expect(Math.abs(end - centre)).toBeLessThanOrEqual(pace.distance / 2 + 1e-6);
  // At that end, the pace turns towards the other end.
  const there = { ...at, x: end - body.offset.x };
  const turned = planMapLeg(above, archie, entry, pace, 1, first!.state, there, hers);
  const other = turned!.leg.kind === "pace" ? turned!.leg.goal.x : NaN;
  expect(Math.abs(other - end)).toBeCloseTo(pace.distance);
  expect(turned!.state.paceDirection).toBe(-first!.state.paceDirection!);
});

it("masks failed edges and never routes pursuit through a climb", () => {
  const plan = planMapLeg(world, archie, entry, pace, 1, undefined, archie.origin, chibi(49, 44));
  const edge = plan!.leg.kind === "edge" ? plan!.leg.edge : undefined;
  expect(edge).toBeDefined();
  expect(pursuitMapMask(world, entry, []).edge(edge!, 0)).toBe(true);
  expect(pursuitMapMask(world, entry, [edge!]).edge(edge!, 0)).toBe(false);
  expect(entry.map.edges.some(({ kind }) => kind === "climb" || kind === "track-climb")).toBe(
    false,
  );
});
