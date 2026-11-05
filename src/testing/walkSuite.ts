import { beforeAll, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { TilePoint, ZoneLayout, ZonePlan } from "../data/types";
import { zoneLayout } from "../rules/tiles";
import {
  crosses,
  type RequiredRouteWalk,
  type Surface,
  surfaceAt,
  walkRequiredRoutes,
  type WalkRouteQuery,
  walkZone,
  type ZoneWalk,
} from "../sim/zoneWalk";
import { CATALOGUE, HITBOXES, TILESETS } from "./art";

export { CATALOGUE, HITBOXES, TILESETS };
// The walk takes seconds on a large zone.
export const WALK_MS = 120_000;

const named = (surface: Surface) =>
  `${surface.area} cols ${surface.left / TILE}-${surface.right / TILE} row ${surface.y / TILE}${
    surface.mover === undefined ? "" : " (moving)"
  }`;
const spotName = (area: string, spot: TilePoint) => `${area} col ${spot.col} row ${spot.row}`;

// Registers the walk's checks on plan, inside the caller's describe.
export function walkSuite(plan: ZonePlan): void {
  let layout: ZoneLayout;
  let walk: ZoneWalk;
  const areas = Object.entries(plan.areas);
  const marks = areas.flatMap(([area, { outOfReach = [] }]) =>
    outOfReach.map((spot) => ({ area, spot })),
  );

  beforeAll(() => {
    layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
    walk = walkZone(BIRD, layout);
  }, WALK_MS);

  it("clears at its right edge, walked from the start", () => {
    expect(walk.cleared).toBe(true);
  });

  it("reaches every surface it does not mark out of reach", () => {
    const marked = new Set(
      marks.flatMap(({ area, spot }) => surfaceAt(TILE, walk.surfaces, area, spot)?.key ?? []),
    );
    const unreached = walk.surfaces.filter(
      (surface) => !walk.reached.has(surface.key) && !marked.has(surface.key),
    );
    expect(unreached.map(named)).toEqual([]);
  });

  if (marks.length > 0) {
    it("marks out of reach only surfaces he never reaches", () => {
      const wrong = marks.filter(({ area, spot }) => {
        const surface = surfaceAt(TILE, walk.surfaces, area, spot);
        return surface === undefined || walk.reached.has(surface.key);
      });
      expect(wrong.map(({ area, spot }) => spotName(area, spot))).toEqual([]);
    });
  }

  noCrossSuite(() => ({ layout, walk }), plan);
}

function noCrossSuite(
  context: () => { readonly layout: ZoneLayout; readonly walk: ZoneWalk },
  plan: ZonePlan,
): void {
  const areas = Object.entries(plan.areas);
  if (areas.some(([, area]) => (area.noCross?.length ?? 0) > 0)) {
    it(
      "can't be crossed at a no-cross spot in one move",
      () => {
        const { layout, walk } = context();
        const crossed = areas.flatMap(([area, { noCross = [] }]) =>
          noCross.flatMap(({ from, to }) => {
            const start = surfaceAt(TILE, walk.surfaces, area, from);
            const end = surfaceAt(TILE, walk.surfaces, area, to);
            const pair = `${spotName(area, from)} to ${spotName(area, to)}`;
            if (!start || !end) {
              return [`${pair}: not both surfaces`];
            }
            return crosses(BIRD, layout, walk.surfaces, start, end) ? [pair] : [];
          }),
        );
        expect(crossed).toEqual([]);
      },
      WALK_MS,
    );
  }
}

// Required-route completion includes only actual entry-connected witnesses, not optional surfaces.
export function requiredWalkSuite(query: WalkRouteQuery, plan: ZonePlan): void {
  let walk: RequiredRouteWalk;
  let layout: ZoneLayout;
  beforeAll(() => {
    layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
    walk = walkRequiredRoutes(BIRD, query, layout);
  }, 180_000);
  it("clears from entry through every declared required route target", () => {
    expect(walk.complete, JSON.stringify({ cleared: walk.cleared, targets: query.targets })).toBe(
      true,
    );
  });
  noCrossSuite(() => ({ layout, walk }), plan);
}
