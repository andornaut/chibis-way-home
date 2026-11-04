/**
 * Canonical zone-primary assignments and muted ramps. No gameplay content is declared here.
 *
 * Each primary has one muted shade, then joins an existing house-palette ramp. Build writes the
 * minimal runtime assignment object to public/art/zone-themes.json and registers the zone-themes
 * manifest data key. The game resolves each primary token through palette.json for map and
 * progress colours.
 *
 * Usage: node art/tools/zoneThemes.ts build
 * Run from the repository root.
 */

import { commands, run } from "./cli.ts";

export interface Theme {
  primary: string;
  colour: string;
  shade: string;
  end: string;
}

// Route order carries meaning. Materials and atmosphere determine each destination's single primary.
export const THEMES: Readonly<Record<string, Theme>> = {
  "blue-cityscape": { primary: "zone-blue", colour: "a8bfd4", shade: "7d98b4", end: "slate" },
  industrial: { primary: "zone-purple", colour: "b6aecb", shade: "90869f", end: "purple" },
  countryside: { primary: "zone-yellow", colour: "d8c994", shade: "b2a16e", end: "brown" },
  woodland: { primary: "zone-green", colour: "a9bea0", shade: "7c9673", end: "forest" },
  "home-city": { primary: "zone-peach", colour: "d6b39d", shade: "ae8b75", end: "brown" },
  apartment: { primary: "zone-red", colour: "d0a7aa", shade: "aa7d83", end: "dbrown" },
};
export const OUT = "public/art/zone-themes.json";

export function colours(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const theme of Object.values(THEMES)) {
    result[theme.primary] = theme.colour;
    result[`${theme.primary}-shade`] = theme.shade;
  }
  return result;
}

export function ramps(house: Readonly<Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const theme of Object.values(THEMES)) {
    result[theme.colour] = theme.shade;
    const end = house[theme.end];
    if (end === undefined) throw new Error(`Unknown ramp end: ${theme.end}`);
    result[theme.shade] = end;
  }
  return result;
}

function assignments(): Record<string, { primary: string }> {
  return Object.fromEntries(
    Object.entries(THEMES).map(([destination, theme]) => [destination, { primary: theme.primary }]),
  );
}

export async function build(): Promise<void> {
  // pixel.ts reads this module at load time, so it is loaded only when building.
  const pixel = await import("./pixel.ts");
  pixel.writeJson({ sortKeys: true }, OUT, assignments());
  pixel.updateManifest("data", [{ key: "zone-themes", json: "zone-themes.json" }]);
  console.log("built zone themes");
}

if (import.meta.main) run(() => commands({ usage: "Usage: zoneThemes.ts build", build }));
