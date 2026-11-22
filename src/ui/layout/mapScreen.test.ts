import { describe, expect, it } from "vitest";

import { TEXT_BUTTON } from "../../data/layout.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { SCREEN, TILE } from "../../data/screen.ts";
import { destinationCentre } from "../map/mapDestinations.ts";
import { MAP_SCREEN, mapLabel } from "./mapScreen.ts";

describe("mapLabel", () => {
  it("centres supplied native ink under its marker", () => {
    const centre = { x: 300, y: 150 };
    const ink = { height: 16, width: 80, x: -2, y: 3 };
    const { knockout, origin } = mapLabel(ink, centre);
    expect(origin.x + ink.x + ink.width / 2).toBe(centre.x);
    expect(origin.y + ink.y + ink.height / 2).toBe(knockout.y + knockout.height / 2);
    expect(knockout.x).toBeLessThan(origin.x + ink.x);
    expect(knockout.x + knockout.width).toBeGreaterThan(origin.x + ink.x + ink.width);
  });
});

describe("map footer actions", () => {
  it("reserves standard action height above the view bottom", () => {
    expect(MAP_SCREEN.actionY + TEXT_BUTTON.height).toBeLessThanOrEqual(SCREEN.height);
  });

  it.each(ZONE_MAP.destinations)(
    "keeps destination $id and its label above the footer",
    (destination) => {
      const centre = destinationCentre(TILE, destination);
      const label = mapLabel({ height: 0, width: 0, x: 0, y: 0 }, centre);
      expect(label.knockout.y + label.knockout.height).toBeLessThan(MAP_SCREEN.actionY);
    },
  );

  const frames = import.meta.glob<{ frames: Record<string, { frame: { h: number } }> }>(
    "../../../public/art/sprites/map-region-*.json",
    {
      eager: true,
      import: "default",
    },
  );
  it.each(ZONE_MAP.decorations)("keeps $art scenery above the footer", ({ art, at }) => {
    const sheet = frames[`../../../public/art/sprites/${art}.json`];
    expect(sheet).toBeDefined();
    const height = Object.values(sheet!.frames)[0]!.frame.h;
    expect(at.y + height).toBeLessThan(MAP_SCREEN.actionY);
  });
});
