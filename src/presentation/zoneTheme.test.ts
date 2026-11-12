import { describe, expect, it } from "vitest";

import themeData from "../../public/art/zone-themes.json" with { type: "json" };
import { ZONE_MAP } from "../data/map.ts";
import { zoneTheme, type ZoneThemes } from "./zoneTheme.ts";

const THEMES = themeData as ZoneThemes;

describe("zone progress themes", () => {
  it.each(ZONE_MAP.destinations)(
    "shares $id's primary across every catalogued stage",
    (destination) => {
      for (const stage of destination.stages) {
        const actual = zoneTheme(ZONE_MAP, THEMES, stage);
        const context = `${destination.id}/${stage}`;
        expect(actual, context).toEqual(THEMES[destination.id]);
        expect(actual.primary, context).toBeTruthy();
      }
    },
  );
  it("uses the starting destination for non-catalogued debug stages", () => {
    expect(zoneTheme(ZONE_MAP, THEMES, "test:3")).toEqual(
      zoneTheme(ZONE_MAP, THEMES, ZONE_MAP.start),
    );
  });
  it("rejects absent art theme data instead of substituting a second colour table", () => {
    expect(() => zoneTheme(ZONE_MAP, {}, ZONE_MAP.start)).toThrow("Missing primary theme");
  });
});
