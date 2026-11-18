import { ZONE_MAP } from "../data/map.ts";
import { TEXT } from "../data/text.ts";

export interface CheatZone {
  readonly id: string;
  readonly label: string;
  readonly stages: readonly { readonly id: string; readonly label: string }[];
}

// The stages Load stage offers, by zone in map order: every catalogued stage with a zone to play,
// each named as the map names it.
export function cheatStages(): readonly CheatZone[] {
  return ZONE_MAP.destinations
    .map((zone) => ({
      id: zone.id,
      label: TEXT.map.zones[zone.id] ?? zone.id,
      stages: zone.stages
        .filter((id) =>
          ZONE_MAP.nodes.some(
            (node) => node.id === id && node.kind === "zone" && node.zone !== undefined,
          ),
        )
        .map((id) => ({ id, label: TEXT.map.stages[id] ?? id })),
    }))
    .filter((zone) => zone.stages.length > 0);
}
