import { BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";
import { describe, expect, it } from "vitest";

import { TEXT_BUTTON } from "../../data/layout.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { SCREEN, TILE } from "../../data/screen.ts";
import { MAP_ACTIONS } from "../input/mapInput.ts";
import { destinationCentre } from "../map/mapDestinations.ts";
import { type PressArea, pressedArea } from "./hitAreas.ts";
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
  const areas: PressArea<string>[] = MAP_ACTIONS.map((key) => ({
    art: MAP_SCREEN[key].button,
    hit: MAP_SCREEN[key].hit,
    key,
  }));

  it.each(MAP_ACTIONS)("keeps %s at the standard height and above the view bottom", (key) => {
    const button = MAP_SCREEN[key].button;
    expect(button.height).toBe(TEXT_BUTTON.height);
    expect(button.y + button.height).toBeLessThanOrEqual(SCREEN.height);
  });

  it("puts Back to title left and Continue right in one centred row", () => {
    const { continue: go, home } = MAP_SCREEN;
    expect(home.button.x + home.button.width + BUTTON_GAP).toBe(go.button.x);
    expect(home.button.width).toBe(go.button.width);
    expect((home.button.x + go.button.x + go.button.width) / 2).toBe(SCREEN.width / 2);
    expect(home.button.y).toBe(go.button.y);
  });

  it.each(areas)("takes all corners of $key as the intended action", ({ art, key }) => {
    expect(
      [
        { x: art.x, y: art.y },
        { x: art.x + art.width - 1, y: art.y + art.height - 1 },
      ].map((point) => pressedArea(areas, point)),
    ).toEqual([key, key]);
  });

  it.each(ZONE_MAP.destinations)(
    "keeps destination $id and its label above the footer",
    (destination) => {
      const centre = destinationCentre(TILE, destination);
      const label = mapLabel({ height: 0, width: 0, x: 0, y: 0 }, centre);
      expect(label.knockout.y + label.knockout.height).toBeLessThan(MAP_SCREEN.home.button.y);
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
    expect(at.y + height).toBeLessThan(MAP_SCREEN.home.button.y);
  });
});
