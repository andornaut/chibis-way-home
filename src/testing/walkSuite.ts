// The zone walk's checks on one zone plan, for the walk tests: it clears at its right edge, it
// reaches every
// surface it does not mark out of reach and none it does, and no no-cross pair is crossed.
import { beforeAll, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { ARCHETYPES } from "../data/archetypes";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { TILE } from "../data/screen";
import type { TilePoint, ZoneLayout, ZonePlan } from "../data/types";
import { zoneLayout } from "../rules/tiles";
import { crosses, type Surface, surfaceAt, walkZone, type ZoneWalk } from "../sim/zoneWalk";
import { artHitboxes, type ArtManifest, sheetFrameSize } from "../view/aseprite";
import { BIRD_FRAME } from "../view/bird";
import type { Tileset } from "../view/tiles";

const SHEETS = import.meta.glob<{
  readonly frames: Readonly<Record<string, { readonly sourceSize: { w: number; h: number } }>>;
}>("../../public/art/sprites/*.json", { eager: true, import: "default" });
export const HITBOXES = artHitboxes(
  (key) => sheetFrameSize(SHEETS[`../../public/art/sprites/${key}.json`] ?? { frames: {} }),
  manifestJson as ArtManifest,
);
export const CATALOGUE = { archetypes: ARCHETYPES, characters: CHARACTERS };
// Art's tilesets by key.
export const TILESETS: Readonly<Record<string, Tileset>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<Tileset>("../../public/art/tilesets/*.json", {
      eager: true,
      import: "default",
    }),
  ).map(([path, tileset]) => [path.replace(/^.*\/(.*)\.json$/, "$1"), tileset]),
);
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
    it("marks out of reach only surfaces she never reaches", () => {
      const wrong = marks.filter(({ area, spot }) => {
        const surface = surfaceAt(TILE, walk.surfaces, area, spot);
        return surface === undefined || walk.reached.has(surface.key);
      });
      expect(wrong.map(({ area, spot }) => spotName(area, spot))).toEqual([]);
    });
  }

  if (areas.some(([, area]) => (area.noCross?.length ?? 0) > 0)) {
    it(
      "can't be crossed at a no-cross spot in one move",
      () => {
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
