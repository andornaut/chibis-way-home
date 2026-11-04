import type { ZoneMap } from "../data/types";
import { destinationForStage } from "../rules/mapDestinations";

export const ZONE_THEMES_KEY = "zone-themes";
export type ZoneThemes = Readonly<Record<string, { readonly primary: string }>>;

// Debug stages outside the catalogue inherit the starting destination's theme. Role names
// come from art's data and resolve through the ordinary palette at the rendering boundary.
export function zoneTheme(
  map: ZoneMap,
  themes: ZoneThemes,
  stageId: string,
): { readonly primary: string } {
  const known = map.nodes.some(({ id, kind }) => id === stageId && kind === "zone");
  const destination = destinationForStage(map, known ? stageId : map.start);
  const theme = themes?.[destination.id];
  if (typeof theme?.primary !== "string" || theme.primary.length === 0) {
    throw new Error(`Missing primary theme for ${destination.id}`);
  }
  return theme;
}
